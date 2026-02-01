/**
 * ScheduleForm Component
 * Form for creating/editing scheduled tasks
 */

import { useState, useEffect } from 'react';
import { ScheduleType, type ScheduleTask } from '../../../electron/agent/schedule/types';

interface ScheduleFormProps {
  task?: ScheduleTask | null;
  onSave: () => void;
  onCancel: () => void;
}

interface FormData {
  name: string;
  description: string;
  type: ScheduleType;
  intervalValue: string;
  intervalUnit: 'milliseconds' | 'seconds' | 'minutes' | 'hours' | 'days';
  cronExpression: string;
  onceAt: string;
  taskType: 'message' | 'tool';
  message: string;
  toolName: string;
  toolArgs: string;
  maxRetries: string;
  retryInterval: string;
  timeout: string;
  requireConfirmation: boolean;
}

const initialFormData: FormData = {
  name: '',
  description: '',
  type: ScheduleType.INTERVAL,
  intervalValue: '5',
  intervalUnit: 'minutes',
  cronExpression: '0 */5 * * *',
  onceAt: '',
  taskType: 'message',
  message: '',
  toolName: '',
  toolArgs: '{}',
  maxRetries: '3',
  retryInterval: '60000',
  timeout: '300000',
  requireConfirmation: false,
};

