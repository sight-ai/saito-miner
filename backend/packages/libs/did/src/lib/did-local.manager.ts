import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  DidDocumentVerificationMethod,
  DidLocalState,
  DidLocalStateSchema,
  ParsedDidDocumentSchema,
  RawDidDocument,
} from '@saito/models';
import { MessageHandlerRegistry } from '@saito/tunnel';
import { ContextHandlerRegistry } from './core/context/context-handler/context-handler.registry';
import { DidLocalBuilder } from './did-local.builder';
import { toKeyPair, toPeerId, toPublicKeyBase58, peerIdToPublicKey, sign, verifySignature } from './did.utils';
import { DidLocalStorage } from './did-document-storage/did-local.storage';
import { DidDocumentImpl } from './core/did-document';

@Injectable()
export class DidLocalManager {
  private readonly logger = new Logger(DidLocalManager
  .name);

  private state!: DidLocalState;
  private didDocument!: RawDidDocument;
  private didImpl!: DidDocumentImpl;

  private didUpdated: boolean = false;

  constructor(
    @Inject('SIGHT_SEQ') private readonly seq: number,
    @Inject('SIGHT_HASH') private readonly hash: string,
    @Inject('KEY_PAIR') private readonly seed: Uint8Array,
    @Inject('AUTHENTICATION') private readonly authentication: string,
    private readonly contextRegistry: ContextHandlerRegistry,
    private readonly messageHandlerRegistry: MessageHandlerRegistry,
    private readonly builder: DidLocalBuilder,
    private readonly storage: DidLocalStorage,
  ) {
    this.onModuleInit();
  }


  async onModuleInit() {
    await this.initState();
    await this.refreshDocument();
    this.logger.log('DidLocalManager fully initialized!');
  }

  private async initState() {
    const loaded = await this.storage.load();
    const contextList = this.contextRegistry.getLocalUrls();
    const keyPair = toKeyPair(this.seed);
    const publicKey = toPublicKeyBase58(keyPair);
    const peerId = toPeerId(keyPair.publicKey);
    const did = `did:sight:hoster:${peerId}`;
    const serviceList = buildServiceList(this.messageHandlerRegistry, did);
    const verificationMethod = [
      {
        id: this.authentication,
        type: 'Ed25519VerificationKey2020',
        controller: did,
        publicKeyMultibase: publicKey,
      },
    ];
    this.state = {
      contextList,
      serviceList,
      keyPair: {
        publicKey: new Uint8Array(keyPair.publicKey),
        secretKey: new Uint8Array(keyPair.secretKey)
      },
      publicKey,
      did,
      authentication: this.authentication,
      verificationMethod,
      seq: this.seq,
      hash: this.hash,
    };
    if ( !this.state.controller && loaded && loaded.controller !== undefined) {
      this.state.controller = loaded.controller;
      this.logger.log(`Loaded the controller.`);
    }
    // const pk = peerIdToPublicKey(did);
    // console.log(`keypair: ${keyPair.publicKey}, pk: ${pk}`);
  }

  // re-scan local state and generate a new did document
  async updateDocument(): Promise<void> {
    await this.initState();
    await this.refreshDocument();
    this.logger.log(`Updated the local Did document`)
  }

  writeLocalDid(raw: RawDidDocument) {
    this.didDocument = raw;
    const parsedDid = ParsedDidDocumentSchema.safeParse(raw);
    if (parsedDid.success) this.didImpl = new DidDocumentImpl(parsedDid.data);
  }

  async load(): Promise<void> {
    const loaded = await this.storage.load();
    if (loaded && loaded['sight:seq'] !== undefined) {
      if (
        !this.didDocument ||
        (loaded['sight:seq'] > this.didDocument['sight:seq']!)
      ) {
        this.writeLocalDid(loaded);
        this.logger.log(`Loaded local Did document`)
      }
    } else {
      await this.refreshDocument();
    }
  }

  // refresh local did document based on local state
  private async refreshDocument() {
    DidLocalStateSchema.parse(this.state);
    const newDoc = await this.builder.build(this.state);
    const isNewer = await this.isNewerThanPersist(newDoc);
    if (isNewer) {
      this.writeLocalDid(newDoc);
      await this.setDidUpdated();
      await this.storage.persist(this.didDocument);
    }
  }

