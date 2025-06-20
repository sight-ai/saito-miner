import { Test, TestingModule } from '@nestjs/testing';
import { DidServiceImpl } from './did.service';
import { MessageHandlerRegistry, TunnelModule } from '@saito/tunnel';
import { ContextHandlerRegistry } from './core/context/context-handler/context-handler.registry';
import { DidLocalBuilder } from './did-local.builder';
import { DiscoveryModule } from '@nestjs/core';
import { DidDocumentProofSigner } from './core/proof';
import { DidLocalManager } from './did-local.manager';
import { DidLocalStorage } from './did-document-storage/did-local.storage';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { RawDidDocument } from '../../../models/src';

const mockMessageHandlerRegistry = {
  getAllIncomeHandlers: () => ['ping', 'pong', 'context-ping', 'context-pong'],
};

describe('DidServiceImpl (integration)', () => {
  let didService: DidServiceImpl;
  const homeDir = os.homedir();
  const filePath = path.join(homeDir, '.sightai', 'config', 'did-local.json');

  beforeEach(async () => {
    try { await fs.unlink(filePath); } catch {}
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
      ]
    })
    .overrideProvider(MessageHandlerRegistry)
    .useValue(mockMessageHandlerRegistry)
    .compile();

    didService = module.get<DidServiceImpl>(DidServiceImpl);
    await new Promise(res => setTimeout(res, 50));
  });

  afterEach(async () => {
    try { await fs.unlink(filePath); } catch {}
  });

  it('should be defined', () => {
    expect(didService).toBeDefined();
  });

  it('should return a valid DID document', async () => {
    const doc = await didService.getDocument();
    expect(doc).toHaveProperty('id');
    expect(doc).toHaveProperty('service');
    expect(Array.isArray(doc.service)).toBeTruthy();
    // console.log('Did document:', JSON.stringify(doc, null, 2));
  });
});

