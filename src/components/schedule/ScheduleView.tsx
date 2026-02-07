/**
 * ScheduleView Component
 * Main view for managing scheduled tasks
 */

import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { ScheduleList } from './ScheduleList';
import { ScheduleForm } from './ScheduleForm';
import type { ScheduleTask } from '../../../electron/agent/schedule/types';
import type { IpcResponse } from '../../../electron/ipc/types/IpcResponse';

interface ScheduleViewProps {
  onClose?: () => void;
}

type ViewMode = 'list' | 'create' | 'edit';

export function ScheduleView({ onClose: _onClose }: ScheduleViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [tasks, setTasks] = useState<ScheduleTask[]>([]);
  const [editingTask, setEditingTask] = useState<ScheduleTask | null>(null);

  const loadTasks = async () => {
    try {
      const result = await window.ipcRenderer.invoke('schedule:list') as IpcResponse<ScheduleTask[]>;
      if (result && typeof result === 'object' && 'success' in result) {
        if (result.success) {
          setTasks(Array.isArray(result.data) ? result.data : []);
        } else {
          console.error('Failed to load tasks:', result.error);
          setTasks([]);
        }
      } else {
        // Fallback for legacy or unexpected format
        setTasks(Array.isArray(result) ? (result as ScheduleTask[]) : []);
      }
    } catch (error) {
      console.error('Failed to load tasks:', error);
      setTasks([]);
    }
  };

  useEffect(() => {
    loadTasks();

    // Listen for task updates
    const handleTaskCreated = (_event: unknown, ...args: unknown[]) => {
      const task = args[0] as ScheduleTask;
      setTasks(prev => [...prev, task]);
    };

    const handleTaskUpdated = (_event: unknown, ...args: unknown[]) => {
      const task = args[0] as ScheduleTask;
      setTasks(prev => prev.map(t => t.id === task.id ? task : t));
    };

    const handleTaskDeleted = (_event: unknown, ...args: unknown[]) => {
      const data = args[0] as { id: string };
      setTasks(prev => prev.filter(t => t.id !== data.id));
    };

    const handleTaskExecuted = (_event: unknown, ...args: unknown[]) => {
      // Reload all tasks to get updated status and last executed time
      loadTasks();
    };

    const handleTaskFailed = (_event: unknown, ...args: unknown[]) => {
      // Reload all tasks to get updated status and failure count
      loadTasks();
    };

    const cleanupCreated = window.ipcRenderer.on('schedule:task-created', handleTaskCreated);
    const cleanupUpdated = window.ipcRenderer.on('schedule:task-updated', handleTaskUpdated);
    const cleanupDeleted = window.ipcRenderer.on('schedule:task-deleted', handleTaskDeleted);
    const cleanupExecuted = window.ipcRenderer.on('schedule:task-executed', handleTaskExecuted);
    const cleanupFailed = window.ipcRenderer.on('schedule:task-failed', handleTaskFailed);

    return () => {
      cleanupCreated();
      cleanupUpdated();
      cleanupDeleted();
      cleanupExecuted();
      cleanupFailed();
    };
  }, []);

  const handleCreate = () => {
    setEditingTask(null);
    setViewMode('create');
  };

  const handleEdit = (task: ScheduleTask) => {
    setEditingTask(task);
    setViewMode('edit');
  };

  const handleSave = async () => {
    await loadTasks();
    setViewMode('list');
    setEditingTask(null);
  };

  const handleCancel = () => {
    setViewMode('list');
    setEditingTask(null);
  };

  if (viewMode === 'create' || viewMode === 'edit') {
    return (
      <ScheduleForm
        task={editingTask}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock size={18} className="text-stone-500" />
          <h3 className="text-sm font-semibold text-stone-700">定时任务</h3>
        </div>
        <button
          type="button"
          onClick={handleCreate}
          className="px-3 py-1.5 text-xs bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
        >
          新建任务
        </button>
      </div>

      <ScheduleList
        tasks={tasks}
        onEdit={handleEdit}
        onRefresh={loadTasks}
      />
    </div>
  );
}
