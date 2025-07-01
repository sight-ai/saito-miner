import { Injectable, Logger, OnApplicationBootstrap, Inject } from '@nestjs/common';
import {
  TDeviceConfig,
  DEVICE_CONFIG_SERVICE
} from '../device-status.interface';
import { AutoRegistrationService, AUTO_REGISTRATION_SERVICE } from './auto-registration.service';
import { DidServiceInterface } from '@saito/did';
import { TunnelServiceImpl } from '@saito/tunnel';

/**
 * 启动初始化服务
 * 负责在应用启动时执行必要的初始化操作
 */
@Injectable()
export class StartupInitializationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(StartupInitializationService.name);

  constructor(
    @Inject(DEVICE_CONFIG_SERVICE)
    private readonly configService: TDeviceConfig,

    @Inject(AUTO_REGISTRATION_SERVICE)
    private readonly autoRegistrationService: AutoRegistrationService,

    @Inject('DidService')
    private readonly didService: DidServiceInterface,

    @Inject('TunnelService')
    private readonly tunnelService: TunnelServiceImpl
  ) {}

  /**
   * 应用启动完成后执行
   */
  async onApplicationBootstrap(): Promise<void> {
    this.logger.log('🚀 Application bootstrap completed, starting initialization...');

    try {
      // 1. 初始化DID服务并获取设备ID
      await this.initializeDidService();

      // 2. 初始化设备配置
      await this.initializeDeviceConfig();

      // 3. 检查并执行自动注册（包含WebSocket连接建立）
      await this.checkAndPerformAutoRegistration();

      // 4. 显示启动状态
      this.displayStartupStatus();

      this.logger.log('✅ Startup initialization completed successfully');
    } catch (error) {
      this.logger.error('❌ Startup initialization failed:', error);
    }
  }

  /**
   * 初始化DID服务并获取设备ID
   */
  private async initializeDidService(): Promise<void> {
    try {
      // 获取DID中的设备ID
      const deviceId = this.didService.getMyPeerId();
      this.logger.log(`📱 从DID服务获取设备ID: ${deviceId}`);

      // 确保设备配置中使用DID的设备ID
      const currentConfig = this.configService.getCurrentConfig();
      if (currentConfig.deviceId !== deviceId) {
        this.logger.log(`🔄 更新设备配置中的设备ID: ${currentConfig.deviceId} -> ${deviceId}`);
        await this.configService.updateConfig({ deviceId });
      }

      this.logger.debug('✅ DID service initialized and device ID synchronized');
    } catch (error) {
      this.logger.error('❌ Failed to initialize DID service:', error);
      throw error;
    }
  }

  /**
   * 初始化设备配置
   */
  private async initializeDeviceConfig(): Promise<void> {
    try {
      await this.configService.initialize();
      this.logger.debug('✅ Device configuration initialized');
    } catch (error) {
      this.logger.error('❌ Failed to initialize device configuration:', error);
      throw error;
    }
  }

  /**
   * 检查并执行自动注册（包含WebSocket连接建立）
   */
  private async checkAndPerformAutoRegistration(): Promise<void> {
    try {
      const config = this.configService.getCurrentConfig();

      if (this.hasStoredRegistrationInfo(config)) {
        this.logger.log('📋 发现存储的注册信息');

        // 获取设备ID
        const deviceId = this.didService.getMyPeerId();

        if (config.isRegistered) {
          this.logger.log('🔄 设备已注册，尝试重新连接到网关...');

          // 先建立WebSocket连接
          await this.establishWebSocketConnection(config, deviceId);
        } else {
          this.logger.log('🔗 设备未注册，尝试初始注册...');
        }

        // 触发自动注册（包含WebSocket连接建立）
        const success = await this.autoRegistrationService.attemptAutoRegistration();

        if (success) {
          this.logger.log('✅ 自动注册完成');
        } else {
          this.logger.warn('⚠️ 自动注册失败，将定期重试');
        }
      } else {
        this.logger.log('ℹ️ 未发现存储的注册信息');
        this.logger.log('💡 请使用注册API手动注册设备');
      }
    } catch (error) {
      this.logger.error('自动注册检查失败:', error);
    }
  }

  /**
   * 建立WebSocket连接
   */
  private async establishWebSocketConnection(config: any, deviceId: string): Promise<void> {
    try {
      if (config.gatewayAddress && config.key) {
        this.logger.log(`🔗 建立WebSocket连接到: ${config.gatewayAddress}`);

        await this.tunnelService.createConnection(
          config.gatewayAddress,
          config.code,
          config.basePath || '/'
        );

        await this.tunnelService.connect(deviceId);
        this.logger.log('✅ WebSocket连接建立成功');
      } else {
        this.logger.warn('⚠️ 缺少网关地址或密钥，跳过WebSocket连接');
      }
    } catch (error) {
      this.logger.error('❌ WebSocket连接建立失败:', error);
      // 不抛出错误，允许继续其他初始化步骤
    }
  }

  /**
   * 显示启动状态
   */
  private displayStartupStatus(): void {
    try {
      const config = this.configService.getCurrentConfig();
      const autoRegStatus = this.autoRegistrationService.getAutoRegistrationStatus();

      this.logger.log('📊 Startup Status Summary:');
      this.logger.log(`   Device ID: ${config.deviceId || 'Not set'}`);
      this.logger.log(`   Device Name: ${config.deviceName || 'Not set'}`);
      this.logger.log(`   Gateway: ${config.gatewayAddress || 'Not set'}`);
      this.logger.log(`   Registration Status: ${config.isRegistered ? '✅ Registered' : '❌ Not Registered'}`);
      this.logger.log(`   Auto Registration: ${autoRegStatus.isRegistering ? '🔄 In Progress' : '⏸️ Idle'}`);

      if (autoRegStatus.retryCount > 0) {
        this.logger.log(`   Retry Count: ${autoRegStatus.retryCount}/${autoRegStatus.maxRetries}`);
      }

      // 显示下一步操作建议
      this.displayNextSteps(config);
    } catch (error) {
      this.logger.error('Failed to display startup status:', error);
    }
  }

  /**
   * 显示下一步操作建议
   */
  private displayNextSteps(config: any): void {
    if (!this.hasStoredRegistrationInfo(config)) {
      this.logger.log('');
      this.logger.log('📝 Next Steps:');
      this.logger.log('   1. Register your device using the registration API');
      this.logger.log('   2. Provide: gateway_address, reward_address, key, code, device_name');
      this.logger.log('   3. The system will automatically connect to the gateway');
    } else if (!config.isRegistered) {
      this.logger.log('');
      this.logger.log('🔄 Auto Registration:');
      this.logger.log('   - The system will automatically retry registration');
      this.logger.log('   - Check network connectivity and gateway availability');
      this.logger.log('   - Verify registration credentials are correct');
    } else {
      this.logger.log('');
      this.logger.log('🎉 Device Ready:');
      this.logger.log('   - Device is registered and connected');
      this.logger.log('   - Heartbeat and monitoring are active');
      this.logger.log('   - Ready to receive tasks from gateway');
    }
  }

  /**
   * 检查是否有存储的注册信息
   */
  private hasStoredRegistrationInfo(config: any): boolean {
    return !!(
      config.gatewayAddress &&
      config.key &&
      config.code &&
      config.rewardAddress &&
      config.deviceName
    );
  }

  /**
   * 获取启动状态
   */
  getStartupStatus(): {
    configInitialized: boolean;
    hasRegistrationInfo: boolean;
    isRegistered: boolean;
    autoRegistrationStatus: any;
  } {
    try {
      const config = this.configService.getCurrentConfig();
      const autoRegStatus = this.autoRegistrationService.getAutoRegistrationStatus();

      return {
        configInitialized: true,
        hasRegistrationInfo: this.hasStoredRegistrationInfo(config),
        isRegistered: config.isRegistered,
        autoRegistrationStatus: autoRegStatus
      };
    } catch (error) {
      this.logger.error('Failed to get startup status:', error);
      return {
        configInitialized: false,
        hasRegistrationInfo: false,
        isRegistered: false,
        autoRegistrationStatus: null
      };
    }
  }

  /**
   * 手动触发重新初始化
   */
  async reinitialize(): Promise<boolean> {
    try {
      this.logger.log('🔄 Manual reinitialization requested...');

      await this.initializeDeviceConfig();
      await this.checkAndPerformAutoRegistration();
      this.displayStartupStatus();

      this.logger.log('✅ Manual reinitialization completed');
      return true;
    } catch (error) {
      this.logger.error('❌ Manual reinitialization failed:', error);
      return false;
    }
  }
}

// 服务提供者
export const STARTUP_INITIALIZATION_SERVICE = Symbol('STARTUP_INITIALIZATION_SERVICE');

const StartupInitializationServiceProvider = {
  provide: STARTUP_INITIALIZATION_SERVICE,
  useClass: StartupInitializationService
};

export default StartupInitializationServiceProvider;
