import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ModuleRef } from '@nestjs/core';
import { DeviceStatusService } from "@saito/device-status";
const TUNNEL_EVENTS = {
  CHAT_INFERENCE_REQUEST: 'tunnel.chat.inference.request',
  COMPLETION_INFERENCE_REQUEST: 'tunnel.completion.inference.request'
} as const;

// 定义事件类型
interface TunnelChatInferenceRequestEvent {
  taskId: string;
  fromDeviceId: string;
  requestParams: any;
  path: string;
  isStream: boolean;
}

interface TunnelCompletionInferenceRequestEvent {
  taskId: string;
  fromDeviceId: string;
  requestParams: any;
  path: string;
  isStream: boolean;
}

// 定义 TunnelService 接口
interface TunnelService {
  handleMessage(message: any): Promise<void>;
}

// 定义 Token
export const TUNNEL_SERVICE_TOKEN = Symbol('TUNNEL_SERVICE_TOKEN');
import { UnifiedModelService } from '../client-services/unified-model.service';

/**
 * Tunnel 推理事件监听器
 *
 * 职责：
 * 1. 监听来自 Tunnel 模块的推理请求事件
 * 2. 调用推理服务执行推理
 * 3. 通过 Tunnel 发送响应回客户端
 *
 * 这是推理服务与 Tunnel 模块解耦的关键组件
 */
