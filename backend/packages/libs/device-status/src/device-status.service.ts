import { Injectable, Inject, Logger, forwardRef } from "@nestjs/common";
import * as R from 'ramda';
import { DeviceStatusRepository } from "./device-status.repository";
import { DatabaseTransactionConnection } from "slonik";
import { Cron, CronExpression } from '@nestjs/schedule';
import { OllamaService } from "@saito/ollama";
import got from "got-cjs";
import si from 'systeminformation';
import { address } from 'ip';
import { env } from '../env'
import { DeviceStatusService } from "./device-status.interface";
import { TunnelService } from "@saito/tunnel";
@Injectable()
export class DefaultDeviceStatusService implements DeviceStatusService {
  private readonly logger = new Logger(DefaultDeviceStatusService.name);
  private isRegistered = false; // 新增注册状态标志
  private deviceId: string = 'local_device_id';
  private deviceName: string = 'local_device_name';
  private rewardAddress: string = '';
  private gatewayAddress: string = '';
  private key: string = '';
  private code: string = '';
  constructor(
    private readonly deviceStatusRepository: DeviceStatusRepository,
    @Inject(forwardRef(() => OllamaService))
    private readonly ollamaService: OllamaService,
    private readonly tunnelService: TunnelService
  ) {
  }
  async register(body: { code: string, gateway_address: string, reward_address: string, key: string }): Promise<{
    success: boolean,
    error: string
  }> {
    try {
      const [ipAddress, deviceType, deviceModel] = await Promise.all([
        address(),
        this.getDeviceType(),
        this.getDeviceModel(),
      ]);

      this.logger.debug(`Registering device with gateway: ${body.gateway_address}`);

      const { data, code } = await got.post(`${body.gateway_address}/node/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${body.key}`
        },
        json: {
          code: body.code,
          gateway_address: body.gateway_address,
          reward_address: body.reward_address,
          device_type: deviceType,
          gpu_type: deviceModel,
          ip: ipAddress,
        },
      }).json() as {
        data: {
          success: boolean,
          error: string,
          node_id: string,
          name: string,
        },
        code: number
      }

