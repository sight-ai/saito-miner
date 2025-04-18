import { Body, Controller, Get, Inject, Logger, Post, Res } from "@nestjs/common";
import { DeviceStatusService } from "@saito/device-status";
import { Response } from 'express';

@Controller('/api/v1/device-status')
export class DeviceStatusController {
  constructor(
    @Inject(DeviceStatusService) private readonly deviceStatusService: DeviceStatusService
  ) { }

  @Post('/register')
  async register(@Res() res: Response, @Body() body: { code: string, gateway_address: string, reward_address: string, key: string }) {
    try {
      const data: {
        success: boolean,
        error: string
      } = await this.deviceStatusService.register(body);
      if (data.success) {
        res.status(200).send('Registration successful, starting heartbeat');
      } else {
        res.status(500).send(data.error);
      }
    } catch (error) {
      res.status(500)
    }
  }

  @Get('/gateway-status')
  async getGatewayStatus() {
    return this.deviceStatusService.getGatewayStatus();
  }
}
