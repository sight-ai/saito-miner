import { z } from 'zod';

export const VerificationMethodSchema = z.object({
  id: z.string(),
  type: z.string(),
  controller: z.string(),
  publicKeyMultibase: z.string()
});

export type DidDocumentVerificationMethod = z.infer<typeof VerificationMethodSchema>;

// The object form of a serviceEndpoint — sometimes called ServiceEndpointObject in DID specs
export const ServiceEndpointObjectSchema = z.object({
  type: z.string(),
  direction: z.string().optional(),
  schema: z.string().url().optional(),
  task_type: z.string().optional(),
  description: z.string().optional(),
  // Other fields can be added here in the future as needed
});

export type DidDocumentServiceEndpointObject = z.infer<typeof ServiceEndpointObjectSchema>;

// Full serviceEndpoint: string | object | array of string/object
export const ServiceEndpointSchema = z.union([
  z.string(),
  ServiceEndpointObjectSchema,
  z.array(z.union([z.string(), ServiceEndpointObjectSchema]))
]);

export type DidDocumentServiceEndpoint = z.infer<typeof ServiceEndpointSchema>;

// Full ServiceSchema
export const ServiceSchema = z.object({
  id: z.string(),
  type: z.union([z.string(), z.array(z.string())]),
  serviceEndpoint: ServiceEndpointSchema
})

export type DidDocumentService = z.infer<typeof ServiceSchema>;

export const ProofSchema = z.object({
  type: z.string(),
  created: z.string(),
  proofPurpose: z.string().optional(),
  verificationMethod: z.string(),
  proofValue: z.string()
});

export type DidDocumentProof = z.infer<typeof ProofSchema>;


export const DidDocumentSchema = z.object({
  '@context': z.array(z.string()),
  id: z.string(),
  controller: z.string().optional(),
  verificationMethod: z.array(VerificationMethodSchema),
  authentication: z.array(z.string()),
  service: z.array(ServiceSchema).optional(),
  'sight:seq': z.string().optional(),
  'sight:hash': z.string().optional(),
  proof: ProofSchema,
});

export type DidDocument = z.infer<typeof DidDocumentSchema>;


