import { useState, memo } from 'react';
import { ChevronDown, ChevronUp, Terminal, Check, Loader2, AlertTriangle } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';

export interface ToolBlockData {
    id: string;
    name: string;
    status: 'running' | 'done' | 'error';
    output?: string;
}

interface CollapsibleToolBlockProps {
    toolName: string;
    input: Record<string, unknown>;
    output?: string;
    status?: 'running' | 'done' | 'error';
}

export const CollapsibleToolBlock = memo(function CollapsibleToolBlock({ toolName, output, status = 'done' }: CollapsibleToolBlockProps) {
    const [expanded, setExpanded] = useState(false);

    const getStatusIcon = () => {
        if (status === 'running') return <Loader2 size={14} className="text-[#E85D3E] animate-spin" />;
        if (status === 'error') return <AlertTriangle size={14} className="text-red-500" />;
        return <Check size={14} className="text-emerald-500" />;
    };

    const fallbackText = status === 'running'
        ? '执行中…'
        : status === 'error'
            ? '执行失败（无输出）'
            : '执行完成（无输出）';

    return (
        <div className="border border-stone-200/60 rounded-2xl overflow-hidden my-2 shadow-sm">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between px-4 py-3 bg-stone-50/50 hover:bg-stone-100/60 transition-colors"
            >
                <div className="flex items-center gap-2.5">
                    {getStatusIcon()}
                    <Terminal size={14} className="text-stone-500" />
                    <span className="text-sm font-medium text-stone-700">{toolName}</span>
                </div>
                {expanded ? (
                    <ChevronUp size={16} className="text-stone-400" />
                ) : (
                    <ChevronDown size={16} className="text-stone-400" />
                )}
            </button>

            {expanded && (
                <div className="border-t border-stone-200/60">
                    <div className="p-4 bg-zinc-900/95 font-mono text-xs text-emerald-400 max-h-40 overflow-y-auto custom-scrollbar">
                        <pre className="whitespace-pre-wrap leading-relaxed">{output || fallbackText}</pre>
                    </div>
                </div>
            )}
        </div>
    );
});

interface StepsIndicatorProps {
    count: number;
    expanded: boolean;
    onToggle: () => void;
}

export function StepsIndicator({ count, expanded, onToggle }: StepsIndicatorProps) {
    const { t } = useI18n();

    return (
        <button
            onClick={onToggle}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1 pl-3 border-l-2 border-primary/30"
        >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            <span>{count} {t('steps')}</span>
        </button>
    );
}
