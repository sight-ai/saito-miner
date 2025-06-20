import { RawDidDocument } from '@saito/models';
import { DidDocumentImpl } from './core/did-document';

export interface DidDocumentOrchestratorInterface {

  toDidImpl(raw: RawDidDocument): Promise<DidDocumentImpl>;

}
