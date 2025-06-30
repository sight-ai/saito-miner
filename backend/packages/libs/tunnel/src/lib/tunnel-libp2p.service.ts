import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { TunnelMessage } from '@saito/models';
import { MessageSendError } from './errors/connection.error';
import { UnknownMessageTypeError } from './errors/unknown-message-type.error';
import {
  TUNNEL_EVENTS,
  TunnelConnectionEstablishedEvent,
  TunnelConnectionLostEvent,
  TunnelDeviceRegisteredEvent,
  TunnelMessageFailedEvent,
  TunnelMessageReceivedEvent,
  TunnelMessageSentEvent,
} from './events';
import { KEYPAIR_EVENTS, KeyPairReadyEvent } from './events/keypair.events';
import { MessageGateway } from './message-gateway/message-gateway.interface';
import { MessageHandlerRegistry } from './message-handler/message-handler.registry';
import { TunnelMessageListener, TunnelService } from './tunnel.interface';
import { GLOBAL_PEER_ID_PROVIDER } from './tunnel.module';

let globalKeyPair: Uint8Array;

// 导出函数供外部使用
export function getGlobalKeyPair(): Uint8Array | undefined {
  return globalKeyPair;
}

export function isKeyPairReady(): boolean {
  return !!globalKeyPair;
}

// export async function startLibp2pNodeManually(): Promise<void> {
//   if (!globalKeyPair) {
//     throw new Error('KeyPair not ready. Please wait for KeyPair ready event.');
//   }

//   console.log('🚀 Starting LibP2P node manually...');
//   console.log('⚠️  LibP2P implementation is currently disabled/commented out');
//   console.log('✅ KeyPair is ready and available for LibP2P initialization');
//   return startLibp2pNode()
// }

// async function startLibp2pNode() {
//   const IS_GATEWAY = Number(process.env['IS_GATEWAY']) === 1;
//   const LIBP2P_PORT = Number(process.env['LIBP2P_PORT'] || 4010);
//   const NODE_PORT = Number(process.env['NODE_PORT'] || 15050);
//   const API_PORT = Number(process.env['API_PORT'] || 8716);
//   const BOOTSTRAP_ADDRS = process.env['BOOTSTRAP_ADDRS'] || '';
//   const bootstrapList = BOOTSTRAP_ADDRS.split(',')
//     .map(addr => addr.trim())
//     .filter(Boolean);
//   const seed = getGlobalKeyPair()
//   const nacl = await import('tweetnacl');
//   const keyPair = nacl.sign.keyPair.fromSeed(seed!);

//   const options = {
//     expressPort: LIBP2P_PORT,
//     nodePort: NODE_PORT,
//     keyPair,
//     tunnelAPI: `http://localhost:${API_PORT}/libp2p/message`,
//     isGateway: IS_GATEWAY,
//     bootstrapList,
//   };

//   const { startLibP2PServer } = await import('./libp2p/libp2p.bundle.js');
//   startLibP2PServer(options);
// }

@Injectable()
export class TunnelServiceLibp2pImpl implements TunnelService {
  private readonly logger = new Logger(TunnelServiceLibp2pImpl.name);

  node_id: string = '';
  gatewayUrl: string = '';
  socket: any = undefined; // 兼容性属性，无需实际赋值

  private listeners: TunnelMessageListener[] = [];

  // 存储已连接的设备
  private connectedDevices: Set<string> = new Set<string>();

  // 存储任务处理器
  private streamHandlers: Map<string, (message: any) => Promise<void>> =
    new Map();
  private noStreamHandlers: Map<string, (message: any) => Promise<any>> =
    new Map();

  // 存储设备与任务的映射关系
  private deviceTaskMap: Map<string, Set<string>> = new Map();

  constructor(
    private readonly handlerRegistry: MessageHandlerRegistry,
    @Inject('MessageGatewayLibp2p')
    private readonly messageGateway: MessageGateway,
    @Inject('PEER_ID') private peerId: string,
    private readonly eventEmitter: EventEmitter2,
    // @Inject(forwardRef(() => 'KEY_PAIR')) private readonly seed: Uint8Array,
  ) {
    // libp2p 场景下无 socket，直接设置 gateway 回调
    this.setupMessageGatewayCallbacks();
    // globalKeyPair = seed;
  }