describe('DidLocalManager (persist & load)', () => {
  let didManager: DidLocalManager;
  let storage: DidLocalStorage;
  const homeDir = os.homedir();
  const filePath = path.join(homeDir, '.sightai', 'config', 'did-local.json');

  beforeEach(async () => {
    try { await fs.unlink(filePath); } catch {}

    const module: TestingModule = await Test.createTestingModule({
      imports: [DiscoveryModule, TunnelModule],
      providers: [
        // {
        //   provide: DidLocalStorage,
        //   useFactory: () => new DidLocalStorage(filePath),
        // },
        DidLocalManager,
        DidLocalBuilder,
        DidDocumentProofSigner,
        ContextHandlerRegistry,
        DidLocalStorage,
        { provide: 'SIGHT_SEQ', useValue: 2 },
        { provide: 'SIGHT_HASH', useValue: 'abc123' },
        { provide: 'KEY_PAIR', useValue: new Uint8Array(32) },
        { provide: 'AUTHENTICATION', useValue: '#key-1' },
      ],
    })
      .overrideProvider(MessageHandlerRegistry)
      .useValue(mockMessageHandlerRegistry)
      .compile();

    didManager = module.get<DidLocalManager>(DidLocalManager);
    storage = module.get<DidLocalStorage>(DidLocalStorage);
    // await didManager.updateDocument();
    await new Promise(res => setTimeout(res, 50));
  });

  afterEach(async () => {
    try { await fs.unlink(filePath); } catch {}
  });

  it('should persist the didDocument to storage', async () => {
    const stored = await storage.load();

    // console.log(`stored DID: ${JSON.stringify(stored, null, 2)}`)
    expect(stored).toBeDefined();
    expect(stored).toHaveProperty('id');
    expect(stored).toHaveProperty('service');
    expect(stored!['sight:seq']).toBe(2);
  });

  it('should load the didDocument from storage', async () => {
    const newDoc = await storage.load();
    newDoc!['sight:seq'] = 10;
    newDoc!['sight:hash'] = '9999';
    if(newDoc) await storage.persist(newDoc);
    await didManager.load();
    const doc = await didManager.getDocument();
    expect(doc!['sight:seq']).toBe(10);
    expect(doc!['sight:hash']).toBe('9999');
  });

  it('should not overwrite with a smaller seq', async () => {
    const doc10 = await storage.load();
    doc10!['sight:seq'] = 10;
    doc10!['sight:hash'] = 'bigger';
    if(doc10) await storage.persist(doc10);
    await didManager.load();

    const doc2 = { ...doc10, 'sight:seq': 2, 'sight:hash': 'smaller' } as RawDidDocument;
    if(doc2) await storage.persist(doc2);
    await didManager.load();
    const doc = await didManager.getDocument();
    expect(doc!['sight:seq']).toBe(10);
    expect(doc!['sight:hash']).toBe('bigger');
  });

  it('should persist only when seq is increased', async () => {
    const oldStored = await storage.load();
    const oldSeq = oldStored!['sight:seq'];

    await (didManager as any).setSeq(1)
    await didManager.updateDocument();
    let stored = await storage.load();
    expect(stored!['sight:seq']).toBe(oldSeq);

    await (didManager as any).setSeq(3)
    await didManager.updateDocument();
    stored = await storage.load();
    expect(stored!['sight:seq']).toBe(3);
  });

  it('should load only when seq is smaller', async () => {
    const oldStored = await storage.load();
    const oldSeq = oldStored!['sight:seq'];

    await (didManager as any).setSeq(1)
    await didManager.load();
    let stored = await storage.load();
    expect(stored!['sight:seq']).toBe(oldSeq);
    let oldState = didManager.getDocument();
    expect(oldState!['sight:seq']).toBe(oldSeq);

    await (didManager as any).setSeq(3)
    await didManager.load();
    stored = await storage.load();
    expect(stored!['sight:seq']).toBe(3);
    oldState = didManager.getDocument();
    expect(oldState!['sight:seq']).toBe(3);
  });

  it('should set didUpdated flag when document updated', async () => {
    // 初始应为 true（初始化已更新）
    expect(didManager.getDidUodated()).toBe(true);
    await didManager.resetDidUpdated();
    expect(didManager.getDidUodated()).toBe(false);
  
    // 再次 updateDocument 后应为 true
    await (didManager as any).setSeq(3)
    await didManager.updateDocument();
    expect(didManager.getDidUodated()).toBe(true);
  });
  // TODO
  it('should set didUpdated after setController', async () => {
    await didManager.resetDidUpdated();
    expect(didManager.getDidUodated()).toBe(false);
    expect(didManager.getController()).toBe(undefined);
  
    await didManager.setController('test-controller');
    await (didManager as any).setSeq(3);
    expect(didManager.getDidUodated()).toBe(true);
    const state = didManager.getState();
    expect(state.controller).toBe('test-controller');
    await (didManager as any).setSeq(4);
    const state2 = didManager.getState();
    expect(didManager.getController()).toBe('test-controller');
  });
  
  it('should return true/false for isNewerThanPersist()', async () => {
    const stored = await storage.load();
    const doc = { ...stored, 'sight:seq': stored!['sight:seq']! + 1 } as RawDidDocument;
    expect(await didManager.isNewerThanPersist(doc)).toBe(true);
  
    const doc2 = { ...stored, 'sight:seq': stored!['sight:seq']! - 1 } as RawDidDocument;
    expect(await didManager.isNewerThanPersist(doc2)).toBe(false);
  
    const doc3 = { ...stored, 'sight:seq': stored!['sight:seq']! } as RawDidDocument;
    expect(await didManager.isNewerThanPersist(doc3)).toBe(false);
  });
  
  it('should patch state and update document', async () => {
    await didManager.resetDidUpdated();
    await didManager.patch({ seq: 77, hash: 'patched' });
    const state = didManager.getState();
    expect(state.seq).toBe(77);
    expect(state.hash).toBe('patched');
    expect(didManager.getDidUodated()).toBe(true);
  });

});