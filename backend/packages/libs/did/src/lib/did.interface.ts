import { DidLocalState, RawDidDocument } from '@saito/models';

export interface DidServiceInterface {
  getDocument(): RawDidDocument;

  refresh(): Promise<void>;

  patch(fields: Partial<DidLocalState>): Promise<void>;

  getMyPeerId(): string;

  getMyPublicKey(): string;

  isDidUpdated(): boolean;

  getController(): string | undefined;

  resetDidUpdated(): Promise<void>;
}
