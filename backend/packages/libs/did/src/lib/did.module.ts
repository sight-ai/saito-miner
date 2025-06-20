import { Module } from '@nestjs/common';
import { ContextHandlerRegistry } from './core/context/context-handler/context-handler.registry';
import { DidDocumentImpl } from './core/did-document';
import { DidDocumentAssembler } from './core/did-document.assembler';
import { DidDocumentParser } from './core/parser/did-document.parser';
import { DidDocumentProofSigner, DidDocumentVerifier } from './core/proof';
import { DidDocumentManagerProvider, DidDocumentManagerService } from './did-document-manager/did-document-manager.service';
import { DidDocumentOrchestrator, DidDocumentOrchestratorProvider } from './did-document.orchestrator';
import { DidServiceImpl, DidServiceProvider } from './did.service';
import { TunnelModule } from '@saito/tunnel'

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
    DidDocumentImpl,
    DidDocumentVerifier,
    ContextHandlerRegistry,
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
      useValue: [
        1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,
        17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32
      ],
    },
    {
      provide: 'AUTHENTICATION',
      useValue: '#key-1',
    },
  ],
  exports: [DidServiceProvider, DidDocumentManagerService],
})
export class DidModule {}
