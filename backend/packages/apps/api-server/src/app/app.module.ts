import { Module, forwardRef } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ZodValidationPipe } from 'nestjs-zod';
import { IndexController } from './controllers/index.controller';
import { DeviceStatusModule } from "@saito/device-status";
import { ModelController } from "./controllers/ollama.controller";
import { MinerController } from "./controllers/miner.controller";
import { MinerModule } from "@saito/miner";
import { DeviceStatusController } from "./controllers/device-status.controller";
import { OpenAIController } from "./controllers/openai.controller";
import { ModelsController } from "./controllers/models.controller";
import { AppConfigController } from "./controllers/app-config.controller";
import {DidModule} from "@saito/did"

// 导入应用配置服务
import { AppConfigurationService } from "./services/app-configuration.service";


import { TunnelModule } from "@saito/tunnel";
import { TaskSyncModule } from '@saito/task-sync';
import { ModelReportingModule } from "@saito/model-reporting";
import { ModelInferenceClientModule, TUNNEL_SERVICE_TOKEN } from "@saito/model-inference-client";
import { ModelInferenceFrameworkManagementModule } from "@saito/model-inference-framework-management";
import { EarningsTrackingModule } from '@saito/earnings-tracking';
import { Libp2pController } from './controllers/tunnel-libp2p.controller';
@Module({
  imports: [
    EventEmitterModule.forRoot(),
    forwardRef(() => MinerModule),
    DeviceStatusModule,
    forwardRef(() => TunnelModule), // TunnelModule 必须在 ModelInferenceClientModule 之前
    TaskSyncModule,
    ModelReportingModule,
    ModelInferenceFrameworkManagementModule,
    ModelInferenceClientModule, // 移到 TunnelModule 之后
    EarningsTrackingModule,
    DidModule
  ],
  controllers: [
    IndexController,
    ModelController,
    MinerController,
    DeviceStatusController,
    OpenAIController,
    ModelsController,
    AppConfigController,
    Libp2pController
  ],
  providers: [
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe,
    },
    // 应用配置服务
    AppConfigurationService,
    // 为推理服务提供 TunnelService
    {
      provide: TUNNEL_SERVICE_TOKEN,
      useExisting: 'TunnelService',
    },
  ],
})
export class AppModule {}
