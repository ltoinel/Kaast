import { useState, useEffect, useRef, useCallback, memo } from "react";
import { useTranslation } from "react-i18next";
import "./DebugConsole.css";

interface LogEntry {
  id: number;
  timestamp: string;
  level: "log" | "warn" | "error" | "info";
  message: string;
}

// Global log storage, shared between instances
const logEntries: LogEntry[] = [];
let logId = 0;
let listeners: Array<() => void> = [];

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

// Intercept console methods once
const originalConsole = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  info: console.info.bind(console),
};

let intercepted = false;

function installInterceptors() {
  if (intercepted) return;
  intercepted = true;

  const createInterceptor = (level: LogEntry["level"]) => {
    return (...args: unknown[]) => {
      originalConsole[level](...args);

      const message = args
        .map((arg) => {
          if (typeof arg === "string") return arg;
          try {
            return JSON.stringify(arg, null, 2);
          } catch {
            return String(arg);
          }
        })
        .join(" ");

      const now = new Date();
      const timestamp = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}.${now.getMilliseconds().toString().padStart(3, "0")}`;

      logEntries.push({ id: logId++, timestamp, level, message });

      if (logEntries.length > 500) {
        logEntries.splice(0, logEntries.length - 500);
      }

      notifyListeners();
    };
  };

  console.log = createInterceptor("log");
  console.warn = createInterceptor("warn");
  console.error = createInterceptor("error");
  console.info = createInterceptor("info");
}

installInterceptors();

interface DebugConsoleProps {
  onClose: () => void;
}

function DebugConsole({ onClose }: DebugConsoleProps) {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<LogEntry[]>([...logEntries]);
  const [filter, setFilter] = useState<"all" | "log" | "warn" | "error">("all");
  const listRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  useEffect(() => {
    const update = () => {
      setEntries([...logEntries]);
    };
    listeners.push(update);
    return () => {
      listeners = listeners.filter((fn) => fn !== update);
    };
  }, []);

  useEffect(() => {
    if (autoScrollRef.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [entries]);

  const handleScroll = useCallback(() => {
    if (!listRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = listRef.current;
    autoScrollRef.current = scrollHeight - scrollTop - clientHeight < 30;
  }, []);

  const handleClear = () => {
    logEntries.length = 0;
    setEntries([]);
  };

  const filtered = filter === "all" ? entries : entries.filter((e) => e.level === filter);

  const levelCounts = {
    all: entries.length,
    log: entries.filter((e) => e.level === "log" || e.level === "info").length,
    warn: entries.filter((e) => e.level === "warn").length,
    error: entries.filter((e) => e.level === "error").length,
  };

  return (
    <div className="debug-console">
      <div className="console-toolbar">
        <div className="console-filters">
          <button
            className={`console-filter ${filter === "all" ? "active" : ""}`}
            onClick={() => setFilter("all")}
          >
            {t('debug.all')} ({levelCounts.all})
          </button>
          <button
            className={`console-filter filter-warn ${filter === "warn" ? "active" : ""}`}
            onClick={() => setFilter("warn")}
          >
            {t('debug.warn')} ({levelCounts.warn})
          </button>
          <button
            className={`console-filter filter-error ${filter === "error" ? "active" : ""}`}
            onClick={() => setFilter("error")}
          >
            {t('debug.errors')} ({levelCounts.error})
          </button>
        </div>
        <div className="console-actions">
          <button className="console-btn" onClick={handleClear} title={t('debug.clear')}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            </svg>
          </button>
          <button className="console-btn" onClick={onClose} title={t('debug.close')}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
      <div className="console-entries" ref={listRef} onScroll={handleScroll}>
        {filtered.length === 0 ? (
          <div className="console-empty">{t('debug.noMessages')}</div>
        ) : (
          filtered.map((entry) => (
            <div key={entry.id} className={`console-entry level-${entry.level}`}>
              <span className="entry-time">{entry.timestamp}</span>
              <span className="entry-level">{entry.level.toUpperCase()}</span>
              <span className="entry-message">{entry.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default memo(DebugConsole);
