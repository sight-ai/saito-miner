import { Task } from '@saito/models';
import { z } from 'zod';

export const taskHistoryResponse = z.object({
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  tasks: z.array(Task)
});

export type TaskHistoryResponse = z.infer<typeof taskHistoryResponse>;
