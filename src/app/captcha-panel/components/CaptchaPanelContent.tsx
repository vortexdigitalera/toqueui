'use client';

import React, { useState, useRef, useEffect } from 'react';
import Icon from '@/components/ui/AppIcon';

type CaptchaOp = 'pull' | 'watch' | 'start' | 'stop' | 'set' | 'solve' | 'status';

interface CommandLog {
  id: string;
  timestamp: string;
  op: CaptchaOp;
  params: string;
  status: 'pending' | 'success' | 'error' | 'running';
  output: string[];
  durationMs?: number;
}

interface HistoryEntry {
  id: string;
  timestamp: string;
  op: CaptchaOp;
  params: string;
  status: 'success' | 'error';
  durationMs: number;
}

const OP_META: Record<CaptchaOp, { label: string; icon: string; color: string; desc: string }> = {
  pull:   { label: 'Pull',   icon: 'ArrowDownTrayIcon',      color: 'var(--primary)',          desc: 'Fetch pending CAPTCHA challenges from queue' },
  watch:  { label: 'Watch',  icon: 'EyeIcon',                color: 'var(--accent)',            desc: 'Subscribe to live CAPTCHA event stream' },
  start:  { label: 'Start',  icon: 'PlayIcon',               color: 'var(--success)',           desc: 'Start the CAPTCHA solver worker process' },
  stop:   { label: 'Stop',   icon: 'StopIcon',               color: 'var(--error)',             desc: 'Gracefully stop the CAPTCHA solver worker' },
  set:    { label: 'Set',    icon: 'AdjustmentsHorizontalIcon', color: 'var(--warning)',        desc: 'Configure CAPTCHA solver parameters' },
  solve:  { label: 'Solve',  icon: 'CheckCircleIcon',        color: '#a78bfa',                  desc: 'Submit a CAPTCHA token for resolution' },
  status: { label: 'Status', icon: 'InformationCircleIcon',  color: 'var(--muted-foreground)',  desc: 'Check current solver status and queue depth' },
};

const MOCK_OUTPUTS: Record<CaptchaOp, (params: string) => string[]> = {
  pull: (p) => [
    `→ Connecting to CAPTCHA queue endpoint...`,
    `→ Auth token validated`,
    `→ Fetching challenges (limit=${p || '10'})`,
    `✓ Pulled 7 pending challenges`,
    `  [hcaptcha] site=nusuk.sa  id=cap_a1b2c3  expires=120s`,
    `  [hcaptcha] site=nusuk.sa  id=cap_d4e5f6  expires=118s`,
    `  [recaptcha-v2] site=masar.sa  id=cap_g7h8i9  expires=90s`,
    `✓ Queue depth: 7 challenges ready`,
  ],
  watch: (p) => [
    `→ Opening event stream (filter=${p || 'all'})...`,
    `→ WebSocket connected: wss://captcha.nusuk.sa/stream`,
    `[WATCH] Subscribed to: challenge.created, challenge.solved, worker.status`,
    `[EVT 07:42:01] challenge.created  id=cap_x1y2z3  type=hcaptcha`,
    `[EVT 07:42:03] challenge.solved   id=cap_a1b2c3  token=P0_eyJ...  latency=1840ms`,
    `[EVT 07:42:07] worker.status      workers=3  queue=4  solved_1m=12`,
    `[WATCH] Stream active — press Stop to disconnect`,
  ],
  start: (_) => [
    `→ Initialising CAPTCHA solver worker pool...`,
    `→ Loading model weights (hcaptcha-v3.bin)...`,
    `→ Loading model weights (recaptcha-v2.bin)...`,
    `✓ Worker 1 online  pid=18421`,
    `✓ Worker 2 online  pid=18422`,
    `✓ Worker 3 online  pid=18423`,
    `✓ Solver pool started — 3 workers active`,
    `→ Listening on queue: captcha.nusuk.sa/queue`,
  ],
  stop: (_) => [
    `→ Sending SIGTERM to worker pool...`,
    `→ Draining in-flight challenges (timeout=10s)...`,
    `  Worker 1 (pid=18421): drained 2 tasks, stopping...`,
    `  Worker 2 (pid=18422): idle, stopping...`,
    `  Worker 3 (pid=18423): drained 1 task, stopping...`,
    `✓ All workers stopped cleanly`,
    `✓ Queue flushed — 0 pending tasks`,
  ],
  set: (p) => [
    `→ Applying configuration: ${p || 'timeout=30 retries=3 provider=2captcha'}`,
    `→ Validating parameter schema...`,
    `✓ timeout      = 30s  (was 20s)`,
    `✓ retries      = 3    (was 2)`,
    `✓ provider     = 2captcha`,
    `✓ concurrency  = 5    (unchanged)`,
    `✓ Configuration saved to captcha.config.json`,
  ],
  solve: (p) => [
    `→ Submitting CAPTCHA token for resolution...`,
    `→ Token: ${p ? p.slice(0, 32) + '...' : 'P0_eyJhbGciOiJSUzI1NiJ9...'}`,
    `→ Routing to provider: 2captcha`,
    `→ Awaiting solver response...`,
    `✓ CAPTCHA solved in 2140ms`,
    `✓ Solution token: 03AGdBq24PBCbwiDt...`,
    `✓ Verification: PASSED`,
  ],
  status: (_) => [
    `→ Querying solver status...`,
    ``,
    `  CAPTCHA Solver Status`,
    `  ─────────────────────────────────────`,
    `  Worker pool     : RUNNING (3/3 active)`,
    `  Queue depth     : 4 challenges`,
    `  Solved (1m)     : 12`,
    `  Solved (1h)     : 487`,
    `  Avg latency     : 1.84s`,
    `  Error rate      : 2.1%`,
    `  Provider        : 2captcha`,
    `  Uptime          : 4h 22m 11s`,
    `  ─────────────────────────────────────`,
    `✓ Status check complete`,
  ],
};

