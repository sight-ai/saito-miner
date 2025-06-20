import { Injectable, Logger } from '@nestjs/common';
import { RawDidDocument } from '@saito/models';
import { DidDocumentImpl } from '../core/did-document';
import { DidManagerStorage } from '../did-document-storage/did-manager.storage';
import { DidDocumentOrchestrator } from '../did-document.orchestrator';
import { DidDocumentManager } from './did-document-manager.interface';

@Injectable()
export class DidDocumentManagerService implements DidDocumentManager {
  private manifests: Map<string, DidDocumentImpl>;
  private readonly logger = new Logger(DidDocumentManagerService.name);

  constructor(
    private readonly orchestrator: DidDocumentOrchestrator,
    private readonly storage: DidManagerStorage,
  ) {
    this.manifests = new Map();
  }

  async load() {
    const arr = await this.storage.load();
    this.manifests.clear();
    if (arr.length < 1) {
      this.logger.log(`No document in local storage.`);
      return;
    }
    for (const parsedDid of arr) {
      try {
        const impl = new DidDocumentImpl(parsedDid);
        this.manifests.set(parsedDid.id, impl);
      } catch (e) {
        this.logger.warn(`Failed to load document ${parsedDid.id}: ${e}`);
      }
    }
    this.logger.log(`Loaded ${this.manifests.size} manifests from storage.`);
  }

  async persist() {
    const arr = Array.from(this.manifests.values()).map(impl => impl.raw);
    await this.storage.persist(arr);
    this.logger.log(`Persisted ${arr.length} manifests to storage.`);
  }

  // 注册manifest，检测类型，检测是否更新，检测是否verify proof
  async addDocument(doc: RawDidDocument): Promise<boolean | undefined> {
    try {
      const result = await this.orchestrator.toDidImpl(doc);
      const peerId = result.getPeerId();
      if (peerId === undefined) return false;
      if (!(await this.isNewerThanPersist(peerId, doc))) {
        this.logger.debug(`Drop manifest for peer ${peerId}: seq not newer`);
        return false;
      }
      this.manifests.set(peerId, result);
      this.logger.debug(`Added/Updated manifest for peer ${peerId}`);
      await this.storage.persistOne(result.raw);
      return true;
    } catch (error: any) {
      this.logger.error(`Failed to add document for peer ${doc.id}:`, error);
      throw new Error(`Invalid DidDocument format: ${error.message}`);
    }
  }
  // TODO, storage
  async isNewerThanPersist(
    peerId: string,
    newDid: RawDidDocument,
  ): Promise<boolean> {
    let existing = this.manifests.get(peerId);
    if (!existing) {
      // fallback to storage
      const loaded = await this.storage.loadOne(peerId);
      console.log(`Load from storage: ${JSON.stringify(loaded, null, 2)}`);
      if (!loaded) return true;
      existing = new DidDocumentImpl(loaded);
      console.log(
        `DidDOcumentImpl from raw: ${JSON.stringify(existing.raw, null, 2)}`,
      );
    }
    const oldSeq = Number(existing.raw['sight:seq']);
    const newSeq = Number(newDid['sight:seq']);
    return !isNaN(newSeq) && newSeq > oldSeq;
  }

  // 通过peerId获取对应的DID
  getDocument(peerId: string): DidDocumentImpl | undefined {
    return this.manifests.get(peerId);
  }

  // 删除
  async removeDocument(peerId: string): Promise<boolean> {
    if (this.manifests.delete(peerId)) {
      await this.persist();
      return true;
    }
    return false;
  }

  // 筛选
  async filterDocuments(
    predicate: (doc: DidDocumentImpl) => boolean,
  ): Promise<DidDocumentImpl[]> {
    return Array.from(this.manifests.values()).filter(predicate);
  }

  getAllDocuments(): DidDocumentImpl[] {
    return Array.from(this.manifests.values());
  }

  async clearAll(): Promise<void> {
    this.manifests.clear();
    await this.persist();
  }

  getPublicKeyByPeerId(peerId: string): string {
    const manifest = this.manifests.get(peerId);
    return manifest?.getPublicKey() ?? '';
  }

  hasPeerId(peerId: string): boolean {
    return this.manifests.has(peerId);
  }

  // TODO, 其他需要的方法，需要的时候添加
}

export const DidDocumentManagerProvider = {
  provide: 'DidDocumentManagerService',
  useClass: DidDocumentManagerService,
};
