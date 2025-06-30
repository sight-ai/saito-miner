import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  TDeviceConfig,
  TDeviceRegistry,
  TDeviceSystem,
  TDeviceGateway,
  DEVICE_CONFIG_SERVICE,
  DEVICE_REGISTRY_SERVICE,
  DEVICE_SYSTEM_SERVICE,
  DEVICE_GATEWAY_SERVICE,
  DeviceConfig,
  RegistrationResult
} from '../device-status.interface';

/**
 * 自动注册服务
 * 负责在程序启动时从本地存储的注册信息中自动注册到网关
 */
@Injectable()
export class AutoRegistrationService implements OnModuleInit {
  private readonly logger = new Logger(AutoRegistrationService.name);
  private isAutoRegistering = false;
  private lastRegistrationAttempt = 0;
  private readonly RETRY_INTERVAL = 5 * 60 * 1000; // 5分钟重试间隔
  private readonly MAX_RETRY_ATTEMPTS = 10; // 最大重试次数
  private retryCount = 0;

  constructor(
    @Inject(DEVICE_CONFIG_SERVICE)
    private readonly configService: TDeviceConfig,

    @Inject(DEVICE_REGISTRY_SERVICE)
    private readonly registryService: TDeviceRegistry,

    @Inject(DEVICE_SYSTEM_SERVICE)
    private readonly systemService: TDeviceSystem,

    @Inject(DEVICE_GATEWAY_SERVICE)
    private readonly gatewayService: TDeviceGateway

  ) {}

  /**
   * 模块初始化时执行自动注册
   */
  async onModuleInit(): Promise<void> {
    // 延迟执行，确保所有依赖都已初始化
    setTimeout(async () => {
      await this.attemptAutoRegistration();
    }, 3000); // 3秒延迟
  }

  /**
   * 尝试自动注册
   */
  async attemptAutoRegistration(): Promise<boolean> {
    if (this.isAutoRegistering) {
      this.logger.debug('Auto registration already in progress, skipping');
      return false;
    }

    try {
      this.isAutoRegistering = true;
      this.logger.log('Starting auto registration process...');

      // 检查是否有存储的注册信息
      const config = this.configService.getCurrentConfig();
      console.log(config, 'getCurrentConfig')
      if (!this.hasValidRegistrationInfo(config)) {
        this.logger.debug('No valid registration information found, skipping auto registration');
        return false;
      }

      if (config.isRegistered) {
        this.logger.log('Device is already registered, attempting to re-register with gateway...');
      } else {
        this.logger.log('Found stored registration info, attempting to register with gateway...');
      }

      // 获取系统信息
      const systemInfo = await this.getSystemInfo();

      // 尝试向网关注册
      const result = await this.registerWithGateway(config, [], systemInfo);
      if (result.success) {
        this.logger.log(`Auto registration successful: ${result.node_id || result.name}`);
        
        // 更新配置状态
        await this.updateRegistrationStatus(config, result);
        
        // 重置重试计数
        this.retryCount = 0;
        this.lastRegistrationAttempt = Date.now();
        
        return true;
      } else {
        this.logger.warn(`Auto registration failed: ${result.error}`);
        this.handleRegistrationFailure();
        return false;
      }

    } catch (error) {
      this.logger.error('Auto registration error:', error);
      this.handleRegistrationFailure();
      return false;
    } finally {
      this.isAutoRegistering = false;
    }
  }

  /**
   * 检查是否有有效的注册信息
   */
  private hasValidRegistrationInfo(config: DeviceConfig): boolean {
    return !!(
      config.gatewayAddress &&
      config.code &&
      config.rewardAddress &&
      config.deviceName
    );
  }

  /**
   * 获取系统信息
   */
  private async getSystemInfo(): Promise<any> {
    try {
      return await this.systemService.collectSystemInfo();
    } catch (error) {
      this.logger.warn('Failed to get system info, using defaults:', error);
      return {
        os: 'Unknown',
        cpu: 'Unknown',
        memory: 'Unknown',
        graphics: [],
        ipAddress: 'Unknown',
        deviceType: process.env['DEVICE_TYPE'] || 'Unknown',
        deviceModel: process.env['GPU_MODEL'] || 'Unknown'
      };
    }
  }

