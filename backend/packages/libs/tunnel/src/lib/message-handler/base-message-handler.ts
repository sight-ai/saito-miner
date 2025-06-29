import 'reflect-metadata';
import { TunnelMessage } from '@saito/models';
import { MESSAGE_HANDLER_META, MessageHandlerMeta } from './message-handler.decorator';
import { GLOBAL_PEER_ID_PROVIDER } from '../tunnel.module';

/**
 * 入站消息处理器基类
 */
export abstract class IncomeBaseMessageHandler {
  protected readonly expectedType: string;

  constructor() {
    const meta = Reflect.getMetadata(MESSAGE_HANDLER_META, this.constructor) as MessageHandlerMeta;
    if (!meta || meta.direction !== 'income') {
      throw new Error(`${this.constructor.name} is missing @MessageHandler({ type, direction: 'income' })`);
    }
    this.expectedType = meta.type;
  }

  protected get peerId(): string {
    return GLOBAL_PEER_ID_PROVIDER.getPeerId();
  }

  async handleMessage(message: TunnelMessage): Promise<void> {
    if (message.type !== this.expectedType) {
      console.warn(`[${this.constructor.name}] Unexpected message type: expected "${this.expectedType}", got "${message.type}"`);
      return;
    }

    const currentPeerId = this.peerId;
    if (currentPeerId && message.to !== currentPeerId) {
      console.warn(`[${this.constructor.name}] Message not to this peer (${currentPeerId}), ignoring`);
      return;
    }

    await this.handleIncomeMessage(message);
  }

  protected abstract handleIncomeMessage(message: TunnelMessage): Promise<void>;
}

/**
 * 出站消息处理器基类
 */
export abstract class OutcomeBaseMessageHandler {
  protected readonly expectedType: string;

  constructor() {
    const meta = Reflect.getMetadata(MESSAGE_HANDLER_META, this.constructor) as MessageHandlerMeta;
    if (!meta || meta.direction !== 'outcome') {
      throw new Error(`${this.constructor.name} is missing @MessageHandler({ type, direction: 'outcome' })`);
    }
    this.expectedType = meta.type;
  }

  protected get peerId(): string {
    return GLOBAL_PEER_ID_PROVIDER.getPeerId();
  }

  async handleMessage(message: TunnelMessage): Promise<void> {
    if (message.type !== this.expectedType) {
      console.warn(
        `[${this.constructor.name}] Unexpected message type: expected "${this.expectedType}", got "${message.type}"`
      );
      return;
    }

    const currentPeerId = this.peerId;
    if (currentPeerId && message.from !== currentPeerId) {
      console.warn(`[${this.constructor.name}] Message not from this peer (${currentPeerId}), ignoring`);
      return;
    }

    await this.handleOutcomeMessage(message);
  }

  protected abstract handleOutcomeMessage(message: TunnelMessage): Promise<void>;
}
