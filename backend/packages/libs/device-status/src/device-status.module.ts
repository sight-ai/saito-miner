import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PersistentModule } from '@saito/persistent';
import { LocalConfigService } from '@saito/common';
import { DeviceStatusRepository } from './device-status.repository';
import DeviceStatusServiceProvider from './device-status.service';

import { ScheduleModule } from '@nestjs/schedule';

// 导入新的服务组件
import DeviceRegistryServiceProvider from './services/device-registry.service';
import DeviceConfigServiceProvider from './services/device-config.service';
import DeviceDatabaseServiceProvider from './services/device-database.service';
import DeviceHeartbeatServiceProvider from './services/device-heartbeat.service';
import DeviceSystemServiceProvider, { DeviceSystemService } from './services/device-system.service';
import DeviceGatewayServiceProvider from './services/device-gateway.service';
import AutoRegistrationServiceProvider from './services/auto-registration.service';
import StartupInitializationServiceProvider from './services/startup-initialization.service';
import { DynamicConfigService } from './services/dynamic-config.service';
import { RegistrationStorage } from './registration-storage';

// 导入增强的设备状态服务
import { EnvironmentDetectorService } from './services/environment-detector.service';
import { DeviceStatusManagerService } from './services/device-status-manager.service';
import { EnhancedDeviceStatusService } from './services/enhanced-device-status.service';

import TunnelCommunicationServiceProvider from './services/tunnel-communication.service';
import { TunnelEventListenerService } from './services/tunnel-event-listener.service';
import { DidIntegrationService } from './services/did-integration.service';
import { DidModule } from '@saito/did';
import { TunnelModule } from '@saito/tunnel';
  
const TUNNEL_COMMUNICATION_SERVICE = Symbol('TUNNEL_COMMUNICATION_SERVICE');

@Module({
  imports: [
    HttpModule,
    PersistentModule,
    ScheduleModule.forRoot(),
    EventEmitterModule,
    DidModule,
    TunnelModule
  ],
  providers: [
    // 共享服务
    LocalConfigService,

    // 新的优化服务组件
    DeviceRegistryServiceProvider,
    DeviceConfigServiceProvider,
    DeviceDatabaseServiceProvider,
    DeviceHeartbeatServiceProvider,
    DeviceSystemServiceProvider,
    DeviceSystemService, // 直接注册类以支持类型注入
    DeviceGatewayServiceProvider,
    AutoRegistrationServiceProvider,
    StartupInitializationServiceProvider,
    DynamicConfigService,
    RegistrationStorage,

    // 增强的设备状态服务
    EnvironmentDetectorService,
    DeviceStatusManagerService,
    EnhancedDeviceStatusService,

    // 主服务
    DeviceStatusServiceProvider,
    DeviceStatusRepository,

    TunnelCommunicationServiceProvider,
    // 提供接口实现
    {
      provide: TUNNEL_COMMUNICATION_SERVICE,
      useExisting: TunnelCommunicationServiceProvider.provide,
    },
    TunnelEventListenerService,
    DidIntegrationService
  ],
  exports: [
    // 共享服务
    LocalConfigService,

    // 新的优化服务组件
    DeviceRegistryServiceProvider,
    DeviceConfigServiceProvider,
    DeviceDatabaseServiceProvider,
    DeviceHeartbeatServiceProvider,
    DeviceSystemServiceProvider,
    DeviceSystemService, // 直接导出类以支持类型注入
    DeviceGatewayServiceProvider,
    AutoRegistrationServiceProvider,
    StartupInitializationServiceProvider,
    DynamicConfigService,
    RegistrationStorage,

    // 增强的设备状态服务
    EnvironmentDetectorService,
    DeviceStatusManagerService,
    EnhancedDeviceStatusService,

    // 主服务
    DeviceStatusServiceProvider,
    DeviceStatusRepository,

    TunnelCommunicationServiceProvider,
    TUNNEL_COMMUNICATION_SERVICE,
    TunnelEventListenerService,
    DidIntegrationService,
  ],
})
export class DeviceStatusModule {}
