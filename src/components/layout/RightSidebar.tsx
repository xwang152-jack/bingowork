import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Circle, FileCode, ChevronDown, ChevronRight, Folder, Globe, Terminal } from 'lucide-react';
import { useConfig } from '../../hooks/useIPC';

export function RightSidebar() {
  const { config } = useConfig();
  const [sections, setSections] = useState({
    progress: true,
    artifacts: true,
    context: true,
  });

  type StepStatus = 'running' | 'done' | 'error';
  type Step = { callId: string; name: string; status: StepStatus };
  type Artifact = { path: string; name: string; type: string; createdAt: number };

  const [stage, setStage] = useState<string>('IDLE');
  const [statusText, setStatusText] = useState<string>('');
  const [steps, setSteps] = useState<Step[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [connectors, setConnectors] = useState<string[]>([]);
  const [workingFiles, setWorkingFiles] = useState<string[]>([]);

  const prevStageRef = useRef<string>('IDLE');

  const toggleSection = (section: keyof typeof sections) => {
    setSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const SectionHeader = ({ title, isOpen, onToggle }: { title: string, isOpen: boolean, onToggle: () => void }) => (
    <button
      onClick={onToggle}
      className="flex items-center justify-between w-full px-5 py-3.5 text-sm font-medium text-stone-700 hover:text-stone-900 transition-colors"
    >
      {title}
      {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
    </button>
  );

  const activeMode = useMemo(() => {
    const m = String(config?.workMode || 'cowork');
    if (m === 'chat' || m === 'code' || m === 'cowork') return m;
    return 'cowork';
  }, [config?.workMode]);

  const selectedFolders = useMemo(() => {
    const folders = Array.isArray(config?.authorizedFolders) ? config?.authorizedFolders : [];
    return folders.filter(Boolean);
  }, [config?.authorizedFolders]);

  const trackConnector = (toolName: string) => {
    const name = String(toolName || '');
    let label: string | null = null;
    if (name.startsWith('browser_')) label = '浏览器';
    else if (name.includes('__')) {
      const prefix = name.split('__')[0] || 'mcp';
      if (name.toLowerCase().includes('search') || prefix.toLowerCase().includes('search')) {
        label = 'Web search';
      } else {
        label = `MCP:${prefix}`;
      }
    }
    if (label) {
      setConnectors(prev => (prev.includes(label!) ? prev : [...prev, label!]));
    }
  };

  const trackWorkingFile = (p: unknown) => {
    const path = typeof p === 'string' ? p : '';
    if (!path) return;
    setWorkingFiles(prev => {
      const next = [path, ...prev.filter(x => x !== path)];
      return next.slice(0, 10);
    });
  };

  useEffect(() => {
    const removeStage = window.ipcRenderer.on('agent:stage', (_event, payload) => {
      const nextStage = (payload as { stage?: string })?.stage || 'IDLE';
      const prevStage = prevStageRef.current;
      prevStageRef.current = nextStage;
      setStage(nextStage);

      if (prevStage === 'IDLE' && nextStage === 'THINKING') {
        setSteps([]);
        setConnectors([]);
        setWorkingFiles([]);
        setStatusText('');
      }
    });

    const removeStatus = window.ipcRenderer.on('agent:status', (_event, msg) => {
      setStatusText(String(msg || ''));
    });

    const removeError = window.ipcRenderer.on('agent:error', (_event, msg) => {
      const m = String(msg || '');
      setStatusText(m);
    });

    const removeToolCall = window.ipcRenderer.on('agent:tool-call', (_event, payload) => {
      const p = payload as { callId?: string; name?: string; input?: Record<string, unknown> } | undefined;
      const callId = String(p?.callId || '');
      const name = String(p?.name || '');
      if (!callId || !name) return;

      trackConnector(name);

      if (name === 'read_file' || name === 'write_file') {
        trackWorkingFile((p?.input as { path?: unknown } | undefined)?.path);
      }

      setSteps(prev => {
        const idx = prev.findIndex(s => s.callId === callId);
        if (idx >= 0) {
          const next = prev.slice();
          next[idx] = { ...next[idx], name, status: 'running' };
          return next;
        }
        return [...prev, { callId, name, status: 'running' }];
      });
    });

    const removeToolResult = window.ipcRenderer.on('agent:tool-result', (_event, payload) => {
      const p = payload as { callId?: string; status?: 'done' | 'error' } | undefined;
      const callId = String(p?.callId || '');
      if (!callId) return;
      setSteps(prev => {
        const idx = prev.findIndex(s => s.callId === callId);
        if (idx < 0) return prev;
        const next = prev.slice();
        next[idx] = { ...next[idx], status: p?.status === 'error' ? 'error' : 'done' };
        return next;
      });
    });

    const removeArtifact = window.ipcRenderer.on('agent:artifact-created', (_event, payload) => {
      const a = payload as { path?: string; name?: string; type?: string } | undefined;
      const ap = String(a?.path || '');
      const an = String(a?.name || '');
      if (!ap || !an) return;
      trackWorkingFile(ap);
      setArtifacts(prev => {
        const filtered = prev.filter(x => x.path !== ap);
        return [{ path: ap, name: an, type: String(a?.type || 'file'), createdAt: Date.now() }, ...filtered].slice(0, 20);
      });
    });

    const removeSessionLoaded = window.ipcRenderer.on('session:loaded', () => {
      setSteps([]);
      setConnectors([]);
      setWorkingFiles([]);
      setArtifacts([]);
      setStatusText('');
      setStage('IDLE');
      prevStageRef.current = 'IDLE';
    });

    return () => {
      removeStage();
      removeStatus();
      removeError();
      removeToolCall();
      removeToolResult();
      removeArtifact();
      removeSessionLoaded();
    };
  }, []);

  const openPath = async (p: string) => {
    const res = await window.ipcRenderer.invoke('shell:open-path', p);
    const r = res as { success?: boolean; error?: string; candidates?: string } | undefined;
    if (r && r.success === false) {
      const details = r.candidates ? `\n\n尝试过的路径:\n${r.candidates}` : '';
      alert(`${r.error || '无法打开'}${details}`);
    }
  };

  const stageText = useMemo(() => {
    if (stage === 'THINKING') return '思考中';
    if (stage === 'PLANNING') return '规划中';
    if (stage === 'EXECUTING') return '执行中';
    if (stage === 'FEEDBACK') return '输出中';
    return '空闲';
  }, [stage]);

  return (
    <div className="w-[300px] bg-[#FAF8F5] flex flex-col border-l border-stone-200/60 h-full overflow-y-auto custom-scrollbar">
      {/* Progress Section */}
      <div className="border-b border-stone-200/50">
        <SectionHeader
          title="任务进度"
          isOpen={sections.progress}
          onToggle={() => toggleSection('progress')}
        />
        {sections.progress && (
          <div className="px-5 pb-4 space-y-3">
            <div className="text-xs text-stone-500 flex items-center justify-between">
              <span>{activeMode === 'chat' ? 'Chat 模式（仅对话）' : `当前状态：${stageText}`}</span>
              <span className="bg-stone-200/60 px-2 py-0.5 rounded-lg text-[10px] font-medium">{steps.length}</span>
            </div>
            {activeMode === 'chat' ? (
              <p className="text-xs text-stone-500 leading-relaxed">该模式不执行工具步骤。</p>
            ) : (
              <>
                {steps.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {steps.map((s) => (
                      <div key={s.callId} className="flex items-center">
                        {s.status === 'done' ? (
                          <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
                        ) : s.status === 'error' ? (
                          <CheckCircle2 size={18} className="text-red-500 shrink-0" />
                        ) : (
                          <Circle size={18} className="text-[#E85D3E] shrink-0 animate-pulse" />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-stone-500 leading-relaxed">步骤会随着任务展开而出现。</p>
                )}
                {statusText ? (
                  <p className="text-xs text-stone-500 whitespace-pre-wrap leading-relaxed">{statusText}</p>
                ) : null}
              </>
            )}
          </div>
        )}
      </div>

      {/* Artifacts Section */}
      <div className="border-b border-stone-200/50">
        <SectionHeader
          title="产出物"
          isOpen={sections.artifacts}
          onToggle={() => toggleSection('artifacts')}
        />
        {sections.artifacts && (
          <div className="px-5 pb-4">
            {artifacts.length > 0 ? (
              <div className="space-y-2">
                {artifacts.map((a) => (
                  <button
                    key={a.path}
                    type="button"
                    onClick={() => { void openPath(a.path); }}
                    className="w-full flex items-center gap-2.5 p-3 bg-white/80 backdrop-blur-sm rounded-xl border border-stone-200/60 shadow-sm hover:bg-stone-50 transition-all"
                    title={a.path}
                  >
                    <FileCode size={16} className="text-stone-400 shrink-0" />
                    <span className="text-sm text-stone-700 truncate">{a.name}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-stone-500 leading-relaxed">暂无产出物（写入文件后会出现在这里）。</p>
            )}
          </div>
        )}
      </div>

      {/* Context Section */}
      <div>
        <SectionHeader
          title="上下文引用"
          isOpen={sections.context}
          onToggle={() => toggleSection('context')}
        />
        {sections.context && (
          <div className="px-5 pb-4 space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs text-stone-500 mb-2.5">
                <span>已选择文件夹</span>
                <span className="bg-stone-200/60 px-2 py-0.5 rounded-lg text-[10px] font-medium">{selectedFolders.length}</span>
              </div>
              {selectedFolders.length > 0 ? (
                <div className="space-y-2">
                  {selectedFolders.slice(0, 6).map((folder) => (
                    <button
                      key={folder}
                      type="button"
                      onClick={() => { void openPath(folder); }}
                      className="w-full flex items-center gap-2.5 text-sm text-stone-600 pl-1 hover:text-stone-800 transition-colors"
                      title={folder}
                    >
                      <Folder size={16} className="text-stone-400 shrink-0" />
                      <span className="truncate">{folder}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-stone-500 pl-1 leading-relaxed">未配置授权目录</p>
              )}
            </div>

            <div>
              <div className="text-xs text-stone-500 mb-2.5">外部工具</div>
              {connectors.length > 0 ? (
                <div className="space-y-2">
                  {connectors.map((c) => (
                    <div key={c} className="flex items-center gap-2.5 text-sm text-stone-600 pl-1">
                      <Globe size={16} className="text-stone-400 shrink-0" />
                      <span className="truncate">{c}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-stone-500 pl-1 leading-relaxed">暂无</p>
              )}
            </div>

            <div>
              <div className="text-xs text-stone-500 mb-2.5">工作文件</div>
              {workingFiles.length > 0 ? (
                <div className="space-y-2">
                  {workingFiles.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => { void openPath(p); }}
                      className="w-full flex items-center gap-2.5 text-sm text-stone-600 pl-1 hover:text-stone-800 transition-colors"
                      title={p}
                    >
                      <FileCode size={16} className="text-stone-400 shrink-0" />
                      <span className="truncate">{p}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-stone-500 pl-1 leading-relaxed">暂无</p>
              )}
            </div>

            <div>
              <div className="text-xs text-stone-500 mb-2.5">本地执行</div>
              <div className="flex items-center gap-2.5 text-sm text-stone-600 pl-1">
                <Terminal size={16} className="text-stone-400 shrink-0" />
                <span className="truncate">命令与脚本（run_command）</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
