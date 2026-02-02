import { useState, useEffect } from 'react';
import { X, Download, CheckCircle, AlertCircle, RefreshCw, Zap } from 'lucide-react';

interface UpdateInfo {
  version: string;
  releaseDate?: string;
  releaseNotes?: string;
}

interface UpdateDialogProps {
  onClose: () => void;
}

type UpdateStatus = 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';

export function UpdateDialog({ onClose }: UpdateDialogProps) {
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [currentVersion, setCurrentVersion] = useState('');

  useEffect(() => {
    // Get current version from package.json
    if (typeof window !== 'undefined' && (window as any).electron) {
      // In production, this will be set by electron
      setCurrentVersion((window as any).electron?.appVersion || '1.0.8');
    } else {
      setCurrentVersion('1.0.8');
    }

    // Check for updates on mount
    checkForUpdates();
  }, []);

  useEffect(() => {
    // Listen for update events
    const cleanupChecking = window.ipcRenderer.on('update:checking', () => {
      setStatus('checking');
    });

    const cleanupAvailable = window.ipcRenderer.on('update:available', (_event: unknown, ...args: unknown[]) => {
      setStatus('available');
      const info = args[0] as UpdateInfo;
      setUpdateInfo(info);
    });

    const cleanupNotAvailable = window.ipcRenderer.on('update:not-available', () => {
      setStatus('not-available');
    });

    const cleanupDownloadProgress = window.ipcRenderer.on('update:download-progress', (_event: unknown, ...args: unknown[]) => {
      setStatus('downloading');
      const progress = args[0] as { percent: number };
      setDownloadProgress(Math.round(progress.percent));
    });

    const cleanupDownloaded = window.ipcRenderer.on('update:downloaded', (_event: unknown, ...args: unknown[]) => {
      setStatus('downloaded');
      const info = args[0] as UpdateInfo;
      setUpdateInfo(info);
    });

    const cleanupError = window.ipcRenderer.on('update:error', (_event: unknown, ...args: unknown[]) => {
      setStatus('error');
      const error = args[0] as { message: string };
      setErrorMessage(error.message);
    });

    return () => {
      cleanupChecking();
      cleanupAvailable();
      cleanupNotAvailable();
      cleanupDownloadProgress();
      cleanupDownloaded();
      cleanupError();
    };
  }, []);

  const checkForUpdates = async () => {
    setStatus('checking');
    setErrorMessage('');
    await window.ipcRenderer.invoke('update:check');
  };

  const downloadUpdate = async () => {
    setStatus('downloading');
    await window.ipcRenderer.invoke('update:download');
  };

  const installUpdate = async () => {
    await window.ipcRenderer.invoke('update:install');
    // App will restart, no need to close dialog
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white/95 backdrop-blur-md rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-stone-200/60">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-stone-200/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#E85D3E] to-[#d14a2e] flex items-center justify-center">
              <Zap className="text-white" size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-stone-800">检查更新</h2>
              <p className="text-xs text-stone-500">当前版本 {currentVersion}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-xl transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E85D3E]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {status === 'checking' && (
            <div className="flex flex-col items-center py-8">
              <RefreshCw className="text-orange-500 animate-spin" size={48} />
              <p className="mt-4 text-stone-600 font-medium">正在检查更新...</p>
            </div>
          )}

          {status === 'available' && updateInfo && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
                <CheckCircle className="text-green-600 shrink-0 mt-0.5" size={20} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-800">发现新版本</p>
                  <p className="text-xs text-green-600 mt-1">版本 {updateInfo.version}</p>
                </div>
              </div>

              {updateInfo.releaseNotes && (
                <div className="p-4 bg-stone-50 rounded-xl">
                  <p className="text-xs font-medium text-stone-700 mb-2">更新内容</p>
                  <div className="text-xs text-stone-600 whitespace-pre-wrap leading-relaxed">
                    {updateInfo.releaseNotes}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={downloadUpdate}
                className="w-full py-3 bg-gradient-to-r from-[#E85D3E] to-[#d14a2e] text-white rounded-xl font-medium hover:from-[#d14a2e] hover:to-[#b53d26] transition-all shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E85D3E]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white flex items-center justify-center gap-2"
              >
                <Download size={18} />
                立即更新
              </button>
            </div>
          )}

          {status === 'not-available' && (
            <div className="flex flex-col items-center py-8">
              <CheckCircle className="text-green-500" size={48} />
              <p className="mt-4 text-stone-600 font-medium">已是最新版本</p>
              <p className="text-sm text-stone-400 mt-1">当前版本 {currentVersion} 是最新版本</p>
              <button
                type="button"
                onClick={onClose}
                className="mt-6 px-6 py-2 bg-stone-100 text-stone-700 rounded-xl hover:bg-stone-200 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-400/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              >
                关闭
              </button>
            </div>
          )}

          {status === 'downloading' && (
            <div className="space-y-4 py-4">
              <div className="flex flex-col items-center">
                <RefreshCw className="text-orange-500 animate-spin" size={48} />
                <p className="mt-4 text-stone-600 font-medium">正在下载更新...</p>
                <p className="text-sm text-stone-400 mt-1">{downloadProgress}%</p>
              </div>
              <div className="w-full h-2 bg-stone-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#E85D3E] to-[#d14a2e] transition-all duration-300"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
            </div>
          )}

          {status === 'downloaded' && updateInfo && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <Download className="text-blue-600 shrink-0 mt-0.5" size={20} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-800">更新已下载</p>
                  <p className="text-xs text-blue-600 mt-1">版本 {updateInfo.version} 准备就绪</p>
                </div>
              </div>

              <p className="text-sm text-stone-600 text-center">
                需要重启应用以完成更新
              </p>

              <button
                type="button"
                onClick={installUpdate}
                className="w-full py-3 bg-gradient-to-r from-[#E85D3E] to-[#d14a2e] text-white rounded-xl font-medium hover:from-[#d14a2e] hover:to-[#b53d26] transition-all shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E85D3E]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white flex items-center justify-center gap-2"
              >
                <Zap size={18} />
                重启并安装
              </button>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                <AlertCircle className="text-red-600 shrink-0 mt-0.5" size={20} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-800">检查更新失败</p>
                  <p className="text-xs text-red-600 mt-1">{errorMessage || '请检查网络连接后重试'}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={checkForUpdates}
                  className="flex-1 py-3 bg-stone-100 text-stone-700 rounded-xl font-medium hover:bg-stone-200 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-400/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white flex items-center justify-center gap-2"
                >
                  <RefreshCw size={16} />
                  重试
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 border border-stone-200 text-stone-700 rounded-xl font-medium hover:bg-stone-50 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-400/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                >
                  关闭
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default UpdateDialog;
