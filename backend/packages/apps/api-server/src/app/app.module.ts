import { Module } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';
import { IndexController } from './controllers/index.controller';
import { OllamaModule } from "@saito/ollama";
import { DeviceStatusModule } from "@saito/device-status";
import { ModelController } from "./controllers/model.controller";
import { MinerController } from "./controllers/miner.controller";
import { MinerModule } from "@saito/miner";
import { DeviceStatusController } from "./controllers/device-status.controller";
@Module({
  imports: [OllamaModule, MinerModule, DeviceStatusModule],
  controllers: [IndexController, ModelController, MinerController, DeviceStatusController],
  providers: [
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe,
    },
  ],
})
export class AppModule {}
