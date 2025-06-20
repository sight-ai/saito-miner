import { DiscoveryModule } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { MessageHandlerRegistry, TunnelModule } from '@saito/tunnel';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ContextHandlerRegistry } from './core/context/context-handler/context-handler.registry';
import { didV1ContextHandler } from './core/context/context-handler/did-v1.context-handler';
import { sightDidV1ContextHandler } from './core/context/context-handler/sight-did-v1.context-handler';
import { DidDocumentAssembler } from './core/did-document.assembler';
import { DidDocumentParser } from './core/parser/did-document.parser';
import { DidDocumentProofSigner, DidDocumentVerifier } from './core/proof';
import { DidLocalStorage } from './did-document-storage/did-local.storage';
import { DidDocumentOrchestrator } from './did-document.orchestrator';
import { DidLocalBuilder } from './did-local.builder';
import { DidLocalManager } from './did-local.manager';
import { DidServiceImpl } from './did.service';
import { Logger } from '@nestjs/common';
import bs58 from 'bs58'; 


const mockMessageHandlerRegistry = {
  getAllIncomeHandlers: () => ['ping', 'pong', 'context-ping', 'context-pong'],
};

Logger.prototype.debug = function (...args: any[]) {
    console.log('[DEBUG]', ...args);
};

describe('DidServiceImpl (integration)', () => {
  let didService: DidServiceImpl;
  let manager: DidLocalManager;
  const homeDir = os.homedir();
  const filePath = path.join(homeDir, '.sightai', 'config', 'did-local.json');

  beforeEach(async () => {
    try {
      await fs.unlink(filePath);
    } catch {}
    const module: TestingModule = await Test.createTestingModule({
      imports: [DiscoveryModule, TunnelModule],
      providers: [
        // {
        //   provide: DidLocalStorage,
        //   useFactory: () => new DidLocalStorage(filePath),
        // },
        DidLocalManager,
        DidServiceImpl,
        DidDocumentProofSigner,
        ContextHandlerRegistry,
        DidLocalBuilder,
        DidLocalStorage,
        { provide: 'SIGHT_SEQ', useValue: 1 },
        { provide: 'SIGHT_HASH', useValue: 'testhash' },
        { provide: 'KEY_PAIR', useValue: new Uint8Array(32) },
        { provide: 'AUTHENTICATION', useValue: '#key-1' },
      ],
    })
      .overrideProvider(MessageHandlerRegistry)
      .useValue(mockMessageHandlerRegistry)
      .compile();

    didService = module.get<DidServiceImpl>(DidServiceImpl);
    manager = module.get<DidLocalManager>(DidLocalManager);
    // 确保 manager 初始化并生成 did 文档
    // await manager.updateDocument();
    await new Promise(res => setTimeout(res, 50));
  });

  afterEach(async () => {
    try {
      await fs.unlink(filePath);
    } catch {}
  });

  it('should be defined', () => {
    expect(didService).toBeDefined();
  });

  it('should return a valid DID document', async () => {
    const doc = await didService.getDocument();
    expect(doc).toBeDefined();
    expect(doc).toHaveProperty('id');
    expect(doc).toHaveProperty('service');
    expect(Array.isArray(doc.service)).toBeTruthy();
    expect(doc).toHaveProperty('proof');
  });

  it('should refresh the DID document', async () => {
    // await (manager as any).setSeq(999);
    // await didService.refresh();
    // const doc = await didService.getDocument();
    // expect(doc['sight:seq']).toBe(1);

    await (manager as any).setSeq(999);
    await (manager as any).refreshDocument();
    const doc2 = await didService.getDocument();
    expect(doc2['sight:seq']).toBe(999);
  });

  it('should export DidServiceProvider with useClass DidServiceImpl', () => {
    const { DidServiceProvider } = require('./did.service');
    expect(DidServiceProvider.useClass).toBe(DidServiceImpl);
  });

  it('should produce a DID document that can be parsed and verified by orchestrator', async () => {
    // 1. 取到当前生成的 DID 文档
    const didDoc = await didService.getDocument();
    // console.log(`Did: ${JSON.stringify(didDoc, null, 2)}`);

    // 2. 构造解析链
    const contextRegistry = new ContextHandlerRegistry();
    contextRegistry.register(
      'https://www.w3.org/ns/did/v1',
      didV1ContextHandler,
    );
    contextRegistry.register(
      'https://schemas.sight.ai/did-service-extension/v1',
      sightDidV1ContextHandler,
    );
    const parser = new DidDocumentParser(contextRegistry);
    const verifier = new DidDocumentVerifier();
    const assembler = new DidDocumentAssembler(parser, verifier);
    const orchestrator = new DidDocumentOrchestrator(assembler);

    // 3. 执行 parse & verify，期望不会抛错，能得到合法对象
    const doc = await orchestrator.toDidImpl(didDoc);

    // 4. 验证核心属性和签名（你可以根据自己的 getter 方法再加断言）
    expect(doc).toBeDefined();
    expect(doc.getPeerId?.()).toBe(didDoc.id); // 兼容你 doc 的 API
    expect(doc.getSeq?.()).toBe(didDoc['sight:seq']);
    expect(doc.getHash?.()).toBe(didDoc['sight:hash']);
    // ...可补充更多结构断言
  });
  it('should getDocument, getMyPeerId, getMyPublicKey return expected', () => {
    const doc = didService.getDocument();
    expect(doc).toBeDefined();
    expect(didService.getMyPeerId()).toBe(doc.id);
    expect(typeof didService.getMyPublicKey()).toBe('string');
  });
  it('should patch fields and set didUpdated', async () => {
    await didService.resetDidUpdated();
    expect(didService.isDidUpdated()).toBe(false);
    await didService.patch({ seq: 123 });
    expect(didService.isDidUpdated()).toBe(true);
  
    // patch controller 字段
    await didService.patch({ controller: 'test-ctrl' , seq: 1234 });
    await new Promise(res => setTimeout(res, 50));
    expect(didService.getDocument().controller).toBe('test-ctrl');
  });
  it('should setController and update state', async () => {
    await didService.setController('superadmin');
    await didService.patch({seq: 10});
    expect(didService.getDocument().controller).toBe('superadmin');
    expect(didService.isDidUpdated()).toBe(true);
  });
  it('should reset didUpdated after update', async () => {
    await didService.patch({ seq: 999 });
    expect(didService.isDidUpdated()).toBe(true);
    await didService.resetDidUpdated();
    expect(didService.isDidUpdated()).toBe(false);
  });
  it('should refresh the DID document', async () => {
    const oldSeq = didService.getDocument()['sight:seq']!;
    await didService.patch({ seq: oldSeq + 1 });
    // await didService.refresh();
    expect(didService.getDocument()['sight:seq']).toBe(oldSeq + 1);
  });
  it('should isNewerThanPersist behave as expected', async () => {
    const doc = didService.getDocument();
    // should be false (same as current)
    expect(await didService.isNewerThanPersist(doc)).toBe(false);
  
    // should be true if seq 更大
    const doc2 = { ...doc, 'sight:seq': doc['sight:seq']! + 100 };
    expect(await didService.isNewerThanPersist(doc2)).toBe(true);
  });
  it('should return correct public key (base58 string) from getMyPublicKey', () => {
    const pub = didService.getMyPublicKey();
    expect(typeof pub).toBe('string');
    expect(pub.length).toBeGreaterThanOrEqual(32); // base58 一般不短于32
    expect(() => bs58.decode(pub)).not.toThrow();
  
    // 和文档的 publicKeyMultibase 一致
    const doc = didService.getDocument();
    expect(doc.verificationMethod[0]!['publicKeyMultibase']!).toBe(pub);
  });
  it('should return publicKey matching the DID document', () => {
    const pub = didService.getMyPublicKey();
    const doc = didService.getDocument();
    expect(pub).toBe(doc.verificationMethod[0]!['publicKeyMultibase']!);
    expect(typeof pub).toBe('string');
  });
  it('should get did documentImpl and service id', async() => {
    const didImpl = didService.getDocumentObj();
    const serviceId = didService.getLocalServiceId();
    expect(didImpl).toBeDefined();
    expect(typeof didImpl.getPeerId).toBe('function');
    expect(didImpl.getPeerId()).toBe(didService.getDocument().id);
    expect(Array.isArray(serviceId)).toBe(true);
    expect(serviceId.length).toBeGreaterThan(0);
    // 每个 serviceId 应为字符串且符合格式
    for (const sid of serviceId) {
      expect(typeof sid).toBe('string');
      expect(sid.startsWith('#')).toBe(true);
    }
  });
});
