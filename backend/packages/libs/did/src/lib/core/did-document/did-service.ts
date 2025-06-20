import { Logger } from '@nestjs/common';
import {
  DidDocumentService,
  DidDocumentServiceEndpointObject,
  ServiceSchema,
} from '@saito/models';
import { DidDocumentElement } from './did-document-element';

export class DidService implements DidDocumentElement {
  private readonly logger = new Logger(DidService.name);
  constructor(public data: DidDocumentService) {}

  parse() {
    try {
      ServiceSchema.parse(this.data);
    } catch (e) {
      this.logger.error('Proof schema validation failed', e);
      throw new Error('Invalid Service format');
    }
  }
  // 获取 type(Id)（无论是 string 还是 string[]，都返回 string[]）
  getServiceId(): string[] {
    const t = this.data.id;
    return Array.isArray(t) ? t : [t];
  }

  // 判断该 service 是否有某种 type(Id)
  hasServiceId(type: string): boolean {
    return this.getServiceId().includes(type);
  }

  // 获取所有 endpoint（统一返回数组）
  getEndpoints(): (string | Record<string, any>)[] {
    const ep = this.data.serviceEndpoint;
    if (Array.isArray(ep)) return ep;
    return [ep];
  }

  // 获取所有 endpoint 里的某个字段值（如 schema、direction）
  getEndpointField(field: keyof DidDocumentServiceEndpointObject): string[] {
    return this.getEndpoints()
      .filter(
        (e): e is DidDocumentServiceEndpointObject =>
          typeof e === 'object' && e !== null,
      )
      .map(obj => obj[field])
      .filter((v): v is string => typeof v === 'string' && v.length > 0);
  }

  // 获取第一个 endpoint 对象里的 type 字段（没有返回 undefined）
  getEndpointType(): string | undefined {
    for (const ep of this.getEndpoints()) {
      if (typeof ep === 'object' && ep !== null && 'type' in ep) {
        return (ep as DidDocumentServiceEndpointObject)['type'];
      }
    }
    return undefined;
  }

  // 判断是否有某个 endpoint.type 字段等于 targetType
  hasEndpointType(targetType: string): boolean {
    for (const ep of this.getEndpoints()) {
      if (
        typeof ep === 'object' &&
        ep !== null &&
        (ep as any).type === targetType
      ) {
        return true;
      }
    }
    return false;
  }

  // 获取第一个 endpoint 对象里的 schema 字段（没有返回 undefined）
  getEndpointSchema(): string | undefined {
    for (const ep of this.getEndpoints()) {
      if (typeof ep === 'object' && ep !== null && 'schema' in ep) {
        return (ep as DidDocumentServiceEndpointObject).schema;
      }
    }
    return undefined;
  }
}
