export * from './tunnel.interface';
export * from './tunnel.module';
export * from './tunnel.service';
// 重构后的服务组件
export * from './message-handler';
export * from './services/tunnel-message.service';
export * from './errors';
export * from './events';
export * from './events/keypair.events';
export * from './message-gateway'
export * from './tunnel-libp2p.service'

// 导出具体的类和模块
export { TunnelModule } from './tunnel.module';
export { TunnelServiceImpl } from './tunnel.service';
export { TunnelMessageService } from './services/tunnel-message.service';
export { MessageHandlerRegistry } from './message-handler/message-handler.registry';
