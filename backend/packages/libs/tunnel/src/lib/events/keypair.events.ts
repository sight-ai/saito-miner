/**
 * KeyPair 相关事件定义
 * 用于解决 did 和 tunnel 模块之间的循环依赖
 */

export class KeyPairReadyEvent {
  constructor(public readonly keyPair: Uint8Array) {}
}

export const KEYPAIR_EVENTS = {
  KEYPAIR_READY: 'keypair.ready',
} as const;
