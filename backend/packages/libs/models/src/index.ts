// =============================================================================
// Models Library - 集中的 Zod Schema 管理
//
// 根据优化规范，所有 zod 相关内容都集中到 models 模块
// 提供统一的验证函数和类型定义
// =============================================================================

// -----------------------------------------------------------------------------
// 新的 Schema 结构 (按业务功能组织)
// -----------------------------------------------------------------------------
export * from './schemas';
export * from './validators/request.validators';
export * from './did';


// 导出验证函数（用于向后兼容）
export {
  validateFrameworkConfig,
  safeValidateFrameworkConfig,
  validateSystemInfo,
  validateSystemHeartbeatData,
  safeValidateSystemInfo,
  safeValidateSystemHeartbeatData
} from './validators/request.validators';

// -----------------------------------------------------------------------------
// 向后兼容 (保留原有导出，但建议使用新的 schemas)
// 注意：为避免重复导出，这些文件中的类型应该与 schemas 中的类型保持一致
// -----------------------------------------------------------------------------
// export * from './ollama/ollama';  // 与 schemas 重复，暂时注释
// export * from './saito-miner/saito-miner';  // 与 schemas 重复，暂时注释（DeviceStatus 冲突）
// export * from './openai/openai';  // 与 schemas 重复，暂时注释

// 只导出不冲突的特定类型
export {
  DeviceCredentials,
  Task,
  Earning,
  TDeviceCredentials,
  TTask,
  TEarning,
  // 添加更多需要的导出
  MinerEarning,
  MinerDeviceStatus,
  HeartbeatData
} from './saito-miner/saito-miner';
export * from './basic.model';
export * from './m.model';
// system-info 已在 schemas 中导出，避免重复导出
