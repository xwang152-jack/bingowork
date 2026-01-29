/**
 * ScheduleList Component
 * Displays list of scheduled tasks
 */

import { useState } from 'react';
import { Clock, RefreshCw } from 'lucide-react';
import type { ScheduleTask } from '../../../electron/agent/schedule/types';
import { ScheduleCard } from './ScheduleCard';

interface ScheduleListProps {
  tasks: ScheduleTask[];
  onEdit: (task: ScheduleTask) => void;
  onRefresh: () => void;
}

export function ScheduleList({ tasks, onEdit, onRefresh }: ScheduleListProps) {
  const [refreshing, setRefreshing] = useState(false);

  const handleToggle = async (task: ScheduleTask) => {
    try {
      await window.ipcRenderer.invoke('schedule:toggle', task.id);
      await onRefresh();
    } catch (error) {
      console.error('Failed to toggle task:', error);
      alert('切换任务状态失败');
    }
  };

  const handleDelete = async (taskId: string, taskName: string) => {
    if (!confirm(`确定要删除任务 "${taskName}" 吗？`)) {
      return;
    }

    try {
      await window.ipcRenderer.invoke('schedule:delete', taskId);
      await onRefresh();
    } catch (error) {
      console.error('Failed to delete task:', error);
      alert('删除任务失败');
    }
  };

  const handleExecuteNow = async (taskId: string) => {
    try {
      await window.ipcRenderer.invoke('schedule:execute-now', taskId);
      alert('任务已开始执行');
    } catch (error) {
      console.error('Failed to execute task:', error);
      alert((error as Error).message);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  };

  const activeCount = tasks.filter(t => t.status === 'active').length;
  const pausedCount = tasks.filter(t => t.status === 'paused').length;
  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const failedCount = tasks.filter(t => t.status === 'failed').length;

  return (
    <div className="space-y-4">
      {/* Statistics */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-emerald-50 rounded-lg p-3 text-center">
          <p className="text-xl font-semibold text-emerald-600">{activeCount}</p>
          <p className="text-xs text-emerald-600">运行中</p>
        </div>
        <div className="bg-amber-50 rounded-lg p-3 text-center">
          <p className="text-xl font-semibold text-amber-600">{pausedCount}</p>
          <p className="text-xs text-amber-600">已暂停</p>
        </div>
        <div className="bg-blue-50 rounded-lg p-3 text-center">
          <p className="text-xl font-semibold text-blue-600">{completedCount}</p>
          <p className="text-xs text-blue-600">已完成</p>
        </div>
        <div className="bg-red-50 rounded-lg p-3 text-center">
          <p className="text-xl font-semibold text-red-600">{failedCount}</p>
          <p className="text-xs text-red-600">失败</p>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-stone-500">共 {tasks.length} 个任务</p>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-all disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          title="刷新"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Task List */}
      {tasks.length === 0 ? (
        <div className="text-center py-12 text-stone-400 border-2 border-dashed border-stone-200 rounded-xl">
          <Clock size={32} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">暂无定时任务</p>
          <p className="text-xs mt-1">点击"新建任务"创建第一个定时任务</p>
        </div>
      ) : (
        <div className="space-y-2 overflow-y-auto custom-scrollbar pr-1" style={{ maxHeight: '500px' }}>
          {tasks.map(task => (
            <ScheduleCard
              key={task.id}
              task={task}
              onToggle={handleToggle}
              onEdit={onEdit}
              onDelete={handleDelete}
              onExecuteNow={handleExecuteNow}
            />
          ))}
        </div>
      )}
    </div>
  );
}
