import { z } from 'zod';
import { VerificationMethodSchema } from './did-document.schema';

export const DidLocalStateSchema = z.object({
  contextList: z.array(z.string()),
  serviceList: z.array(z.record(z.unknown())),
  keyPair: z.object({
    publicKey: z.instanceof(Uint8Array),
    secretKey: z.instanceof(Uint8Array),
  }),
  controller: z.string().optional(),
  publicKey: z.string(),
  did: z.string(),
  authentication: z.string(),
  verificationMethod: z.array(VerificationMethodSchema),
  seq: z.number(),
  hash: z.string(),
}).passthrough();

export type DidLocalState = z.infer<typeof DidLocalStateSchema>;