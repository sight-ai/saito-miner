import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IncomeBaseMessageHandler } from '../base-message-handler';
import { TunnelMessage, DeviceModelReportMessage, DeviceModelReportMessageSchema } from '@saito/models';
import { MessageHandler } from '../message-handler.decorator';
import { TUNNEL_EVENTS, TunnelModelReportReceivedEvent } from '../../events';

/**
 * 模型上报消息入站处理器
 *
 * 处理通过tunnel接收到的模型上报请求，记录日志并可以触发事件
 */
@MessageHandler({ type: 'device_model_report', direction: 'income' })
@Injectable()
export class IncomeDeviceModelReportHandler extends IncomeBaseMessageHandler {
  private readonly logger = new Logger(IncomeDeviceModelReportHandler.name);

  constructor(
    private readonly eventEmitter: EventEmitter2
  ) {
    super();
  }

  async handleIncomeMessage(message: TunnelMessage): Promise<void> {
    try {
      const reportMessage = DeviceModelReportMessageSchema.parse(message) as DeviceModelReportMessage;

      this.logger.log(`Processing model report request from ${reportMessage.from}`);
      this.logger.debug(`Model report payload:`, reportMessage.payload);
      // 记录模型上报请求信息
      this.logger.log(`Model report request details:`, {
        device_id: reportMessage.payload.device_id,
        models_count: reportMessage.payload.models.length,
        models: reportMessage.payload.models.map(model => {
          return {
            name: model.name,
            size: model.size,
            family: model.details.family,
            parameter_size: model.details.parameter_size
          };
        })
      });

      // 发射模型报告接收事件，让其他模块处理
      this.eventEmitter.emit(
        TUNNEL_EVENTS.MODEL_REPORT_RECEIVED,
        new TunnelModelReportReceivedEvent(
          reportMessage.from,
          reportMessage.payload.models
        )
      );

      this.logger.log(`Model report event emitted for device: ${reportMessage.from}`);

    } catch (error) {
      this.logger.error('Error processing model report message:', error);

      // 这里可以发送错误响应消息
    }
  }
}
