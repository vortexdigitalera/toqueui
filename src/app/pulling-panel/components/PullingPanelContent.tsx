'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';

interface PullJob {
  id: string;
  groupId: string;
  groupName: string;
  status: 'idle' | 'pulling' | 'done' | 'error';
  pulledCount?: number;
  totalCount?: number;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  errorMsg?: string;
}

const MOCK_GROUPS = [
  { id: 'GRP-001', name: 'Hajj Group Alpha 2026' },
  { id: 'GRP-002', name: 'Umrah Package Delta' },
  { id: 'GRP-003', name: 'VIP Pilgrimage Group' },
  { id: 'GRP-004', name: 'Ramadan Umrah Batch 7' },
  { id: 'GRP-005', name: 'Corporate Hajj Delegation' },
];

const INITIAL_JOBS: PullJob[] = [
  {
    id: 'pull-001', groupId: 'GRP-003', groupName: 'VIP Pilgrimage Group',
    status: 'done', pulledCount: 12, totalCount: 12,
    startedAt: '06:55:00', completedAt: '06:55:04', durationMs: 4210,
  },
  {
    id: 'pull-002', groupId: 'GRP-004', groupName: 'Ramadan Umrah Batch 7',
    status: 'error', pulledCount: 3, totalCount: 18,
    startedAt: '07:01:00', errorMsg: 'Session expired — re-authenticate and retry',
  },
];

export default function PullingPanelContent() {
  const [jobs, setJobs] = useState<PullJob[]>(INITIAL_JOBS);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [isPulling, setIsPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState<Record<string, number>>({});

  const handlePull = async (groupId: string) => {
    const group = MOCK_GROUPS.find(g => g.id === groupId);
    if (!group) return;

    const jobId = `pull-${String(jobs.length + 1).padStart(3, '0')}`;
    const total = Math.floor(8 + Math.random() * 15);
    const newJob: PullJob = {
      id: jobId, groupId, groupName: group.name,
      status: 'pulling', totalCount: total,
      startedAt: new Date().toLocaleTimeString('en-US', { hour12: false }),
    };
    setJobs(prev => [newJob, ...prev]);
    setIsPulling(true);

    for (let i = 1; i <= total; i++) {
      await new Promise(r => setTimeout(r, 150 + Math.random() * 100));
      setPullProgress(prev => ({ ...prev, [jobId]: i }));
    }

    const success = Math.random() > 0.15;
    const durationMs = Math.floor(total * 200 + Math.random() * 500);
    setJobs(prev => prev.map(j =>
      j.id === jobId
        ? {
            ...j,
            status: success ? 'done' : 'error',
            pulledCount: success ? total : Math.floor(total * 0.4),
            completedAt: new Date().toLocaleTimeString('en-US', { hour12: false }),
            durationMs,
            errorMsg: success ? undefined : 'Pilgrim data fetch failed — CAPTCHA challenge detected',
          }
        : j
    ));
    setPullProgress(prev => { const n = { ...prev }; delete n[jobId]; return n; });
    setIsPulling(false);
    setSelectedGroup('');
  };

  const statusColor = (s: PullJob['status']) =>
    s === 'done' ? 'var(--success)' : s === 'error' ? 'var(--error)' : s === 'pulling' ? 'var(--warning)' : 'var(--muted-foreground)';

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-3xl font-semibold" style={{ color: 'var(--foreground)' }}>Pulling</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
          Pull pilgrim data from Masar Nusuk for selected groups — backend: POST /pull
        </p>
      </div>

      {/* Pull trigger */}
      <div className="card-surface p-5">
        <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--foreground)' }}>Trigger Pull</h2>
        <div className="flex gap-3 flex-wrap">
          <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Select Group</label>
            <select
              className="input-field px-3 py-2 text-sm"
              value={selectedGroup}
              onChange={e => setSelectedGroup(e.target.value)}
            >
              <option value="">— choose group —</option>
              {MOCK_GROUPS.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => selectedGroup && handlePull(selectedGroup)}
              disabled={!selectedGroup || isPulling}
              className="btn-primary px-5 py-2 text-sm"
            >
              <Icon name="ArrowDownTrayIcon" size={14} />
              {isPulling ? 'Pulling...' : 'Pull Data'}
            </button>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => MOCK_GROUPS.forEach((g, i) => setTimeout(() => handlePull(g.id), i * 200))}
              disabled={isPulling}
              className="btn-ghost px-5 py-2 text-sm"
            >
              <Icon name="ArrowPathIcon" size={14} />
              Pull All Groups
            </button>
          </div>
        </div>
      </div>

      {/* Jobs list */}
      <div className="card-surface overflow-hidden">
        <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Pull Jobs</span>
          <span className="text-xs font-mono" style={{ color: 'var(--muted-foreground)' }}>{jobs.length} total</span>
        </div>
        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {jobs.length === 0 && (
            <div className="px-5 py-8 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
              No pull jobs yet — trigger a pull above
            </div>
          )}
          {jobs.map(job => {
            const prog = pullProgress[job.id];
            const pct = prog && job.totalCount ? Math.round((prog / job.totalCount) * 100) : null;
            return (
              <div key={job.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{job.groupName}</span>
                      <span className="text-2xs font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}>{job.groupId}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs font-mono" style={{ color: 'var(--muted-foreground)' }}>
                      <span>ID: {job.id}</span>
                      {job.startedAt && <span>Started: {job.startedAt}</span>}
                      {job.completedAt && <span>Done: {job.completedAt}</span>}
                      {job.durationMs && <span>{job.durationMs}ms</span>}
                    </div>
                    {job.errorMsg && (
                      <p className="mt-1.5 text-xs" style={{ color: 'var(--error)' }}>⚠ {job.errorMsg}</p>
                    )}
                    {pct !== null && (
                      <div className="mt-2">
                        <div className="flex justify-between mb-1">
                          <span className="text-2xs" style={{ color: 'var(--muted-foreground)' }}>Pulling {prog}/{job.totalCount}</span>
                          <span className="text-2xs font-mono" style={{ color: 'var(--accent)' }}>{pct}%</span>
                        </div>
                        <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--muted)' }}>
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: 'var(--primary)' }} />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="px-2 py-0.5 rounded text-2xs font-semibold" style={{ backgroundColor: `${statusColor(job.status)}20`, color: statusColor(job.status) }}>
                      {job.status}
                    </span>
                    {job.pulledCount !== undefined && job.totalCount !== undefined && (
                      <span className="text-xs font-mono" style={{ color: 'var(--muted-foreground)' }}>
                        {job.pulledCount}/{job.totalCount} pilgrims
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
