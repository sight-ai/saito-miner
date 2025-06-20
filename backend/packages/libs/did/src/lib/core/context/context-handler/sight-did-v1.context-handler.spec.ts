import { sightDidV1ContextHandler } from './sight-did-v1.context-handler';

describe('GenericContextHandler with Sight DID v1 context', () => {
  const handler = sightDidV1ContextHandler;

  console.log('Sight DID v1 context handler terms:', (handler as any).termsMap);

  it('should recognize sight-specific top-level terms', () => {
    expect(handler.hasTerm('sight:seq')).toBe(true);
    expect(handler.hasTerm('sight:hash')).toBe(true);
    expect(handler.hasTerm('P2PMessageHandler')).toBe(true);
    expect(handler.hasTerm('ModelManifestService')).toBe(true);
  });

  it('should not recognize unknown sight terms', () => {
    expect(handler.hasTerm('sight:unknownTerm')).toBe(false);
    expect(handler.hasTerm('foobar')).toBe(false);
  });

  it('should validate value types for sight:seq', () => {
    expect(handler.validateValueForPath(['sight:seq'], 123)).toBe(true); // integer
    expect(handler.validateValueForPath(['sight:seq'], '123')).toBe(false); // string not allowed
    expect(handler.validateValueForPath(['sight:seq'], null)).toBe(false);
  });

  it('should validate value types for sight:hash', () => {
    expect(handler.validateValueForPath(['sight:hash'], 'abcd1234')).toBe(true);
    expect(handler.validateValueForPath(['sight:hash'], 123)).toBe(false);
  });

  it('should return false for unknown path', () => {
    expect(handler.validateValueForPath(['foobar'], 'xyz')).toBe(false);
    expect(handler.validateValueForPath(['notInSight'], 'value')).toBe(false);
  });

  it('should validate service terms', () => {
    expect(
      handler.validateValueForPath(['service', 'id'], '@ping-handler'),
    ).toBe(true);
    expect(
      handler.validateValueForPath(['service', 'type'], 'P2PMessageHandler'),
    ).toBe(true);
    expect(
      handler.validateValueForPath(['service', 'serviceEndpoint'], {
        type: 'ping',
        direction: 'income',
        schema: 'https://schemas.sight.ai/message-types/ping.json',
        description: 'Accepts ping messages for health checking',
      }),
    ).toBe(true);
    expect(
      handler.validateValueForPath(
        ['service', 'serviceEndpoint'],
        'p2p://peer12D3KooWABC/model_manifest',
      ),
    ).toBe(true);

    expect(handler.validateValueForPath(['service', 'id'], 123)).toBe(false);
    expect(handler.validateValueForPath(['service', 'type'], 123)).toBe(false);
    // expect(
    //   handler.validateValueForPath(['service', 'serviceEndpoint'], 123),
    // ).toBe(false);
  });

  it('should validate serviceEndpoint', () => {
    expect(handler.validateValueForPath(['service', 'serviceEndpoint','type'], 'ping')).toBe(true);
    expect(handler.validateValueForPath(['service', 'serviceEndpoint', 'direction'], 'income')).toBe(true);
    expect(handler.validateValueForPath(['service', 'serviceEndpoint', 'schema'], 'https://foo.bar')).toBe(true);
    expect(handler.validateValueForPath(['service', 'serviceEndpoint', 'task_type'], 'llm')).toBe(true);
    expect(handler.validateValueForPath(['service', 'serviceEndpoint', 'description'], 'foobar')).toBe(true);

    // 类型错误
    expect(handler.validateValueForPath(['service', 'serviceEndpoint','type'], 123)).toBe(false);
    expect(handler.validateValueForPath(['service', 'serviceEndpoint', 'direction'], 123)).toBe(false);
    expect(handler.validateValueForPath(['service', 'serviceEndpoint', 'schema'], 123)).toBe(false);
    expect(handler.validateValueForPath(['service', 'serviceEndpoint', 'task_type'], 456)).toBe(false);
    expect(handler.validateValueForPath(['service', 'serviceEndpoint', 'description'], 789)).toBe(false);

  });
});
