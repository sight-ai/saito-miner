import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { IncomeBaseMessageHandler } from '../base-message-handler';
import {
  TunnelMessage,
  ChatRequestStreamMessage,
  ChatRequestStreamMessageSchema,
  ChatResponseStreamMessage,
  ChatCompatibilityPayload,
  OpenAIChatCompletionChunk,
  OpenAIChatCompletionRequest,
  OpenAIChatCompletionChunkSchema,
  OpenAIChatMessage
} from '@saito/models';
import { MessageHandler } from '../message-handler.decorator';
import { TunnelService } from '../../tunnel.interface';
import {
  TUNNEL_EVENTS,
  TunnelChatRequestReceivedEvent,
  TunnelChatInferenceRequestEvent,
  TunnelInferenceResponseEvent
} from '../../events';

// 使用 models 中定义的类型，无需本地定义

/**
 * OpenAI 流式聊天请求处理器
 *
 * 职责：
 * 1. 接收并验证流式聊天请求
 * 2. 调用推理服务执行聊天
 * 3. 处理 OpenAI SSE 格式的流式响应
 * 4. 转发响应给目标设备
 *
 * 设计模式：
 * - Strategy Pattern: 处理不同格式的流式数据
 * - Template Method: 标准化消息处理流程
 * - Factory Pattern: 创建响应处理器
 */
@MessageHandler({ type: 'chat_request_stream', direction: 'income' })
@Injectable()
export class IncomeChatRequestStreamHandler extends IncomeBaseMessageHandler {
  private readonly logger = new Logger(IncomeChatRequestStreamHandler.name);

  // SSE 数据缓冲区 - 用于处理不完整的 SSE 行
  private readonly sseBuffers = new Map<string, string>();

  constructor(
    @Inject('TunnelService') private readonly tunnel: TunnelService,
    private readonly eventEmitter: EventEmitter2
  ) {
    super();
  }

  /**
   * 处理入站流式聊天请求消息
   * Template Method Pattern - 定义标准处理流程
   */
  async handleIncomeMessage(message: TunnelMessage): Promise<void> {
    this.logger.log(`🎯 收到流式聊天请求 - 目标: ${message.to}, 来源: ${message.from}`);

    try {
      // 1. 验证并解析消息
      const chatRequest = this.parseAndValidateMessage(message);

      // 发射聊天请求接收事件
      this.eventEmitter.emit(
        TUNNEL_EVENTS.CHAT_REQUEST_RECEIVED,
        new TunnelChatRequestReceivedEvent(
          chatRequest.payload.taskId || `${Date.now()}`,
          chatRequest.from,
          chatRequest.payload,
          true // 流式请求
        )
      );

      // 2. 执行流式聊天推理
      await this.processChatRequestStream(chatRequest);

    } catch (error) {
      this.logger.error(`❌ 处理流式聊天请求失败: ${error instanceof Error ? error.message : '未知错误'}`);
      await this.handleError(message, error);
    }
  }

  /**
   * 解析并验证消息
   * Strategy Pattern - 支持多种消息格式
   */
  private parseAndValidateMessage(message: TunnelMessage): ChatRequestStreamMessage {
    // 尝试标准格式解析
    const parseResult = ChatRequestStreamMessageSchema.safeParse(message);

    if (parseResult.success) {
      this.logger.debug(`✅ 标准格式解析成功`);
      return parseResult.data;
    }

    // 尝试兼容格式解析
    this.logger.debug(`⚠️ 标准格式解析失败，尝试兼容格式: ${parseResult.error.message}`);
    return this.parseCompatibilityFormat(message);
  }

  /**
   * 解析兼容格式的消息（嵌套 data 格式）
   */
  private parseCompatibilityFormat(message: TunnelMessage): ChatRequestStreamMessage {
    const payload = message.payload as ChatCompatibilityPayload;

    if (!payload.taskId || !payload.data) {
      throw new Error('Invalid compatibility format: missing taskId or data');
    }

    // 转换消息格式以符合 OpenAI 标准
    const convertedMessages: OpenAIChatMessage[] = payload.data.messages.map(msg => ({
      role: msg.role as 'system' | 'user' | 'assistant' | 'function',
      content: msg.content || null,
      name: undefined,
      function_call: undefined
    }));

    const convertedData: OpenAIChatCompletionRequest = {
      model: payload.data.model || 'unknown',
      messages: convertedMessages,
      stream: payload.data.stream !== false,
      temperature: payload.data.temperature,
      max_tokens: payload.data.max_tokens,
      top_p: payload.data.top_p,
      frequency_penalty: payload.data.frequency_penalty,
      presence_penalty: payload.data.presence_penalty,
      stop: payload.data.stop,
      n: payload.data.n || 1, // 提供默认值
      logit_bias: payload.data.logit_bias,
      user: payload.data.user
    };

    // 转换为标准格式
    return {
      type: 'chat_request_stream',
      from: message.from,
      to: message.to,
      payload: {
        taskId: payload.taskId,
        path: payload.path || '/openai/v1/chat/completions',
        data: convertedData 
      }
    };
  }

