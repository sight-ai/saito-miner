import { Inject, Logger } from "@nestjs/common";
import { PersistentService } from "@saito/persistent";
import crypto from 'crypto';
import {
  MinerEarning,
  MinerDeviceStatus,
  ModelOfMiner
} from "@saito/models";

/**
 * 安全地解析 JSON 字符串
 * @param jsonString 要解析的 JSON 字符串
 * @param logger 用于记录错误的日志记录器
 * @param errorMessage 错误消息前缀
 * @returns 解析后的对象，如果解析失败则返回 null
 */
const safeJsonParse = <T>(jsonString: any, logger: Logger, errorMessage: string = 'Failed to parse JSON'): T | null => {
  if (!jsonString) {
    return null;
  }

  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    logger.error(`${errorMessage}: ${error}`);
    return null;
  }
};

export class MinerRepository {
  constructor(
    @Inject(PersistentService)
    private readonly persistentService: PersistentService,
  ) { }
  private readonly logger = new Logger(MinerRepository.name);

  async transaction<T>(
    handler: (db: any) => T,
  ) {
    return this.persistentService.transaction(handler);
  }

  // 获取收益信息
  async getEarningInfo(db: any, deviceId: string, isRegistered: boolean) {
    const source = isRegistered ? 'gateway' : 'local';

    try {
      let totalBlockRewards = 0;
      let totalJobRewards = 0;

      // 使用 LevelDB 的迭代器获取所有收益记录
      for await (const [key, value] of this.persistentService.earningsDb.iterator()) {
        if (key === '__schema__') continue; // 跳过 schema 记录

        const earning = safeJsonParse<ModelOfMiner<'Earning'>>(
          value,
          this.logger,
          `Failed to parse earning data for key ${key}`
        );

        if (earning && earning.device_id === deviceId && earning.source === source) {
          totalBlockRewards += Number(earning.block_rewards) || 0;
          totalJobRewards += Number(earning.job_rewards) || 0;
        }
      }

      return {
        total_block_rewards: totalBlockRewards,
        total_job_rewards: totalJobRewards
      } as ModelOfMiner<'MinerEarning'>;
    } catch (error) {
      this.logger.error(`Error getting earning info: ${error}`);
      return {
        total_block_rewards: 0,
        total_job_rewards: 0
      } as ModelOfMiner<'MinerEarning'>;
    }
  }

  // 获取设备信息
  async getDeviceInfo(db: any, deviceId: string, isRegistered: boolean) {
    try {
      // 直接从 deviceStatusDb 获取设备信息
      const deviceData = await this.persistentService.deviceStatusDb.get(deviceId);

      // 检查 deviceData 是否为 undefined 或 null
      if (!deviceData) {
        return null;
      }

      try {
        const device = JSON.parse(deviceData);

        return {
          name: device.name,
          status: device.status,
          up_time_start: device.up_time_start,
          up_time_end: device.up_time_end
        } as ModelOfMiner<'MinerDeviceStatus'>;
      } catch (parseError) {
        this.logger.error(`Error parsing device data: ${parseError}`);
        return null;
      }
    } catch (error) {
      if ((error as any).code === 'LEVEL_NOT_FOUND') {
        return null;
      }
      this.logger.error(`Error getting device info: ${error}`);
      return null;
    }
  }

