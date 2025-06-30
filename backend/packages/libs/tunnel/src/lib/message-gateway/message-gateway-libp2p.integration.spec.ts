import { TunnelMessageSchema } from '@saito/models';
import { MessageGatewayLibp2pService } from './message-gateway-libp2p.service';

describe('MessageGatewayLibp2pService (integration)', () => {
  let service: MessageGatewayLibp2pService;

  beforeEach(() => {
    service = new MessageGatewayLibp2pService();
  });

  it('should actually send message to real REST endpoint', async () => {
    // 请确保你本地 http://localhost:3001/libp2p/send 已经启动并可用
    const message = {
      from: 'test-from',
      to: 'test-to',
      type: 'ping',
      payload: { timestamp: 1231231 , message: 'foo' },
    };

    await expect(service.sendMessage(TunnelMessageSchema.parse(message))).resolves.not.toThrow();
    // 你也可以加其他断言，比如看响应内容
  });
});