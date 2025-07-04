import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IncomeBaseMessageHandler } from '../base-message-handler';
import { TunnelMessage, DeviceRegisterAckMessage, DeviceRegisterAckMessageSchema } from '@saito/models';
import { MessageHandler } from '../message-handler.decorator';
import { TUNNEL_EVENTS, TunnelDeviceStatusUpdateRequestEvent } from '../../events';

/**
 * 设备注册确认消息处理器
 * 
 * 处理接收到的设备注册确认消息，通常来自网关
 */
@MessageHandler({ type: 'device_register_ack', direction: 'income' })
@Injectable()
export class IncomeDeviceRegisterAckHandler extends IncomeBaseMessageHandler {
  private readonly logger = new Logger(IncomeDeviceRegisterAckHandler.name);

  constructor(
    @Inject('PEER_ID') private readonly injectedPeerId: string,
    private readonly eventEmitter: EventEmitter2
  ) {
    super();
  }

  protected override get peerId(): string {
    return this.injectedPeerId;
  }

  /**
   * 处理入站设备注册确认消息
   */
  async handleIncomeMessage(message: TunnelMessage): Promise<void> {
    this.logger.debug(`收到设备注册确认消息: ${JSON.stringify(message)}`);

    // 验证消息格式
    const parseResult = DeviceRegisterAckMessageSchema.safeParse(message);
    if (!parseResult.success) {
      this.logger.error(`设备注册确认消息格式无效: ${parseResult.error.message}`);
      return;
    }

    const deviceRegisterAckMessage = parseResult.data as DeviceRegisterAckMessage;
    
    try {
      // 处理设备注册确认
      await this.processDeviceRegisterAck(deviceRegisterAckMessage);
      
    } catch (error) {
      this.logger.error(`处理设备注册确认消息失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 处理设备注册确认
   */
  private async processDeviceRegisterAck(message: DeviceRegisterAckMessage): Promise<void> {
    const { success, deviceId, message: ackMessage, error } = message.payload;
    
    if (success) {
      this.logger.log(`✅ 设备注册确认成功 - DeviceID: ${deviceId}`);
      if (ackMessage) {
        this.logger.debug(`确认消息: ${ackMessage}`);
      }
      
      // 这里可以添加注册成功后的处理逻辑
      // 例如：
      // 1. 更新本地设备状态
      // 2. 启动心跳服务
      // 3. 记录注册成功事件
      // 4. 通知其他服务
      
      await this.handleRegistrationSuccess(deviceId, ackMessage);
      
    } else {
      this.logger.error(`❌ 设备注册确认失败 - DeviceID: ${deviceId}`);
      if (error) {
        this.logger.error(`错误信息: ${error}`);
      }
      
      // 处理注册失败
      await this.handleRegistrationFailure(deviceId, error);
    }
  }

  /**
   * 处理注册成功
   */
  private async handleRegistrationSuccess(deviceId: string, message?: string): Promise<void> {
    this.logger.log(`处理设备注册成功 - DeviceID: ${deviceId}`);

    // 记录注册成功时间
    const registrationTime = Date.now();
    this.logger.debug(`设备注册成功时间: ${new Date(registrationTime).toISOString()}`);

    try {
      // 发射设备状态更新请求事件
      this.eventEmitter.emit(
        TUNNEL_EVENTS.DEVICE_STATUS_UPDATE_REQUEST,
        new TunnelDeviceStatusUpdateRequestEvent(
          deviceId,
          'connected',
          `Device registration successful: ${message || 'No additional message'}`
        )
      );

      this.logger.log(`✅ 已发射设备状态更新事件 - 注册成功`);
      this.logger.log(`✅ 注册成功后处理完成 - 心跳由设备状态服务管理`);
    } catch (error) {
      this.logger.error(`注册成功后处理失败:`, error);
    }
  }

  /**
   * 处理注册失败
   */
  private async handleRegistrationFailure(deviceId: string, error?: string): Promise<void> {
    this.logger.error(`处理设备注册失败 - DeviceID: ${deviceId}, Error: ${error || '未知错误'}`);

    // 记录注册失败时间
    const failureTime = Date.now();
    this.logger.debug(`设备注册失败时间: ${new Date(failureTime).toISOString()}`);

    try {
      // 发射设备状态更新请求事件
      this.eventEmitter.emit(
        TUNNEL_EVENTS.DEVICE_STATUS_UPDATE_REQUEST,
        new TunnelDeviceStatusUpdateRequestEvent(
          deviceId,
          'failed',
          `Device registration failed: ${error || '未知错误'}`
        )
      );

      this.logger.log(`已发射设备状态更新事件 - 注册失败`);
    } catch (updateError) {
      this.logger.error(`发射设备状态更新事件失败:`, updateError);
    }

    // 这里可以添加具体的失败处理逻辑
    // 例如：重试注册、通知用户、记录错误等
  }


}