const INITIAL_HISTORY: HistoryEntry[] = [
  { id: 'h-001', timestamp: '07:30:12', op: 'start',  params: '',                  status: 'success', durationMs: 1240 },
  { id: 'h-002', timestamp: '07:31:05', op: 'status', params: '',                  status: 'success', durationMs: 210  },
  { id: 'h-003', timestamp: '07:35:44', op: 'pull',   params: 'limit=5',           status: 'success', durationMs: 880  },
  { id: 'h-004', timestamp: '07:38:20', op: 'set',    params: 'timeout=30',        status: 'success', durationMs: 145  },
  { id: 'h-005', timestamp: '07:40:01', op: 'solve',  params: 'P0_eyJhbGci...',   status: 'error',   durationMs: 3100 },
  { id: 'h-006', timestamp: '07:41:55', op: 'watch',  params: 'filter=hcaptcha',  status: 'success', durationMs: 0    },
];

const SET_PRESETS = [
  { label: 'Default', value: 'timeout=30 retries=3 provider=2captcha concurrency=5' },
  { label: 'Fast',    value: 'timeout=15 retries=1 provider=anticaptcha concurrency=10' },
  { label: 'Robust',  value: 'timeout=60 retries=5 provider=2captcha concurrency=3' },
];

export default function CaptchaPanelContent() {
  const [selectedOp, setSelectedOp] = useState<CaptchaOp>('status');
  const [params, setParams] = useState('');
  const [logs, setLogs] = useState<CommandLog[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>(INITIAL_HISTORY);
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<'terminal' | 'history'>('terminal');
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  const runOperation = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setActiveTab('terminal');

    const logId = `log-${Date.now()}`;
    const ts = new Date().toLocaleTimeString('en-US', { hour12: false });
    const newLog: CommandLog = {
      id: logId,
      timestamp: ts,
      op: selectedOp,
      params,
      status: 'running',
      output: [`$ captcha ${selectedOp}${params ? ' ' + params : ''}`, `→ Running...`],
    };
    setLogs(prev => [...prev, newLog]);

    const lines = MOCK_OUTPUTS[selectedOp](params);
    const startTime = Date.now();

    for (let i = 0; i < lines.length; i++) {
      await new Promise(r => setTimeout(r, 80 + Math.random() * 120));
      setLogs(prev => prev.map(l =>
        l.id === logId
          ? { ...l, output: [`$ captcha ${selectedOp}${params ? ' ' + params : ''}`, ...lines.slice(0, i + 1)] }
          : l
      ));
    }

    const durationMs = Date.now() - startTime;
    const success = Math.random() > 0.08;

    setLogs(prev => prev.map(l =>
      l.id === logId
        ? { ...l, status: success ? 'success' : 'error', durationMs,
            output: [
              `$ captcha ${selectedOp}${params ? ' ' + params : ''}`,
              ...lines,
              success ? `✓ Completed in ${durationMs}ms` : `✗ Operation failed (exit code 1)`,
            ] }
        : l
    ));

    setHistory(prev => [{
      id: `h-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
      op: selectedOp,
      params,
      status: success ? 'success' : 'error',
      durationMs,
    }, ...prev].slice(0, 50));

    setIsRunning(false);
  };

  const clearLogs = () => setLogs([]);

  const opColor = (op: CaptchaOp) => OP_META[op].color;

  const statusDot = (s: 'success' | 'error' | 'running' | 'pending') =>
    s === 'success' ? 'var(--success)' : s === 'error' ? 'var(--error)' : s === 'running' ? 'var(--warning)' : 'var(--muted-foreground)';

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold" style={{ color: 'var(--foreground)' }}>CAPTCHA Manager</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
          Pull, watch, start, stop, set, solve, and check CAPTCHA solver status — live command feedback
        </p>
      </div>

      {/* Operation selector */}
      <div className="card-surface p-5">
        <h2 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--muted-foreground)' }}>Select Operation</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {(Object.keys(OP_META) as CaptchaOp[]).map(op => {
            const meta = OP_META[op];
            const active = selectedOp === op;
            return (
              <button
                key={op}
                onClick={() => { setSelectedOp(op); setParams(''); }}
                className="flex flex-col items-center gap-1.5 px-2 py-3 rounded-lg border transition-all text-center"
                style={{
                  backgroundColor: active ? `${meta.color}18` : 'var(--muted)',
                  borderColor: active ? meta.color : 'var(--border)',
                  color: active ? meta.color : 'var(--muted-foreground)',
                }}
              >
                <Icon name={meta.icon as Parameters<typeof Icon>[0]['name']} size={18} />
                <span className="text-xs font-semibold">{meta.label}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs" style={{ color: 'var(--muted-foreground)' }}>
          {OP_META[selectedOp].desc}
        </p>
      </div>

      {/* Params + Execute */}
      <div className="card-surface p-5">
        <h2 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--muted-foreground)' }}>
          Parameters — <span style={{ color: opColor(selectedOp) }}>{OP_META[selectedOp].label}</span>
        </h2>

        {selectedOp === 'set' && (
          <div className="flex gap-2 flex-wrap mb-3">
            {SET_PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => setParams(p.value)}
                className="text-xs px-3 py-1.5 rounded border transition-colors"
                style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)', backgroundColor: 'var(--muted)' }}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              className="input-field w-full px-3 py-2 text-sm font-mono"
              placeholder={
                selectedOp === 'pull'   ? 'limit=10  (optional)' :
                selectedOp === 'watch'  ? 'filter=hcaptcha  (optional)' :
                selectedOp === 'set'    ? 'timeout=30 retries=3 provider=2captcha' :
                selectedOp === 'solve'  ? 'Paste CAPTCHA token here...' :
                selectedOp === 'start'  ? 'workers=3  (optional)' :
                'No parameters required'
              }
              value={params}
              onChange={e => setParams(e.target.value)}
              disabled={selectedOp === 'stop' || selectedOp === 'status'}
            />
          </div>
          <button
            onClick={runOperation}
            disabled={isRunning}
            className="btn-primary px-6 py-2 text-sm flex items-center gap-2"
            style={isRunning ? {} : { backgroundColor: opColor(selectedOp) }}
          >
            {isRunning
              ? <><Icon name="ArrowPathIcon" size={14} /><span>Running...</span></>
              : <><Icon name={OP_META[selectedOp].icon as Parameters<typeof Icon>[0]['name']} size={14} /><span>Execute {OP_META[selectedOp].label}</span></>
            }
          </button>
        </div>
      </div>

      {/* Terminal + History tabs */}
      <div className="card-surface overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex gap-1">
            {(['terminal', 'history'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="px-3 py-1.5 rounded text-xs font-semibold capitalize transition-colors"
                style={{
                  backgroundColor: activeTab === tab ? 'var(--primary)' : 'transparent',
                  color: activeTab === tab ? '#fff' : 'var(--muted-foreground)',
                }}
              >
                {tab === 'terminal' ? `Terminal (${logs.length})` : `History (${history.length})`}
              </button>
            ))}
          </div>
          {activeTab === 'terminal' && logs.length > 0 && (
            <button
              onClick={clearLogs}
              className="text-xs px-2 py-1 rounded transition-colors"
              style={{ color: 'var(--muted-foreground)' }}
            >
              Clear
            </button>
          )}
        </div>

        {/* Terminal view */}
        {activeTab === 'terminal' && (
          <div
            ref={terminalRef}
            className="font-mono text-xs p-4 overflow-y-auto space-y-4"
            style={{ minHeight: '320px', maxHeight: '420px', backgroundColor: 'var(--background)', color: 'var(--foreground)' }}
          >
            {logs.length === 0 && (
              <div className="flex flex-col items-center justify-center h-48 gap-2" style={{ color: 'var(--muted-foreground)' }}>
                <Icon name="CommandLineIcon" size={28} />
                <span>Select an operation and click Execute to see live output</span>
              </div>
            )}
            {logs.map(log => (
              <div key={log.id}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: statusDot(log.status) }}
                  />
                  <span style={{ color: 'var(--muted-foreground)' }}>{log.timestamp}</span>
                  <span
                    className="px-1.5 py-0.5 rounded text-2xs font-semibold uppercase"
                    style={{ backgroundColor: `${opColor(log.op)}20`, color: opColor(log.op) }}
                  >
                    {log.op}
                  </span>
                  {log.durationMs !== undefined && (
                    <span style={{ color: 'var(--muted-foreground)' }}>{log.durationMs}ms</span>
                  )}
                </div>
                <div
                  className="pl-4 space-y-0.5 border-l-2"
                  style={{ borderColor: `${opColor(log.op)}40` }}
                >
                  {log.output.map((line, i) => (
                    <div
                      key={i}
                      style={{
                        color: line.startsWith('✓') ? 'var(--success)'
                          : line.startsWith('✗') ? 'var(--error)'
                          : line.startsWith('$') ? 'var(--accent)'
                          : line.startsWith('→') ? 'var(--muted-foreground)'
                          : line.startsWith('[EVT') ? '#a78bfa'
                          : 'var(--foreground)',
                      }}
                    >
                      {line || '\u00A0'}
                    </div>
                  ))}
                  {log.status === 'running' && (
                    <div className="flex items-center gap-1.5 mt-1" style={{ color: 'var(--warning)' }}>
                      <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--warning)' }} />
                      <span>Processing...</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* History view */}
        {activeTab === 'history' && (
          <div className="divide-y overflow-y-auto" style={{ borderColor: 'var(--border)', maxHeight: '420px' }}>
            {history.length === 0 && (
              <div className="px-5 py-10 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
                No history yet — run an operation above
              </div>
            )}
            {history.map(entry => (
              <div key={entry.id} className="px-5 py-3 flex items-center gap-4">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: entry.status === 'success' ? 'var(--success)' : 'var(--error)' }}
                />
                <span className="text-xs font-mono w-16 shrink-0" style={{ color: 'var(--muted-foreground)' }}>
                  {entry.timestamp}
                </span>
                <span
                  className="text-xs font-semibold uppercase px-2 py-0.5 rounded shrink-0"
                  style={{ backgroundColor: `${opColor(entry.op)}18`, color: opColor(entry.op) }}
                >
                  {entry.op}
                </span>
                <span className="text-xs font-mono flex-1 truncate" style={{ color: 'var(--muted-foreground)' }}>
                  {entry.params || '—'}
                </span>
                <span className="text-xs font-mono shrink-0" style={{ color: 'var(--muted-foreground)' }}>
                  {entry.durationMs > 0 ? `${entry.durationMs}ms` : 'stream'}
                </span>
                <span
                  className="text-2xs font-semibold px-2 py-0.5 rounded shrink-0"
                  style={{
                    backgroundColor: entry.status === 'success' ? 'var(--success-muted, #16a34a20)' : 'var(--error-muted, #dc262620)',
                    color: entry.status === 'success' ? 'var(--success)' : 'var(--error)',
                  }}
                >
                  {entry.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick status bar */}
      <div className="card-surface p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Worker Pool',   value: 'RUNNING',  color: 'var(--success)' },
            { label: 'Queue Depth',   value: '4',        color: 'var(--warning)' },
            { label: 'Solved (1h)',   value: '487',      color: 'var(--accent)'  },
            { label: 'Avg Latency',   value: '1.84s',    color: 'var(--foreground)' },
          ].map(stat => (
            <div key={stat.label} className="flex flex-col gap-0.5">
              <span className="text-2xs uppercase tracking-widest font-semibold" style={{ color: 'var(--muted-foreground)' }}>
                {stat.label}
              </span>
              <span className="text-lg font-semibold font-mono" style={{ color: stat.color }}>
                {stat.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
