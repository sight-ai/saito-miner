import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { DidDocumentManagerService } from './did-document-manager.service';
import { DidDocumentProofSigner, DidDocumentVerifier } from '../core/proof';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { DidDocumentOrchestrator } from '../did-document.orchestrator';
import { DidDocumentAssembler } from '../core/did-document.assembler';
import { DidDocumentParser } from '../core/parser/did-document.parser';
import { didV1ContextHandler } from '../core/context/context-handler/did-v1.context-handler';
import { DidManagerStorage } from '../did-document-storage/did-manager.storage';
import { ContextHandlerRegistry } from '../core/context/context-handler/context-handler.registry';
import { sightDidV1ContextHandler } from '../core/context/context-handler/sight-did-v1.context-handler';

// 1. 创建静态 Ed25519 密钥对（可以写死方便测试）
const keyPair = nacl.sign.keyPair.fromSeed(
  new Uint8Array([
    1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,
    17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32
  ])
);
const publicKeyBase58 = bs58.encode(keyPair.publicKey);
const privateKey = keyPair.secretKey;

  const homeDir = os.homedir();
  const filePath = path.join(homeDir, '.sightai', 'config', 'did-local.json');

describe('DidDocumentManagerService e2e', () => {
  let registry: DidDocumentManagerService;
  let proofSigner: DidDocumentProofSigner;
  let assembler: DidDocumentAssembler;
  let verifier: DidDocumentVerifier;
  let parser: DidDocumentParser;
  let contextHandlerRegistry: ContextHandlerRegistry; 
  let orchestrator: DidDocumentOrchestrator;
  let storage: DidManagerStorage;
  let baseDoc: any, newDoc: any, legalDoc: any, legalDocV2: any, oldDoc: any;

  beforeAll(() => {
    proofSigner = new DidDocumentProofSigner();
    verifier = new DidDocumentVerifier();
    contextHandlerRegistry = new ContextHandlerRegistry();
    // contextHandlerRegistry.register('https://www.w3.org/ns/did/v1', didV1ContextHandler);
    // contextHandlerRegistry.register('https://schemas.sight.ai/did-service-extension/v1', sightDidV1ContextHandler);
    parser = new DidDocumentParser(contextHandlerRegistry);
    assembler = new DidDocumentAssembler(parser, verifier);
    orchestrator = new DidDocumentOrchestrator(assembler);
    storage = new DidManagerStorage();
  });

  beforeEach(async () => {
    registry = new DidDocumentManagerService(orchestrator, storage);
    await registry.clearAll();
    await fs.unlink(filePath).catch(() => {});

    baseDoc = {
      '@context': [
        'https://www.w3.org/ns/did/v1',
        'https://schemas.sight.ai/did-service-extension/v1',
      ],
      id: 'did:sight:hoster:peerTest',
      controller: '123',
      verificationMethod: [
        {
          id: '#host-key-1',
          type: 'Ed25519VerificationKey2020',
          controller: 'did:sight:hoster:peerTest',
          publicKeyMultibase: publicKeyBase58,
        },
      ],
      authentication: ['#host-key-1'],
      service: [],
      'sight:seq': 1,
      'sight:hash': 'fakehash1', // 这个字段等下会被 proofSigner 重新生成
    };

    newDoc = {...baseDoc, 'sight:seq':2};
  });

  afterEach(async () => {
    await fs.unlink(filePath).catch(() => {});
  });

  async function generateSignedDoc(rawDoc: any) {
    const docWithoutProof = { ...rawDoc };
    delete docWithoutProof.proof;
    const docWithProof = await proofSigner.signAndAttachProof(docWithoutProof, privateKey, `${rawDoc.id}#host-key-1`);
    return docWithProof;
  }

  it('should add and get a manifest', async () => {
    legalDoc = await generateSignedDoc(baseDoc);
    await registry.addDocument(legalDoc);
    expect(registry.hasPeerId('did:sight:hoster:peerTest')).toBe(true);
    const doc = await registry.getDocument(legalDoc.id);
    expect(doc).toBeDefined();
    expect(doc!.getPeerId()).toBe(legalDoc.id);
    expect(await registry.getPublicKeyByPeerId(legalDoc.id)).toBe(publicKeyBase58);
  });

  it('should replace manifest only if seq is newer', async () => {
    legalDoc = await generateSignedDoc(baseDoc);
    oldDoc = await generateSignedDoc(baseDoc);
    legalDocV2 = await generateSignedDoc(newDoc);

    await registry.addDocument(legalDoc);
    await registry.addDocument(oldDoc); // seq 旧，不会替换
    let doc = await registry.getDocument(legalDoc.id);
    expect(doc!.getSeq()).toBe(1); 

    await registry.addDocument(legalDocV2);
    doc = await registry.getDocument(legalDoc.id);
    expect(doc!.getSeq()).toBe(2);
  });

  it('should remove manifest', async () => {
    legalDoc = await generateSignedDoc(baseDoc);
    await registry.addDocument(legalDoc);
    expect(await registry.getDocument(legalDoc.id)).toBeDefined();
    await registry.removeDocument(legalDoc.id);
    expect(await registry.getDocument(legalDoc.id)).toBeUndefined();
  });

  it('should persist and reload manifests', async () => {
    legalDoc = await generateSignedDoc(baseDoc);
    await registry.addDocument(legalDoc);

    const newRegistry = new DidDocumentManagerService(orchestrator, storage);
    const preDoc = await newRegistry.getDocument(legalDoc.id);
    expect(preDoc).toBeUndefined();
    await newRegistry.load();
    const doc = await newRegistry.getDocument(legalDoc.id);
    expect(doc).toBeDefined();
  });

  it('should filter manifests', async () => {
    legalDoc = await generateSignedDoc(baseDoc);
    legalDocV2 = await generateSignedDoc(newDoc);
    await registry.addDocument(legalDoc);
    await registry.addDocument(legalDocV2);
    const filtered = await registry.filterDocuments(
      doc => Number(doc!.getSeq()) > 1,
    );
    expect(filtered.some(doc => Number(doc!.getSeq()) > 1)).toBe(true);
  });


  it('should fail verification if doc is tampered (e.g. field order or value changed)', async () => {
    const docWithProof = await generateSignedDoc(baseDoc);
    const tampered = { ...docWithProof, id: 'did:sight:hoster:peerHacked' };
    await expect(registry.addDocument(tampered)).rejects.toThrow();
  });

  it('should persist and reload manifests correctly', async () => {
    const legalDoc = await generateSignedDoc(baseDoc);
    await registry.addDocument(legalDoc);
    await registry.load();
    const doc = await registry.getDocument(legalDoc.id);
    expect(doc).toBeDefined();
    expect(doc!.getPeerId()).toBe(legalDoc.id);
  });

  it('should update a document in storage when persistOne is called', async () => {
    legalDoc = await generateSignedDoc(baseDoc);
    await registry.addDocument(legalDoc);
  
    // 修改内容，seq+1，证明覆盖
    const updatedDoc = { ...legalDoc, 'sight:seq': legalDoc['sight:seq'] + 1 };
    await storage.persistOne(updatedDoc);
  
    // 加载后应为新的 seq
    await registry.load();
    const loadedDoc = await registry.getDocument(legalDoc.id);
    expect(loadedDoc).toBeDefined();
    expect(loadedDoc!.getSeq()).toBe(updatedDoc['sight:seq']);
  });

  it('should only persist newer documents (by seq)', async () => {
    legalDoc = await generateSignedDoc(baseDoc);
    await registry.addDocument(legalDoc);
  
    // seq 更小的应该不会覆盖
    const olderDoc = { ...legalDoc, 'sight:seq': legalDoc['sight:seq'] - 1 };
    const isNewer = await registry.isNewerThanPersist(olderDoc.id, olderDoc);
    expect(isNewer).toBe(false);
  
    // seq 更大的会覆盖
    const newerDoc = { ...legalDoc, 'sight:seq': legalDoc['sight:seq'] + 1 };
    const isNewer2 = await registry.isNewerThanPersist(newerDoc.id, newerDoc);
    expect(isNewer2).toBe(true);
  });

  it('should remove document from storage after removeDocument', async () => {
    legalDoc = await generateSignedDoc(baseDoc);
    await registry.addDocument(legalDoc);
    await registry.removeDocument(legalDoc.id);
  
    // 重新 load，应该没有这个文档
    await registry.load();
    const doc = await registry.getDocument(legalDoc.id);
    expect(doc).toBeUndefined();
  });

  it('should persist and load multiple documents', async () => {
    legalDoc = await generateSignedDoc(baseDoc);
    legalDocV2 = await generateSignedDoc({ ...baseDoc, id: 'did:sight:hoster:peerTest2' });
    await registry.addDocument(legalDoc);
    await registry.addDocument(legalDocV2);
  
    await registry.load();
    expect(await registry.getDocument(legalDoc.id)).toBeDefined();
    expect(await registry.getDocument(legalDocV2.id)).toBeDefined();
  });

});