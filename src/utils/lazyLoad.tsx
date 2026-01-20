/**
 * Lazy loading utilities for performance optimization
 * Helps reduce initial bundle size by loading heavy dependencies on demand
 */

import { lazy, Suspense } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Loading fallback component for lazy loaded components
 */
export function LoadingFallback({ message = '加载中...' }: { message?: string }) {
    return (
        <div className="flex items-center justify-center p-8">
            <Loader2 size={24} className="animate-spin text-orange-500" />
            <span className="ml-2 text-stone-500">{message}</span>
        </div>
    );
}

/**
 * Error boundary fallback for lazy loaded components
 */
export function LazyLoadError({ error }: { error: Error }) {
    return (
        <div className="flex items-center justify-center p-8 text-red-500">
            <p>加载失败: {error.message}</p>
        </div>
    );
}

/**
 * Higher-order component for lazy loading with error handling
 */
export function withLazyLoad<P extends object>(
    importFunc: () => Promise<{ default: ComponentType<P> }>,
    fallbackMessage?: string
) {
    const LazyComponent = lazy(importFunc) as unknown as ComponentType<P>;

    return function LazyLoadWrapper(props: P) {
        return (
            <Suspense fallback={<LoadingFallback message={fallbackMessage} />}>
                <LazyComponent {...props} />
            </Suspense>
        );
    };
}

type SettingsViewLazyProps = { onClose: () => void };
type FloatingBallPageLazyProps = Record<string, never>;
type MarkdownRendererLazyProps = { content: string; className?: string; isDark?: boolean };
type SkillEditorLazyProps = { filename: string | null; readOnly?: boolean; onClose: () => void; onSave: () => void };

/**
 * Lazy loaded Settings view
 */
export const LazySettingsView = withLazyLoad<SettingsViewLazyProps>(
    () => import('../components/SettingsView').then((m) => ({ default: m.SettingsView })),
    '加载设置...'
);

/**
 * Lazy loaded FloatingBall page
 */
export const LazyFloatingBallPage = withLazyLoad<FloatingBallPageLazyProps>(
    () =>
        import('../components/FloatingBallPage').then((m) => ({
            default: function FloatingBallPageLazyWrapper(_props: FloatingBallPageLazyProps) {
                return <m.FloatingBallPage />;
            },
        })),
    '加载悬浮球...'
);

/**
 * Lazy loaded Markdown renderer with Mermaid
 * This is a heavy component due to Mermaid library
 */
export const LazyMarkdownRenderer = withLazyLoad<MarkdownRendererLazyProps>(
    () =>
        import('../components/MarkdownRenderer').then((m) => ({
            default: function MarkdownRendererLazyWrapper(props: MarkdownRendererLazyProps) {
                return <m.MarkdownRenderer {...props} />;
            },
        })),
    '渲染内容...'
);

/**
 * Lazy loaded Skill editor
 */
export const LazySkillEditor = withLazyLoad<SkillEditorLazyProps>(
    () => import('../components/SkillEditor').then((m) => ({ default: m.SkillEditor })),
    '加载编辑器...'
);

/**
 * Create a lazy loaded component wrapper with custom loading UI
 */
export function createLazyComponent(
    importFn: () => Promise<{ default: ComponentType<Record<string, unknown>> }>,
    loadingUI?: ReactNode
) {
    const LazyComponent = lazy(importFn) as unknown as ComponentType<Record<string, unknown>>;

    return function LazyWrapper(props: Record<string, unknown>) {
        return (
            <Suspense fallback={loadingUI || <LoadingFallback />}>
                <LazyComponent {...props} />
            </Suspense>
        );
    };
}
