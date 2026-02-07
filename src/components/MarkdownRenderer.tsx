import { useState, useEffect, useRef, useMemo, memo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import SyntaxHighlighter from 'react-syntax-highlighter/dist/esm/prism';
import { oneLight, vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import mermaid from 'mermaid';
import { Check, Copy } from 'lucide-react';
import DOMPurify from 'dompurify';

// Extend Window interface
declare global {
    interface Window {
        __mermaidInitialized?: boolean;
    }
}

// Initialize mermaid once
if (typeof window !== 'undefined' && !window.__mermaidInitialized) {
    mermaid.initialize({
        startOnLoad: false,
        theme: 'neutral',
        securityLevel: 'loose',
        fontFamily: 'Inter, sans-serif',
    });
    window.__mermaidInitialized = true;
}

interface MarkdownRendererProps {
    content: string;
    className?: string;
    isDark?: boolean;
}

// Memoize the main renderer to avoid re-renders
// 自定义比较函数，避免不必要的重新渲染
const areMarkdownPropsEqual = (
    prevProps: MarkdownRendererProps,
    nextProps: MarkdownRendererProps
) => {
    return (
        prevProps.content === nextProps.content &&
        prevProps.isDark === nextProps.isDark &&
        prevProps.className === nextProps.className
    );
};

export const MarkdownRenderer = memo(function MarkdownRenderer({ content, className = '', isDark = false }: MarkdownRendererProps) {
    // Memoize prose class
    const proseClass = useMemo(() => {
        return `prose ${isDark ? 'prose-invert' : 'prose-stone'} max-w-none ${className}`;
    }, [isDark, className]);

    return (
        <div className={proseClass}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    code({ node: _node, inline, className, children, ...props }: { node?: unknown; inline?: boolean; className?: string; children?: React.ReactNode }) {
                        const match = /language-(\w+)/.exec(className || '');
                        const codeContent = String(children).replace(/\n$/, '');

                        if (!inline && match) {
                            // Mermaid handling
                            if (match[1] === 'mermaid') {
                                return <MermaidDiagram code={codeContent} isDark={isDark} />;
                            }

                            // Standard Syntax Highlighting
                            return (
                                <div className="relative group my-4 rounded-lg overflow-hidden border border-stone-200 shadow-sm">
                                    <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <CopyButton text={codeContent} />
                                    </div>
                                    <SyntaxHighlighter
                                        style={isDark ? vscDarkPlus : oneLight} // Simple light/dark check
                                        language={match[1]}
                                        PreTag="div"
                                        customStyle={{
                                            margin: 0,
                                            padding: '1.5rem 1rem',
                                            fontSize: '0.9rem',
                                            lineHeight: '1.5',
                                            background: isDark ? '#1e1e1e' : '#fafafa',
                                        }}
                                        {...props}
                                    >
                                        {codeContent}
                                    </SyntaxHighlighter>
                                </div>
                            );
                        }

                        // Inline code - check for file paths
                        const codeText = String(children);
                        // Detect Windows paths (E:\...) or Unix paths (/.../...)
                        const isFilePath = /^[A-Za-z]:[/\\]|^\/\w+/.test(codeText);

                        if (isFilePath) {
                            return (
                                <code
                                    className={`${className} px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 font-mono text-sm border border-blue-200 cursor-pointer hover:bg-blue-100 transition-colors`}
                                    onClick={() => {
                                        window.ipcRenderer.invoke('shell:open-path', codeText).then((res) => {
                                            const r = res as { success?: boolean; error?: string } | undefined;
                                            if (r && r.success === false && r.error) alert(r.error);
                                        }).catch((e) => alert(String(e)));
                                    }}
                                    title="点击在文件管理器中打开"
                                    {...props}
                                >
                                    📁 {children}
                                </code>
                            );
                        }

                        return (
                            <code
                                className={`${className} px-1.5 py-0.5 rounded-md bg-stone-100 text-stone-800 font-mono text-sm border border-stone-200`}
                                {...props}
                            >
                                {children}
                            </code>
                        );
                    },
                    // Improved Table Styling
                    table({ children }) {
                        return (
                            <div className="overflow-x-auto my-6 border border-stone-200 rounded-xl shadow-sm">
                                <table className="w-full text-left border-collapse text-sm">
                                    {children}
                                </table>
                            </div>
                        );
                    },
                    thead({ children }) {
                        return <thead className="bg-stone-50 text-stone-700">{children}</thead>;
                    },
                    th({ children }) {
                        return <th className="px-4 py-3 font-semibold border-b border-stone-200">{children}</th>;
                    },
                    td({ children }) {
                        return <td className="px-4 py-3 border-b border-stone-100 text-stone-600">{children}</td>;
                    },
                    // Improved Spacing for Typography
                    p({ children }) {
                        return <p className="mb-3 leading-7 last:mb-0">{children}</p>;
                    },
                    ul({ children }) {
                        return <ul className="list-disc pl-5 mb-3 space-y-1 marker:text-stone-300">{children}</ul>;
                    },
                    ol({ children }) {
                        return <ol className="list-decimal pl-5 mb-3 space-y-1 marker:text-stone-300">{children}</ol>;
                    },
                    li({ children }) {
                        return <li className="pl-1">{children}</li>;
                    },
                    h1({ children }) {
                        return <h1 className="text-xl font-bold mt-6 mb-3 pb-2 border-b border-stone-100">{children}</h1>;
                    },
                    h2({ children }) {
                        return <h2 className="text-base font-bold mt-5 mb-2.5 flex items-center gap-2">
                            <span className="w-1 h-4 bg-orange-500 rounded-full inline-block"></span>
                            {children}
                        </h2>;
                    },
                    h3({ children }) {
                        return <h3 className="text-sm font-semibold mt-4 mb-2">{children}</h3>;
                    },
                    blockquote({ children }) {
                        return <blockquote className="border-l-4 border-orange-200 pl-4 py-1 my-3 italic bg-orange-50/20 rounded-r-lg">{children}</blockquote>;
                    },
                    a({ href, children }) {
                        // Web links open in new tab
                        const isWeb = href?.startsWith('http:') || href?.startsWith('https:') || href?.startsWith('mailto:');

                        // Treat EVERYTHING else as a local file/interaction
                        // This handles relative paths (e.g. "src/main.ts") which previously caused SPA reload
                        const isLocalFile = !isWeb;

                        const openLocal = () => {
                            const target = String(href || '').trim();
                            const invokeOpen = (p: string) =>
                                window.ipcRenderer.invoke('shell:open-path', p).then((res) => {
                                    const r = res as { success?: boolean; error?: string; candidates?: string } | undefined;
                                    if (r && r.success === false) {
                                        const details = r.candidates ? `\n\n尝试过的路径:\n${r.candidates}` : '';
                                        alert(`${r.error || '无法打开'}${details}`);
                                    }
                                });

                            if (target) {
                                invokeOpen(target).catch((err) => alert(String(err)));
                                return;
                            }

                            window.ipcRenderer.invoke('config:get-all').then((cfg) => {
                                const c = cfg as { authorizedFolders?: string[] } | undefined;
                                const folder = Array.isArray(c?.authorizedFolders) ? c?.authorizedFolders?.[0] : undefined;
                                if (!folder) {
                                    alert('该链接未包含路径，且尚未配置授权文件夹。');
                                    return;
                                }
                                invokeOpen(folder).catch((err) => alert(String(err)));
                            }).catch((err) => alert(String(err)));
                        };

                        return (
                            isLocalFile ? (
                                <button
                                    type="button"
                                    className="text-orange-600 hover:text-orange-700 underline decoration-orange-300 hover:decoration-orange-600 underline-offset-2 transition-all font-medium cursor-pointer"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        openLocal();
                                    }}
                                >
                                    {children}
                                </button>
                            ) : (
                                <a
                                    href={href}
                                className="text-orange-600 hover:text-orange-700 underline decoration-orange-300 hover:decoration-orange-600 underline-offset-2 transition-all font-medium cursor-pointer"
                                target={isWeb ? "_blank" : undefined}
                                rel="noopener noreferrer"
                            >
                                {children}
                            </a>
                            )
                        )
                    }
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
}, areMarkdownPropsEqual);

// Memoize MermaidDiagram component
const MermaidDiagram = memo(function MermaidDiagram({ code, isDark }: { code: string, isDark: boolean }) {
    const [svg, setSvg] = useState<string>('');
    const renderId = useRef(`mermaid-${Math.random().toString(36).slice(2, 11)}`);

    useEffect(() => {
        mermaid.render(renderId.current, code).then(({ svg }) => {
            // Sanitize SVG to prevent XSS attacks
            const sanitizedSvg = DOMPurify.sanitize(svg, {
                USE_PROFILES: { svg: true, svgFilters: true },
                ADD_ATTR: ['xmlns', 'viewBox', 'preserveAspectRatio'],
            });
            setSvg(sanitizedSvg);
        }).catch((err) => {
            console.error('Mermaid render error:', err);
            setSvg(`<div class="text-red-500 bg-red-50 p-2 rounded text-xs font-mono">Failed to render diagram</div>`);
        });
    }, [code, isDark]);

    return (
        <div
            className="my-6 p-4 bg-white border border-stone-200 rounded-xl flex justify-center overflow-x-auto shadow-sm"
            dangerouslySetInnerHTML={{ __html: svg }}
        />
    );
});

// Memoize CopyButton component
const CopyButton = memo(function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [text]);

    return (
        <button
            onClick={handleCopy}
            className="p-1.5 rounded-lg bg-white/90 shadow-sm border border-stone-200 hover:bg-white text-stone-500 hover:text-stone-800 transition-all"
            title="Copy code"
        >
            {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
        </button>
    );
});
