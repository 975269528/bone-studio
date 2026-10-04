import type { Project } from './types';
import { executeCommands } from './commands';
import { parseProject } from './validation';

const MAX_HISTORY_ENTRIES = 80;

export interface ProjectHistory {
  past: Project[];
  present: Project;
  future: Project[];
}

/** 创建独立项目历史，不共享调用者可修改的对象。 */
export function createHistory(project: Project): ProjectHistory {
  return { past: [], present: parseProject(project), future: [] };
}

/** 将事务作为一次撤销记录；非法事务不污染原历史。 */
export function applyHistory(options: { history: ProjectHistory; commands: unknown[] }): ProjectHistory {
  const present = executeCommands({ project: options.history.present, commands: options.commands });
  return { past: [...options.history.past, options.history.present].slice(-MAX_HISTORY_ENTRIES), present, future: [] };
}

/** 撤销一次完整事务；空历史保持原状态。 */
export function undoHistory(history: ProjectHistory): ProjectHistory {
  const present = history.past.at(-1);
  if (!present) return history;
  return { past: history.past.slice(0, -1), present, future: [history.present, ...history.future] };
}

/** 恢复一次被撤销事务；空重做队列保持原状态。 */
export function redoHistory(history: ProjectHistory): ProjectHistory {
  const present = history.future[0];
  if (!present) return history;
  return { past: [...history.past, history.present], present, future: history.future.slice(1) };
}
