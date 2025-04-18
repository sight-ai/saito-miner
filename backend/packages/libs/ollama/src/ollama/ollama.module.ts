import { Module, forwardRef } from '@nestjs/common';
import { PersistentModule } from '@saito/persistent';
import { OllamaRepository } from './ollama.repository';
import OllamaServiceProvider from './ollama.service';
import { HttpModule } from "@nestjs/axios";
import { MinerModule } from '@saito/miner';
import { DeviceStatusModule } from '@saito/device-status';
import { DeviceStatusService } from '@saito/device-status';
import { TunnelModule } from '@saito/tunnel';

@Module({
  imports: [
    HttpModule, 
    PersistentModule, 
    MinerModule, 
    DeviceStatusModule,
    forwardRef(() => TunnelModule)
  ],
  providers: [
    OllamaServiceProvider, 
    OllamaRepository,
    {
      provide: 'DEVICE_STATUS_SERVICE',
      useExisting: DeviceStatusService
    }
  ],
  exports: [OllamaServiceProvider, OllamaRepository],
})
export class OllamaModule {}
