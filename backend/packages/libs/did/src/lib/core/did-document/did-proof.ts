import { DidDocumentProof, ProofSchema } from '@saito/models';
import { DidDocumentElement } from './did-document-element';
import { Logger } from '@nestjs/common';


export class DidProof implements DidDocumentElement {
  private readonly logger = new Logger(DidProof.name);
  constructor(public data: DidDocumentProof) {}

  parse() {
    try {
      ProofSchema.parse(this.data);
    } catch (e) {
      this.logger.error('Proof schema validation failed', e);
      throw new Error('Invalid Proof format');
    }
  }
}