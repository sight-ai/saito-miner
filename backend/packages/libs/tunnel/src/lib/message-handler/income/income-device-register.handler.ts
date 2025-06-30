import { Injectable, Logger } from '@nestjs/common';
import { IncomeBaseMessageHandler } from '../base-message-handler';
import { TunnelMessage, DeviceRegisterRequestMessage, DeviceRegisterResponseMessageSchema, DeviceRegisterResponseMessage } from '@saito/models';
import { MessageHandler } from '../message-handler.decorator';

/**
 * 设备注册请求消息入站处理器
 *
 * 处理通过tunnel接收到的设备注册请求，记录日志并可以触发事件
 */
@MessageHandler({ type: 'device_register_response', direction: 'income' })
@Injectable()
export class IncomeDeviceRegisterRequestHandler extends IncomeBaseMessageHandler {
  private readonly logger = new Logger(IncomeDeviceRegisterRequestHandler.name);

  constructor() {
    super();
  }

  async handleIncomeMessage(message: TunnelMessage): Promise<void> {
    try {
      const registerMessage = DeviceRegisterResponseMessageSchema.parse(message) as DeviceRegisterResponseMessage;

      this.logger.log(`Processing device register response from ${registerMessage.from}`);
      this.logger.debug(`Register payload:`, registerMessage.payload);

      // 检查注册状态
      const { status, device_id } = registerMessage.payload;

      if (status === 'connected') {
        this.logger.log(`✅ 设备注册成功 - DeviceID: ${device_id}`);
        this.logger.log(`💓 注册成功，心跳将由 DeviceStatusService 自动启动`);

      } else if (status === 'failed') {
        this.logger.error(`❌ 设备注册失败 - DeviceID: ${device_id}`);
      }

    } catch (error) {
      this.logger.error('Error processing device register response:', error);
    }
  }
}
