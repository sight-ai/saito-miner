import { z } from 'zod'
import {ProofSchema, ServiceSchema, VerificationMethodSchema} from "./did-document.schema";

export const ParsedDidDocumentSchema = z.object({
  '@context': z.union([
    z.string(),
    z.array(z.union([z.string(), z.record(z.unknown())]))
  ]),
  id: z.string(),
  controller: z.string().optional(),
  verificationMethod: z.array(VerificationMethodSchema).optional(),
  authentication: z.array(z.union([z.string(), VerificationMethodSchema])).optional(),
  service: z.array(ServiceSchema).optional(),
  proof: ProofSchema.optional(),
  unknownContexts: z.array(z.union([z.string(), z.record(z.unknown())])).optional(),
  unknownTerms: z.array(z.string()).optional(),
  unknownServiceTypes: z.array(z.string()).optional()
}).passthrough();

export type ParsedDidDocument = z.infer<typeof ParsedDidDocumentSchema>;
