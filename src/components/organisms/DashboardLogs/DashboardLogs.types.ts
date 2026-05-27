export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

export type LogEntry = {
  ts?: string;
  level?: LogLevel | string;
  target?: string;
  msg?: string;
  fields?: Record<string, unknown>;
  /** Present when the line was not valid JSON. */
  raw?: string;
};

export type LogsResponse = {
  items: LogEntry[];
  partial?: boolean;
};

export type LevelFilter = 'all' | LogLevel;
