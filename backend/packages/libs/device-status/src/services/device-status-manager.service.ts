import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LocalConfigService } from '@saito/common';
import { 
  SystemInfoSchema, 
  DeviceStatusSchema, 
  SystemHeartbeatDataSchema,
  type SystemInfo,
  type DeviceStatus,
  type SystemHeartbeatData
} from '@saito/models';
import { EnvironmentDetectorService, EnvironmentDetectionResult } from './environment-detector.service';
import { DeviceSystemService } from './device-system.service';

/**
 * 设备状态信息
 */
export interface DeviceStatusInfo {
  deviceId: string;
  deviceName: string;
  status: DeviceStatus;
  framework: {
    type: 'ollama' | 'vllm' | null;
    available: boolean;
    version?: string;
    models: string[];
  };
  system: SystemInfo;
  lastUpdated: string;
  uptime: number;
}

/**
 * 状态变更事件
 */
export interface StatusChangeEvent {
  deviceId: string;
  oldStatus: DeviceStatus;
  newStatus: DeviceStatus;
  timestamp: string;
  reason: string;
}

/**
 * 状态变更监听器
 */
export type StatusChangeListener = (event: StatusChangeEvent) => void;

/**
 * 设备状态管理器
 * 
 */
@Injectable()
export class DeviceStatusManagerService {
  private readonly logger = new Logger(DeviceStatusManagerService.name);
  
  private currentStatus: DeviceStatus = 'unknown';
  private lastEnvironmentCheck: EnvironmentDetectionResult | null = null;
  private lastSystemInfo: SystemInfo | null = null;
  private statusChangeListeners: StatusChangeListener[] = [];
  private startTime = Date.now();

  constructor(
    private readonly localConfigService: LocalConfigService,
    private readonly environmentDetector: EnvironmentDetectorService,
    private readonly systemService: DeviceSystemService
  ) {
    this.initializeStatusManager();
  }

  /**
   * 初始化状态管理器
   */
  private async initializeStatusManager(): Promise<void> {
    try {
      this.logger.log('Initializing device status manager');
      
      // 执行初始状态检查
      await this.performStatusCheck();
      
      this.logger.log('Device status manager initialized');
    } catch (error) {
      this.logger.error('Failed to initialize device status manager:', error);
    }
  }

  /**
   * 获取当前设备状态信息
   */
  async getCurrentDeviceStatus(): Promise<DeviceStatusInfo> {
    try {
      const deviceId = this.localConfigService.get('config.json', 'device_id') || 'unknown';
      const deviceName = this.localConfigService.get('config.json', 'device_name') || 'Unknown Device';
      
      // 获取最新的环境和系统信息
      const [environment, systemInfo] = await Promise.all([
        this.environmentDetector.detectCurrentEnvironment(),
        this.systemService.collectSystemInfo()
      ]);

      return {
        deviceId,
        deviceName,
        status: this.currentStatus,
        framework: {
          type: environment.framework,
          available: environment.isAvailable,
          version: environment.version,
          models: environment.models || []
        },
        system: systemInfo as any,
        lastUpdated: new Date().toISOString(),
        uptime: Date.now() - this.startTime
      };

    } catch (error) {
      this.logger.error('Failed to get current device status:', error);
      throw error;
    }
  }