  /**
   * 监听 KeyPair 准备就绪事件
   */
  @OnEvent(KEYPAIR_EVENTS.KEYPAIR_READY)
  handleKeyPairReady(event: KeyPairReadyEvent) {
    this.logger.log('🔑 Received KeyPair ready event');
    globalKeyPair = event.keyPair;
    this.logger.log('✅ Global KeyPair has been set for tunnel module');
  }

  /**
   * 手动启动 LibP2P 节点
   */
  // async startLibp2p(): Promise<void> {
  //   if (!globalKeyPair) {
  //     throw new Error('KeyPair not set. Please ensure KeyPair ready event has been fired.');
  //   }

  //   this.logger.log('🚀 Starting LibP2P node...');
  //   this.logger.warn('⚠️  LibP2P implementation is currently disabled/commented out');
  //   this.logger.log('✅ KeyPair is ready and available for LibP2P initialization');

  //   // TODO: Uncomment and implement actual LibP2P startup when ready
  //   return startLibp2pNode();
  // }

  /**
   * 处理消息
   */
  async handleMessage(
    message: TunnelMessage,
    listener?: TunnelMessageListener,
  ): Promise<void> {
    this.logger.log(`🔍 当前设备ID (peerId): ${this.peerId}`);
    this.logger.log(`📨 消息目标: ${message.to}, 消息来源: ${message.from}`);
    this.logger.log(`🔄 消息类型: ${message.type}`);

    if (message.from === message.to) {
      this.logger.debug('忽略自发自收消息');
      return;
    }

    try {
      // 发射消息接收事件
      this.eventEmitter.emit(
        TUNNEL_EVENTS.MESSAGE_RECEIVED,
        new TunnelMessageReceivedEvent(message),
      );

      // 使用注入的peerId
      if (message.to === this.peerId) {
        this.logger.log(`✅ 消息目标匹配，处理入站消息`);
        await this.handleIncomeMessage(message, listener);
      } else if (message.from === this.peerId) {
        this.logger.log(`📤 消息来源匹配，处理出站消息`);
        await this.handleOutcomeMessage(message, listener);
      } else {
        this.logger.warn(
          `❌ 忽略与设备ID不匹配的消息 - 当前设备: ${this.peerId}, 消息路径: ${message.from} -> ${message.to}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `消息处理失败: ${error instanceof Error ? error.message : '未知错误'}`,
      );

      // 发射消息处理失败事件
      this.eventEmitter.emit(
        TUNNEL_EVENTS.MESSAGE_FAILED,
        new TunnelMessageFailedEvent(
          message,
          error instanceof Error ? error : new Error('未知错误'),
        ),
      );

      throw error;
    }
  }

  /**
   * 发送消息到网关
   */
  async sendMessage(message: TunnelMessage): Promise<void> {
    try {
      await this.messageGateway.sendMessage(message);
      // 发射消息发送成功事件
      this.eventEmitter.emit(
        TUNNEL_EVENTS.MESSAGE_SENT,
        new TunnelMessageSentEvent(message),
      );
    } catch (error) {
      this.logger.error(
        `发送消息失败: ${error instanceof Error ? error.message : '未知错误'}`,
      );
      this.eventEmitter.emit(
        TUNNEL_EVENTS.MESSAGE_FAILED,
        new TunnelMessageFailedEvent(
          message,
          error instanceof Error ? error : new Error('发送消息失败'),
        ),
      );
      throw new MessageSendError('发送消息失败', message);
    }
  }

  /**
   * 设置MessageGateway回调
   */
  private setupMessageGatewayCallbacks(): void {
    this.messageGateway.onMessage((message: TunnelMessage) => {
      this.handleMessage(message).catch(error => {
        this.logger.error(
          `处理接收到的消息失败: ${
            error instanceof Error ? error.message : '未知错误'
          }`,
        );
      });
    });

    this.messageGateway.onConnectionChange((connected: boolean) => {
      if (connected) {
        this.logger.log('与网关连接已建立');
      } else {
        this.logger.warn('与网关连接已断开');
      }
    });

    this.messageGateway.onError((error: Error) => {
      this.logger.error(`MessageGateway错误: ${error.message}`);
    });
  }

  /**
   * 处理入站消息
   */
  private async handleIncomeMessage(
    message: TunnelMessage,
    listener?: TunnelMessageListener,
  ): Promise<void> {
    await this.triggerListener(message);

    const handler = this.handlerRegistry.getIncomeHandler(message.type);
    if (!handler) {
      this.logger.error(`Cannot handle income message ${message.type}`);
      throw new UnknownMessageTypeError(message.type, 'income');
    }
    await handler.handleMessage(message);

    // 在最后添加监听器以避免自触发
    if (listener) {
      this.listeners.push(listener);
    }
  }

  /**
   * 处理出站消息
   */
  private async handleOutcomeMessage(
    message: TunnelMessage,
    listener?: TunnelMessageListener,
  ): Promise<void> {
    await this.triggerListener(message);

    const handler = this.handlerRegistry.getOutcomeHandler(message.type);
    if (!handler) {
      this.logger.error(`Cannot handle outcome message ${message.type}`);
      throw new UnknownMessageTypeError(message.type, 'outcome');
    }
    await handler.handleMessage(message);

    // 在最后添加监听器以避免自触发
    if (listener) {
      this.listeners.push(listener);
    }
  }

  /**
   * 触发监听器
   */
  private async triggerListener(message: TunnelMessage) {
    const remaining: TunnelMessageListener[] = [];

    for (const _listener of this.listeners) {
      const isMatch = _listener.match(message);

      if (isMatch) {
        _listener.callback(message);

        const shouldRemove = _listener.once?.(message) ?? false;
        if (!shouldRemove) {
          remaining.push(_listener);
        }
      } else {
        remaining.push(_listener);
      }
    }

    this.listeners = remaining;
  }

  /** 兼容性空实现部分 —— 全部无需任何实际 socket 逻辑，仅为保留接口 **/

  async createConnection(
    gatewayAddress: string,
    _code?: string,
    _basePath?: string,
  ): Promise<void> {
    // 只更新状态，发事件，完全不用 socket
    this.gatewayUrl = gatewayAddress;
    this.logger.log(
      `libp2p模式，忽略实际连接，仅记录 gatewayUrl: ${gatewayAddress}`,
    );
    this.eventEmitter.emit(
      TUNNEL_EVENTS.CONNECTION_ESTABLISHED,
      new TunnelConnectionEstablishedEvent(
        this.peerId || 'unknown',
        gatewayAddress,
      ),
    );
  }

  async connect(node_id: string): Promise<void> {
    this.node_id = node_id;
    this.peerId = node_id;
    GLOBAL_PEER_ID_PROVIDER.setPeerId(node_id);
    this.logger.log(`libp2p模式设备注册: ${node_id}`);
    this.eventEmitter.emit(
      TUNNEL_EVENTS.DEVICE_REGISTERED,
      new TunnelDeviceRegisteredEvent(node_id, node_id),
    );
  }

  async disconnect(): Promise<void> {
    this.logger.log('libp2p模式下断开连接，状态清理');
    this.eventEmitter.emit(
      TUNNEL_EVENTS.CONNECTION_LOST,
      new TunnelConnectionLostEvent(this.peerId, 'Manual disconnect'),
    );
    this.connectedDevices.clear();
    this.streamHandlers.clear();
    this.noStreamHandlers.clear();
    this.deviceTaskMap.clear();
    this.listeners = [];
  }

  async getConnectedDevices(): Promise<string[]> {
    return Array.from(this.connectedDevices);
  }

  async isDeviceConnected(deviceId: string): Promise<boolean> {
    return this.connectedDevices.has(deviceId);
  }

  isConnected(): boolean {
    return this.messageGateway.isConnected();
  }

  async waitForConnection(timeoutMs: number = 10000): Promise<boolean> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      if (this.isConnected()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return false;
  }

  setupSocketListeners(): void {
    this.logger.debug('setupSocketListeners called (libp2p兼容性空实现)');
  }

  handleDisconnect(): void {
    this.logger.warn('handleDisconnect called (libp2p兼容性空实现)');
  }
}
