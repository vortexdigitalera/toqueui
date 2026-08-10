'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { toqueBenchRun, toqueBenchResults } from '@/lib/toque/client';
import { toast } from 'sonner';

interface BenchmarkRun {
  id: string;
  label: string;
  endpoint: string;
  iterations: number;
  concurrency: number;
  status: 'idle' | 'running' | 'done' | 'error';
  avgMs?: number;
  minMs?: number;
  maxMs?: number;
  p95Ms?: number;
  successRate?: number;
  startedAt?: string;
  httpStatus?: number;
  cliCommand?: string;
}

const ENDPOINTS = [
  'GET /health',
  'GET /groups/list',
  'POST /auth/ping',
  'POST /auth/refresh',
  'POST /send',
  'POST /pull',
  'GET /schedule/get',
  'POST /schedule/create',
  'POST /captcha/solve',
  'GET /captcha/status',
  'POST /captcha/pull',
  'GET /bench/results',
];

export default function BenchmarkingPanelContent() {
  const [runs, setRuns] = useState<BenchmarkRun[]>([]);
  const [endpoint, setEndpoint] = useState(ENDPOINTS[0]);
  const [iterations, setIterations] = useState(100);
  const [concurrency, setConcurrency] = useState(5);
  const [label, setLabel] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const [cliLog, setCliLog] = useState<string[]>([]);

  const appendLog = (line: string) =>
    setCliLog(prev => [...prev.slice(-99), line]);

  const handleRun = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setProgress(0);

    const runLabel = label || endpoint;
    const cliCmd = `toque bench run --endpoint "${endpoint}" --iter ${iterations} --concurrency ${concurrency}`;
    const newRun: BenchmarkRun = {
      id: `bm-${Date.now()}`,
      label: runLabel,
      endpoint,
      iterations,
      concurrency,
      status: 'running',
      startedAt: new Date().toLocaleTimeString('en-US', { hour12: false }),
      cliCommand: cliCmd,
    };
    setRuns(prev => [newRun, ...prev]);

    appendLog(`$ ${cliCmd}`);
    appendLog(`→ POST /bench/run  { endpoint: "${endpoint}", iterations: ${iterations}, concurrency: ${concurrency} } ...`);

    // Animate progress while waiting for real response
    const progressInterval = setInterval(() => {
      setProgress(p => Math.min(p + 8, 90));
    }, 200);

    const result = await toqueBenchRun({ endpoint, iterations, concurrency, label: runLabel });
    clearInterval(progressInterval);
    setProgress(100);

    if (result.ok && result.data) {
      const d = result.data;
      setRuns(prev => prev.map(r =>
        r.id === newRun.id
          ? {
              ...r,
              status: 'done',
              avgMs: d.avgMs,
              minMs: d.minMs,
              maxMs: d.maxMs,
              p95Ms: d.p95Ms,
              successRate: d.successRate,
              httpStatus: result.status,
            }
          : r
      ));
      appendLog(`✓ POST /bench/run → ${result.status} (${result.latencyMs}ms)`);
      appendLog(`  avg: ${d.avgMs}ms  min: ${d.minMs}ms  max: ${d.maxMs}ms  p95: ${d.p95Ms}ms  success: ${d.successRate}%`);
      toast.success(`Benchmark complete — avg ${d.avgMs}ms, ${d.successRate}% success`);
    } else {
      const errMsg = result.error || `HTTP ${result.status}`;
      setRuns(prev => prev.map(r =>
        r.id === newRun.id ? { ...r, status: 'error', httpStatus: result.status } : r
      ));
      appendLog(`✗ POST /bench/run → ${result.status || 'ERR'}: ${errMsg}`);
      toast.error('Benchmark failed: ' + errMsg);
    }

    setIsRunning(false);
    setProgress(0);
    setLabel('');
  };

  const handleLoadResults = async () => {
    setIsLoadingResults(true);
    appendLog('$ toque bench results');
    appendLog('→ GET /bench/results ...');
    const result = await toqueBenchResults();
    if (result.ok && result.data?.runs?.length) {
      const serverRuns: BenchmarkRun[] = result.data.runs.map(r => ({
        id: r.runId,
        label: r.label,
        endpoint: r.endpoint,
        iterations: r.iterations,
        concurrency: r.concurrency,
        status: r.status,
        avgMs: r.avgMs,
        minMs: r.minMs,
        maxMs: r.maxMs,
        p95Ms: r.p95Ms,
        successRate: r.successRate,
        startedAt: r.startedAt,
        cliCommand: `toque bench run --endpoint "${r.endpoint}"`,
      }));
      setRuns(serverRuns);
      appendLog(`✓ GET /bench/results → ${result.status} (${result.latencyMs}ms)  ${serverRuns.length} runs`);
      toast.success(`${serverRuns.length} benchmark runs loaded`);
    } else {
      appendLog(`✗ GET /bench/results → ${result.status || 'ERR'}: ${result.error}`);
      toast.error('Could not load results: ' + result.error);
    }
    setIsLoadingResults(false);
  };

  const statusColor = (s: BenchmarkRun['status']) =>
    s === 'done' ? 'var(--success)' : s === 'error' ? 'var(--error)' : s === 'running' ? 'var(--warning)' : 'var(--muted-foreground)';

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold" style={{ color: 'var(--foreground)' }}>Benchmarking</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Stress-test API endpoints — wired to <span className="font-mono text-xs" style={{ color: 'var(--accent)' }}>POST /bench/run · GET /bench/results</span>
          </p>
        </div>
        <button
          onClick={handleLoadResults}
          disabled={isLoadingResults}
          className="btn-ghost px-4 py-2 text-sm"
        >
          {isLoadingResults ? <LoadingSpinner size={14} /> : <Icon name="ArrowDownTrayIcon" size={14} />}
          Load Results
        </button>
      </div>

      {/* Config card */}
      <div className="card-surface p-5">
        <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--foreground)' }}>New Benchmark Run</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Endpoint</label>
            <select className="input-field px-3 py-2 text-sm" value={endpoint} onChange={e => setEndpoint(e.target.value)}>
              {ENDPOINTS.map(ep => <option key={ep} value={ep}>{ep}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Label (optional)</label>
            <input className="input-field px-3 py-2 text-sm" placeholder="e.g. Stress test v2" value={label} onChange={e => setLabel(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Iterations</label>
            <input type="number" className="input-field px-3 py-2 text-sm font-mono" min={1} max={1000} value={iterations} onChange={e => setIterations(Number(e.target.value))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Concurrency</label>
            <input type="number" className="input-field px-3 py-2 text-sm font-mono" min={1} max={50} value={concurrency} onChange={e => setConcurrency(Number(e.target.value))} />
          </div>
        </div>

        {/* CLI preview */}
        <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded font-mono text-xs" style={{ backgroundColor: 'var(--input)', border: '1px solid var(--border)' }}>
          <span style={{ color: 'var(--accent)' }}>$</span>
          <span style={{ color: 'var(--foreground)' }}>toque bench run --endpoint &quot;{endpoint}&quot; --iter {iterations} --concurrency {concurrency}</span>
        </div>

        {isRunning && (
          <div className="mt-4">
            <div className="flex justify-between mb-1">
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Running benchmark...</span>
              <span className="text-xs font-mono" style={{ color: 'var(--accent)' }}>{progress}%</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--muted)' }}>
              <div className="h-full rounded-full transition-all duration-200" style={{ width: `${progress}%`, backgroundColor: 'var(--primary)' }} />
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button onClick={handleRun} disabled={isRunning} className="btn-primary px-5 py-2 text-sm">
            <Icon name="PlayIcon" size={14} />
            {isRunning ? 'Running...' : 'Run Benchmark'}
          </button>
        </div>
      </div>

      {/* CLI log */}
      {cliLog.length > 0 && (
        <div className="card-surface overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2">
              <Icon name="CommandLineIcon" size={13} style={{ color: 'var(--accent)' }} />
              <span className="text-xs font-semibold font-mono" style={{ color: 'var(--foreground)' }}>CLI Output</span>
            </div>
            <button onClick={() => setCliLog([])} className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Clear</button>
          </div>
          <div className="p-4 font-mono text-xs space-y-0.5 overflow-y-auto" style={{ backgroundColor: '#050508', maxHeight: '140px' }}>
            {cliLog.map((line, i) => (
              <div key={`bench-log-${i}`} style={{ color: line.startsWith('✓') ? 'var(--success)' : line.startsWith('✗') ? 'var(--error)' : line.startsWith('$') ? 'var(--accent)' : 'var(--muted-foreground)' }}>
                {line}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results table */}
      <div className="card-surface overflow-hidden">
        <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Results</span>
          <span className="ml-2 text-xs font-mono" style={{ color: 'var(--muted-foreground)' }}>{runs.length} runs</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Label', 'CLI Command', 'Endpoint', 'Iter', 'Conc', 'Avg', 'Min', 'Max', 'p95', 'Success%', 'Status'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left font-semibold" style={{ color: 'var(--muted-foreground)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {runs.length === 0 && (
                <tr><td colSpan={11} className="px-4 py-6 text-center" style={{ color: 'var(--muted-foreground)' }}>No runs yet — configure and run a benchmark above</td></tr>
              )}
              {runs.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td className="px-4 py-2.5" style={{ color: 'var(--foreground)' }}>{r.label}</td>
                  <td className="px-4 py-2.5" style={{ color: 'var(--accent)', maxWidth: '180px' }}>
                    <span className="truncate block" title={r.cliCommand}>$ {r.cliCommand?.replace('toque bench run ', '')}</span>
                  </td>
                  <td className="px-4 py-2.5" style={{ color: 'var(--accent)' }}>{r.endpoint}</td>
                  <td className="px-4 py-2.5" style={{ color: 'var(--foreground)' }}>{r.iterations}</td>
                  <td className="px-4 py-2.5" style={{ color: 'var(--foreground)' }}>{r.concurrency}</td>
                  <td className="px-4 py-2.5" style={{ color: r.avgMs && r.avgMs > 200 ? 'var(--warning)' : 'var(--success)' }}>{r.avgMs ?? '—'}ms</td>
                  <td className="px-4 py-2.5" style={{ color: 'var(--success)' }}>{r.minMs ?? '—'}ms</td>
                  <td className="px-4 py-2.5" style={{ color: r.maxMs && r.maxMs > 1000 ? 'var(--error)' : 'var(--foreground)' }}>{r.maxMs ?? '—'}ms</td>
                  <td className="px-4 py-2.5" style={{ color: r.p95Ms && r.p95Ms > 500 ? 'var(--warning)' : 'var(--foreground)' }}>{r.p95Ms ?? '—'}ms</td>
                  <td className="px-4 py-2.5" style={{ color: r.successRate && r.successRate < 90 ? 'var(--error)' : 'var(--success)' }}>{r.successRate ?? '—'}%</td>
                  <td className="px-4 py-2.5">
                    <span className="px-2 py-0.5 rounded text-2xs font-semibold" style={{ backgroundColor: `${statusColor(r.status)}20`, color: statusColor(r.status) }}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
