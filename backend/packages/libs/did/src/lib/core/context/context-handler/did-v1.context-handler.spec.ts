import {didV1ContextHandler} from "./did-v1.context-handler";

describe('GenericContextHandler with DID v1 context', () => {
  const handler = didV1ContextHandler;

  it('should recognize standard top-level terms', () => {
    expect(handler.hasTerm('id')).toBe(true);
    expect(handler.hasTerm('type')).toBe(true);
    expect(handler.hasTerm('service')).toBe(true);
    expect(handler.hasTerm('authentication')).toBe(true);
    expect(handler.hasTerm('verificationMethod')).toBe(true);
  });

  it('should not recognize unknown terms', () => {
    expect(handler.hasTerm('foobar')).toBe(false);
    expect(handler.hasTerm('P2PMessageHandler')).toBe(false);
  });

  it('should validate top-level term values', () => {
    expect(handler.validateValueForPath(['id'], 'did:example:123')).toBe(true);
    expect(handler.validateValueForPath(['id'], 123)).toBe(false);

    expect(handler.validateValueForPath(['authentication'], '#key-1')).toBe(true);
    expect(handler.validateValueForPath(['authentication'], 123)).toBe(false);
  });

  it('should validate serviceEndpoint via sub-context', () => {
    // serviceEndpoint is under service.@context
    expect(handler.hasTerm('service')).toBe(true);

    // Check that sub-context is correct:
    expect(handler.validateValueForPath(['service', 'serviceEndpoint'], 'https://node.example/service')).toBe(true);

    // Invalid value for serviceEndpoint → must be string (@id)
    expect(handler.validateValueForPath(['service', 'serviceEndpoint'], { foo: 'bar' })).toBe(false);
  });

  it('should return false for unknown path', () => {
    expect(handler.validateValueForPath(['foobar'], 'xyz')).toBe(false);
    expect(handler.validateValueForPath(['service', 'unknownField'], 'value')).toBe(false);
  });
});
