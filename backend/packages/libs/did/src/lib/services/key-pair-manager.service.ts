import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as fsAsync from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import nacl from 'tweetnacl';

/**
 * 密钥对配置接口
 */
interface KeyPairConfig {
  seed: number[]; // 数组形式的种子
  deviceId: string; // 设备唯一标识
  createdAt: string; // 创建时间
  lastUsed: string; // 最后使用时间
}

/**
 * 密钥对管理服务
 * 负责为每个设备生成和管理唯一的密钥对
 * 密钥对会持久化存储，确保设备重启后仍能使用相同的密钥
 */
@Injectable()
export class KeyPairManager {
  private readonly logger = new Logger(KeyPairManager.name);
  private readonly configDir: string;
  private readonly keyPairConfigFile: string;
  private cachedKeyPair: Uint8Array | null = null;
  private cachedDeviceId: string | null = null;

  constructor() {
    // 支持 Docker 和本地环境
    const dataDir = process.env['SIGHTAI_DATA_DIR'];
    if (dataDir) {
      this.configDir = path.join(dataDir, 'config');
    } else {
      const homeDir = os.homedir();
      this.configDir = path.join(homeDir, '.sightai', 'config');
    }
    
    this.keyPairConfigFile = path.join(this.configDir, 'device-keypair.json');
    this.ensureConfigDir();
  }

  /**
   * 确保配置目录存在
   */
  private ensureConfigDir(): void {
    try {
      if (!fs.existsSync(this.configDir)) {
        fs.mkdirSync(this.configDir, { recursive: true });
        this.logger.log(`Created key pair config directory: ${this.configDir}`);
      }
    } catch (error) {
      this.logger.error(`Failed to create config directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 生成设备唯一标识
   * 基于系统信息生成稳定的设备ID
   */
  private generateDeviceId(): string {
    try {
      // 获取系统信息用于生成设备ID
      const hostname = os.hostname();
      const platform = os.platform();
      const arch = os.arch();
      const userInfo = os.userInfo();
      
      // 组合系统信息
      const systemInfo = `${hostname}-${platform}-${arch}-${userInfo.username}`;
      
      // 生成哈希作为设备ID
      const hash = crypto.createHash('sha256').update(systemInfo).digest('hex');
      return `device_${hash.substring(0, 16)}`;
    } catch (error) {
      this.logger.warn('Failed to generate device ID from system info, using random ID');
      // 如果获取系统信息失败，使用随机ID
      const randomBytes = crypto.randomBytes(8);
      return `device_${randomBytes.toString('hex')}`;
    }
  }

  /**
   * 生成新的密钥对种子
   */
  private generateSeed(): Uint8Array {
    return new Uint8Array(crypto.randomBytes(32));
  }

  /**
   * 加载现有的密钥对配置
   */
  private async loadKeyPairConfig(): Promise<KeyPairConfig | null> {
    try {
      if (!fs.existsSync(this.keyPairConfigFile)) {
        this.logger.debug('No key pair config found');
        return null;
      }

      const data = await fsAsync.readFile(this.keyPairConfigFile, 'utf-8');
      const config = JSON.parse(data) as KeyPairConfig;
      
      this.logger.debug(`Loaded key pair config for device: ${config.deviceId}`);
      return config;
    } catch (error) {
      this.logger.error(`Failed to load key pair config: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  /**
   * 保存密钥对配置
   */
  private async saveKeyPairConfig(config: KeyPairConfig): Promise<void> {
    try {
      await fsAsync.mkdir(this.configDir, { recursive: true });
      await fsAsync.writeFile(
        this.keyPairConfigFile, 
        JSON.stringify(config, null, 2), 
        'utf-8'
      );
      this.logger.log(`Key pair config saved for device: ${config.deviceId}`);
    } catch (error) {
      this.logger.error(`Failed to save key pair config: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * 获取或生成密钥对
   * 如果设备已有密钥对则使用现有的，否则生成新的
   */
  async getOrGenerateKeyPair(): Promise<Uint8Array> {
    // 如果已缓存，直接返回
    if (this.cachedKeyPair) {
      return this.cachedKeyPair;
    }

    try {
      // 尝试加载现有配置
      const existingConfig = await this.loadKeyPairConfig();
      const currentDeviceId = this.generateDeviceId();

      if (existingConfig && existingConfig.deviceId === currentDeviceId) {
        // 设备ID匹配，使用现有密钥对
        this.logger.log(`Using existing key pair for device: ${currentDeviceId}`);
        
        // 更新最后使用时间
        existingConfig.lastUsed = new Date().toISOString();
        await this.saveKeyPairConfig(existingConfig);
        
        // 解码种子
        const seed = Uint8Array.from(existingConfig.seed);
        this.cachedKeyPair = seed;
        this.cachedDeviceId = currentDeviceId;
        
        return this.cachedKeyPair;
      } else {
        // 设备ID不匹配或没有现有配置，生成新密钥对
        this.logger.log(`Generating new key pair for device: ${currentDeviceId}`);
        
        const seed = this.generateSeed();
        const now = new Date().toISOString();
        
        const newConfig: KeyPairConfig = {
          seed: Array.from(seed),
          deviceId: currentDeviceId,
          createdAt: now,
          lastUsed: now
        };
        
        await this.saveKeyPairConfig(newConfig);
        
        this.cachedKeyPair = seed;
        this.cachedDeviceId = currentDeviceId;
        
        return this.cachedKeyPair;
      }
    } catch (error) {
      this.logger.error(`Failed to get or generate key pair: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * 获取当前设备ID
   */
  async getDeviceId(): Promise<string> {
    if (this.cachedDeviceId) {
      return this.cachedDeviceId;
    }
    
    // 确保密钥对已初始化
    await this.getOrGenerateKeyPair();
    return this.cachedDeviceId!;
  }

  /**
   * 重新生成密钥对（慎用）
   * 这会导致设备的DID发生变化
   */
  async regenerateKeyPair(): Promise<Uint8Array> {
    this.logger.warn('Regenerating key pair - this will change the device DID');
    
    const currentDeviceId = this.generateDeviceId();
    const seed = this.generateSeed();
    const now = new Date().toISOString();
    
    const newConfig: KeyPairConfig = {
      seed: Array.from(seed),
      deviceId: currentDeviceId,
      createdAt: now,
      lastUsed: now
    };
    
    await this.saveKeyPairConfig(newConfig);
    
    // 清除缓存
    this.cachedKeyPair = seed;
    this.cachedDeviceId = currentDeviceId;
    
    return seed;
  }

  /**
   * 获取密钥对信息（不包含私钥）
   */
  async getKeyPairInfo(): Promise<{
    deviceId: string;
    createdAt: string;
    lastUsed: string;
    publicKey: string;
  } | null> {
    try {
      const config = await this.loadKeyPairConfig();
      if (!config) {
        return null;
      }

      // 生成公钥用于显示
      const seed = Uint8Array.from(config.seed);
      const keyPair = nacl.sign.keyPair.fromSeed(new Uint8Array(seed));
      const publicKey = Buffer.from(keyPair.publicKey).toString('base64');

      return {
        deviceId: config.deviceId,
        createdAt: config.createdAt,
        lastUsed: config.lastUsed,
        publicKey
      };
    } catch (error) {
      this.logger.error(`Failed to get key pair info: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }
}
