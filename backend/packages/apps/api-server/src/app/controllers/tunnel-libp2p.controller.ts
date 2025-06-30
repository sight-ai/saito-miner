import { Body, Controller, Inject, Logger, Post } from '@nestjs/common';
import { TunnelMessage } from '@saito/models'; // TunnelMessage 类型
import { MessageGatewayLibp2pService, TunnelService } from '@saito/tunnel'; // 这里假设 @saito/tunnel 指向你的 libs/tunnel

@Controller('libp2p')
export class Libp2pController {
  private logger = new Logger(Libp2pController.name);
  constructor(@Inject('TunnelService') private readonly tunnelService: TunnelService) {}

  @Post('message')
  async handleLibp2pMessage(@Body() message: TunnelMessage) {
    // 这里调用 tunnelService 的 handleMessage 方法
    await this.tunnelService.handleMessage(message);
    this.logger.debug(`Received from libp2p.`);
    return { status: 'ok' };
  }
}
