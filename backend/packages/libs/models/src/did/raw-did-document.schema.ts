import { z } from 'zod';

export const RawDidDocumentSchema = z.object({
  '@context': z.union([
    z.string(),
    z.array(z.union([z.string(), z.record(z.unknown())]))
  ]),
  id: z.string(),
  controller: z.string().optional(),
  verificationMethod: z.array(z.record(z.unknown())),
  authentication: z.array(z.union([z.string(), z.record(z.unknown())])),
  service: z.array(z.record(z.unknown())),
  'sight:seq': z.number().optional(),
  'sight:hash': z.string().optional(),
  proof: z.record(z.unknown()).optional()
}).passthrough();

export type RawDidDocument = z.infer<typeof RawDidDocumentSchema>;
