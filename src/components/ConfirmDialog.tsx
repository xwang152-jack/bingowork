import { useState } from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';

interface ConfirmationRequest {
    id: string;
    tool: string;
    description: string;
    args: Record<string, unknown>;
}

interface ConfirmDialogProps {
    request: ConfirmationRequest | null;
    onConfirm: (id: string, remember: boolean, tool: string, path?: string) => void;
    onDeny: (id: string) => void;
}

export function ConfirmDialog({ request, onConfirm, onDeny }: ConfirmDialogProps) {
    const [remember, setRemember] = useState(false);

    if (!request) return null;

    const path = (request.args?.path || request.args?.cwd) as string | undefined;

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white/95 backdrop-blur-md border border-stone-200/60 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-scale-in">
                {/* Header */}
                <div className="p-6 border-b border-stone-200/60 bg-amber-50/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-amber-100 rounded-2xl">
                            <AlertTriangle className="text-amber-600" size={24} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-lg text-stone-800 tracking-tight">操作确认</h3>
                            <p className="text-sm text-stone-500">请确认是否执行此操作</p>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                    <div>
                        <p className="text-sm text-stone-500 mb-2">工具</p>
                        <p className="font-mono text-sm bg-stone-100/80 px-4 py-2.5 rounded-xl border border-stone-200/60">{request.tool}</p>
                    </div>
                    <div>
                        <p className="text-sm text-stone-500 mb-2">描述</p>
                        <p className="text-stone-800 leading-relaxed">{request.description}</p>
                    </div>
                    {request.args && Object.keys(request.args).length > 0 && (
                        <div>
                            <p className="text-sm text-stone-500 mb-2">参数</p>
                            <pre className="bg-stone-100/80 p-4 rounded-xl text-xs font-mono overflow-x-auto max-h-32 border border-stone-200/60 custom-scrollbar">
                                {JSON.stringify(request.args, null, 2)}
                            </pre>
                        </div>
                    )}
                    {/* Remember checkbox */}
                    <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-stone-50/80 transition-colors">
                        <input
                            type="checkbox"
                            checked={remember}
                            onChange={(e) => setRemember(e.target.checked)}
                            className="w-4 h-4 rounded accent-[#E85D3E]"
                        />
                        <span className="text-sm text-stone-600">记住此选择，以后自动执行</span>
                    </label>
                </div>

                {/* Actions */}
                <div className="flex gap-3 p-6 border-t border-stone-200/60 bg-stone-50/30">
                    <button
                        onClick={() => {
                            setRemember(false);
                            onDeny(request.id);
                        }}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-50 text-red-600 rounded-2xl hover:bg-red-100 transition-colors font-medium border border-red-200/60"
                    >
                        <X size={18} /> 拒绝
                    </button>
                    <button
                        onClick={() => {
                            onConfirm(request.id, remember, request.tool, path);
                            setRemember(false);
                        }}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-[#E85D3E] to-[#d14a2e] text-white rounded-2xl hover:from-[#d14a2e] hover:to-[#b53d26] transition-all font-medium shadow-sm"
                    >
                        <Check size={18} /> 允许
                    </button>
                </div>
            </div>
        </div>
    );
}

// Re-export useConfirmations for convenience
export { useConfirmations } from './useConfirmations';

