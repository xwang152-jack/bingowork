/**
 * ExecutionLogs Component
 * Displays execution logs for a task
 */

import { useEffect, useState } from 'react';
import { Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import type { ScheduleExecutionLog, ExecutionLogStatus } from '../../../electron/agent/schedule/types';

interface ExecutionLogsProps {
  taskId: string;
}

export function ExecutionLogs({ taskId }: ExecutionLogsProps) {
  const [logs, setLogs] = useState<ScheduleExecutionLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, [taskId]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const result = await window.ipcRenderer.invoke('schedule:get-logs', taskId) as ScheduleExecutionLog[];
      setLogs(result);
    } catch (error) {
      console.error('Failed to load logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: ExecutionLogStatus) => {
    switch (status) {
      case 'running':
        return <Clock size={14} className="text-blue-500" />;
      case 'success':
        return <CheckCircle size={14} className="text-emerald-500" />;
      case 'failed':
        return <XCircle size={14} className="text-red-500" />;
      case 'timeout':
        return <AlertCircle size={14} className="text-amber-500" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: ExecutionLogStatus): string => {
    switch (status) {
      case 'running':
        return '运行中';
      case 'success':
        return '成功';
      case 'failed':
        return '失败';
      case 'timeout':
        return '超时';
      default:
        return '未知';
    }
  };

  const formatDuration = (startedAt: number, completedAt?: number): string => {
    if (!completedAt) return '-';
    const duration = completedAt - startedAt;
    if (duration < 1000) return `${duration}ms`;
    if (duration < 60000) return `${(duration / 1000).toFixed(1)}s`;
    return `${(duration / 60000).toFixed(1)}m`;
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString('zh-CN');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-stone-400 text-sm">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium text-stone-600">执行日志</h4>
        <span className="text-xs text-stone-400">共 {logs.length} 条记录</span>
      </div>

      {logs.length === 0 ? (
        <div className="text-center py-6 text-stone-400 text-xs">
          暂无执行记录
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {logs.map((log) => (
            <div
              key={log.id}
              className="p-3 bg-white border border-stone-200 rounded-lg hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between mb-1">
                <div className="flex items-center gap-2">
                  {getStatusIcon(log.status)}
                  <span className="text-xs font-medium text-stone-600">
                    {getStatusText(log.status)}
                  </span>
                </div>
                <span className="text-xs text-stone-400">
                  {formatDuration(log.startedAt, log.completedAt)}
                </span>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-stone-500">
                  <Clock size={10} />
                  <span>{formatDate(log.startedAt)}</span>
                </div>

                {log.result && (
                  <div className="mt-2 p-2 bg-emerald-50 border border-emerald-100 rounded text-xs text-emerald-700">
                    <div className="font-medium mb-1">结果:</div>
                    <div className="break-words font-mono">{log.result.slice(0, 200)}{log.result.length > 200 ? '...' : ''}</div>
                  </div>
                )}

                {log.error && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-100 rounded text-xs text-red-700">
                    <div className="font-medium mb-1">错误:</div>
                    <div className="break-words">{log.error}</div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
