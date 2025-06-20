import { Injectable } from '@nestjs/common';
import {
    DidLocalState,
  DidLocalStateSchema,
  RawDidDocument,
  RawDidDocumentSchema,
} from '@saito/models';
import { DidDocumentProofSigner } from './core/proof';

// TODO: 更新seq和hash
@Injectable()
export class DidLocalBuilder {
  constructor(private readonly signer: DidDocumentProofSigner) {}

  async build(state: DidLocalState): Promise<RawDidDocument> {
    DidLocalStateSchema.parse(state);
    const baseDoc = {
      '@context': state.contextList,
      id: state.did,
      verificationMethod: state.verificationMethod,
      authentication: [state.authentication],
      service: state.serviceList,
      'sight:seq': state.seq,
      'sight:hash': state.hash,
    };
    if (state.controller !== undefined) {
      (baseDoc as any).controller = state.controller;
    }
    const parsed = RawDidDocumentSchema.safeParse(baseDoc);
    if (!parsed.success) throw parsed.error;
    return await this.signer.signAndAttachProof(
      parsed.data,
      state.keyPair.secretKey,
      state.verificationMethod[0].id,
    );
  }
}