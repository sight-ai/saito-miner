import {
  ParsedDidDocument,
  ParsedDidDocumentSchema,
  RawDidDocument,
} from '@saito/models';
import {
  ContextObject,
  GenericContextHandler,
} from '../context/context-handler/context-handler';
import { ContextHandlerRegistry } from '../context/context-handler/context-handler.registry';
import { Logger } from '@nestjs/common';

/**
 * Accept a raw input and generate ParsedDidDocument.
 * Note that ParsedDidDocument shall have unknownContexts / unknownTerms / unknownServiceTypes
 * It is left over by the upper layer to handle to resolve
 */
export class DidDocumentParser {
  private readonly logger = new Logger(DidDocumentParser.name);
  constructor(private readonly registry: ContextHandlerRegistry) {}

  parse(rawDidDocument: RawDidDocument): ParsedDidDocument {
    // console.log(`Parsing DID Document: ${JSON.stringify(rawDidDocument)}`);
    const matchingHandlers = this.matchContextHandlers(
      rawDidDocument['@context'],
    );
    this.logger.debug(`Matching context handlers: ${matchingHandlers.length} for contexts: ${JSON.stringify(rawDidDocument['@context'])}`);
    const unknownContexts = this.getUnknownContexts(
      rawDidDocument['@context'],
      matchingHandlers,
    );
    const unknownTerms: string[] = [];
    const unknownServiceTypes: string[] = [];
    const legalExtraTerms: Record<string, unknown> = {};

    // Validate top-level terms
    for (const [term, value] of Object.entries(rawDidDocument)) {
      if (
        term.startsWith('@') ||
        term === 'id' ||
        term === 'service' ||
        term === 'verificationMethod' ||
        term === 'authentication' ||
        term === 'proof'
      ) {
        continue;
      }
      let matched = false;
      for (const handler of matchingHandlers) {
        if (handler.hasTerm(term)) {
          const valid = handler.validateValueForPath([term], value);
          if (!valid) {
            console.warn(`Validation failed for term '${term}'`);
            break;
          } else {
            matched = true;
            break;
          }
        }
      }
      if (!matched) {
        this.logger.debug(`unknow term: ${term}`);
        unknownTerms.push(term);
      }
    }

    // Validate services
    const service = (rawDidDocument.service || []).map(service => {
      const serviceType = service['type'];
      // console.log(`Service type: ${serviceType}`);
      if (typeof serviceType === 'string') {
        let serviceTypeMatched = matchingHandlers.some(handler => {
          return handler.hasTerm(serviceType);
        });
        // console.log(`service Type: ${serviceType}, serviceMatched: ${serviceTypeMatched}`)
        if (serviceTypeMatched) {
          for (const [key, value] of Object.entries(service)) {
            if (key === 'serviceEndpoint' && value && typeof value === 'object' && !Array.isArray(value)) {
              for (const [subKey, subValue] of Object.entries(value)) {
                for (const handler of matchingHandlers) {
                  if (handler.hasTerm('service')) {
                    const path = ['service', 'serviceEndpoint', subKey];
                    const valid = handler.validateValueForPath(path, subValue);
                    if (!valid) {
                      serviceTypeMatched = false;
                    }
                    break;
                  }
                }
                if (!serviceTypeMatched) {
                  console.warn(`Validation failed for service.serviceEndpoint.${subKey}`);
                  break;
                }
              }
            } else {
              for (const handler of matchingHandlers) {
                if (handler.hasTerm('service')) {
                  const path = ['service', key];
                  const valid = handler.validateValueForPath(path, value)
                  if (!valid) {
                    serviceTypeMatched = false;
                    console.warn(`Validation failed for service.${key}`);
                    break;
                  }
                }
              }
            }
          }
        }
        if (!serviceTypeMatched) {
          // console.log(`Unknown service type: ${serviceType}`);
          unknownServiceTypes.push(serviceType);
        }
      }

      // Must return the correct ServiceEntry object
      return {
        id: service['id'] as string,
        type: service['type'] as string,
        serviceEndpoint: service['serviceEndpoint'] as any,
      };
    });

    // legal extra terms:
    for (const [key, value] of Object.entries(rawDidDocument)) {
      if (
        ![
          '@context',
          'id',
          'verificationMethod',
          'authentication',
          'service',
          'proof',
        ].includes(key) &&
        !unknownTerms.includes(key)
      ) {
        legalExtraTerms[key] = value;
      }
    }
        
    const value = {
      '@context': rawDidDocument['@context'],
      id: rawDidDocument.id,
      verificationMethod: rawDidDocument.verificationMethod,
      authentication: rawDidDocument.authentication,
      service,
      proof: rawDidDocument.proof,
      unknownContexts,
      unknownTerms,
      unknownServiceTypes,
      ...legalExtraTerms,
    };


    // Build ParsedDidDocument
    const parsed = ParsedDidDocumentSchema.safeParse({
      '@context': rawDidDocument['@context'],
      id: rawDidDocument.id,
      verificationMethod: rawDidDocument.verificationMethod,
      authentication: rawDidDocument.authentication,
      service,
      proof: rawDidDocument.proof,
      unknownContexts,
      unknownTerms,
      unknownServiceTypes,
      ...legalExtraTerms,
    });

    if (parsed.success) {
      return parsed.data;
    } else {
      console.error(parsed.error);
      throw parsed.error;
    }
  }

  private matchContextHandlers(
    rawContext: RawDidDocument['@context'],
  ): GenericContextHandler[] {
    const contextHandlers = this.registry.getAllHandlers();
    return contextHandlers
      .filter(handler => {
        return Array.isArray(rawContext)
          ? rawContext.some(ctx =>
              typeof ctx === 'string' || this.isContextObject(ctx)
                ? handler.supportsContext(ctx)
                : false,
            )
          : handler.supportsContext(rawContext);
      })
      .reverse();
  }

  private isContextObject(ctx: unknown): ctx is ContextObject {
    return typeof ctx === 'object' && ctx !== null && !Array.isArray(ctx);
  }

  private getUnknownContexts(
    rawContext: RawDidDocument['@context'],
    matchingHandlers: GenericContextHandler[],
  ): any[] {
    const known = matchingHandlers.map(h => h.getContextUrl());
    return Array.isArray(rawContext)
      ? rawContext.filter(ctx => !known.some(k => this.contextEquals(k, ctx)))
      : [];
  }

  private contextEquals(a: any, b: any): boolean {
    if (typeof a === 'string' && typeof b === 'string') return a === b;
    return false;
  }
}
