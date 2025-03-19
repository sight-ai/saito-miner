import { Module } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';
import { IndexController } from './controllers/index.controller';
import { KeeperController } from "./controllers/keeper.controller";
import { KeeperModule } from "@saito/keeper";
import { OllamaModule } from "@saito/ollama";
import { DeviceStatusModule } from "@saito/device-status";
import { ModelController } from "./controllers/model.controller";
import { MinerController } from "./controllers/miner.controller";
import { MinerModule } from "@saito/miner";
import { NodeModule } from "@saito/node";

@Module({
  imports: [KeeperModule, OllamaModule, MinerModule, DeviceStatusModule, NodeModule],
  controllers: [IndexController, KeeperController, ModelController, MinerController],
  providers: [
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe,
    },
  ],
})
export class AppModule {}