  // 获取运行时间百分比
  async getUptimePercentage(db: any, deviceId: string, isRegistered: boolean) {
    const source = isRegistered ? 'gateway' : 'local';

    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // 用于存储不同日期的任务
      const uniqueDates = new Set<string>();

      // 使用 LevelDB 的迭代器获取所有任务
      for await (const [key, value] of this.persistentService.tasksDb.iterator()) {
        if (key === '__schema__') continue; // 跳过 schema 记录

        const task = safeJsonParse<ModelOfMiner<'Task'>>(
          value,
          this.logger,
          `Failed to parse task data for key ${key}`
        );

        if (task && task.device_id === deviceId && task.source === source) {
          const taskDate = new Date(task.created_at);
          if (taskDate >= thirtyDaysAgo) {
            // 将日期格式化为 YYYY-MM-DD
            const dateStr = taskDate.toISOString().split('T')[0];
            uniqueDates.add(dateStr);
          }
        }
      }

      // 计算运行时间百分比
      const uptimePercentage = (uniqueDates.size * 100.0) / 30.0;

      return {
        uptime_percentage: uptimePercentage
      } as ModelOfMiner<'MinerUptime'>;
    } catch (error) {
      this.logger.error(`Error getting uptime percentage: ${error}`);
      return {
        uptime_percentage: 0
      } as ModelOfMiner<'MinerUptime'>;
    }
  }

  // 获取收益历史数据
  async getEarningsHistory(db: any, deviceId: string, days: number = 31, isRegistered: boolean) {
    const source = isRegistered ? 'gateway' : 'local';
    const result = [];

    try {
      // 获取当前日期
      const now = new Date();

      // 创建一个映射来存储每天的收益
      const dailyEarnings = new Map<string, number>();

      // 使用 LevelDB 的迭代器获取所有收益记录
      for await (const [key, value] of this.persistentService.earningsDb.iterator()) {
        if (key === '__schema__') continue; // 跳过 schema 记录

        const earning = safeJsonParse<ModelOfMiner<'Earning'>>(
          value,
          this.logger,
          `Failed to parse earning data for key ${key}`
        );

        if (earning && earning.device_id === deviceId && earning.source === source) {
          const earningDate = new Date(earning.created_at);
          // 将日期格式化为 YYYY-MM-DD
          const dateStr = earningDate.toISOString().split('T')[0];

          // 累加当天的收益
          const currentEarning = dailyEarnings.get(dateStr) || 0;
          const earningAmount = (Number(earning.block_rewards) || 0) + (Number(earning.job_rewards) || 0);
          dailyEarnings.set(dateStr, currentEarning + earningAmount);
        }
      }

      // 生成过去days天的日期
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0]; // 格式: YYYY-MM-DD

        result.push({
          daily_earning: dailyEarnings.get(dateStr) || 0,
          date: dateStr
        });
      }
    } catch (error) {
      this.logger.error(`Error getting earnings history: ${error}`);
    }

    return result as ModelOfMiner<'MinerEarningsHistory'>[];
  }

  // 获取任务请求数据
  async getTaskRequestData(
    db: any,
    deviceId: string,
    period: 'daily' | 'weekly' | 'monthly' = 'daily',
    isRegistered: boolean
  ) {
    const source = isRegistered ? 'gateway' : 'local';

    // For daily: last 24 hours
    // For weekly: last 8 days
    // For monthly: last 31 days
    const intervalMap = {
      'daily': { unit: 'hour', value: 24, format: 'hour' },
      'weekly': { unit: 'day', value: 8, format: 'day' },
      'monthly': { unit: 'day', value: 31, format: 'day' }
    } as const;

    const timeConfig = intervalMap[period];
    const result = [];

    try {
      // 获取当前时间
      const now = new Date();

      // 创建一个映射来存储每个时间点的任务数量
      const timePointCounts = new Map<string, number>();

      // 使用 LevelDB 的迭代器获取所有任务
      for await (const [key, value] of this.persistentService.tasksDb.iterator()) {
        if (key === '__schema__') continue; // 跳过 schema 记录

        const task = safeJsonParse<ModelOfMiner<'Task'>>(
          value,
          this.logger,
          `Failed to parse task data for key ${key}`
        );

        if (task && task.device_id === deviceId && task.source === source) {
          const taskDate = new Date(task.created_at);

          // 根据时间单位格式化时间点
          let timePointStr;
          if (timeConfig.format === 'hour') {
            // 格式: YYYY-MM-DD HH:00:00
            timePointStr = `${taskDate.toISOString().split('T')[0]} ${taskDate.getHours().toString().padStart(2, '0')}:00:00`;
          } else {
            // 格式: YYYY-MM-DD 00:00:00
            timePointStr = `${taskDate.toISOString().split('T')[0]} 00:00:00`;
          }

          // 累加该时间点的任务数量
          const currentCount = timePointCounts.get(timePointStr) || 0;
          timePointCounts.set(timePointStr, currentCount + 1);
        }
      }

      // 根据时间单位生成时间点
      for (let i = timeConfig.value - 1; i >= 0; i--) {
        const date = new Date(now);

        if (timeConfig.format === 'hour') {
          date.setHours(date.getHours() - i);
          // 设置分钟和秒为0
          date.setMinutes(0);
          date.setSeconds(0);
          date.setMilliseconds(0);
        } else {
          date.setDate(date.getDate() - i);
          // 设置小时、分钟和秒为0
          date.setHours(0);
          date.setMinutes(0);
          date.setSeconds(0);
          date.setMilliseconds(0);
        }

        // 格式化日期
        const dateStr = date.toISOString().replace('T', ' ').split('.')[0];

        result.push({
          request_count: timePointCounts.get(dateStr) || 0,
          date: dateStr
        });
      }
    } catch (error) {
      this.logger.error(`Error getting task request data: ${error}`);
    }

    return result as ModelOfMiner<'MinerDailyRequests'>[];
  }

  // 获取按月任务活动数据
  async getMonthlyTaskActivity(
    db: any,
    year: number,
    deviceId: string,
    isRegistered: boolean
  ) {
    const source = isRegistered ? 'gateway' : 'local';
    const result = [];

    try {
      // 创建一个映射来存储每月的任务数量
      const monthlyTaskCounts = new Map<string, number>();

      // 使用 LevelDB 的迭代器获取所有任务
      for await (const [key, value] of this.persistentService.tasksDb.iterator()) {
        if (key === '__schema__') continue; // 跳过 schema 记录

        const task = safeJsonParse<ModelOfMiner<'Task'>>(
          value,
          this.logger,
          `Failed to parse task data for key ${key}`
        );

        if (task && task.device_id === deviceId && task.source === source) {
          const taskDate = new Date(task.created_at);
          const taskYear = taskDate.getFullYear();

          // 只统计指定年份的任务
          if (taskYear === year) {
            const taskMonth = taskDate.getMonth() + 1; // 月份从0开始，需要+1
            const monthStr = taskMonth.toString().padStart(2, '0');
            const dateStr = `${year}-${monthStr}-01`;

            // 累加该月的任务数量
            const currentCount = monthlyTaskCounts.get(dateStr) || 0;
            monthlyTaskCounts.set(dateStr, currentCount + 1);
          }
        }
      }

      // 生成1-12月的数据
      for (let month = 1; month <= 12; month++) {
        // 格式化月份为两位数
        const monthStr = month.toString().padStart(2, '0');
        const dateStr = `${year}-${monthStr}-01`;

        result.push({
          date: dateStr,
          task_count: monthlyTaskCounts.get(dateStr) || 0
        });
      }
    } catch (error) {
      this.logger.error(`Error getting monthly task activity: ${error}`);
    }

    return result as ModelOfMiner<'MinerTaskActivity'>[];
  }

  // 获取按日任务活动数据
  async getDailyTaskActivity(
    db: any,
    month: number | null,
    deviceId: string,
    isRegistered: boolean
  ) {
    const source = isRegistered ? 'gateway' : 'local';
    const result = [];

    try {
      if (month === null) {
        // 如果没有提供月份，使用当前月份
        month = new Date().getMonth() + 1; // JavaScript月份从0开始
      }

      // 获取当前年份
      const year = new Date().getFullYear();

      // 获取该月的天数
      const daysInMonth = new Date(year, month, 0).getDate();

      // 格式化月份为两位数
      const monthStr = month.toString().padStart(2, '0');

      // 创建一个映射来存储每天的任务数量
      const dailyTaskCounts = new Map<string, number>();

      // 使用 LevelDB 的迭代器获取所有任务
      for await (const [key, value] of this.persistentService.tasksDb.iterator()) {
        if (key === '__schema__') continue; // 跳过 schema 记录

        const task = safeJsonParse<ModelOfMiner<'Task'>>(
          value,
          this.logger,
          `Failed to parse task data for key ${key}`
        );

        if (task && task.device_id === deviceId && task.source === source) {
          const taskDate = new Date(task.created_at);
          const taskYear = taskDate.getFullYear();
          const taskMonth = taskDate.getMonth() + 1; // 月份从0开始，需要+1

          // 只统计指定年月的任务
          if (taskYear === year && taskMonth === month) {
            const taskDay = taskDate.getDate();
            const dayStr = taskDay.toString().padStart(2, '0');
            const dateStr = `${year}-${monthStr}-${dayStr}`;

            // 累加该天的任务数量
            const currentCount = dailyTaskCounts.get(dateStr) || 0;
            dailyTaskCounts.set(dateStr, currentCount + 1);
          }
        }
      }

      // 生成该月每一天的数据
      for (let day = 1; day <= daysInMonth; day++) {
        // 格式化日期为两位数
        const dayStr = day.toString().padStart(2, '0');
        const dateStr = `${year}-${monthStr}-${dayStr}`;

        result.push({
          date: dateStr,
          task_count: dailyTaskCounts.get(dateStr) || 0
        });
      }
    } catch (error) {
      this.logger.error(`Error getting daily task activity: ${error}`);
    }

    return result as ModelOfMiner<'MinerTaskActivity'>[];
  }

  // 获取任务列表（分页）
  async getTasks(
    db: any,
    page: number,
    limit: number,
    deviceId: string,
    isRegistered: boolean
  ) {
    const offset = (page - 1) * limit;
    const source = isRegistered ? 'gateway' : 'local';

    try {
      // 获取所有符合条件的任务
      const allTasks: ModelOfMiner<'Task'>[] = [];

      // 使用 LevelDB 的迭代器获取所有任务
      for await (const [key, value] of this.persistentService.tasksDb.iterator()) {
        if (key === '__schema__') continue; // 跳过 schema 记录

        const task = safeJsonParse<ModelOfMiner<'Task'>>(
          value,
          this.logger,
          `Failed to parse task data for key ${key}`
        );

        if (task && task.device_id === deviceId && task.source === source) {
          allTasks.push(task);
        }
      }

      // 按创建时间降序排序
      allTasks.sort((a, b) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      // 分页
      const paginatedTasks = allTasks.slice(offset, offset + limit);

      return {
        count: allTasks.length,
        tasks: paginatedTasks
      };
    } catch (error) {
      this.logger.error(`Error getting tasks: ${error}`);
      return {
        count: 0,
        tasks: []
      };
    }
  }

  // 根据设备ID获取任务
  async getTasksByDeviceId(
    db: any,
    deviceId: string,
    isRegistered: boolean
  ): Promise<ModelOfMiner<'Task'>[]> {
    const source = isRegistered ? 'gateway' : 'local';

    try {
      const tasks: ModelOfMiner<'Task'>[] = [];

      // 使用 LevelDB 的迭代器获取所有任务
      for await (const [key, value] of this.persistentService.tasksDb.iterator()) {
        if (key === '__schema__') continue; // 跳过 schema 记录

        const task = safeJsonParse<ModelOfMiner<'Task'>>(
          value,
          this.logger,
          `Failed to parse task data for key ${key}`
        );

        if (task && task.device_id === deviceId && task.source === source) {
          tasks.push(task);
        }
      }

      // 按创建时间降序排序
      return tasks.sort((a, b) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    } catch (error) {
      this.logger.error(`Error getting tasks by device ID: ${error}`);
      return [];
    }
  }

  // 根据设备ID获取收益记录
  async getEarningsByDeviceId(
    db: any,
    deviceId: string,
    isRegistered: boolean
  ): Promise<ModelOfMiner<'Earning'>[]> {
    const source = isRegistered ? 'gateway' : 'local';

    try {
      const earnings: ModelOfMiner<'Earning'>[] = [];

      // 使用 LevelDB 的迭代器获取所有收益记录
      for await (const [key, value] of this.persistentService.earningsDb.iterator()) {
        if (key === '__schema__') continue; // 跳过 schema 记录

        const earning = safeJsonParse<ModelOfMiner<'Earning'>>(
          value,
          this.logger,
          `Failed to parse earning data for key ${key}`
        );

        if (earning && earning.device_id === deviceId && earning.source === source) {
          earnings.push(earning);
        }
      }

      // 按创建时间降序排序
      return earnings.sort((a, b) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    } catch (error) {
      this.logger.error(`Error getting earnings by device ID: ${error}`);
      return [];
    }
  }

  // 根据任务ID获取收益记录
  async getEarningsByTaskId(
    db: any,
    taskId: string
  ): Promise<ModelOfMiner<'Earning'>[]> {
    try {
      const earnings: ModelOfMiner<'Earning'>[] = [];

      // 使用 LevelDB 的迭代器获取所有收益记录
      for await (const [key, value] of this.persistentService.earningsDb.iterator()) {
        if (key === '__schema__') continue; // 跳过 schema 记录

        const earning = safeJsonParse<ModelOfMiner<'Earning'>>(
          value,
          this.logger,
          `Failed to parse earning data for key ${key}`
        );

        if (earning && earning.task_id === taskId) {
          earnings.push(earning);
        }
      }

      // 按创建时间降序排序
      return earnings.sort((a, b) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    } catch (error) {
      this.logger.error(`Error getting earnings by task ID: ${error}`);
      return [];
    }
  }

  // 创建任务
  async createTask(
    db: any,
    model: string,
    deviceId: string
  ): Promise<ModelOfMiner<'Task'>> {
    try {
      // 生成UUID
      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      // 创建任务对象
      const task: ModelOfMiner<'Task'> = {
        id,
        model,
        created_at: now,
        updated_at: now,
        status: 'pending',
        total_duration: 0,
        load_duration: 0,
        prompt_eval_count: 0,
        prompt_eval_duration: 0,
        eval_count: 0,
        eval_duration: 0,
        source: 'local',
        device_id: deviceId
      };

      // 保存到 LevelDB
      await this.persistentService.tasksDb.put(id, JSON.stringify(task));

      return task;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error creating task: ${errorMessage}`);
      throw error;
    }
  }

  // 更新任务 - 简单版本
  async updateTask(
    db: any,
    id: string,
    updates: Partial<ModelOfMiner<'Task'>>
  ): Promise<ModelOfMiner<'Task'>> {
    try {
      // 获取现有任务
      const taskData = await this.persistentService.tasksDb.get(id);
      const task = safeJsonParse<ModelOfMiner<'Task'>>(
        taskData,
        this.logger,
        `Error parsing task data for task ID ${id}`
      );

      if (!task) {
        throw new Error(`Task with ID ${id} not found or could not be parsed`);
      }

      // 更新任务
      const updatedTask = {
        ...task,
        ...updates,
        updated_at: new Date().toISOString()
      };

      // 保存到 LevelDB
      await this.persistentService.tasksDb.put(id, JSON.stringify(updatedTask));

      return updatedTask;
    } catch (error) {
      this.logger.error(`Error updating task: ${error}`);
      throw error;
    }
  }

  // 更新任务 - 直接接收更新对象
  async updateTaskWithSql(
    db: any,
    id: string,
    updateSql: string
  ): Promise<ModelOfMiner<'Task'>> {
    try {
      // 获取现有任务
      const taskData = await this.persistentService.tasksDb.get(id);
      const task = safeJsonParse<ModelOfMiner<'Task'>>(
        taskData,
        this.logger,
        `Error parsing task data for task ID ${id}`
      );

      if (!task) {
        throw new Error(`Task with ID ${id} not found or could not be parsed`);
      }

      // 解析 SQL 更新片段并应用更新
      // 注意：这里我们需要手动解析 SQL 更新片段，因为 LevelDB 不支持 SQL
      // 例如：status = 'completed', total_duration = 10.5
      const updates: Record<string, any> = {};
      const updatePairs = updateSql.split(',').map(pair => pair.trim());

      for (const pair of updatePairs) {
        const [key, value] = pair.split('=').map(part => part.trim());

        // 处理字符串值（去掉引号）
        if (value.startsWith("'") && value.endsWith("'")) {
          updates[key] = value.substring(1, value.length - 1);
        }
        // 处理数字值
        else if (!isNaN(Number(value))) {
          updates[key] = Number(value);
        }
        // 处理布尔值
        else if (value === 'true' || value === 'false') {
          updates[key] = value === 'true';
        }
        // 处理 null 值
        else if (value === 'null') {
          updates[key] = null;
        }
      }

      // 更新任务
      const updatedTask = {
        ...task,
        ...updates,
        updated_at: new Date().toISOString()
      };

      // 保存到 LevelDB
      await this.persistentService.tasksDb.put(id, JSON.stringify(updatedTask));

      return updatedTask;
    } catch (error) {
      this.logger.error(`Error updating task: ${error}`);
      throw error;
    }
  }

  // 获取单个任务
  async getTaskById(
    db: any,
    taskId: string
  ): Promise<ModelOfMiner<'Task'> | null> {
    try {
      const taskData = await this.persistentService.tasksDb.get(taskId);
      return safeJsonParse<ModelOfMiner<'Task'>>(
        taskData,
        this.logger,
        `Error parsing task data for task ID ${taskId}`
      );
    } catch (error) {
      if ((error as any).code === 'LEVEL_NOT_FOUND') {
        return null;
      }
      this.logger.error(`Error getting task by ID: ${error}`);
      return null; // 返回 null 而不是抛出错误，以提高应用程序的稳定性
    }
  }

  // 创建收益记录
  async createEarning(
    db: any,
    blockRewards: number,
    jobRewards: number,
    deviceId: string,
    taskId: string
  ): Promise<void> {
    try {
      // 生成UUID
      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      // 创建收益对象
      const earning: ModelOfMiner<'Earning'> = {
        id,
        block_rewards: blockRewards,
        job_rewards: jobRewards,
        device_id: deviceId,
        task_id: taskId,
        created_at: now,
        updated_at: now,
        source: 'local'
      };

      // 保存到 LevelDB
      await this.persistentService.earningsDb.put(id, JSON.stringify(earning));
    } catch (error) {
      this.logger.error(`Error creating earning: ${error}`);
      throw error;
    }
  }
}