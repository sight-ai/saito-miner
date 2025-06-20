import { Injectable, Logger } from '@nestjs/common';
import { ParsedDidDocument, RawDidDocument } from '@saito/models';
import { DidDocumentImpl } from './did-document';
import { DidDocumentParser } from './parser/did-document.parser';
import { DidDocumentVerifier } from './proof/did-document.verifier';

export type Assembler = {
  parsed: ParsedDidDocument;
//   unknownContexts: (string | Record<string, unknown>)[];
//   unknownTerms: string[];
//   unknownServiceTypes: string[];
  isProofValid: boolean;
  didImpl?: DidDocumentImpl;
};

// RawDidDocument -> DidDocumentImpl
@Injectable()
export class DidDocumentAssembler {
  private readonly logger = new Logger(DidDocumentAssembler.name);
  constructor(
    private readonly parser: DidDocumentParser,
    private readonly verifier: DidDocumentVerifier,
  ) {}

  async fromRaw(raw: RawDidDocument): Promise<Assembler> {
    const parsed = this.parser.parse(raw);
    const unknownContexts = parsed.unknownContexts || [];
    const unknownTerms = parsed.unknownTerms || [];
    const unknownServiceTypes = parsed.unknownServiceTypes || [];

    let isProofValid = false;
    let didImpl: DidDocumentImpl | undefined = undefined;

    if (
      unknownContexts.length === 0 &&
      unknownTerms.length === 0 &&
      unknownServiceTypes.length === 0
    ) {
        this.logger.debug(`No unknown term, begin to verify.`)
      isProofValid = await this.verifier.verifyProof(raw);
      if (isProofValid) {
        didImpl = new DidDocumentImpl(parsed);
        this.logger.debug(`Parsed the DidDocument successfully.`);
      } else this.logger.debug(`Fail to verify proof.`)
    }
    return {
      parsed,
      isProofValid,
      didImpl,
    };
  }
}