  /**
   * 获取心跳数据
   */
  async getHeartbeatData(): Promise<SystemHeartbeatData> {
    try {
      const deviceStatus = await this.getCurrentDeviceStatus();
      const systemInfo = deviceStatus.system;

      // 构建心跳数据
      const heartbeatData = {
        code: deviceStatus.deviceId,
        cpu_usage: this.extractCpuUsage(systemInfo),
        memory_usage: this.extractMemoryUsage(systemInfo),
        gpu_usage: this.extractGpuUsage(systemInfo),
        gpu_temperature: this.extractGpuTemperature(systemInfo),
        network_in_kbps: this.extractNetworkIn(systemInfo),
        network_out_kbps: this.extractNetworkOut(systemInfo),
        ip: '127.0.0.1', // 从其他地方获取 IP
        timestamp: new Date().toISOString(),
        type: 'Unknown', // 从其他地方获取设备类型
        model: 'Unknown', // 从其他地方获取设备型号
        device_info: {
          cpu_model: this.extractCpuModel(systemInfo),
          cpu_cores: this.extractCpuCores(systemInfo),
          cpu_threads: this.extractCpuThreads(systemInfo),
          ram_total: this.extractRamTotal(systemInfo),
          ram_used: this.extractRamUsed(systemInfo),
          ram_available: this.extractRamAvailable(systemInfo),
          ram_available_percent: this.extractRamAvailablePercent(systemInfo),
          gpu_model: this.extractGpuModel(systemInfo),
          gpu_vendor: this.extractGpuVendor(systemInfo),
          gpu_count: systemInfo.gpus?.length || 0,
          gpu_memory: this.extractGpuMemory(systemInfo),
          gpu_temperature: this.extractGpuTemperature(systemInfo),
          disk_total: this.extractDiskTotal(systemInfo),
          disk_used: this.extractDiskUsed(systemInfo),
          disk_available: this.extractDiskAvailable(systemInfo),
          disk_available_percent: this.extractDiskAvailablePercent(systemInfo),
          network_in_kbps: this.extractNetworkIn(systemInfo),
          network_out_kbps: this.extractNetworkOut(systemInfo),
          os_info: systemInfo.os || 'Unknown',
          uptime_seconds: Math.floor(deviceStatus.uptime / 1000)
        }
      };

      // 验证心跳数据
      return SystemHeartbeatDataSchema.parse(heartbeatData);

    } catch (error) {
      this.logger.error('Failed to generate heartbeat data:', error);
      throw error;
    }
  }

  /**
   * 添加状态变更监听器
   */
  addStatusChangeListener(listener: StatusChangeListener): void {
    this.statusChangeListeners.push(listener);
  }

  /**
   * 移除状态变更监听器
   */
  removeStatusChangeListener(listener: StatusChangeListener): void {
    const index = this.statusChangeListeners.indexOf(listener);
    if (index > -1) {
      this.statusChangeListeners.splice(index, 1);
    }
  }

  /**
   * 手动触发状态检查
   */
  async triggerStatusCheck(): Promise<DeviceStatusInfo> {
    await this.performStatusCheck();
    return this.getCurrentDeviceStatus();
  }

  /**
   * 公共方法：更新设备状态
   * 供外部模块调用，例如事件监听器
   */
  async updateDeviceStatus(newStatus: DeviceStatus, reason: string): Promise<void> {
    await this.updateStatus(newStatus, reason);
  }

