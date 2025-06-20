import { RawDidDocument } from '@saito/models';
import { DidDocumentImpl } from '../core/did-document';

export interface DidDocumentManager {
  addDocument(raw: RawDidDocument): Promise<boolean | undefined>;
  getDocument(peerId: string): DidDocumentImpl | undefined;
  removeDocument(peerId: string): Promise<boolean>;
  getAllDocuments(): DidDocumentImpl[];
  filterDocuments(predicate: (doc: DidDocumentImpl) => boolean): Promise<DidDocumentImpl[]>;
}
