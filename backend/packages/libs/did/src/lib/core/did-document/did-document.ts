import { Logger } from '@nestjs/common';
import {
  DidDocumentSchema,
  DidDocumentServiceEndpointObject,
  ParsedDidDocument,
} from '@saito/models';
import { DidDocumentElement } from './did-document-element';
import { DidProof } from './did-proof';
import { DidService } from './did-service';
import { DidVerificationMethod } from './did-verification-method';

export class DidDocumentImpl implements DidDocumentElement {
  private elements: DidDocumentElement[] = [];
  public raw: ParsedDidDocument;
  private readonly logger = new Logger(DidDocumentImpl.name);
  private unknownContexts?: (string | Record<string, unknown>)[];
  private unknownTerms?: (string | Record<string, unknown>)[];
  private unknownServiceTypes?: (string | Record<string, unknown>)[];

  constructor(parsed: ParsedDidDocument) {
    this.raw = parsed;
    this.unknownContexts = parsed.unknownContexts ?? [];
    this.unknownTerms = parsed.unknownTerms ?? [];
    this.unknownServiceTypes = parsed.unknownServiceTypes ?? [];

    if (Array.isArray(parsed.verificationMethod)) {
      for (const vm of parsed.verificationMethod) {
        this.elements.push(new DidVerificationMethod(vm));
      }
    }
    if (Array.isArray(parsed.service)) {
      for (const s of parsed.service) {
        this.elements.push(new DidService(s));
      }
    }
    if (parsed.proof) {
      this.elements.push(new DidProof(parsed.proof));
    }
  }

  hasUnknown(): boolean {
    return (this.unknownContexts && this.unknownContexts.length > 0) ||
      (this.unknownTerms && this.unknownTerms.length > 0) ||
      (this.unknownServiceTypes && this.unknownServiceTypes.length > 0)
      ? true
      : false;
  }

  getUnknownContexts() {
    return this.unknownContexts ?? [];
  }
  getUnknownTerms() {
    return this.unknownTerms ?? [];
  }
  getUnknownServiceTypes() {
    return this.unknownServiceTypes ?? [];
  }

  parse() {
    try {
      DidDocumentSchema.parse(this.raw);
      this.elements.forEach(el => el.parse());
    } catch (error) {
      this.logger.error('DidDocument parsing error:', error);
      throw new Error('Invalid DidDocument format');
    }
  }

  getPeerId(): string | undefined {
    return this.raw.id;
  }

  getPublicKey(): string | undefined {
    const vm = this.elements.find(el => el instanceof DidVerificationMethod) as
      | DidVerificationMethod
      | undefined;
    return vm?.getPublicKey();
  }

  getHash(): string | undefined{
    return typeof this.raw['sight:hash'] === 'string'
      ? this.raw['sight:hash']
      : undefined;
  }

  getSeq(): number | undefined {
    return typeof this.raw['sight:seq'] === 'number'
      ? this.raw['sight:seq']
      : undefined;
  }

  // 获取所有 Service 实例
  getServices(): DidService[] {
    return this.elements.filter(el => el instanceof DidService) as DidService[];
  }

  // 获取所有serviceId
  getServiceId(): string[] {
    return this.getServices().flatMap(s => s.getServiceId());
  }

  // 获取所有指定 id 的 Service
  getServicesById(id: string): DidService[] {
    return this.getServices().filter(s => s.hasServiceId(id));
  }

  // 检查是否有某种 id 的 service
  hasServiceId(id: string): boolean {
    return this.getServices().some(s => s.hasServiceId(id));
  }

  // 获取所有 endpoint（字符串或对象）
  getAllServiceEndpoints(): (string | Record<string, undefined>)[] {
    return this.getServices().flatMap(s => s.getEndpoints());
  }

  // 获取所有 endpoint 的 type 字段（去重，非 undefined）
  getAllEndpointTypes(): string[] {
    return this.getServices()
      .flatMap(s => s.getEndpointField('type'))
      .filter(
        (t, i, arr) => t !== undefined && arr.indexOf(t) === i,
      ) as string[];
  }

  // 判断所有 service endpoint 是否存在某 type
  hasEndpointType(type: string): boolean {
    return this.getServices().some(s => s.hasEndpointType(type));
  }

  // 获取所有 endpoint 的 schema 字段（去重，非 undefined）
  getAllEndpointSchemas(): string[] {
    return this.getServices()
      .flatMap(s => s.getEndpointField('schema'))
      .filter(
        (t, i, arr) => t !== undefined && arr.indexOf(t) === i,
      ) as string[];
  }

  // 获取所有 endpoint 的某个字段（类型安全版本）
  getAllEndpointField(field: keyof DidDocumentServiceEndpointObject): string[] {
    return this.getServices()
      .flatMap(s => s.getEndpointField(field))
      .filter(
        (v, i, arr) => v !== undefined && arr.indexOf(v) === i,
      ) as string[];
  }
}
