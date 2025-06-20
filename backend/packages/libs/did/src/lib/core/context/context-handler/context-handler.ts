export type ContextObject = {
  [term: string]: TermDefinition | string | undefined | number | boolean;
};

export type TermDefinition = {
  '@id': string;
  '@type'?: string;
  '@container'?: string;
  '@context'?: ContextObject;
};

export class GenericContextHandler {
  private readonly contextObject: ContextObject;
  private readonly termsMap: Map<string, TermDefinition | string | number | boolean>;

  constructor(
    contextObject: ContextObject,
    private readonly contextUrl: string,
  ) {
    this.contextObject = contextObject;

    this.termsMap = new Map();

    for (const [key, value] of Object.entries(contextObject)) {
      if (!key.startsWith('@')) {
        this.termsMap.set(key, value as TermDefinition | string);
      }
    }
  }

  getContextObject(): ContextObject {
    return this.contextObject;
  }

  
  // TODO: mapping between URL and context hanlder
  getContextUrl(): string {
    return this.contextUrl;
  }

  supportsContext(context: string | ContextObject): boolean {
    if (typeof context === 'string') {
      // Example: for DID v1 context
      return context === this.contextUrl;
    }
    return false;
  }

  hasTerm(term: string): boolean {
    return this.termsMap.has(term);
  }

  /**
   * Validate a value along a path of terms (recursive).
   * Example: ['service', 'serviceEndpoint']
   */
  validateValueForPath(path: string[], value: unknown): boolean {
    if (path.length === 0) return false;

    const [currentTerm, ...restPath] = path;
    const termDef = this.termsMap.get(currentTerm);
    if (!termDef) return false;

    // If there is more path → need sub-context
    if (restPath.length > 0) {
      if (typeof termDef === 'object' && termDef['@context']) {
        const subContext = new GenericContextHandler(termDef['@context'], this.contextUrl);
        return subContext.validateValueForPath(restPath, value);
      } else {
        // Cannot descend if no sub-context
        return false;
      }
    }

    // Final level → validate the value here
    let type: string | undefined;
    if (typeof termDef === 'string') {
      type = '@id';
    } else if (typeof termDef === 'object' && termDef !== null) {
      type = termDef['@type'];
    } else if (typeof termDef === 'number' || typeof termDef === 'boolean') {
      // Not a term definition → always accept (meta terms like @version/@protected should not be validated)
      return true;
    } else {
      return false;
    }

    switch (type) {
      case '@id':
      case 'http://www.w3.org/2001/XMLSchema#anyURI':
        return typeof value === 'string';
      case '@vocab':
      case 'http://www.w3.org/2001/XMLSchema#string':
        return typeof value === 'string';
      case 'http://www.w3.org/2001/XMLSchema#integer':
        return Number.isInteger(value);
      case 'http://www.w3.org/2001/XMLSchema#decimal':
      case 'http://www.w3.org/2001/XMLSchema#double':
      case 'http://www.w3.org/2001/XMLSchema#number':
        return typeof value === 'number';
      default:
        return true; // Unknown type → allow
    }
  }
}
