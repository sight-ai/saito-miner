import { DidDocument } from '@saito/models';
import bs58 from 'bs58';
import * as crypto from 'crypto';
import nacl from 'tweetnacl';

export function toKeyPair(seed: Uint8Array): nacl.SignKeyPair {
  return nacl.sign.keyPair.fromSeed(seed);
}

export function toPublicKeyBase58(keyPair: nacl.SignKeyPair): string {
  return bs58.encode(keyPair.publicKey);
}

export function toPeerId(pubkey: string): string {
  return crypto.createHash('sha256').update(pubkey).digest('base64');
}

function deepSortObject(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(deepSortObject);
  }
  if (obj && typeof obj === 'object' && obj !== null) {
    return Object.keys(obj)
      .sort()
      .reduce((result: any, key: string) => {
        result[key] = deepSortObject(obj[key]);
        return result;
      }, {});
  }
  return obj;
}

// hash要hash除了hash以外的所有字段
function buildHashInput(doc: DidDocument): object {
  const {
    '@context': context,
    id,
    controller,
    verificationMethod,
    authentication,
    service,
    'sight:seq': seq,
    proof,
  } = doc;
  return {
    '@context': context,
    id,
    controller,
    verificationMethod,
    authentication,
    service,
    'sight:seq': seq,
    proof,
  };
}

export function calcHash(doc: DidDocument): string {
  const inputObj = buildHashInput(doc);
  const sortedObj = deepSortObject(inputObj);
  const jsonStr = JSON.stringify(sortedObj);
  return crypto.createHash('sha256').update(jsonStr).digest('base64');
}

export function calcSeq(doc: DidDocument): string {
  return String(Date.now());
}
