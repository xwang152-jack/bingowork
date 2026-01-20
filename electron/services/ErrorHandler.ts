export enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  FATAL = 'fatal'
}

export interface ErrorDetails {
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
  source?: string;
}

class ErrorHandler {
  private static instance: ErrorHandler;

  private constructor() {}

  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  public handleError(error: Error | string, severity: ErrorSeverity = ErrorSeverity.ERROR, context?: Record<string, unknown>) {
    const errorDetails: ErrorDetails = {
      message: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      context,
      source: 'main-process'
    };

    // Log to console
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${severity.toUpperCase()}] ${errorDetails.message}`;
    
    switch (severity) {
      case ErrorSeverity.INFO:
        console.log(logMessage);
        break;
      case ErrorSeverity.WARNING:
        console.warn(logMessage);
        break;
      case ErrorSeverity.ERROR:
      case ErrorSeverity.FATAL:
        console.error(logMessage);
        if (errorDetails.stack) {
          console.error(errorDetails.stack);
        }
        break;
    }

    // Here you could add logic to write to a log file, send to a crash reporting service, etc.
  }

  public log(message: string, context?: Record<string, unknown>) {
    this.handleError(message, ErrorSeverity.INFO, context);
  }

  public warn(message: string, context?: Record<string, unknown>) {
    this.handleError(message, ErrorSeverity.WARNING, context);
  }

  public error(error: Error | string, context?: Record<string, unknown>) {
    this.handleError(error, ErrorSeverity.ERROR, context);
  }
}

export const errorHandler = ErrorHandler.getInstance();
