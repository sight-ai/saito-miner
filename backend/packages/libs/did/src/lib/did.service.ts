import { Injectable } from '@nestjs/common';
import { DidLocalState, RawDidDocument } from '@saito/models';
import { DidLocalManager } from './did-local.manager';
import { DidServiceInterface } from './did.interface';
import { DidDocumentImpl } from './core/did-document';

@Injectable()
export class DidServiceImpl implements DidServiceInterface {
  constructor(private readonly manager: DidLocalManager) {}

  getDocument(): RawDidDocument {
    return this.manager.getDocument();
  }

  getDocumentObj(): DidDocumentImpl {
    return this.manager.getDocumentObj();
  }

  getLocalServiceId(): string[] {
    return this.manager.getLocalServiceId();
  }

  getMyPeerId(): string {
    return this.manager.getPeerId();
  }

  getMyPublicKey(): string {
    return this.manager.getPublicKey();
  }

  isDidUpdated(): boolean {
    return this.manager.getDidUodated();
  }

  getController(): string | undefined{
    return this.manager.getController();
  }
 
  async resetDidUpdated() {
    await this.manager.resetDidUpdated();
  }

  async refresh() {
    await this.manager.updateDocument();
  }

  async patch(fields: Partial<DidLocalState>) {
    await this.manager.patch(fields);
  }

  async setController(newController: string) {
    await this.manager.setController(newController);
  }

  async isNewerThanPersist(did: RawDidDocument): Promise<boolean> {
    return await this.manager.isNewerThanPersist(did);
  }
}

export const DidServiceProvider = {
  provide: 'DidService',
  useClass: DidServiceImpl,
};
