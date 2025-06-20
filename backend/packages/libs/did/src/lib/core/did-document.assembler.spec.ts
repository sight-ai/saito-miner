import { DidDocumentAssembler } from './did-document.assembler';
import { DidDocumentParser } from './parser/did-document.parser';
import { DidDocumentVerifier } from './proof/did-document.verifier';
import { DidDocumentImpl } from './did-document';
import { RawDidDocument } from '../../../../models';
import { didV1ContextHandler } from './context/context-handler/did-v1.context-handler';
import { DidDocumentProofSigner } from './proof/did-document.proofSigner';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { ContextHandlerRegistry } from './context/context-handler/context-handler.registry';

const mockParser = {
  parse: jest.fn()
};

const mockVerifier = {
  verifyProof: jest.fn()
};

describe('DidDocumentAssembler', () => {
  let assembler: DidDocumentAssembler;

  beforeEach(() => {
    assembler = new DidDocumentAssembler(
      mockParser as unknown as DidDocumentParser,
      mockVerifier as unknown as DidDocumentVerifier
    );
  });

  it('should assemble DidDocumentImpl if no unknowns', async () => {
    const raw: RawDidDocument = { id: 'did:test:1' } as any;
    const parsed = {
      id: 'did:test:1',
      unknownContexts: [],
      unknownTerms: [],
      unknownServiceTypes: [],
    };

    mockParser.parse.mockReturnValue(parsed);
    mockVerifier.verifyProof.mockResolvedValue(true);

    const result = await assembler.fromRaw(raw);

    expect(result.parsed).toBe(parsed);
    expect(result.parsed.unknownContexts).toEqual([]);
    expect(result.parsed.unknownTerms).toEqual([]);
    expect(result.parsed.unknownServiceTypes).toEqual([]);
    expect(result.isProofValid).toBe(true);
    expect(result.didImpl).toBeInstanceOf(DidDocumentImpl);
  });

  it('should not return didImpl if there are unknownContexts', async () => {
    const raw: RawDidDocument = { id: 'did:test:2' } as any;
    const parsed = {
      id: 'did:test:2',
      unknownContexts: ['https://custom/unknown'],
      unknownTerms: [],
      unknownServiceTypes: [],
    };

    mockParser.parse.mockReturnValue(parsed);

    const result = await assembler.fromRaw(raw);

    expect(result.parsed.unknownContexts!.length).toBeGreaterThan(0);
    expect(result.didImpl).toBeUndefined();
  });

  it('should not return didImpl if there are unknownTerms', async () => {
    const raw: RawDidDocument = { id: 'did:test:3' } as any;
    const parsed = {
      id: 'did:test:3',
      unknownContexts: [],
      unknownTerms: ['strangeTerm'],
      unknownServiceTypes: [],
    };

    mockParser.parse.mockReturnValue(parsed);

    const result = await assembler.fromRaw(raw);

    expect(result.parsed.unknownTerms!.length).toBeGreaterThan(0);
    expect(result.didImpl).toBeUndefined();
  });

  it('should not return didImpl if proof is invalid', async () => {
    const raw: RawDidDocument = { id: 'did:test:4' } as any;
    const parsed = {
      id: 'did:test:4',
      unknownContexts: [],
      unknownTerms: [],
      unknownServiceTypes: [],
    };

    mockParser.parse.mockReturnValue(parsed);
    mockVerifier.verifyProof.mockResolvedValue(false);

    const result = await assembler.fromRaw(raw);

    expect(result.isProofValid).toBe(false);
    expect(result.didImpl).toBeUndefined();
  });
});

describe('DidDocumentAssembler full stack', () => {
  const keyPair = nacl.sign.keyPair.fromSeed(
    new Uint8Array([
      1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,
      17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32
    ])
  );
  const privateKey = keyPair.secretKey;
  const publicKey = keyPair.publicKey;
  const pubKeyBase58 = bs58.encode(publicKey);

  // 2. 构造未签名的 did raw doc
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
        id: '#pong-handler',
        type: 'P2PMessageHandler',
        serviceEndpoint: {
          type: 'pong',
          direction: 'income',
          schema: 'https://schemas.sight.ai/message-types/pong.json',
          description: 'Accepts pong messages for health checking'
        }
      },
      {
        id: '#manifest',
        type: 'ModelManifestService',
        serviceEndpoint: 'p2p://peer12D3KooWABC/model_manifest'
      }
    ]
  };

  const proofSigner = new DidDocumentProofSigner();
  const contextHandlerRegistry = new ContextHandlerRegistry();
  // contextHandlerRegistry.register('https://www.w3.org/ns/did/v1', didV1ContextHandler);  

  const parser = new DidDocumentParser(contextHandlerRegistry);
  const verifier = new DidDocumentVerifier();
  const assembler = new DidDocumentAssembler(parser, verifier);

  it('should parse, sign, verify and assemble a full DidDocumentImpl', async () => {
    const rawWithProof = await proofSigner.signAndAttachProof(baseRawJson, privateKey, 'did:sight:hoster:peer12D3KooWABC#host-key-1');

    expect(rawWithProof.proof).toBeDefined();

    const result = await assembler.fromRaw(rawWithProof);

    await new Promise(resolve => setTimeout(resolve, 100)); // 等待异步操作完成

    // console.log('Assembled DID Document:', result);

    expect(result.didImpl).toBeInstanceOf(DidDocumentImpl);
    expect(result.isProofValid).toBe(true);
    expect(result.parsed.unknownContexts!.length).toBe(0);
    expect(result.parsed.unknownTerms!.length).toBe(0);
    expect(result.parsed.unknownServiceTypes!.length).toBe(0);

    const didObj = result.didImpl!;
    expect(didObj.getPeerId()).toBe('did:sight:hoster:peer12D3KooWABC');
    expect(didObj.getPublicKey()).toBe(pubKeyBase58);

    // 获取所有serviceId
    expect(didObj.getServiceId()).toEqual(['#ping-handler', '#pong-handler', "#manifest"]);
    // expect(didObj.getServicesById('#ping-handler')).toEqual()
    // 测试获取所有 endpoint type
    expect(didObj.getAllEndpointTypes()).toEqual(['ping', 'pong']); // 只会有一个对象 endpoint
    // 测试是否存在某种 endpoint type
    expect(didObj.hasEndpointType('ping')).toBe(true);
    expect(didObj.hasEndpointType('not-exist')).toBe(false);
    // 测试获取所有 endpoint schema
    expect(didObj.getAllEndpointSchemas()).toEqual(['https://schemas.sight.ai/message-types/ping.json', 'https://schemas.sight.ai/message-types/pong.json']);
    // 测试获取所有 endpoint 的 direction 字段
    expect(didObj.getAllEndpointField('direction')).toContain('income');
    // 测试获取所有 endpoint 的 description 字段
    expect(didObj.getAllEndpointField('description')).toContain('Accepts ping messages for health checking');
    // 测试 ModelManifestService 类型的 endpoint 是字符串
    const allServiceEndpoints = didObj.getAllServiceEndpoints();
    expect(allServiceEndpoints).toContain('p2p://peer12D3KooWABC/model_manifest');  
  });

});