@Injectable()
export class TunnelInferenceEventListenerService {
  private readonly logger = new Logger(TunnelInferenceEventListenerService.name);
  private tunnelService: TunnelService | null = null;

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly unifiedModelService: UnifiedModelService,
    @Inject(DeviceStatusService) private readonly deviceStatusService: DeviceStatusService,
  ) {
    setTimeout(() => {
      try {
        this.tunnelService = this.moduleRef.get('TunnelService', { strict: false });
        if (this.tunnelService) {
          this.logger.log('✅ TunnelService 已成功获取');
        } else {
          this.logger.warn('⚠️  TunnelService 未找到，推理响应将无法发送');
        }
      } catch (error) {
        this.logger.warn('⚠️  获取 TunnelService 失败，推理响应将无法发送');
      }
    }, 1000); // 1秒后尝试获取
  }

  /**
   * 监听聊天推理请求事件
   */
  @OnEvent(TUNNEL_EVENTS.CHAT_INFERENCE_REQUEST)
  async handleChatInferenceRequest(event: TunnelChatInferenceRequestEvent): Promise<void> {
    this.logger.log(`🎯 收到聊天推理请求事件 - TaskID: ${event.taskId}, 来源设备: ${event.fromDeviceId}, 流式: ${event.isStream}`);

    try {
      if (event.isStream) {
        await this.handleStreamingChatRequest(event);
      } else {
        await this.handleNonStreamingChatRequest(event);
      }
    } catch (error) {
      this.logger.error(`❌ 处理聊天推理请求失败: ${error instanceof Error ? error.message : '未知错误'}`);
      await this.sendErrorResponse(event, error);
    }
  }

  /**
   * 监听完成推理请求事件
   */
  @OnEvent(TUNNEL_EVENTS.COMPLETION_INFERENCE_REQUEST)
  async handleCompletionInferenceRequest(event: TunnelCompletionInferenceRequestEvent): Promise<void> {
    this.logger.log(`🎯 收到完成推理请求事件 - TaskID: ${event.taskId}, 来源设备: ${event.fromDeviceId}, 流式: ${event.isStream}`);

    try {
      if (event.isStream) {
        await this.handleStreamingCompletionRequest(event);
      } else {
        await this.handleNonStreamingCompletionRequest(event);
      }
    } catch (error) {
      this.logger.error(`❌ 处理完成推理请求失败: ${error instanceof Error ? error.message : '未知错误'}`);
      await this.sendErrorResponse(event, error);
    }
  }

  /**
   * 处理流式聊天请求
   */
  private async handleStreamingChatRequest(event: TunnelChatInferenceRequestEvent): Promise<void> {
    this.logger.debug(`🌊 处理流式聊天请求 - Model: ${event.requestParams.model}`);

    // 创建流式响应处理器
    const responseHandler = this.createStreamingResponseHandler(event.taskId, event.fromDeviceId, 'chat');

    // 调用推理服务
    await this.unifiedModelService.chat(event.requestParams, responseHandler as any, event.path);

    this.logger.log(`✅ 流式聊天推理完成 - TaskID: ${event.taskId}`);
  }

  /**
   * 处理非流式聊天请求
   */
  private async handleNonStreamingChatRequest(event: TunnelChatInferenceRequestEvent): Promise<void> {
    this.logger.debug(`📝 处理非流式聊天请求 - Model: ${event.requestParams.model}`);

    // 创建非流式响应处理器
    const responseHandler = this.createNonStreamingResponseHandler(event.taskId, event.fromDeviceId, 'chat');

    // 调用推理服务
    await this.unifiedModelService.chat(event.requestParams, responseHandler as any, event.path);

    this.logger.log(`✅ 非流式聊天推理完成 - TaskID: ${event.taskId}`);
  }

  /**
   * 处理流式完成请求
   */
  private async handleStreamingCompletionRequest(event: TunnelCompletionInferenceRequestEvent): Promise<void> {
    this.logger.debug(`🌊 处理流式完成请求 - Model: ${event.requestParams.model}`);

    // 创建流式响应处理器
    const responseHandler = this.createStreamingResponseHandler(event.taskId, event.fromDeviceId, 'completion');

    // 调用推理服务
    await this.unifiedModelService.complete(event.requestParams, responseHandler as any, event.path);

    this.logger.log(`✅ 流式完成推理完成 - TaskID: ${event.taskId}`);
  }

  /**
   * 处理非流式完成请求
   */
  private async handleNonStreamingCompletionRequest(event: TunnelCompletionInferenceRequestEvent): Promise<void> {
    this.logger.debug(`📝 处理非流式完成请求 - Model: ${event.requestParams.model}`);

    // 创建非流式响应处理器
    const responseHandler = this.createNonStreamingResponseHandler(event.taskId, event.fromDeviceId, 'completion');

    // 调用推理服务
    await this.unifiedModelService.complete(event.requestParams, responseHandler as any, event.path);

    this.logger.log(`✅ 非流式完成推理完成 - TaskID: ${event.taskId}`);
  }

  /**
   * 创建流式响应处理器
   * 模拟 Express Response 对象，将响应通过 Tunnel 发送
   */
  private createStreamingResponseHandler(taskId: string, targetDeviceId: string, type: 'chat' | 'completion') {
    const self = this;

    // 创建一个更完整的 Express Response 模拟
    const mockResponse = {
      // 基本属性
      headersSent: false,
      statusCode: 200,

      // 头部管理
      setHeader: (name: string, value: any) => {
        self.logger.debug(`设置响应头: ${name} = ${value}`);
        return mockResponse;
      },

      getHeader: (_name: string) => undefined,

      removeHeader: (_name: string) => {
        return mockResponse;
      },

      // 状态码
      status: (code: number) => {
        mockResponse.statusCode = code;
        return {
          json: (data: any) => {
            self.sendNonStreamingResponse(taskId, targetDeviceId, data, type);
          }
        };
      },

      // JSON 响应
      json: (data: any) => {
        self.sendNonStreamingResponse(taskId, targetDeviceId, data, type);
        return mockResponse;
      },

      // 流式写入
      write: (chunk: any) => {
        try {
          self.logger.debug(`收到流式数据块，类型: ${typeof chunk}, 构造函数: ${chunk?.constructor?.name}`);

          // 确保 chunk 是字符串类型
          let chunkStr: string;
          if (typeof chunk === 'string') {
            chunkStr = chunk;
          } else if (Buffer.isBuffer(chunk)) {
            chunkStr = chunk.toString('utf8');
          } else if (chunk instanceof Uint8Array) {
            // 处理 Uint8Array
            chunkStr = Buffer.from(chunk).toString('utf8');
          } else if (chunk && typeof chunk === 'object' && !Array.isArray(chunk)) {
            // 如果是普通对象（不是数组），直接发送
            console.log(chunk)
            self.sendStreamingResponse(taskId, targetDeviceId, chunk, type);
            return true;
          } else {
            chunkStr = String(chunk);
          }

          // 解析 SSE 数据
          const lines = chunkStr.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              if (line === 'data: [DONE]') {
                // 流式结束标记 - [DONE] 不是 JSON，直接发送完成标记
                self.logger.debug(`收到流式结束标记 - TaskID: ${taskId}`);
                self.sendStreamingComplete(taskId, targetDeviceId, type);
              } else {
                const data = line.substring(6);
                if (data.trim()) {
                  try {
                    const parsedData = JSON.parse(data);
                    // 验证数据是否符合 OpenAI 格式
                    if (self.isValidOpenAIResponse(parsedData, type)) {
                      self.sendStreamingResponse(taskId, targetDeviceId, parsedData, type);
                    } else {
                      self.logger.warn(`收到不符合 OpenAI 格式的数据，跳过: ${JSON.stringify(parsedData)}`);
                    }
                  } catch (parseError) {
                    self.logger.warn(`无法解析 JSON 数据: ${data}, 错误: ${parseError instanceof Error ? parseError.message : '未知错误'}`);
                  }
                }
              }
            }
          }

          return true;
        } catch (error) {
          self.logger.error(`解析流式响应失败: ${error instanceof Error ? error.message : '未知错误'}`);
          self.logger.debug(`Chunk 类型: ${typeof chunk}, 值: ${JSON.stringify(chunk)}`);
          return false;
        }
      },

      // 结束响应
      end: (finalChunk?: any) => {
        if (finalChunk) {
          mockResponse.write(finalChunk);
        }
        // 发送结束标记
        self.sendStreamingComplete(taskId, targetDeviceId, type, {});
        return mockResponse;
      },

      // 其他必要的方法
      send: (data: any) => {
        if (typeof data === 'object') {
          mockResponse.json(data);
        } else {
          mockResponse.write(data);
          mockResponse.end();
        }
        return mockResponse;
      }
    };

    return mockResponse;
  }

  /**
   * 创建非流式响应处理器
   * 模拟 Express Response 对象，将响应通过 Tunnel 发送
   */
  private createNonStreamingResponseHandler(taskId: string, targetDeviceId: string, type: 'chat' | 'completion') {
    const self = this;

    // 创建一个更完整的 Express Response 模拟
    const mockResponse = {
      // 基本属性
      headersSent: false,
      statusCode: 200,

      // 头部管理
      setHeader: (_name: string, _value: any) => {
        return mockResponse;
      },

      getHeader: (_name: string) => undefined,

      removeHeader: (_name: string) => {
        return mockResponse;
      },

      // 状态码
      status: (code: number) => {
        mockResponse.statusCode = code;
        return {
          json: (data: any) => {
            self.sendNonStreamingResponse(taskId, targetDeviceId, data, type);
          }
        };
      },

      // JSON 响应
      json: (data: any) => {
        self.sendNonStreamingResponse(taskId, targetDeviceId, data, type);
        return mockResponse;
      },

      // 发送响应
      send: (data: any) => {
        self.sendNonStreamingResponse(taskId, targetDeviceId, data, type);
        return mockResponse;
      },

      // 流式方法（非流式模式下不应该被调用，但为了兼容性提供）
      write: (_chunk: any) => {
        self.logger.warn(`非流式响应处理器收到 write 调用 - TaskID: ${taskId}`);
        return true;
      },

      end: (_finalChunk?: any) => {
        return mockResponse;
      }
    };

    return mockResponse;
  }

  /**
   * 发送流式响应
   */
  private async sendStreamingResponse(taskId: string, targetDeviceId: string, data: any, type: 'chat' | 'completion'): Promise<void> {
    if (!this.tunnelService) {
      this.logger.warn(`⚠️  无法发送流式响应，TunnelService 未注入 - TaskID: ${taskId}`);
      return;
    }

    try {
      const messageType = type === 'chat' ? 'chat_response_stream' : 'completion_response_stream';

      const responseMessage = {
        type: messageType,
        from: await this.deviceStatusService.getDeviceId(),
        to: targetDeviceId,
        payload: {
          taskId,
          path: '',
          data
        }
      };

      await this.tunnelService.handleMessage(responseMessage as any);
    } catch (error) {
      this.logger.error(`发送流式响应失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 发送流式完成标记
   */
  private async sendStreamingComplete(taskId: string, targetDeviceId: string, type: 'chat' | 'completion', _data?: any): Promise<void> {
    if (!this.tunnelService) {
      this.logger.warn(`⚠️  无法发送流式完成标记，TunnelService 未注入 - TaskID: ${taskId}`);
      return;
    }

    try {
      const messageType = type === 'chat' ? 'chat_response_stream' : 'completion_response_stream';

      // 创建符合 OpenAI 格式的结束标记
      let completeData: any;
      if (type === 'chat') {
        completeData = {
          id: `chatcmpl-${Date.now()}`,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: 'unknown',
          choices: [{
            index: 0,
            delta: {},
            finish_reason: 'stop'
          }]
        };
      } else {
        completeData = {
          id: `cmpl-${Date.now()}`,
          object: 'text_completion',
          created: Math.floor(Date.now() / 1000),
          model: 'unknown',
          choices: [{
            index: 0,
            text: '',
            finish_reason: 'stop'
          }]
        };
      }

      const completeMessage = {
        type: messageType,
        from: await this.deviceStatusService.getDeviceId(),
        to: targetDeviceId,
        payload: {
          taskId,
          path: '',
          data: completeData
        }
      };

      await this.tunnelService.handleMessage(completeMessage as any);
      this.logger.debug(`✅ 流式响应完成标记已发送 - TaskID: ${taskId}`);
    } catch (error) {
      this.logger.error(`发送流式完成标记失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 发送非流式响应
   */
  private async sendNonStreamingResponse(taskId: string, targetDeviceId: string, data: any, type: 'chat' | 'completion'): Promise<void> {
    if (!this.tunnelService) {
      this.logger.warn(`⚠️  无法发送非流式响应，TunnelService 未注入 - TaskID: ${taskId}`);
      return;
    }

    try {
      const messageType = type === 'chat' ? 'chat_response' : 'completion_response';

      const responseMessage = {
        type: messageType,
        from: await this.deviceStatusService.getDeviceId(),
        to: targetDeviceId,
        payload: {
          taskId,
          data
        }
      };

      await this.tunnelService.handleMessage(responseMessage as any);
      this.logger.log(`✅ 非流式响应已发送 - TaskID: ${taskId}`);
    } catch (error) {
      this.logger.error(`发送非流式响应失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 发送错误响应
   */
  private async sendErrorResponse(event: any, error: unknown): Promise<void> {
    if (!this.tunnelService) {
      this.logger.warn(`⚠️  无法发送错误响应，TunnelService 未注入 - TaskID: ${event.taskId}`);
      return;
    }

    try {
      const errorMessage = error instanceof Error ? error.message : '未知错误';

      const responseMessage = {
        type: 'error_response',
        from: await this.deviceStatusService.getDeviceId(),
        to: event.fromDeviceId,
        payload: {
          taskId: event.taskId,
          error: errorMessage
        }
      };

      await this.tunnelService.handleMessage(responseMessage as any);
      this.logger.log(`❌ 错误响应已发送 - TaskID: ${event.taskId}`);
    } catch (sendError) {
      this.logger.error(`发送错误响应失败: ${sendError instanceof Error ? sendError.message : '未知错误'}`);
    }
  }

  /**
   * 验证数据是否符合 OpenAI 响应格式
   */
  private isValidOpenAIResponse(data: any, type: 'chat' | 'completion'): boolean {
    if (!data || typeof data !== 'object') {
      return false;
    }

    if (type === 'chat') {
      // 验证聊天响应格式
      return (
        typeof data.id === 'string' &&
        data.object === 'chat.completion.chunk' &&
        typeof data.created === 'number' &&
        typeof data.model === 'string' &&
        Array.isArray(data.choices)
      );
    } else {
      // 验证完成响应格式
      return (
        typeof data.id === 'string' &&
        (data.object === 'text_completion' || data.object === 'completion') &&
        typeof data.created === 'number' &&
        typeof data.model === 'string' &&
        Array.isArray(data.choices)
      );
    }
  }
}
