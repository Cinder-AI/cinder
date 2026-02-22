type LogLevel = "debug" | "info" | "warn" | "error";

const levelWeights: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const configuredLevel = (process.env.REACTOR_LOG_LEVEL || "info").toLowerCase() as LogLevel;
const minWeight = levelWeights[configuredLevel] ?? levelWeights.info;

function shouldLog(level: LogLevel): boolean {
  return levelWeights[level] >= minWeight;
}

function print(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  if (!shouldLog(level)) {
    return;
  }

  const payload = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...(meta ? { meta } : {}),
  };
  const line = JSON.stringify(payload);

  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.log(line);
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => print("debug", message, meta),
  info: (message: string, meta?: Record<string, unknown>) => print("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => print("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) => print("error", message, meta),
};
