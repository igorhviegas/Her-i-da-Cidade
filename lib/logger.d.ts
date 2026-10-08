type LogMethod = (...args: unknown[]) => void;
export const logger: { debug: LogMethod; info: LogMethod; log: LogMethod; warn: LogMethod; error: LogMethod };
