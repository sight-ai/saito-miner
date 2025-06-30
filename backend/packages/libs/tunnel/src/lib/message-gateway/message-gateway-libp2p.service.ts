import { Injectable, Logger } from '@nestjs/common';
import { TunnelMessage } from '@saito/models';
import axios from 'axios';
import { MessageGateway } from './message-gateway.interface';

@Injectable()
export class MessageGatewayLibp2pService implements MessageGateway {
  private readonly logger = new Logger(MessageGatewayLibp2pService.name);
  private messageCallback: ((message: TunnelMessage) => void) | null = null;
  private connectionCallback: ((connected: boolean) => void) | null = null;
  private errorCallback: ((error: Error) => void) | null = null;

  constructor() {}

  // 实际负责消息发送，调用 libp2p 网络
  async sendMessage(message: TunnelMessage): Promise<void> {
    try {
      const port = process.env['LIBP2P_PORT'] || 4010;
      const url = `http://localhost:${port}/libp2p/send`;
      this.logger.debug(`Going to send to ${url}`);
      await axios.post(url, message, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      this.logger.log(`Sent to libp2p: ${url}`);
    } catch (err) {
      this.logger.error('Failed to send message to libp2p REST server', err);
      if (axios.isAxiosError(err)) {
        this.logger.error('Axios error', {
          code: err.code,
          message: err.message,
          url: err.config?.url,
          stack: err.stack,
          data: err.response?.data,
          status: err.response?.status,
        });
      } else {
        this.logger.error('Unknown error', err);
      }
      throw err;
    }
  }

  async connect(
    gatewayAddress: string,
    code?: string,
    basePath?: string,
  ): Promise<void> {
    return;
  }

  async receiveMessage(message: TunnelMessage) {
    // 这里手动触发之前注册的 callback
    if (this.messageCallback) {
      await this.messageCallback(message);
    }
  }

  async disconnect(): Promise<void> {
    return;
  }

  isConnected(): boolean {
    return true;
  }

  getDeviceId(): string | null {
    return null;
  }

  onMessage(callback: (message: TunnelMessage) => void): void {
    this.messageCallback = callback;
  }

  onConnectionChange(callback: (connected: boolean) => void): void {
    this.connectionCallback = callback;
  }

  onError(callback: (error: Error) => void): void {
    this.errorCallback = callback;
  }
}

export const MessageGatewayLibp2pProvider = {
  provide: 'MessageGatewayLibp2p',
  useClass: MessageGatewayLibp2pService,
};
