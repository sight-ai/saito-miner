import { MessageGatewayLibp2pService } from './message-gateway-libp2p.service';
import axios from 'axios';
import { TunnelMessage, TunnelMessageSchema } from '@saito/models';


jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('MessageGatewayLibp2pService', () => {
  let service: MessageGatewayLibp2pService;

  beforeEach(() => {
    service = new MessageGatewayLibp2pService();
    jest.clearAllMocks();
  });

  it('should send message successfully', async () => {
    mockedAxios.post.mockResolvedValue({ data: { status: 'ok' } });

    await expect(
      service.sendMessage({ from: 'a', to: 'b', type: 'ping', payload: { timestamp: 12323123, message: 'foo' } }),
    ).resolves.not.toThrow();

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'http://localhost:3001/libp2p/send',
      { from: 'a', to: 'b', type: 'ping', payload: { timestamp: 12323123, message: 'foo' } },
      expect.objectContaining({
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });

  it('should call onMessage callback', async () => {
    const callback = jest.fn();
    service.onMessage(callback);

    const msg = { from: 'x', to: 'y', type: 'ping', payload: { timestamp: 12323123, message: 'foo' } };
    await service.receiveMessage(TunnelMessageSchema.parse(msg));

    expect(callback).toHaveBeenCalledWith(msg);
  });

  it('should handle axios error', async () => {
    mockedAxios.post.mockRejectedValue(new Error('Network error'));

    await expect(
      service.sendMessage({ from: 'a', to: 'b', type: 'ping', payload: { timestamp: 12323123, message: 'foo'} }),
    ).rejects.toThrow('Network error');
  });

  it('isConnected should always return true', () => {
    expect(service.isConnected()).toBe(true);
  });

  it('getDeviceId should return null', () => {
    expect(service.getDeviceId()).toBeNull();
  });
});