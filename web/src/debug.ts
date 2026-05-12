interface LogEntry {
  ts: string;
  level: 'error' | 'warn' | 'api';
  message: string;
  detail?: unknown;
}

const MAX_ENTRIES = 500;
const log: LogEntry[] = [];

function entry(level: LogEntry['level'], message: string, detail?: unknown) {
  log.push({ ts: new Date().toISOString(), level, message, detail });
  if (log.length > MAX_ENTRIES) log.shift();
}

// Capture console.error and console.warn
const _error = console.error.bind(console);
const _warn  = console.warn.bind(console);

console.error = (...args: unknown[]) => {
  entry('error', args.map(String).join(' '), args.length > 1 ? args : undefined);
  _error(...args);
};

console.warn = (...args: unknown[]) => {
  entry('warn', args.map(String).join(' '), args.length > 1 ? args : undefined);
  _warn(...args);
};

// Intercept fetch to log API failures
const _fetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
  const res = await _fetch(input, init);
  if (!res.ok && url.includes('/api/')) {
    entry('api', `${res.status} ${res.statusText} — ${url}`);
  }
  return res;
};

// Expose debug helpers on window
const nexumDebug = {
  dump() {
    if (log.length === 0) { console.log('[nexum] No entries captured.'); return; }
    console.group(`[nexum] Debug log (${log.length} entries)`);
    for (const e of log) {
      const fn = e.level === 'error' ? console.error : e.level === 'warn' ? console.warn : console.info;
      fn(`[${e.ts}] [${e.level.toUpperCase()}] ${e.message}`, ...(e.detail != null ? [e.detail] : []));
    }
    console.groupEnd();
  },

  errors() {
    const errs = log.filter((e) => e.level === 'error');
    if (errs.length === 0) { console.log('[nexum] No errors captured.'); return; }
    console.group(`[nexum] Errors (${errs.length})`);
    for (const e of errs) console.error(`[${e.ts}] ${e.message}`, ...(e.detail != null ? [e.detail] : []));
    console.groupEnd();
  },

  api() {
    const calls = log.filter((e) => e.level === 'api');
    if (calls.length === 0) { console.log('[nexum] No failed API calls captured.'); return; }
    console.group(`[nexum] Failed API calls (${calls.length})`);
    for (const e of calls) console.warn(`[${e.ts}] ${e.message}`);
    console.groupEnd();
  },

  queue() {
    import('./store/pendingQueue').then(({ getQueue }) => {
      const q = getQueue();
      if (q.length === 0) { console.log('[nexum] Pending queue is empty.'); return; }
      console.group(`[nexum] Pending queue (${q.length} ops)`);
      for (const op of q) console.warn(`  [attempt ${op.attempts}] ${op.method} ${op.url} — ${op.label}`);
      console.groupEnd();
    });
  },

  flush() {
    import('./store/pendingQueue').then(({ flushQueue }) => {
      console.log('[nexum] Manually flushing queue...');
      flushQueue();
    });
  },

  mapState() {
    // Dynamically import to avoid circular deps at init time
    import('./store/mapStore').then(({ useMapStore }) => {
      const state = useMapStore.getState();
      console.group('[nexum] Map store state');
      console.log('Map ID:', state.map.id);
      console.log('Systems:', state.map.systems.length, state.map.systems.map((s) => `${s.name} (${s.id})`));
      console.log('Connections:', state.map.connections.length);
      console.log('Active map ID:', state.activeMapId);
      console.groupEnd();
    });
  },

  clear() {
    log.length = 0;
    console.log('[nexum] Debug log cleared.');
  },

  help() {
    console.group('[nexum] Available commands');
    console.log('nexumDebug.dump()      — all captured log entries');
    console.log('nexumDebug.errors()    — errors only');
    console.log('nexumDebug.api()       — failed API calls only');
    console.log('nexumDebug.mapState()  — current map store snapshot');
    console.log('nexumDebug.queue()     — show pending write queue');
    console.log('nexumDebug.flush()     — manually flush the write queue');
    console.log('nexumDebug.clear()     — clear the log buffer');
    console.groupEnd();
  },
};

(window as unknown as Record<string, unknown>).nexumDebug = nexumDebug;

console.log('[nexum] Debug logger active — type nexumDebug.help() to see available commands.');