  /**
   * 处理错误情况
   */
  private async handleError(message: TunnelMessage, error: unknown): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : '未知错误';

    // 这里可以发送错误响应给客户端
    this.logger.error(`处理消息失败: ${errorMessage}`, {
      messageType: message.type,
      from: message.from,
      to: message.to
    });
  }

  /**
   * 处理流式聊天请求 - 纯事件驱动方式
   *
   * 职责：
   * 1. 验证请求数据
   * 2. 发射推理请求事件
   * 3. 不直接调用推理服务（解耦）
   */
  private async processChatRequestStream(message: ChatRequestStreamMessage): Promise<void> {
    const payload = message.payload;
    const taskId = payload.taskId;
    const path = payload.path;

    // 从 payload 中提取 OpenAI 格式的数据
    const requestData = payload.data as OpenAIChatCompletionRequest;

    // 构建请求参数，确保是流式请求
    const requestParams: OpenAIChatCompletionRequest = {
      ...requestData,
      stream: true // 确保是流式请求
    };

    this.logger.log(`🎯 准备发射流式聊天推理请求事件 - TaskID: ${taskId}, Path: ${path}, Model: ${requestParams.model}`);

    // 验证请求数据
    this.validateChatRequest(requestParams);

    try {
      // 发射聊天推理请求事件，让推理服务模块处理
      // Tunnel 模块只负责消息传输，不直接调用推理服务
      this.eventEmitter.emit(
        TUNNEL_EVENTS.CHAT_INFERENCE_REQUEST,
        new TunnelChatInferenceRequestEvent(
          taskId,
          message.from,
          requestParams,
          path,
          true // 流式请求
        )
      );

      this.logger.log(`✅ 已发射聊天推理请求事件 - TaskID: ${taskId}`);
      this.logger.debug(`📡 事件已发射，等待推理服务模块处理并响应`);

    } catch (error) {
      this.logger.error(`❌ 发射推理请求事件失败: ${error instanceof Error ? error.message : '未知错误'}`);
      throw error;
    }
  }

  /**
   * 验证聊天请求数据
   */
  private validateChatRequest(data: OpenAIChatCompletionRequest): void {
    if (!data.messages || data.messages.length === 0) {
      throw new Error('Invalid chat request: missing messages');
    }

    if (!data.model) {
      throw new Error('Invalid chat request: missing model');
    }
  }

  // 注意：推理响应监听器已移除
  // 现在推理服务直接通过 tunnel 发送响应，不再需要事件转发

  /**
   * 创建流式响应处理器
   * Factory Pattern - 创建模拟的 Express Response 对象
   */
  private createStreamResponseHandler(taskId: string, targetDeviceId: string) {
    return {
      // Express Response 接口方法
      setHeader: () => {},
      status: () => ({ json: () => {} }),
      json: () => {},
      headersSent: false,

      // 流式写入方法
      write: async (chunk: string | Buffer | object) => {
        try {
          const text = this.convertChunkToText(chunk);
          console.log(text)
          if (text) {
            await this.handleOpenAISSEChunk(taskId, targetDeviceId, text);
          } else if (typeof chunk === 'object') {
            // 验证并处理对象类型的数据
            const validatedChunk = this.validateOpenAIChunk(chunk);
            if (validatedChunk) {
              await this.sendStreamChunk(taskId, targetDeviceId, validatedChunk);
            }
          }
        } catch (error) {
          this.logger.error(`处理数据块失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      },

      // 流式结束方法
      end: async () => {
        await this.sendStreamComplete(taskId, targetDeviceId);
      }
    };
  }

  /**
   * 将数据块转换为文本
   * Strategy Pattern - 处理不同类型的数据块
   */
  private convertChunkToText(chunk: string | Buffer | object): string | null {
    if (typeof chunk === 'string') {
      return chunk;
    }

    if (Buffer.isBuffer(chunk)) {
      return chunk.toString('utf8');
    }

    if (chunk && typeof chunk === 'object') {
      // 检查是否是类数组对象
      if (Array.isArray(chunk) || ('length' in chunk && typeof (chunk as ArrayLike<number>).length === 'number')) {
        const uint8Array = new Uint8Array(chunk as ArrayLike<number>);
        return Buffer.from(uint8Array).toString('utf8');
      }
    }

    return String(chunk);
  }

  /**
   * 处理 OpenAI SSE 流式数据块并转换为 JSON
   * Strategy Pattern - 专门处理 SSE 格式数据
   */
  private async handleOpenAISSEChunk(taskId: string, targetDeviceId: string, text: string): Promise<void> {
    try {
      const bufferKey = `${taskId}-${targetDeviceId}`;
      let buffer = this.sseBuffers.get(bufferKey) || '';

      // 累积数据
      buffer += text;

      // 按行分割处理 SSE 数据
      const lines = buffer.split('\n');
      let processedLines = 0;

      for (let i = 0; i < lines.length - 1; i++) { // 保留最后一行，可能不完整
        const line = lines[i].trim();

        if (line.startsWith('data: ')) {
          const data = line.slice(6); // 移除 "data: " 前缀

          if (data === '[DONE]') {
            await this.sendStreamComplete(taskId, targetDeviceId);
            this.sseBuffers.delete(bufferKey);
            return;
          }

          try {
            // 解析并验证 OpenAI 格式数据
            const jsonData = JSON.parse(data);
            const validatedChunk = this.validateOpenAIChunk(jsonData);

            if (validatedChunk) {
              await this.sendStreamChunk(taskId, targetDeviceId, validatedChunk);
            }

            processedLines = i + 1;
          } catch (parseError) {
            this.logger.warn(`解析 OpenAI SSE 数据失败: ${data}`);
            processedLines = i + 1;
          }
        } else if (line === '' || line.startsWith(':')) {
          // 空行或注释行，跳过
          processedLines = i + 1;
        } else {
          processedLines = i + 1;
        }
      }

      // 更新缓冲区
      const remainingBuffer = lines.slice(processedLines).join('\n');
      if (remainingBuffer.trim()) {
        this.sseBuffers.set(bufferKey, remainingBuffer);
      } else {
        this.sseBuffers.delete(bufferKey);
      }

    } catch (error) {
      this.logger.error(`处理 OpenAI SSE 数据块失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 验证 OpenAI 数据块格式
   */
  private validateOpenAIChunk(data: unknown): OpenAIChatCompletionChunk | null {
    try {
      const result = OpenAIChatCompletionChunkSchema.safeParse(data);
      if (result.success) {
        return result.data;
      } else {
        this.logger.warn(`OpenAI 数据块格式验证失败: ${result.error.message}`);
        return null;
      }
    } catch (error) {
      this.logger.warn(`OpenAI 数据块验证异常: ${error instanceof Error ? error.message : '未知错误'}`);
      return null;
    }
  }






  /**
   * 发送流式数据块（OpenAI 格式）
   * 使用正确的 Zod 类型验证
   */
  private async sendStreamChunk(taskId: string, targetDeviceId: string, chunk: OpenAIChatCompletionChunk): Promise<void> {
    this.logger.debug(`📤 发送 OpenAI 数据块 - TaskID: ${taskId}, Model: ${chunk.model}`);

    const streamMessage: ChatResponseStreamMessage = {
      type: 'chat_response_stream',
      from: this.peerId,
      to: targetDeviceId,
      payload: {
        taskId,
        path: '', // 响应时path可以为空
        data: chunk // 同时保持 data 字段兼容性
      } 
    };

    // 使用 handleMessage 让系统自动判断发送目标
    await this.tunnel.handleMessage(streamMessage);
  }

  /**
   * 发送流式完成信号
   */
  private async sendStreamComplete(taskId: string, targetDeviceId: string): Promise<void> {
    // 清理 SSE 缓冲区
    const bufferKey = `${taskId}-${targetDeviceId}`;
    this.sseBuffers.delete(bufferKey);

    this.logger.log(`✅ 流式推理完成 - TaskID: ${taskId}, Target: ${targetDeviceId}`);

    // 创建符合 OpenAI 格式的完成信号
    const completeChunk: OpenAIChatCompletionChunk = {
      id: `chatcmpl-${taskId}`,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: 'unknown',
      choices: [{
        index: 0,
        delta: {},
        finish_reason: 'stop'
      }]
    };

    const completeMessage: ChatResponseStreamMessage = {
      type: 'chat_response_stream',
      from: this.peerId,
      to: targetDeviceId,
      payload: {
        taskId,
        path: '', // 响应时path可以为空
        data: completeChunk,
        done: true
      } as any
    };

    // 使用 handleMessage 让系统自动判断发送目标
    await this.tunnel.handleMessage(completeMessage);
  }


}
