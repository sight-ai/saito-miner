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

export function toPeerId(publicKey: Uint8Array): string {
  // return crypto.createHash('sha256').update(pubkey).digest('base64');
  const prefix = new Uint8Array([0xed, 0x01]);
  const multicodec = new Uint8Array(prefix.length + publicKey.length);
  multicodec.set(prefix, 0);
  multicodec.set(publicKey, prefix.length);
  return bs58.encode(multicodec);
}

// 传 did:sight:hoster:xxx 或直接 peerId，获得公钥(Uint8)
export function peerIdToPublicKey(didOrPeerId: string): Uint8Array | null {
  let peerId = didOrPeerId;
  const prefix = 'did:sight:hoster:';
  if (peerId.startsWith(prefix)) {
    peerId = peerId.slice(prefix.length);
  }
  let decoded: Uint8Array;
  try {
    decoded = bs58.decode(peerId);
  } catch (e) {
    return null;
  }
  if (decoded.length !== 34 || decoded[0] !== 0xed || decoded[1] !== 0x01) {
    return null; 
  }
  return decoded.slice(2);
}

export function sign(nonce: string | Uint8Array, secretKey: Uint8Array): string {
  const msg = typeof nonce === 'string' ? Buffer.from(nonce) : nonce;
  const signature = nacl.sign.detached(new Uint8Array(msg), secretKey);
  return bs58.encode(signature);
}

export function verifySignature(
  nonce: string | Uint8Array,
  signature: string,
  publicKey: string
): boolean {
  const msg = typeof nonce === 'string' ? Buffer.from(nonce) : nonce;
  const sig = bs58.decode(signature);
  const pub = bs58.decode(publicKey);
  return nacl.sign.detached.verify(new Uint8Array(msg), sig, pub);
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
