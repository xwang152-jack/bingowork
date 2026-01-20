/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';

// Define error handler interface for use in renderer
interface ErrorHandler {
  handleError: (error: Error, severity?: 'low' | 'medium' | 'high', context?: Record<string, unknown>) => void;
}

// Create a simple error handler for renderer process
const rendererErrorHandler: ErrorHandler = {
  handleError: (error: Error, severity = 'medium' as const, context?: Record<string, unknown>) => {
    console.error('[ErrorBoundary]', severity, error.message, context);
    // Could send to main process for logging
    try {
      window.ipcRenderer.send('log-error', {
        message: error.message,
        stack: error.stack,
        severity,
        context,
      });
    } catch {
      // Ignore if IPC fails
    }
  },
};

const errorHandler = rendererErrorHandler;

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error to error reporting service
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Use centralized error handler
    try {
      errorHandler.handleError(
        error,
        'high' as const,
        {
          componentStack: errorInfo.componentStack,
          digest: errorInfo.digest,
        }
      );
    } catch (handlerError) {
      console.error('Failed to handle error in ErrorBoundary:', handlerError);
    }

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Update state with error info
    this.setState({
      errorInfo,
    });
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-stone-50 dark:bg-stone-900">
          <div className="max-w-md w-full mx-4 bg-white dark:bg-stone-800 rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 dark:bg-red-900/30 rounded-full">
              <svg
                className="w-6 h-6 text-red-600 dark:text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            <h2 className="text-xl font-semibold text-center text-stone-900 dark:text-stone-100 mb-2">
              出错了
            </h2>

            <p className="text-stone-600 dark:text-stone-400 text-center mb-4">
              应用遇到了一个意外错误。您可以尝试刷新页面或重启应用。
            </p>

            {this.state.error && (
              <details className="mb-4">
                <summary className="cursor-pointer text-sm text-stone-500 dark:text-stone-500 hover:text-stone-700 dark:hover:text-stone-300">
                  查看错误详情
                </summary>
                <div className="mt-2 p-3 bg-stone-100 dark:bg-stone-700 rounded text-xs font-mono text-stone-800 dark:text-stone-200 overflow-auto max-h-40">
                  <div className="font-semibold mb-1">{this.state.error.name}: {this.state.error.message}</div>
                  {this.state.error.stack && (
                    <pre className="whitespace-pre-wrap">{this.state.error.stack}</pre>
                  )}
                </div>
              </details>
            )}

            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                重试
              </button>
              <button
                onClick={() => window.location.reload()}
                className="flex-1 px-4 py-2 bg-stone-200 hover:bg-stone-300 dark:bg-stone-700 dark:hover:bg-stone-600 text-stone-800 dark:text-stone-200 rounded-lg transition-colors"
              >
                刷新页面
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * HOC to wrap a component with Error Boundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode,
  onError?: (error: Error, errorInfo: ErrorInfo) => void
): React.ComponentType<P> {
  return function WrappedComponent(props: P) {
    return (
      <ErrorBoundary fallback={fallback} onError={onError}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}

/**
 * Hook to programmatically trigger error boundary
 * Useful for async errors
 */
export function useErrorHandler(): (error: Error) => void {
  return (error: Error) => {
    throw error;
  };
}
