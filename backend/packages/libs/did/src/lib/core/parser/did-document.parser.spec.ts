
import { ContextHandlerRegistry } from "../context/context-handler/context-handler.registry";
import {didV1ContextHandler} from "../context/context-handler/did-v1.context-handler";
import {DidDocumentParser} from "./did-document.parser";
import {RawDidDocumentSchema} from "@saito/models";
import {sightDidV1ContextHandler} from "../context/context-handler/sight-did-v1.context-handler";

describe('DidDocumentParser', () => {
  let registry = new ContextHandlerRegistry();
  // registry.register('https://www.w3.org/ns/did/v1', didV1ContextHandler);
  const parser = new DidDocumentParser(registry);
  registry.removeHandler('https://schemas.sight.ai/did-service-extension/v1');


  it('should parse a valid DID Document correctly', () => {
    const rawJson = {
      '@context': [
        'https://www.w3.org/ns/did/v1',
        'https://schemas.sight.ai/did-service-extension/v1'
      ],
      id: 'did:sight:hoster:peer12D3KooWABC',
      verificationMethod: [
        {
          id: '#host-key-1',
          type: 'Ed25519VerificationKey2020',
          controller: 'did:sight:hoster:peer12D3KooWABC',
          publicKeyMultibase: 'z6MkwExamplePubKeyXYZ123'
        }
      ],
      authentication: ['#host-key-1'],
      service: [
        {
          id: '#ping-handler',
          type: 'P2PMessageHandler',
          serviceEndpoint: {
            type: 'ping',
            direction: 'income',
            schema: 'https://schemas.sight.ai/message-types/ping.json',
            description: 'Accepts ping messages for health checking'
          }
        },
        {
          id: '#manifest',
          type: 'ModelManifestService',
          serviceEndpoint: 'p2p://peer12D3KooWABC/model_manifest'
        }
      ],
      proof: {
        type: 'Ed25519Signature2020',
        created: '2025-06-01T10:00:00Z',
        proofPurpose: 'assertionMethod',
        verificationMethod: 'did:sight:hoster:peer12D3KooWABC#host-key-1',
        proofValue: 'z4PhExampleSignature...'
      }
    };

    // Validate raw input first (optional but good)
    const rawDidDocument = RawDidDocumentSchema.parse(rawJson);

    // Now run the parser
    const parsed = parser.parse(rawDidDocument);

    // Check basic fields
    expect(parsed.id).toBe('did:sight:hoster:peer12D3KooWABC');
    expect(parsed.verificationMethod!.length).toBe(1);
    expect(parsed.authentication).toEqual(['#host-key-1']);
    expect(parsed.service!.length).toBe(2);
    expect(parsed.proof!.type).toBe('Ed25519Signature2020');

    // Check unknown contexts
    expect(parsed.unknownContexts!.length).toBe(1);
    
    // Check unknown terms
    expect(parsed.unknownTerms!.length).toBe(0);
    
    // Check unknown service types
    expect(parsed.unknownServiceTypes!.length).toBe(2);
  });

  it('should detect unknown service type', () => {
    const rawJson = {
      '@context': [
        'https://www.w3.org/ns/did/v1',
        'https://schemas.sight.ai/did-service-extension/v1'
      ],
      id: 'did:sight:hoster:peer12D3KooWABC',
      verificationMethod: [],
      authentication: [],
      service: [
        {
          id: '#unknown-service',
          type: 'UnknownServiceType',
          serviceEndpoint: 'https://example.com/unknown'
        }
      ],
      proof: {
        type: 'Ed25519Signature2020',
        created: '2025-06-01T10:00:00Z',
        proofPurpose: 'assertionMethod',
        verificationMethod: 'did:sight:hoster:peer12D3KooWABC#host-key-1',
        proofValue: 'z4PhExampleSignature...'
      }
    };

    const rawDidDocument = RawDidDocumentSchema.parse(rawJson);
    const parsed = parser.parse(rawDidDocument);

    // Unknown service type should be reported
    expect(parsed.unknownServiceTypes).toContain('UnknownServiceType');
  });

  it('should detect unknown top-level term', () => {
    const rawJson = {
      '@context': [
        'https://www.w3.org/ns/did/v1',
        'https://schemas.sight.ai/did-service-extension/v1'
      ],
      id: 'did:sight:hoster:peer12D3KooWABC',
      verificationMethod: [],
      authentication: [],
      unknownField: 'unexpected-value',
      service: [],
      proof: {
        type: 'Ed25519Signature2020',
        created: '2025-06-01T10:00:00Z',
        proofPurpose: 'assertionMethod',
        verificationMethod: 'did:sight:hoster:peer12D3KooWABC#host-key-1',
        proofValue: 'z4PhExampleSignature...'
      }
    };

    const rawDidDocument = RawDidDocumentSchema.parse(rawJson);
    const parsed = parser.parse(rawDidDocument);

    // unknownField should be detected
    expect(parsed.unknownTerms).toContain('unknownField');
    expect(parsed.unknownTerms!.length).toBe(1);
  });

  it('should parse DID Document with sight extension context', () => {
    registry.register('https://schemas.sight.ai/did-service-extension/v1', sightDidV1ContextHandler);
    // console.log('Sight DID v1 context handler terms:', (sightDidV1ContextHandler as any).termsMap);

    // registry = new ContextHandlerRegistry()
    // registry.register('https://schemas.sight.ai/did-service-extension/v1', sightDidV1ContextHandler);
  
    const rawJson = {
      '@context': [
        'https://www.w3.org/ns/did/v1',
        'https://schemas.sight.ai/did-service-extension/v1'
      ],
      id: 'did:sight:hoster:peer12D3KooWABC',
      controller: '21345',
      verificationMethod: [
        {
          id: '#host-key-1',
          type: 'Ed25519VerificationKey2020',
          controller: 'did:sight:hoster:peer12D3KooWABC',
          publicKeyMultibase: 'z6MkwExamplePubKeyXYZ123'
        }
      ],
      authentication: ['#host-key-1'],
      service: [
        {
          id: '#ping-handler',
          type: 'P2PMessageHandler',
          serviceEndpoint: {
            type: 'ping',
            direction: 'income',
            schema: 'https://schemas.sight.ai/message-types/ping.json',
            description: 'Accepts ping messages for health checking'
          }
        },
        {
          id: '#manifest',
          type: 'ModelManifestService',
          serviceEndpoint: 'p2p://peer12D3KooWABC/model_manifest'
        }
      ],
      'sight:seq': 1,
      'sight:hash': 'fakehash1',
      proof: {
        type: 'Ed25519Signature2020',
        created: '2025-06-01T10:00:00Z',
        proofPurpose: 'assertionMethod',
        verificationMethod: 'did:sight:hoster:peer12D3KooWABC#host-key-1',
        proofValue: 'z4PhExampleSignature...'
      }
    };
  
    const rawDidDocument = RawDidDocumentSchema.parse(rawJson);
    const parsed = parser.parse(rawDidDocument);
  
    expect(parsed.id).toBe('did:sight:hoster:peer12D3KooWABC');
    expect((parsed as any)['sight:seq']).toBe(1);
    expect((parsed as any)['sight:hash']).toBe('fakehash1');
    expect(parsed.verificationMethod!.length).toBe(1);
    expect(parsed.service!.length).toBe(2);
  
    expect(parsed.unknownContexts!.length).toBe(0);
    expect(parsed.unknownTerms!.length).toBe(0);
    expect(parsed.unknownServiceTypes!.length).toBe(0);
  });
});
