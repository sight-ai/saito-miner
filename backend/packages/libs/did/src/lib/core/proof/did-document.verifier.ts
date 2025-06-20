import { Global, Injectable, Logger } from '@nestjs/common';
import { DidDocumentProof, DidDocumentVerificationMethod, ParsedDidDocument, RawDidDocument } from '@saito/models';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import stringify from 'fast-json-stable-stringify';


@Injectable()
@Global()
export class DidDocumentVerifier {
  private readonly logger = new Logger(DidDocumentVerifier.name);
  /**
   * 校验 DID 文档的 proof
   * @param rawDoc 已经解析过的 DID 文档
   */
  async verifyProof(rawDoc: RawDidDocument): Promise<boolean> {
    const proof = rawDoc.proof as DidDocumentProof;
    if (!proof || !proof.verificationMethod) return false;
    this.logger.debug(`Get the proof term.`)

    const keyFragment = proof.verificationMethod.split('#')[1];
    if (!rawDoc.verificationMethod) return false;
    const vm = (rawDoc.verificationMethod as DidDocumentVerificationMethod[]).find(
      m =>
        (m.id.startsWith('#') ? m.id.substring(1) : m.id) === keyFragment
    );
    if (!vm || !vm.publicKeyMultibase) return false;
    this.logger.debug(`Get the verification method.`);

    const {
      proof: _,
      ...docWithoutProof
    } = rawDoc;
    const message = new TextEncoder().encode(stringify(docWithoutProof));

    let signature: Uint8Array;
    let pubkey: Uint8Array;
    try {
      signature = bs58.decode(proof.proofValue);
      pubkey = bs58.decode(vm.publicKeyMultibase);
    } catch (e) {
      return false;
    }
    this.logger.debug(`Get the signature`);
    
    return nacl.sign.detached.verify(message, signature, pubkey);
  }
}
