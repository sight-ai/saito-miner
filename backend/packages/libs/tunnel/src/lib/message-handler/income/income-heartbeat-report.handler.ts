import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IncomeBaseMessageHandler } from '../base-message-handler';
import { TunnelMessage, DeviceHeartbeatReportMessage, DeviceHeartbeatReportMessageSchema } from '@saito/models';
import { MessageHandler } from '../message-handler.decorator';
import { TUNNEL_EVENTS, TunnelHeartbeatReceivedEvent } from '../../events';

/**
 * 心跳上报消息入站处理器
 *
 * 处理通过tunnel接收到的心跳上报请求，记录日志并可以触发事件
 */
@MessageHandler({ type: 'device_heartbeat_report', direction: 'income' })
@Injectable()
export class IncomeDeviceHeartbeatReportHandler extends IncomeBaseMessageHandler {
  private readonly logger = new Logger(IncomeDeviceHeartbeatReportHandler.name);

  constructor(
    private readonly eventEmitter: EventEmitter2
  ) {
    super();
  }

  async handleIncomeMessage(message: TunnelMessage): Promise<void> {
    try {
      const heartbeatMessage = DeviceHeartbeatReportMessageSchema.parse(message) as DeviceHeartbeatReportMessage;

      this.logger.log(`Processing heartbeat report request from ${heartbeatMessage.from}`);
      this.logger.debug(`Heartbeat payload:`, heartbeatMessage.payload);

      // 记录心跳上报请求信息
      this.logger.log(`Heartbeat report request details:`, {
        code: heartbeatMessage.payload.code,
        cpu_usage: heartbeatMessage.payload.cpu_usage,
        memory_usage: heartbeatMessage.payload.memory_usage,
        gpu_usage: heartbeatMessage.payload.gpu_usage,
        ip: heartbeatMessage.payload.ip,
        timestamp: heartbeatMessage.payload.timestamp,
        type: heartbeatMessage.payload.type,
        model: heartbeatMessage.payload.model,
        device_info: heartbeatMessage.payload.device_info ? 'provided' : 'not provided'
      });

      // 发射心跳接收事件，让其他模块处理
      this.eventEmitter.emit(
        TUNNEL_EVENTS.HEARTBEAT_RECEIVED,
        new TunnelHeartbeatReceivedEvent(
          heartbeatMessage.from,
          heartbeatMessage.payload
        )
      );

      this.logger.log(`Heart beat event emitted for device: ${heartbeatMessage.from}`);

    } catch (error) {
      this.logger.error('Error processing heartbeat report message:', error);
      
      // 这里可以发送错误响应消息
    }
  }
}
