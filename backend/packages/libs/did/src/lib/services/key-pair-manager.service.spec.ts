import { Test, TestingModule } from '@nestjs/testing';
import { KeyPairManager } from './key-pair-manager.service';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import nacl from 'tweetnacl';

describe('KeyPairManager', () => {
  let service: KeyPairManager;
  let testConfigDir: string;
  let originalEnv: string | undefined;

  beforeEach(async () => {
    // 创建临时测试目录
    testConfigDir = path.join(os.tmpdir(), 'sightai-test', Math.random().toString(36).substring(7));
    
    // 设置测试环境变量
    originalEnv = process.env['SIGHTAI_DATA_DIR'];
    process.env['SIGHTAI_DATA_DIR'] = testConfigDir;

    const module: TestingModule = await Test.createTestingModule({
      providers: [KeyPairManager],
    }).compile();

    service = module.get<KeyPairManager>(KeyPairManager);
  });

  afterEach(async () => {
    // 恢复环境变量
    if (originalEnv !== undefined) {
      process.env['SIGHTAI_DATA_DIR'] = originalEnv;
    } else {
      delete process.env['SIGHTAI_DATA_DIR'];
    }

    // 清理测试目录
    if (fs.existsSync(testConfigDir)) {
      fs.rmSync(testConfigDir, { recursive: true, force: true });
    }
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should generate a new key pair when none exists', async () => {
    const keyPair = await service.getOrGenerateKeyPair();
    
    expect(keyPair).toBeDefined();
    expect(keyPair).toBeInstanceOf(Uint8Array);
    expect(keyPair.length).toBe(32); // Ed25519 seed length
  });

  it('should return the same key pair on subsequent calls', async () => {
    const keyPair1 = await service.getOrGenerateKeyPair();
    const keyPair2 = await service.getOrGenerateKeyPair();
    
    expect(keyPair1).toEqual(keyPair2);
  });

  it('should persist key pair configuration to file', async () => {
    await service.getOrGenerateKeyPair();
    
    const configFile = path.join(testConfigDir, 'config', 'device-keypair.json');
    expect(fs.existsSync(configFile)).toBe(true);
    
    const configData = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
    expect(configData).toHaveProperty('seed');
    expect(configData).toHaveProperty('deviceId');
    expect(configData).toHaveProperty('createdAt');
    expect(configData).toHaveProperty('lastUsed');
  });

  it('should load existing key pair from file', async () => {
    // 第一次生成
    const keyPair1 = await service.getOrGenerateKeyPair();

    // 创建新的服务实例（模拟重启）
    const newService = new KeyPairManager();
    const keyPair2 = await newService.getOrGenerateKeyPair();

    // 比较数组内容而不是对象类型
    expect(Array.from(keyPair1)).toEqual(Array.from(keyPair2));
  });

  it('should generate valid Ed25519 key pairs', async () => {
    const seed = await service.getOrGenerateKeyPair();
    const keyPair = nacl.sign.keyPair.fromSeed(seed);
    
    expect(keyPair.publicKey).toBeDefined();
    expect(keyPair.secretKey).toBeDefined();
    expect(keyPair.publicKey.length).toBe(32);
    expect(keyPair.secretKey.length).toBe(64);
    
    // 测试签名和验证
    const message = new TextEncoder().encode('test message');
    const signature = nacl.sign.detached(message, keyPair.secretKey);
    const isValid = nacl.sign.detached.verify(message, signature, keyPair.publicKey);
    
    expect(isValid).toBe(true);
  });

  it('should generate consistent device ID', async () => {
    const deviceId1 = await service.getDeviceId();
    const deviceId2 = await service.getDeviceId();
    
    expect(deviceId1).toBe(deviceId2);
    expect(deviceId1).toMatch(/^device_[a-f0-9]{16}$/);
  });

  it('should provide key pair info without exposing private key', async () => {
    await service.getOrGenerateKeyPair();
    const info = await service.getKeyPairInfo();
    
    expect(info).toBeDefined();
    expect(info).toHaveProperty('deviceId');
    expect(info).toHaveProperty('createdAt');
    expect(info).toHaveProperty('lastUsed');
    expect(info).toHaveProperty('publicKey');
    expect(info).not.toHaveProperty('seed');
    expect(info).not.toHaveProperty('privateKey');
  });

  it('should regenerate key pair when requested', async () => {
    const keyPair1 = await service.getOrGenerateKeyPair();
    const keyPair2 = await service.regenerateKeyPair();

    expect(Array.from(keyPair1)).not.toEqual(Array.from(keyPair2));

    // 验证新密钥对被持久化
    const keyPair3 = await service.getOrGenerateKeyPair();
    expect(Array.from(keyPair2)).toEqual(Array.from(keyPair3));
  });

  it('should update lastUsed timestamp when loading existing key pair', async () => {
    // 第一次生成
    await service.getOrGenerateKeyPair();
    const info1 = await service.getKeyPairInfo();
    
    // 等待一小段时间
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // 创建新服务实例并加载
    const newService = new KeyPairManager();
    await newService.getOrGenerateKeyPair();
    const info2 = await newService.getKeyPairInfo();
    
    expect(info2!.lastUsed).not.toBe(info1!.lastUsed);
    expect(new Date(info2!.lastUsed).getTime()).toBeGreaterThan(new Date(info1!.lastUsed).getTime());
  });

  it('should handle missing config directory gracefully', async () => {
    // 删除配置目录
    if (fs.existsSync(testConfigDir)) {
      fs.rmSync(testConfigDir, { recursive: true, force: true });
    }
    
    // 应该能够创建目录并生成密钥对
    const keyPair = await service.getOrGenerateKeyPair();
    expect(keyPair).toBeDefined();
    expect(fs.existsSync(path.join(testConfigDir, 'config'))).toBe(true);
  });

  it('should handle corrupted config file gracefully', async () => {
    // 创建损坏的配置文件
    const configDir = path.join(testConfigDir, 'config');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(path.join(configDir, 'device-keypair.json'), 'invalid json');
    
    // 应该能够生成新的密钥对
    const keyPair = await service.getOrGenerateKeyPair();
    expect(keyPair).toBeDefined();
  });
});