  /**
   * 定期状态检查 (每30秒)
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async scheduledStatusCheck(): Promise<void> {
    try {
      await this.performStatusCheck();
    } catch (error) {
      this.logger.error('Scheduled status check failed:', error);
    }
  }

  /**
   * 定期环境检查 (每5分钟)
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async scheduledEnvironmentCheck(): Promise<void> {
    try {
      this.logger.debug('Performing scheduled environment check');
      
      const environment = await this.environmentDetector.detectCurrentEnvironment();
      this.lastEnvironmentCheck = environment;
      
      // 如果环境状态发生变化，更新设备状态
      if (!environment.isAvailable && this.currentStatus === 'online') {
        await this.updateStatus('error', 'Framework became unavailable');
      } else if (environment.isAvailable && this.currentStatus === 'error') {
        await this.updateStatus('online', 'Framework became available');
      }

    } catch (error) {
      this.logger.error('Scheduled environment check failed:', error);
    }
  }

  // =============================================================================
  // 私有方法
  // =============================================================================

  /**
   * 执行状态检查
   */
  private async performStatusCheck(): Promise<void> {
    try {
      const [environment, systemInfo] = await Promise.all([
        this.environmentDetector.detectCurrentEnvironment(),
        this.systemService.collectSystemInfo()
      ]);

      this.lastEnvironmentCheck = environment;
      this.lastSystemInfo = systemInfo as any;

      // 确定新状态
      let newStatus: DeviceStatus;
      let reason: string;

      if (!environment.isAvailable) {
        newStatus = 'offline';
        reason = `Framework ${environment.framework || 'unknown'} is not available`;
      } else if (environment.models && environment.models.length === 0) {
        newStatus = 'error';
        reason = 'No models available in framework';
      } else {
        newStatus = 'online';
        reason = 'Framework is available and working';
      }

      // 更新状态
      await this.updateStatus(newStatus, reason);

    } catch (error) {
      this.logger.error('Status check failed:', error);
      await this.updateStatus('error', `Status check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 更新设备状态
   */
  private async updateStatus(newStatus: DeviceStatus, reason: string): Promise<void> {
    const oldStatus = this.currentStatus;
    
    if (oldStatus !== newStatus) {
      this.currentStatus = newStatus;
      
      const event: StatusChangeEvent = {
        deviceId: this.localConfigService.get('config.json', 'device_id') || 'unknown',
        oldStatus,
        newStatus,
        timestamp: new Date().toISOString(),
        reason
      };

      this.logger.log(`Device status changed: ${oldStatus} -> ${newStatus} (${reason})`);

      // 通知监听器
      this.notifyStatusChange(event);
    }
  }

  /**
   * 通知状态变更
   */
  private notifyStatusChange(event: StatusChangeEvent): void {
    this.statusChangeListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        this.logger.error('Status change listener failed:', error);
      }
    });
  }

  // =============================================================================
  // 数据提取辅助方法
  // =============================================================================

  private extractCpuUsage(systemInfo: SystemInfo): number {
    // 从系统信息中提取 CPU 使用率，默认返回 0
    return 0; // TODO: 实现实际的 CPU 使用率提取
  }

  private extractMemoryUsage(systemInfo: SystemInfo): number {
    // 从内存信息中计算使用率
    if (typeof systemInfo.memory === 'object' && systemInfo.memory.usage) {
      return systemInfo.memory.usage;
    }
    return 50;
  }

  private extractGpuUsage(systemInfo: SystemInfo): number {
    return 0; // TODO: 实现 GPU 使用率提取
  }

  private extractGpuTemperature(systemInfo: SystemInfo): number {
    return 45; // TODO: 实现 GPU 温度提取
  }

  private extractNetworkIn(systemInfo: SystemInfo): number {
    return 0; // TODO: 实现网络流量提取
  }

  private extractNetworkOut(systemInfo: SystemInfo): number {
    return 0; // TODO: 实现网络流量提取
  }

  private extractCpuModel(systemInfo: SystemInfo): string {
    return typeof systemInfo.cpu === 'object' ? systemInfo.cpu.model : 'Unknown CPU';
  }

  private extractCpuCores(systemInfo: SystemInfo): number {
    if (typeof systemInfo.cpu === 'object' && systemInfo.cpu.cores) {
      return systemInfo.cpu.cores;
    }
    return 8; // 默认值
  }

  private extractCpuThreads(systemInfo: SystemInfo): number {
    return 16; // TODO: 从系统信息中提取
  }

  private extractRamTotal(systemInfo: SystemInfo): number {
    if (typeof systemInfo.memory === 'object' && systemInfo.memory.total) {
      return systemInfo.memory.total;
    }
    return 8; // 默认 8GB
  }

  private extractRamUsed(systemInfo: SystemInfo): number {
    const total = this.extractRamTotal(systemInfo);
    return total * 0.6; // TODO: 实现实际的已用内存计算
  }

  private extractRamAvailable(systemInfo: SystemInfo): number {
    const total = this.extractRamTotal(systemInfo);
    const used = this.extractRamUsed(systemInfo);
    return total - used;
  }

  private extractRamAvailablePercent(systemInfo: SystemInfo): number {
    const total = this.extractRamTotal(systemInfo);
    const available = this.extractRamAvailable(systemInfo);
    return total > 0 ? (available / total) * 100 : 0;
  }

  private extractGpuModel(systemInfo: SystemInfo): string {
    return systemInfo.gpus?.[0]?.name || 'Unknown GPU';
  }

  private extractGpuVendor(systemInfo: SystemInfo): string {
    return systemInfo.gpus?.[0]?.vendor || 'Unknown';
  }

  private extractGpuMemory(systemInfo: SystemInfo): number {
    if (systemInfo.gpus?.[0]?.memory?.total) {
      return systemInfo.gpus[0].memory.total;
    }
    return 0;
  }

  private extractDiskTotal(systemInfo: SystemInfo): number {
    return 1000; // TODO: 实现磁盘容量提取
  }

  private extractDiskUsed(systemInfo: SystemInfo): number {
    return 600; // TODO: 实现已用磁盘容量提取
  }

  private extractDiskAvailable(systemInfo: SystemInfo): number {
    return this.extractDiskTotal(systemInfo) - this.extractDiskUsed(systemInfo);
  }

  private extractDiskAvailablePercent(systemInfo: SystemInfo): number {
    const total = this.extractDiskTotal(systemInfo);
    const available = this.extractDiskAvailable(systemInfo);
    return total > 0 ? (available / total) * 100 : 0;
  }
}
