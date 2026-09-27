type Level = 'debug' | 'info' | 'warn' | 'error';
const order: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function emit(level: Level, msg: string, data?: object) {
  const threshold = (process.env.LOG_LEVEL as Level | undefined) ?? 'info';
  if (order[level] < order[threshold]) return;
  if (process.env.NODE_ENV === 'test' && level !== 'error') return;
  const line = { t: new Date().toISOString(), level, msg, ...data };
  const out = process.env.NODE_ENV === 'production' ? JSON.stringify(line) : `[${level}] ${msg}${data ? ' ' + JSON.stringify(data) : ''}`;
  (level === 'error' ? console.error : level === 'warn' ? console.warn : console.log)(out);
}

export const log = {
  debug: (m: string, d?: object) => emit('debug', m, d),
  info: (m: string, d?: object) => emit('info', m, d),
  warn: (m: string, d?: object) => emit('warn', m, d),
  error: (m: string, d?: object) => emit('error', m, d),
};