      if (data.success && code !== 500) {
        this.isRegistered = true;
        this.heartbeat()
        this.deviceId = data.node_id;
        this.deviceName = data.name;
        this.rewardAddress = body.reward_address;
        this.gatewayAddress = body.gateway_address
        this.key = body.key;
        this.code = body.code;
        await this.tunnelService.createSocket(this.gatewayAddress, this.key, this.code)
        await this.tunnelService.connectSocket(data.node_id)
        this.logger.log('Device registration successful');
        return data;
      } else {
        this.logger.error(`Registration failed: ${data.error}`);
        return data;
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Registration error: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  async getDeviceType(): Promise<string> {
    return env().DEVICE_TYPE
  }

  async getDeviceModel(): Promise<string> {
    return env().GPU_MODEL
  }

  async getDeviceInfo(): Promise<string> {
    try {
      const [os, cpu, mem, graphics] = await Promise.all([
        si.osInfo(),
        si.cpu(),
        si.mem(),
        si.graphics()
      ]);

      return JSON.stringify({
        os: `${os.distro} ${os.release} (${os.arch})`,
        cpu: `${cpu.manufacturer} ${cpu.brand} ${cpu.speed}GHz`,
        memory: `${(mem.total / 1024 / 1024 / 1024).toFixed(1)}GB`,
        graphics: R.map(R.applySpec({
          model: R.prop('model'),
          vram: R.ifElse(R.both(R.has('vram'), R.pipe(R.prop('vram'), R.is(Number))), R.pipe(R.prop('vram'), R.divide(R.__, 1024), Math.round, R.toString, R.concat(R.__, 'GB')), R.always('Unknown'))
        }), graphics.controllers)
      });
    } catch {
      return '{}';
    }
  }
  async heartbeat() {
    if (!this.isRegistered) {
      this.logger.debug('Skipping heartbeat - device not registered');
      return;
    }

    try {
      const [cpuLoad, memoryInfo, gpuInfo, ipAddress, deviceType, deviceModel, deviceInfo] = await Promise.all([
        si.currentLoad().catch(() => ({ currentLoad: 0 })),
        si.mem().catch(() => ({ used: 0, total: 1 })),
        si.graphics().catch(() => ({ controllers: [{ utilizationGpu: 0 }] })),
        address(),
        this.getDeviceType(),
        this.getDeviceModel(),
        this.getDeviceInfo()
      ]);

      const heartbeatData = {
        code: this.code,
        cpu_usage: Number(cpuLoad.currentLoad.toFixed(2)),
        memory_usage: Number(
          ((memoryInfo.used / memoryInfo.total) * 100).toFixed(2)
        ),
        gpu_usage: Number(
          (gpuInfo.controllers[0]?.utilizationGpu || 0).toFixed(2)
        ),
        ip: ipAddress,
        timestamp: new Date().toISOString(),
        type: deviceType,
        model: deviceModel,
        device_info: deviceInfo,
        gateway_url: this.gatewayAddress
      };

      await got.post(`${this.gatewayAddress}/node/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.key}`
        },
        json: heartbeatData,
      });

      this.logger.debug('Heartbeat sent successfully');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Heartbeat failed: ${errorMessage}`);
      // 如果心跳失败，可能需要重新注册
      this.isRegistered = false;
    }
  }
  async updateDeviceStatus(deviceId: string, name: string, status: "online" | "offline", rewardAddress: string) {
    return this.deviceStatusRepository.transaction(async (conn: DatabaseTransactionConnection) => {
      return this.deviceStatusRepository.updateDeviceStatus(conn, deviceId, name, status, rewardAddress, this.gatewayAddress, this.key, this.code);
    });
  }

  async getDeviceStatus(deviceId: string) {
    return this.deviceStatusRepository.transaction(async (conn: DatabaseTransactionConnection) => {
      return this.deviceStatusRepository.findDeviceStatus(conn, deviceId);
    });
  }

  async markInactiveDevicesOffline(inactiveDuration: number) {
    return this.deviceStatusRepository.transaction(async (conn: DatabaseTransactionConnection) => {
      const thresholdTime = new Date(Date.now() - inactiveDuration);
      return this.deviceStatusRepository.markDevicesOffline(conn, thresholdTime);
    });
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async checkOllamaStatus() {
    this.heartbeat()
    const deviceId = this.deviceId;
    const deviceName = this.deviceName
    const rewardAddress = this.rewardAddress

    if (!deviceId || !deviceName) {
      return;
    }

    try {
      const isOnline = await this.isOllamaOnline();
      const status: "online" | "offline" = isOnline ? "online" : "offline";
      R.ifElse(R.equals(true), async () => {
        await this.updateDeviceStatus(deviceId, deviceName, status, rewardAddress);
      }, async () => {
        const inactiveDuration = 1000 * 60;
        await this.markInactiveDevicesOffline(inactiveDuration);
      })(isOnline);
    } catch (error) {
      const inactiveDuration = 1000 * 60;
      await this.markInactiveDevicesOffline(inactiveDuration);
    }
  }

  async isOllamaOnline(): Promise<boolean> {
    try {
      return await this.ollamaService.checkStatus();
    } catch (error) {
      return false;
    }
  }

  async getDeviceList(): Promise<{
    deviceId: string,
    name: string,
    status: "online" | "offline"
  }[]> {
    return this.deviceStatusRepository.transaction(async (conn: DatabaseTransactionConnection) => {
      return this.deviceStatusRepository.findDeviceList(conn);
    });
  }

  async getCurrentDevice(): Promise<{
    deviceId: string,
    name: string,
    status: "online" | "offline",
    rewardAddress: string | null
  }> {
    return this.deviceStatusRepository.transaction(async (conn: DatabaseTransactionConnection) => {
      return this.deviceStatusRepository.findCurrentDevice(conn);
    });
  }

  async getGatewayStatus(): Promise<{
    isRegistered: boolean
  }> {
    return {
      isRegistered: this.isRegistered
    };
  }

  async getDeviceId(): Promise<string> {
    return this.deviceId;
  }

  async getDeviceName(): Promise<string> {
    return this.deviceName;
  }

  async getRewardAddress(): Promise<string> {
    return this.rewardAddress;
  }

  async getGatewayAddress(): Promise<string> {
    return this.gatewayAddress;
  }

  async getKey(): Promise<string> {
    return this.key;
  }
}


const DeviceStatusServiceProvider = {
  provide: DeviceStatusService,
  useClass: DefaultDeviceStatusService,
};

export default DeviceStatusServiceProvider;
