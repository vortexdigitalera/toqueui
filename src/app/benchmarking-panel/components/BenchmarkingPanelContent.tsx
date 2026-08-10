'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';


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
}

const INITIAL_RUNS: BenchmarkRun[] = [
  {
    id: 'bm-001', label: 'Auth Token Refresh', endpoint: 'POST /auth/refresh',
    iterations: 100, concurrency: 5, status: 'done',
    avgMs: 87, minMs: 42, maxMs: 312, p95Ms: 198, successRate: 99.0,
    startedAt: '07:00:14',
  },
  {
    id: 'bm-002', label: 'Group List Fetch', endpoint: 'GET /groups/list',
    iterations: 200, concurrency: 10, status: 'done',
    avgMs: 54, minMs: 28, maxMs: 189, p95Ms: 142, successRate: 100,
    startedAt: '07:02:30',
  },
  {
    id: 'bm-003', label: 'Visa Send Stress', endpoint: 'POST /send',
    iterations: 50, concurrency: 3, status: 'error',
    avgMs: 1240, minMs: 890, maxMs: 4200, p95Ms: 3800, successRate: 72.0,
    startedAt: '07:05:00',
  },
];

const ENDPOINTS = [
  'GET /health', 'GET /groups/list', 'POST /auth/refresh',
  'POST /send', 'GET /schedule/get', 'POST /schedule/create',
  'POST /captcha/solve', 'GET /pull/status',
];

export default function BenchmarkingPanelContent() {
  const [runs, setRuns] = useState<BenchmarkRun[]>(INITIAL_RUNS);
  const [endpoint, setEndpoint] = useState(ENDPOINTS[0]);
  const [iterations, setIterations] = useState(100);
  const [concurrency, setConcurrency] = useState(5);
  const [label, setLabel] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleRun = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setProgress(0);

    const newRun: BenchmarkRun = {
      id: `bm-${String(runs.length + 1).padStart(3, '0')}`,
      label: label || endpoint,
      endpoint,
      iterations,
      concurrency,
      status: 'running',
      startedAt: new Date().toLocaleTimeString('en-US', { hour12: false }),
    };
    setRuns(prev => [newRun, ...prev]);

    for (let i = 0; i <= 100; i += 10) {
      await new Promise(r => setTimeout(r, 120));
      setProgress(i);
    }

    const success = Math.random() > 0.15;
    const avgMs = Math.floor(40 + Math.random() * 300);
    setRuns(prev => prev.map(r =>
      r.id === newRun.id
        ? {
            ...r,
            status: success ? 'done' : 'error',
            avgMs,
            minMs: Math.floor(avgMs * 0.4),
            maxMs: Math.floor(avgMs * 4.5),
            p95Ms: Math.floor(avgMs * 2.2),
            successRate: success ? +(95 + Math.random() * 5).toFixed(1) : +(60 + Math.random() * 30).toFixed(1),
          }
        : r
    ));
    setIsRunning(false);
    setProgress(0);
    setLabel('');
  };

  const statusColor = (s: BenchmarkRun['status']) =>
    s === 'done' ? 'var(--success)' : s === 'error' ? 'var(--error)' : s === 'running' ? 'var(--warning)' : 'var(--muted-foreground)';

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-3xl font-semibold" style={{ color: 'var(--foreground)' }}>Benchmarking</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
          Stress-test API endpoints — measure latency, throughput, and error rates
        </p>
      </div>

      {/* Config card */}
      <div className="card-surface p-5">
        <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--foreground)' }}>New Benchmark Run</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Endpoint</label>
            <select
              className="input-field px-3 py-2 text-sm"
              value={endpoint}
              onChange={e => setEndpoint(e.target.value)}
            >
              {ENDPOINTS.map(ep => <option key={ep} value={ep}>{ep}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Label (optional)</label>
            <input
              className="input-field px-3 py-2 text-sm"
              placeholder="e.g. Stress test v2"
              value={label}
              onChange={e => setLabel(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Iterations</label>
            <input
              type="number"
              className="input-field px-3 py-2 text-sm font-mono"
              min={1} max={1000}
              value={iterations}
              onChange={e => setIterations(Number(e.target.value))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Concurrency</label>
            <input
              type="number"
              className="input-field px-3 py-2 text-sm font-mono"
              min={1} max={50}
              value={concurrency}
              onChange={e => setConcurrency(Number(e.target.value))}
            />
          </div>
        </div>

        {isRunning && (
          <div className="mt-4">
            <div className="flex justify-between mb-1">
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Running benchmark...</span>
              <span className="text-xs font-mono" style={{ color: 'var(--accent)' }}>{progress}%</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--muted)' }}>
              <div
                className="h-full rounded-full transition-all duration-200"
                style={{ width: `${progress}%`, backgroundColor: 'var(--primary)' }}
              />
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button
            onClick={handleRun}
            disabled={isRunning}
            className="btn-primary px-5 py-2 text-sm"
          >
            <Icon name="PlayIcon" size={14} />
            {isRunning ? 'Running...' : 'Run Benchmark'}
          </button>
        </div>
      </div>

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
                {['Label', 'Endpoint', 'Iter', 'Conc', 'Avg', 'Min', 'Max', 'p95', 'Success%', 'Status'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left font-semibold" style={{ color: 'var(--muted-foreground)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {runs.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td className="px-4 py-2.5" style={{ color: 'var(--foreground)' }}>{r.label}</td>
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
