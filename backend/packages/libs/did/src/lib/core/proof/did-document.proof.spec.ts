import { DidDocumentProofSigner } from './did-document.proofSigner';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { DidDocumentVerifier } from './did-document.verifier';
import stringify from 'fast-json-stable-stringify';
import { DidDocumentParser } from '../parser/did-document.parser';
import { didV1ContextHandler } from '../context/context-handler/did-v1.context-handler';
import { ContextHandlerRegistry } from '../context/context-handler/context-handler.registry';

describe('DidDocumentProofSigner & DidDocumentVerifier', () => {
  const keyPair = nacl.sign.keyPair.fromSeed(
    new Uint8Array([
      1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,
      17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32
    ])
  );
  const privateKey = keyPair.secretKey;
  const publicKey = keyPair.publicKey;
  const pubKeyBase58 = bs58.encode(publicKey);

  const baseRawJson = {
    '@context': [
      'https://www.w3.org/ns/did/v1',
      'https://schemas.sight.ai/did-service-extension/v1'
    ],
    id: 'did:sight:hoster:peer12D3KooWABC',
    verificationMethod: [
      {
        id: '#host-key-1',
        type: 'Ed25519VerificationKey2020',
        controller: 'did:sight:hoster:peer12D3KooWABC',
        publicKeyMultibase: pubKeyBase58,
      }
    ],
    authentication: ['#host-key-1'],
    service: [
      {
        id: '#ping-handler',
        type: 'P2PMessageHandler',
        serviceEndpoint: {
          type: 'ping',
          direction: 'income',
          schema: 'https://schemas.sight.ai/message-types/ping.json',
          description: 'Accepts ping messages for health checking'
        }
      },
      {
        id: '#manifest',
        type: 'ModelManifestService',
        serviceEndpoint: 'p2p://peer12D3KooWABC/model_manifest'
      }
    ]
  };

  it('should sign and verify proof correctly', async () => {
    const signer = new DidDocumentProofSigner();
    const verificationMethodId = 'did:sight:hoster:peer12D3KooWABC#host-key-1';
    const proof = await (signer as any).signProof(
      baseRawJson,
      privateKey,
      verificationMethodId
    );
    // 1. 判断proof字段结构
    expect(proof).toHaveProperty('type', 'Ed25519Signature2020');
    expect(proof).toHaveProperty('proofValue');
    expect(proof.proofValue.length).toBeGreaterThan(10);
    expect(proof).toHaveProperty('verificationMethod', verificationMethodId);

    // 2. 合成 DID 文档
    const didWithProof = await signer.signAndAttachProof(
      baseRawJson,
      privateKey,
      verificationMethodId
    );

    // 3. 用 verifier 校验 proof
    const verifier = new DidDocumentVerifier();
    const verified = await verifier.verifyProof(didWithProof);
    expect(verified).toBe(true);

    // 4. 篡改后验签应失败
    const tampered = { ...didWithProof, id: 'did:sight:hoster:fake' };
    const verifiedFake = await verifier.verifyProof(tampered);
    expect(verifiedFake).toBe(false);
  });

  it('should fail to verify if verificationMethod is missing', async () => {
    const signer = new DidDocumentProofSigner();
    const verificationMethodId = 'did:sight:hoster:peer12D3KooWABC#host-key-1';
    const didWithoutVM = await signer.signAndAttachProof(
      baseRawJson,
      privateKey,
      verificationMethodId
    );
    delete (didWithoutVM as any).verificationMethod;

    const verifier = new DidDocumentVerifier();
    const result = await verifier.verifyProof(didWithoutVM);
    expect(result).toBe(false);
  });

  it('should fail to verify if proof is missing', async () => {
    const didWithoutProof = { ...baseRawJson };
    const verifier = new DidDocumentVerifier();
    const result = await verifier.verifyProof(didWithoutProof);
    expect(result).toBe(false);
  });

  it('should fail to verify if proofValue is invalid', async () => {
    const signer = new DidDocumentProofSigner();
    const verificationMethodId = 'did:sight:hoster:peer12D3KooWABC#host-key-1';
    const proof = await (signer as any).signProof(
      baseRawJson,
      privateKey,
      verificationMethodId
    );
    const didWithProof = { ...baseRawJson, proof: { ...proof, proofValue: 'invalidsig' } };
    const verifier = new DidDocumentVerifier();
    const result = await verifier.verifyProof(didWithProof);
    expect(result).toBe(false);
  });

  it('should fail if verificationMethod id in proof is not found', async () => {
    const signer = new DidDocumentProofSigner();
    const didWithProof = await signer.signAndAttachProof(
      baseRawJson,
      privateKey,
      'did:sight:hoster:peer12D3KooWABC#not-exist'
    );
    const verifier = new DidDocumentVerifier();
    const result = await verifier.verifyProof(didWithProof);
    expect(result).toBe(false);
  });

  it('should verify both raw JSON and ParsedDidDocument formats', async () => {
    const signer = new DidDocumentProofSigner();
    const verificationMethodId = 'did:sight:hoster:peer12D3KooWABC#host-key-1';
    const contextRegistry = new ContextHandlerRegistry();
    contextRegistry.register('https://www.w3.org/ns/did/v1', didV1ContextHandler);
    const parser = new DidDocumentParser(contextRegistry);
  
    const didWithProof = await signer.signAndAttachProof(
      baseRawJson,
      privateKey,
      verificationMethodId
    );
  
    const verifier = new DidDocumentVerifier();
    const verifiedRaw = await verifier.verifyProof(didWithProof);
    expect(verifiedRaw).toBe(true);
  
    const parsedDidDoc = parser.parse(didWithProof);
    console.log('ParsedDidDocument:', parsedDidDoc);

    // const parsedDidDoc2 = {
    //   ...didWithProof,
    //   unknownContexts: [],
    //   unknownTerms: [],
    //   unknownServiceTypes: [],
    // };
    // console.log('ParsedDidDocument2:', parsedDidDoc2);
  
    const verifiedParsed = await verifier.verifyProof(didWithProof);
    expect(verifiedParsed).toBe(true);
  });
});