  async isNewerThanPersist(newDid: RawDidDocument): Promise<boolean>{
    const persistedDid = await this.storage.load();
    if (!this.didDocument || !persistedDid) return true;
    else {
      // console.log(`persisted: ${persistedDid['sight:seq']! }, newDId: ${newDid['sight:seq']!}`)
      if (persistedDid['sight:seq']! < newDid['sight:seq']!)
        return true;
    }
    return false;
  }

  getDocument(): RawDidDocument {
    return this.didDocument;
  }
  getDocumentObj(): DidDocumentImpl {
    return this.didImpl;
  }
  getLocalServiceId(): string[] {
    return this.didImpl.getServiceId();
  }
  getState(): DidLocalState {
    return { ...this.state };
  }
  getContextList(): string[] {
    return this.state.contextList;
  }
  getServiceList(): Record<string, unknown>[] {
    return this.state.serviceList;
  }
  getPeerId(): string {
    return this.state.did;
  }
  getVerificationMethod(): DidDocumentVerificationMethod[] {
    return this.state.verificationMethod;
  }
  getAuthentication(): string {
    return this.state.authentication;
  }
  getPublicKey(): string {
    return this.state.publicKey;
  }
  getDidUodated(): boolean {
    return this.didUpdated;
  }
  getController(): string | undefined {
    return this.state.controller;
  }

  signNonce(nonce: string | Uint8Array): string {
    return sign(nonce, this.state.keyPair.secretKey);
  }

  verifyNonceSignature(nonce: string | Uint8Array, signature: string, publicKey: string): boolean {
    return verifySignature(nonce, signature, publicKey);
  }

  async resetDidUpdated() {
    this.didUpdated = false;
  }

  private async setDidUpdated() {
    this.didUpdated = true;
  }

  async patch(fields: Partial<DidLocalState>) {
    this.state = { ...this.state, ...fields };
    await this.refreshDocument();
  }

  async setController(newController: string) {
    this.state.controller = newController;
    await this.refreshDocument();
  }

  private async setContextList(contexts: string[]) {
    this.state.contextList = contexts;
    await this.refreshDocument();
  }
  private async setServiceList(services: Record<string, unknown>[]) {
    this.state.serviceList = services;
    await this.refreshDocument();
  }
  private async setKeyPair(seed: Uint8Array) {
    const keyPair = toKeyPair(seed);
    const publicKey = toPublicKeyBase58(keyPair);
    const peerId = toPeerId(keyPair.publicKey);
    const did = `did:sight:hoster:${peerId}`;
    const verificationMethod = [
      {
        id: this.authentication,
        type: 'Ed25519VerificationKey2020',
        controller: did,
        publicKeyMultibase: publicKey,
      },
    ];
    this.state = {
      ...this.state,
      keyPair: {
        publicKey: new Uint8Array(keyPair.publicKey),
        secretKey: new Uint8Array(keyPair.secretKey)
      },
      publicKey,
      did,
      verificationMethod,
    };
    await this.refreshDocument();
  }
  private async setSeq(seq: number) {
    this.state.seq = seq;
    await this.refreshDocument();
  }
  private async setHash(hash: string) {
    this.state.hash = hash;
    await this.refreshDocument();
  }
}

type ServiceEntry = {
  id: string;
  type: string;
  serviceEndpoint: string | Record<string, unknown>;
};

function buildServiceList(
  messageHandlerRegistry: MessageHandlerRegistry,
  did: string
): ServiceEntry[] {
  const p2pTypes: string[] = messageHandlerRegistry.getAllIncomeHandlers();
  const p2pServices: ServiceEntry[] = p2pTypes.map(type => ({
    id: `#${type}-handler`,
    type: "P2PMessageHandler",
    serviceEndpoint: {
      type,
      direction: "income",
      schema: `https://schemas.sight.ai/message-types/${type}.json`,
      description: `Accepts ${type} messages`
    }
  }));

  const manifestService: ServiceEntry = {
    id: "#manifest",
    type: "ModelManifestService",
    serviceEndpoint: `${did}/model_manifest`
  };

  return [...p2pServices, manifestService];
}
