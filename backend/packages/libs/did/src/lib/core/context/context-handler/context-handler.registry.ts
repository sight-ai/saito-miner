import { Injectable } from '@nestjs/common';
import { GenericContextHandler } from './context-handler';
import { didV1ContextHandler } from './did-v1.context-handler';
import { sightDidV1ContextHandler } from './sight-did-v1.context-handler';

/* 
    localMap存储本地hardcode的context，handlerMap存储所有的context
    parser用handlerMap进行parse，维护本地did用localMap
*/
@Injectable()
export class ContextHandlerRegistry {
  private handlerMap = new Map<string, GenericContextHandler>();
  private localHandlerMap = new Map<string, GenericContextHandler>();

  constructor() {
    this.registerLocal(
      didV1ContextHandler.getContextUrl(),
      didV1ContextHandler,
    );
    this.registerLocal(
      sightDidV1ContextHandler.getContextUrl(),
      sightDidV1ContextHandler,
    );
  }

  registerLocal(contextUrl: string, handler: GenericContextHandler) {
    this.handlerMap.set(contextUrl, handler);
    this.localHandlerMap.set(contextUrl, handler);
  }

  register(contextUrl: string, handler: GenericContextHandler) {
    this.handlerMap.set(contextUrl, handler);
  }

  getHandler(contextUrl: string) {
    return this.handlerMap.get(contextUrl);
  }
  getAllHandlers(): GenericContextHandler[] {
    return Array.from(this.handlerMap.values());
  }
  getAllUrls(): string[] {
    return Array.from(this.handlerMap.keys());
  }

  getAllLocalHandlers(): GenericContextHandler[] {
    return Array.from(this.localHandlerMap.values());
  }
  getLocalUrls(): string[] {
    return Array.from(this.localHandlerMap.keys());
  }

  removeHandler(contextUrl: string) {
    if (this.handlerMap.delete(contextUrl)) {
      return true;
    }
    return false;
  }
}
