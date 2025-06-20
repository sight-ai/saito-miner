import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import {
  MESSAGE_HANDLER_META,
  MessageHandlerMeta,
} from './message-handler.decorator';
import {
  IncomeBaseMessageHandler,
  OutcomeBaseMessageHandler,
} from './base-message-handler';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { TunnelMessage } from '@saito/models';

@Injectable()
export class MessageHandlerRegistry implements OnModuleInit {
  private readonly logger = new Logger(MessageHandlerRegistry.name);

  private incomeHandlers = new Map<string, IncomeBaseMessageHandler>();
  private outcomeHandlers = new Map<string, OutcomeBaseMessageHandler>();

  constructor(
    private readonly discovery: DiscoveryService,
  ) {}

  async onModuleInit() {
    this.logger.log('Scanning for message handlers...');
    const wrappers: InstanceWrapper[] = this.discovery.getProviders();

    for (const wrapper of wrappers) {
      const instance = wrapper.instance;
      if (!instance) continue;

      const meta = Reflect.getMetadata(
        MESSAGE_HANDLER_META,
        instance.constructor,
      ) as MessageHandlerMeta | undefined;

      if (!meta) continue;

      if (meta.direction === 'income') {
        this.logger.debug(
          `Registering income handler: "${meta.type}" → ${instance.constructor.name}`,
        );
        this.incomeHandlers.set(meta.type, instance as IncomeBaseMessageHandler);
      }

      if (meta.direction === 'outcome') {
        this.logger.debug(
          `Registering outcome handler: "${meta.type}" → ${instance.constructor.name}`,
        );
        this.outcomeHandlers.set(meta.type, instance as OutcomeBaseMessageHandler);
      }
    }

    this.logger.log(
      `Registered ${this.incomeHandlers.size} income and ${this.outcomeHandlers.size} outcome handlers.`,
    );
  }

  getIncomeHandler(type: string): IncomeBaseMessageHandler | undefined {
    return this.incomeHandlers.get(type);
  }

  getOutcomeHandler(type: string): OutcomeBaseMessageHandler | undefined {
    return this.outcomeHandlers.get(type);
  }

  // add income handler keys getter
  getAllIncomeHandlers(): string[] {
    return Array.from(this.incomeHandlers.keys());
  }

  /**
   * 处理入站消息
   */
  async handleIncomeMessage(message: TunnelMessage): Promise<void> {
    const handler = this.incomeHandlers.get(message.type);
    if (!handler) {
      this.logger.warn(`No income handler found for message type: ${message.type}`);
      return;
    }

    try {
      await (handler as any).handleIncomeMessage(message);
    } catch (error) {
      this.logger.error(`Income handler error for ${message.type}:`, error);
    }
  }

  /**
   * 处理出站消息
   */
  async handleOutcomeMessage(message: TunnelMessage): Promise<void> {
    const handler = this.outcomeHandlers.get(message.type);
    if (!handler) {
      this.logger.warn(`No outcome handler found for message type: ${message.type}`);
      return;
    }

    try {
      await (handler as any).handleOutcomeMessage(message);
    } catch (error) {
      this.logger.error(`Outcome handler error for ${message.type}:`, error);
    }
  }

  getHandlerDescriptors(): {
    direction: 'income' | 'outcome';
    type: string;
    className: string;
  }[] {
    const descriptors: any[] = [];

    for (const [type, handler] of this.incomeHandlers) {
      descriptors.push({
        direction: 'income',
        type,
        className: handler.constructor.name,
      });
    }

    for (const [type, handler] of this.outcomeHandlers) {
      descriptors.push({
        direction: 'outcome',
        type,
        className: handler.constructor.name,
      });
    }

    return descriptors;
  }
}
