import { Global, Injectable } from '@nestjs/common';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import stringify from 'fast-json-stable-stringify';
import { DidDocumentProof } from '@saito/models';


// TODO, 清除any
@Injectable()
@Global()
export class DidDocumentProofSigner {
  /**
   * 生成 proof 字段
   * @param doc   待签名的 DID 文档（无 proof 字段）
   * @param privateKey  签名私钥（Uint8Array/Base64/Base58都可）
   * @param verificationMethodId  用哪个 verificationMethod 的 id
   * @returns proof 对象
   */
  private async signProof(
    doc: any,
    privateKey: Uint8Array,
    verificationMethodId: string
  ): Promise<any> {
    const docCopy = { ...doc };
    delete docCopy.proof;

    const message = stringify(docCopy); // string
    const messageBytes = new TextEncoder().encode(message);

    const signature = nacl.sign.detached(messageBytes, privateKey); // Uint8Array
    const signatureBase58 = bs58.encode(signature);

    const proof : DidDocumentProof = {
      type: 'Ed25519Signature2020',
      created: new Date().toISOString(),
      proofPurpose: 'assertionMethod',
      verificationMethod: verificationMethodId, // 如 "did:xxx#host-key-1"
      proofValue: signatureBase58,
    };
    return proof;
  }

  async signAndAttachProof(
    doc: any,
    privateKey: Uint8Array,
    verificationMethodId: string
  ): Promise<any> {
    const proof = await this.signProof(doc, privateKey, verificationMethodId);
    return { ...doc, proof };
  }
}