import { Module } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TunnelModule, KEYPAIR_EVENTS, KeyPairReadyEvent } from '@saito/tunnel';
import { ContextHandlerRegistry } from './core/context/context-handler/context-handler.registry';
import { DidDocumentAssembler } from './core/did-document.assembler';
import { DidDocumentParser } from './core/parser/did-document.parser';
import { DidDocumentProofSigner, DidDocumentVerifier } from './core/proof';
import {
  DidDocumentManagerProvider,
  DidDocumentManagerService,
} from './did-document-manager/did-document-manager.service';
import { DidLocalStorage } from './did-document-storage/did-local.storage';
import { DidManagerStorage } from './did-document-storage/did-manager.storage';
import {
  DidDocumentOrchestrator,
  DidDocumentOrchestratorProvider,
} from './did-document.orchestrator';
import { DidLocalBuilder } from './did-local.builder';
import { DidLocalManager } from './did-local.manager';
import { DidServiceImpl, DidServiceProvider } from './did.service';
import { KeyPairManager } from './services/key-pair-manager.service';

@Module({
  imports: [TunnelModule],
  providers: [
    DidServiceProvider,
    DidDocumentOrchestratorProvider,
    DidDocumentManagerProvider,
    DidServiceImpl,
    DidDocumentManagerService,
    DidDocumentAssembler,
    DidDocumentOrchestrator,
    DidDocumentParser,
    DidDocumentProofSigner,
    DidDocumentVerifier,
    ContextHandlerRegistry,
    DidLocalManager,
    DidLocalBuilder,
    DidLocalStorage,
    DidManagerStorage,
    KeyPairManager,
    {
      provide: 'SIGHT_SEQ',
      useValue: 1,
    },
    {
      provide: 'SIGHT_HASH',
      useValue: '123',
    },
    {
      provide: 'KEY_PAIR',
      useFactory: async (keyPairManager: KeyPairManager, eventEmitter: EventEmitter2) => {
        const keyPair = await keyPairManager.getOrGenerateKeyPair();

        // 发送 KeyPair 准备就绪事件，通知 tunnel 模块
        eventEmitter.emit(KEYPAIR_EVENTS.KEYPAIR_READY, new KeyPairReadyEvent(keyPair));

        return keyPair;
      },
      inject: [KeyPairManager, EventEmitter2],
    },
    {
      provide: 'AUTHENTICATION',
      useValue: '#key-1',
    },
  ],
  exports: [
    'KEY_PAIR',
    DidServiceProvider,
    DidDocumentManagerService,
    DidServiceImpl,
    KeyPairManager,
  ],
})
export class DidModule {}
