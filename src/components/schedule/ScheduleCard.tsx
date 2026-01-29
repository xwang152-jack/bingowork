/**
 * ScheduleCard Component
 * Displays a single scheduled task card
 */

import { Play, Pause, Trash2, Edit2, Zap, History } from 'lucide-react';
import type { ScheduleTask, ScheduleType, ScheduleStatus } from '../../../electron/agent/schedule/types';

interface ScheduleCardProps {
  task: ScheduleTask;
  onToggle: (task: ScheduleTask) => void;
  onEdit: (task: ScheduleTask) => void;
  onDelete: (taskId: string, taskName: string) => void;
  onExecuteNow: (taskId: string) => void;
}

export function ScheduleCard({ task, onToggle, onEdit, onDelete, onExecuteNow }: ScheduleCardProps) {
  const formatScheduleType = (type: ScheduleType): string => {
    switch (type) {
      case 'interval':
        if (task.schedule.interval) {
          const { value, unit } = task.schedule.interval;
          const unitText = {
            milliseconds: '毫秒',
            seconds: '秒',
            minutes: '分钟',
            hours: '小时',
            days: '天',
          }[unit];
          return `每 ${value} ${unitText}`;
        }
        return '间隔执行';
      case 'cron':
        return task.schedule.cron || 'Cron 表达式';
      case 'once':
        return task.schedule.onceAt ? new Date(task.schedule.onceAt).toLocaleString('zh-CN') : '一次性执行';
      default:
        return '未知';
    }
  };

  const getStatusBadge = (status: ScheduleStatus) => {
    switch (status) {
      case 'active':
        return <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-600 rounded-full font-medium">运行中</span>;
      case 'paused':
        return <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-600 rounded-full font-medium">已暂停</span>;
      case 'completed':
        return <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded-full font-medium">已完成</span>;
      case 'failed':
        return <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full font-medium">失败</span>;
      default:
        return null;
    }
  };

  const formatNextExecution = (timestamp?: number): string => {
    if (!timestamp) return '-';

    const now = Date.now();
    const diff = timestamp - now;

    if (diff < 0) return '已过期';

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days} 天后`;
    if (hours > 0) return `${hours} 小时后`;
    if (minutes > 0) return `${minutes} 分钟后`;
    return '即将执行';
  };

  const formatLastExecution = (timestamp?: number): string => {
    if (!timestamp) return '未执行';
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days} 天前`;
    if (hours > 0) return `${hours} 小时前`;
    if (minutes > 0) return `${minutes} 分钟前`;
    return '刚刚';
  };

  const isActive = task.status === 'active';

  return (
    <div className={`p-4 bg-white border rounded-lg hover:shadow-md transition-all ${isActive ? 'border-emerald-200' : 'border-stone-200'}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-medium text-stone-800 truncate">{task.name}</h4>
            {getStatusBadge(task.status)}
          </div>

          {task.description && (
            <p className="text-xs text-stone-500 mb-2 line-clamp-2">{task.description}</p>
          )}

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-stone-500">
              <Zap size={12} />
              <span>{formatScheduleType(task.type)}</span>
            </div>

            {isActive && task.nextExecutionAt && (
              <div className="flex items-center gap-2 text-xs text-stone-500">
                <Clock size={12} className="text-blue-500" />
                <span>下次执行: {formatNextExecution(task.nextExecutionAt)}</span>
              </div>
            )}

            {task.lastExecutedAt && (
              <div className="flex items-center gap-2 text-xs text-stone-500">
                <History size={12} className="text-purple-500" />
                <span>上次执行: {formatLastExecution(task.lastExecutedAt)}</span>
              </div>
            )}

            <div className="flex items-center gap-3 text-xs text-stone-400">
              <span>执行 {task.executionCount} 次</span>
              {task.failureCount > 0 && (
                <span className="text-red-500">失败 {task.failureCount} 次</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 ml-2">
          {isActive ? (
            <button
              type="button"
              onClick={() => onToggle(task)}
              className="p-1.5 text-amber-500 hover:bg-amber-50 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              title="暂停"
            >
              <Pause size={14} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onToggle(task)}
              className="p-1.5 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              title="启动"
            >
              <Play size={14} />
            </button>
          )}

          <button
            type="button"
            onClick={() => onExecuteNow(task.id)}
            className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            title="立即执行"
          >
            <Zap size={14} />
          </button>

          <button
            type="button"
            onClick={() => onEdit(task)}
            className="p-1.5 text-stone-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            title="编辑"
          >
            <Edit2 size={14} />
          </button>

          <button
            type="button"
            onClick={() => onDelete(task.id, task.name)}
            className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            title="删除"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function Clock({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
