import { Logger } from '@nestjs/common';
import {
  DidDocumentVerificationMethod,
  VerificationMethodSchema,
} from '@saito/models';
import { DidDocumentElement } from './did-document-element';

export class DidVerificationMethod implements DidDocumentElement {
  private readonly logger = new Logger(DidVerificationMethod.name);
  constructor(public data: DidDocumentVerificationMethod) {}

  parse() {
    try {
      VerificationMethodSchema.parse(this.data);
    } catch (e) {
      this.logger.error('Proof schema validation failed', e);
      throw new Error('Invalid VerificationMethod format');
    }
  }

  getPublicKey(): string {
    return this.data.publicKeyMultibase;
  }
}