  /**
   * 向网关注册
   */
  private async registerWithGateway(
    config: DeviceConfig,
    localModels: any[],
    systemInfo: any
  ): Promise<RegistrationResult> {
    try {
      // 首先检查网关是否可达
      const isGatewayOnline = await this.gatewayService.checkGatewayStatus(config.gatewayAddress);
      
      if (!isGatewayOnline) {
        return {
          success: false,
          error: 'Gateway is not reachable'
        };
      }

      // 向网关注册
      return await this.gatewayService.registerWithGateway(config, localModels, systemInfo);
    } catch (error) {
      this.logger.error('Gateway registration error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown registration error'
      };
    }
  }

  /**
   * 更新注册状态
   */
  private async updateRegistrationStatus(
    config: DeviceConfig, 
    result: RegistrationResult
  ): Promise<void> {
    try {
      const updatedConfig: Partial<DeviceConfig> = {
        isRegistered: true
      };

      // 如果网关返回了新的设备信息，更新配置
      if (result.node_id && result.node_id !== config.deviceId) {
        updatedConfig.deviceId = result.node_id;
      }

      if (result.name && result.name !== config.deviceName) {
        updatedConfig.deviceName = result.name;
      }

      await this.configService.updateConfig(updatedConfig);
      this.logger.debug('Registration status updated successfully');
    } catch (error) {
      this.logger.error('Failed to update registration status:', error);
    }
  }

  /**
   * 处理注册失败
   */
  private handleRegistrationFailure(): void {
    this.retryCount++;
    this.lastRegistrationAttempt = Date.now();
    
    if (this.retryCount >= this.MAX_RETRY_ATTEMPTS) {
      this.logger.error(`Auto registration failed after ${this.MAX_RETRY_ATTEMPTS} attempts, giving up`);
    } else {
      this.logger.warn(`Auto registration failed, will retry (attempt ${this.retryCount}/${this.MAX_RETRY_ATTEMPTS})`);
    }
  }

  /**
   * 定时检查并重试注册 (每5分钟执行一次)
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async periodicRegistrationCheck(): Promise<void> {
    try {
      // 如果正在注册中，跳过
      if (this.isAutoRegistering) {
        return;
      }

      // 如果重试次数已达上限，跳过
      if (this.retryCount >= this.MAX_RETRY_ATTEMPTS) {
        return;
      }

      // 检查是否需要重试
      const now = Date.now();
      const timeSinceLastAttempt = now - this.lastRegistrationAttempt;
      
      if (timeSinceLastAttempt < this.RETRY_INTERVAL) {
        return;
      }

      const config = this.configService.getCurrentConfig();
      
      // 如果没有注册信息或注册失败，尝试重新注册
      if (!config.isRegistered && this.hasValidRegistrationInfo(config)) {
        this.logger.debug('Periodic registration check: attempting auto registration');
        await this.attemptAutoRegistration();
      }
    } catch (error) {
      this.logger.error('Periodic registration check error:', error);
    }
  }

  /**
   * 手动触发重新注册
   */
  async forceReregistration(): Promise<boolean> {
    this.logger.log('Force re-registration requested');
    this.retryCount = 0; // 重置重试计数
    return await this.attemptAutoRegistration();
  }

  /**
   * 获取自动注册状态
   */
  getAutoRegistrationStatus(): {
    isRegistering: boolean;
    retryCount: number;
    maxRetries: number;
    lastAttempt: number;
    nextRetryTime: number;
  } {
    const nextRetryTime = this.lastRegistrationAttempt + this.RETRY_INTERVAL;
    
    return {
      isRegistering: this.isAutoRegistering,
      retryCount: this.retryCount,
      maxRetries: this.MAX_RETRY_ATTEMPTS,
      lastAttempt: this.lastRegistrationAttempt,
      nextRetryTime: this.retryCount < this.MAX_RETRY_ATTEMPTS ? nextRetryTime : 0
    };
  }

  /**
   * 重置自动注册状态
   */
  resetAutoRegistrationStatus(): void {
    this.retryCount = 0;
    this.lastRegistrationAttempt = 0;
    this.isAutoRegistering = false;
    this.logger.log('Auto registration status reset');
  }

  /**
   * 检查是否可以进行自动注册
   */
  canAutoRegister(): boolean {
    const config = this.configService.getCurrentConfig();
    return this.hasValidRegistrationInfo(config) && 
           this.retryCount < this.MAX_RETRY_ATTEMPTS &&
           !this.isAutoRegistering;
  }
}

// 服务提供者
export const AUTO_REGISTRATION_SERVICE = Symbol('AUTO_REGISTRATION_SERVICE');

const AutoRegistrationServiceProvider = {
  provide: AUTO_REGISTRATION_SERVICE,
  useClass: AutoRegistrationService
};

export default AutoRegistrationServiceProvider;
