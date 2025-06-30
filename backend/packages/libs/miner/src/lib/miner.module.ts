import { Module, forwardRef } from '@nestjs/common';
import { PersistentModule } from "@saito/persistent";
import MinerServiceProvider from "./miner.service";
import { MinerRepository } from "./miner.repository";
import { ScheduleModule } from '@nestjs/schedule';
import { DeviceStatusModule } from "@saito/device-status";

// 新的抽象架构服务
import { TaskManagerService } from './services/task-manager.service';
import { EarningsManagerService } from './services/earnings-manager.service';
import { DataAccessService } from './services/data-access.service';
import { UnifiedMinerService } from './services/unified-miner.service';

// 核心契约接口和标识符
import {
  TASK_MANAGER,
  EARNINGS_MANAGER,
  STATISTICS_ANALYZER,
  GATEWAY_CONNECTOR,
  DATA_ACCESS_LAYER,
  MINER_SERVICE,
  MinerConfig
} from './core-contracts/miner-core.contracts';
// 默认配置
const defaultMinerConfig: MinerConfig = {
  maxRetries: 3,
  retryDelay: 1000,
  staleTaskThreshold: 5 * 60 * 1000, // 5分钟
  defaultPageSize: 20,
  enableAutoCleanup: true,
  maxConcurrentTasks: 10,
  taskTimeout: 30 * 60 * 1000, // 30分钟
  enableMetrics: true,
  metricsInterval: 60 * 1000, // 1分钟
  cleanupInterval: 24 * 60 * 60 * 1000 // 24小时
};

@Module({
  imports: [
    PersistentModule,
    ScheduleModule.forRoot(),
    DeviceStatusModule
  ],
  providers: [
    // 原有服务（向后兼容）
    MinerServiceProvider,
    MinerRepository,

    // 新的抽象架构服务
    {
      provide: DATA_ACCESS_LAYER,
      useClass: DataAccessService
    },
    {
      provide: TASK_MANAGER,
      useClass: TaskManagerService
    },
    {
      provide: EARNINGS_MANAGER,
      useClass: EarningsManagerService
    },
    {
      provide: STATISTICS_ANALYZER,
      useClass: EarningsManagerService
    },
    {
      provide: GATEWAY_CONNECTOR,
      useValue: {
        connectTaskList: async (_body: any) => ({ success: false, error: 'Gateway connector not implemented' }),
        syncWithGateway: async () => false,
        validateGatewayConnection: async () => false
      }
    },
    {
      provide: MINER_SERVICE,
      useClass: UnifiedMinerService
    },
    {
      provide: 'MINER_CONFIG',
      useValue: defaultMinerConfig
    },

    // 具体实现类
    TaskManagerService,
    EarningsManagerService,
    DataAccessService,
    UnifiedMinerService
  ],
  exports: [
    // 原有导出（向后兼容）
    MinerServiceProvider,

    // 新的抽象架构导出
    TASK_MANAGER,
    EARNINGS_MANAGER,
    STATISTICS_ANALYZER,
    GATEWAY_CONNECTOR,
    DATA_ACCESS_LAYER,
    MINER_SERVICE,

    // 具体实现类导出
    TaskManagerService,
    EarningsManagerService,
    DataAccessService,
    UnifiedMinerService
  ]
})
export class MinerModule {}