export function ScheduleForm({ task, onSave, onCancel }: ScheduleFormProps) {
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (task) {
      setFormData({
        name: task.name,
        description: task.description || '',
        type: task.type,
        intervalValue: String(task.schedule.interval?.value || 5),
        intervalUnit: task.schedule.interval?.unit || 'minutes',
        cronExpression: task.schedule.cron || '0 */5 * * *',
        onceAt: task.schedule.onceAt ? new Date(task.schedule.onceAt).toISOString().slice(0, 16) : '',
        taskType: task.task.type,
        message: task.task.type === 'message' ? task.task.message : '',
        toolName: task.task.type === 'tool' ? task.task.tool.name : '',
        toolArgs: task.task.type === 'tool' ? JSON.stringify(task.task.tool.args, null, 2) : '{}',
        maxRetries: String(task.maxRetries),
        retryInterval: String(task.retryInterval),
        timeout: String(task.timeout),
        requireConfirmation: task.requireConfirmation,
      });
    }
  }, [task]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = '任务名称不能为空';
    }

    if (formData.taskType === 'message' && !formData.message.trim()) {
      newErrors.message = '消息内容不能为空';
    }

    if (formData.taskType === 'tool' && !formData.toolName.trim()) {
      newErrors.toolName = '工具名称不能为空';
    }

    if (formData.type === ScheduleType.INTERVAL) {
      const value = parseInt(formData.intervalValue);
      if (isNaN(value) || value <= 0) {
        newErrors.intervalValue = '间隔时间必须大于0';
      }
    }

    if (formData.type === ScheduleType.ONCE && !formData.onceAt) {
      newErrors.onceAt = '执行时间不能为空';
    }

    if (formData.taskType === 'tool') {
      try {
        JSON.parse(formData.toolArgs);
      } catch {
        newErrors.toolArgs = '无效的 JSON 格式';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setSaving(true);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const scheduleConfig: any = {
        type: formData.type,
      };

      if (formData.type === ScheduleType.INTERVAL) {
        scheduleConfig.interval = {
          value: parseInt(formData.intervalValue),
          unit: formData.intervalUnit,
        };
      } else if (formData.type === ScheduleType.CRON) {
        scheduleConfig.cron = formData.cronExpression;
      } else if (formData.type === ScheduleType.ONCE) {
        scheduleConfig.onceAt = new Date(formData.onceAt).getTime();
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const taskContent: any = {};
      if (formData.taskType === 'message') {
        taskContent.type = 'message';
        taskContent.message = formData.message;
      } else {
        taskContent.type = 'tool';
        taskContent.tool = {
          name: formData.toolName,
          args: JSON.parse(formData.toolArgs),
        };
      }

      const taskData = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        type: formData.type,
        schedule: scheduleConfig,
        task: taskContent,
        maxRetries: parseInt(formData.maxRetries),
        retryInterval: parseInt(formData.retryInterval),
        timeout: parseInt(formData.timeout),
        requireConfirmation: formData.requireConfirmation,
      };

      if (task) {
        await window.ipcRenderer.invoke('schedule:update', task.id, taskData);
      } else {
        await window.ipcRenderer.invoke('schedule:create', taskData);
      }

      onSave();
    } catch (error) {
      console.error('Failed to save task:', error);
      alert((error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-stone-700">
          {task ? '编辑任务' : '新建任务'}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="text-stone-400 hover:text-stone-600 transition-colors"
        >
          ✕
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Task Name */}
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">
            任务名称 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:border-orange-500 ${errors.name ? 'border-red-300' : 'border-stone-200'}`}
            placeholder="输入任务名称"
          />
          {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">
            描述
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-orange-500 resize-none"
            rows={2}
            placeholder="输入任务描述（可选）"
          />
        </div>

        {/* Schedule Type */}
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">
            调度类型
          </label>
          <select
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value as ScheduleType })}
            className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-orange-500"
          >
            <option value={ScheduleType.INTERVAL}>间隔执行</option>
            <option value={ScheduleType.CRON}>Cron 表达式</option>
            <option value={ScheduleType.ONCE}>一次性执行</option>
          </select>
        </div>

        {/* Interval Settings */}
        {formData.type === ScheduleType.INTERVAL && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">
                间隔数值 <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                value={formData.intervalValue}
                onChange={(e) => setFormData({ ...formData, intervalValue: e.target.value })}
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:border-orange-500 ${errors.intervalValue ? 'border-red-300' : 'border-stone-200'}`}
              />
              {errors.intervalValue && <p className="text-xs text-red-500 mt-1">{errors.intervalValue}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">
                时间单位
              </label>
              <select
                value={formData.intervalUnit}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onChange={(e) => setFormData({ ...formData, intervalUnit: e.target.value as any })}
                className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-orange-500"
              >
                <option value="seconds">秒</option>
                <option value="minutes">分钟</option>
                <option value="hours">小时</option>
                <option value="days">天</option>
              </select>
            </div>
          </div>
        )}

        {/* Cron Expression */}
        {formData.type === ScheduleType.CRON && (
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">
              Cron 表达式 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.cronExpression}
              onChange={(e) => setFormData({ ...formData, cronExpression: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-orange-500 font-mono"
              placeholder="0 */5 * * *"
            />
            <p className="text-xs text-stone-400 mt-1">
              格式: 分 时 日 月 周 (例如: 0 */5 * * * 表示每5分钟)
            </p>
          </div>
        )}

        {/* Once At */}
        {formData.type === ScheduleType.ONCE && (
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">
              执行时间 <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={formData.onceAt}
              onChange={(e) => setFormData({ ...formData, onceAt: e.target.value })}
              className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:border-orange-500 ${errors.onceAt ? 'border-red-300' : 'border-stone-200'}`}
            />
            {errors.onceAt && <p className="text-xs text-red-500 mt-1">{errors.onceAt}</p>}
          </div>
        )}

        {/* Task Type */}
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">
            任务类型
          </label>
          <select
            value={formData.taskType}
            onChange={(e) => setFormData({ ...formData, taskType: e.target.value as 'message' | 'tool' })}
            className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-orange-500"
          >
            <option value="message">发送消息</option>
            <option value="tool">执行工具</option>
          </select>
        </div>

        {/* Message Content */}
        {formData.taskType === 'message' && (
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">
              消息内容 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:border-orange-500 resize-none ${errors.message ? 'border-red-300' : 'border-stone-200'}`}
              rows={4}
              placeholder="输入要发送给 AI 的消息"
            />
            {errors.message && <p className="text-xs text-red-500 mt-1">{errors.message}</p>}
          </div>
        )}

        {/* Tool Execution */}
        {formData.taskType === 'tool' && (
          <>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">
                工具名称 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.toolName}
                onChange={(e) => setFormData({ ...formData, toolName: e.target.value })}
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:border-orange-500 ${errors.toolName ? 'border-red-300' : 'border-stone-200'}`}
                placeholder="例如: read_file"
              />
              {errors.toolName && <p className="text-xs text-red-500 mt-1">{errors.toolName}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">
                工具参数 (JSON)
              </label>
              <textarea
                value={formData.toolArgs}
                onChange={(e) => setFormData({ ...formData, toolArgs: e.target.value })}
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:border-orange-500 resize-none font-mono ${errors.toolArgs ? 'border-red-300' : 'border-stone-200'}`}
                rows={4}
                placeholder='{"path": "/path/to/file"}'
              />
              {errors.toolArgs && <p className="text-xs text-red-500 mt-1">{errors.toolArgs}</p>}
            </div>
          </>
        )}

        {/* Advanced Settings */}
        <div className="border-t border-stone-200 pt-3">
          <p className="text-xs font-medium text-stone-600 mb-2">高级设置</p>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">最大重试次数</label>
              <input
                type="number"
                min="0"
                max="10"
                value={formData.maxRetries}
                onChange={(e) => setFormData({ ...formData, maxRetries: e.target.value })}
                className="w-full px-2 py-1.5 text-xs border border-stone-200 rounded focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">重试间隔(ms)</label>
              <input
                type="number"
                min="1000"
                value={formData.retryInterval}
                onChange={(e) => setFormData({ ...formData, retryInterval: e.target.value })}
                className="w-full px-2 py-1.5 text-xs border border-stone-200 rounded focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">超时时间(ms)</label>
              <input
                type="number"
                min="1000"
                value={formData.timeout}
                onChange={(e) => setFormData({ ...formData, timeout: e.target.value })}
                className="w-full px-2 py-1.5 text-xs border border-stone-200 rounded focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="checkbox"
              id="requireConfirmation"
              checked={formData.requireConfirmation}
              onChange={(e) => setFormData({ ...formData, requireConfirmation: e.target.checked })}
              className="rounded border-stone-300 text-orange-500 focus:ring-orange-500"
            />
            <label htmlFor="requireConfirmation" className="text-xs text-stone-600">
              执行前需要用户确认
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            {saving ? '保存中...' : task ? '保存' : '创建'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            取消
          </button>
        </div>
      </form>
    </div>
  );
}
