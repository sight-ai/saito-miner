import { Injectable, Logger } from '@nestjs/common';
import { RawDidDocument } from '@saito/models';
import { DidDocumentImpl } from './core/did-document';
import { DidDocumentAssembler } from './core/did-document.assembler';
import { DidDocumentOrchestratorInterface } from './did-document.orchestrator.interface';

@Injectable()
export class DidDocumentOrchestrator implements DidDocumentOrchestratorInterface{
  private readonly logger = new Logger(DidDocumentOrchestrator.name);
  constructor(private readonly assembler: DidDocumentAssembler) {}

  async toDidImpl(raw: RawDidDocument): Promise<DidDocumentImpl> {
    const result = await this.assembler.fromRaw(raw);
    // console.log('DidDocumentOrchestrator: Assembled DidDocumentImpl:', result);
    if (!result.didImpl) {
      this.logger.error(
        `Failed to assemble DidDocumentImpl: unknown terms/context or proof invalid.`,
      );
      throw new Error(
        'Failed to assemble DidDocumentImpl: unknown terms/context or proof invalid.',
      );
    }
    this.logger.debug(`Successfully get the DidDocument in Orchestrator.`);
    return result.didImpl;
  }
}

export const DidDocumentOrchestratorProvider = {
    provide: 'DidDocumentOrchestrator',
    useClass: DidDocumentOrchestrator,
}
