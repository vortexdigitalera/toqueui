'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';
import Icon from '@/components/ui/AppIcon';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { toquePull, toqueGroupsList, type Group } from '@/lib/toque/client';

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
  cliCommand?: string;
  httpStatus?: number;
}

const FALLBACK_GROUPS: Group[] = [
  { id: 'GRP-001', name: 'Hajj Group Alpha 2026' },
  { id: 'GRP-002', name: 'Umrah Package Delta' },
  { id: 'GRP-003', name: 'VIP Pilgrimage Group' },
  { id: 'GRP-004', name: 'Ramadan Umrah Batch 7' },
  { id: 'GRP-005', name: 'Corporate Hajj Delegation' },
];

export default function PullingPanelContent() {
  const [jobs, setJobs] = useState<PullJob[]>([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [isPulling, setIsPulling] = useState(false);
  const [groups, setGroups] = useState<Group[]>(FALLBACK_GROUPS);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [cliLog, setCliLog] = useState<string[]>([]);

  const appendLog = (line: string) =>
    setCliLog(prev => [...prev.slice(-99), line]);

  const handleLoadGroups = async () => {
    setIsLoadingGroups(true);
    appendLog('$ toque groups list');
    appendLog('→ GET /groups/list ...');
    const result = await toqueGroupsList();
    if (result.ok && result.data?.groups?.length) {
      setGroups(result.data.groups);
      appendLog(`✓ GET /groups/list → ${result.status} (${result.latencyMs}ms)  ${result.data.groups.length} groups`);
      toast.success(`${result.data.groups.length} groups loaded from server`);
    } else {
      appendLog(`✗ GET /groups/list → ${result.status || 'ERR'}: ${result.error || 'No groups returned'} — using cached list`);
      toast.error('Could not load groups from server — using cached list');
    }
    setIsLoadingGroups(false);
  };

  const handlePull = async (groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    const jobId = `pull-${Date.now()}`;
    const newJob: PullJob = {
      id: jobId,
      groupId,
      groupName: group.name,
      status: 'pulling',
      startedAt: new Date().toLocaleTimeString('en-US', { hour12: false }),
      cliCommand: `toque pull ${groupId}`,
    };
    setJobs(prev => [newJob, ...prev]);
    setIsPulling(true);

    appendLog(`$ toque pull ${groupId}`);
    appendLog(`→ POST /pull  { groupId: "${groupId}" } ...`);

    const result = await toquePull(groupId);
    const completedAt = new Date().toLocaleTimeString('en-US', { hour12: false });

    if (result.ok && result.data) {
      const d = result.data;
      setJobs(prev => prev.map(j =>
        j.id === jobId ? {
          ...j,
          status: 'done',
          pulledCount: d.pulledCount,
          totalCount: d.totalCount,
          completedAt,
          durationMs: d.durationMs || result.latencyMs,
          httpStatus: result.status,
        } : j
      ));
      appendLog(`✓ POST /pull → ${result.status} (${result.latencyMs}ms)  pulled: ${d.pulledCount}/${d.totalCount}`);
      toast.success(`Pull complete — ${d.pulledCount} pilgrims pulled for ${group.name}`);
    } else {
      const errMsg = result.error || `HTTP ${result.status}`;
      setJobs(prev => prev.map(j =>
        j.id === jobId ? {
          ...j,
          status: 'error',
          completedAt,
          durationMs: result.latencyMs,
          errorMsg: errMsg,
          httpStatus: result.status,
        } : j
      ));
      appendLog(`✗ POST /pull → ${result.status || 'ERR'}: ${errMsg}`);
      toast.error(`Pull failed for ${group.name}: ${errMsg}`);
    }

    setIsPulling(false);
    setSelectedGroup('');
  };

  const handlePullAll = async () => {
    for (const g of groups) {
      await handlePull(g.id);
    }
  };

  const statusColor = (s: PullJob['status']) =>
    s === 'done' ? 'var(--success)' : s === 'error' ? 'var(--error)' : s === 'pulling' ? 'var(--warning)' : 'var(--muted-foreground)';

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-3xl font-semibold" style={{ color: 'var(--foreground)' }}>Pulling</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
          Pull pilgrim data from Masar Nusuk — wired to <span className="font-mono text-xs" style={{ color: 'var(--accent)' }}>POST /pull · GET /groups/list</span>
        </p>
      </div>

      {/* Pull trigger */}
      <div className="card-surface p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Trigger Pull</h2>
          <button
            type="button"
            onClick={handleLoadGroups}
            disabled={isLoadingGroups}
            className="btn-ghost px-3 py-1.5 text-xs"
          >
            {isLoadingGroups ? <LoadingSpinner size={12} /> : <Icon name="ArrowPathIcon" size={12} />}
            {isLoadingGroups ? 'Loading...' : 'Reload Groups'}
          </button>
        </div>
        <div className="flex gap-3 flex-wrap">
          <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
            <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Select Group</label>
            <select
              className="input-field px-3 py-2 text-sm"
              value={selectedGroup}
              onChange={e => setSelectedGroup(e.target.value)}
            >
              <option value="">— choose group —</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name} ({g.id})</option>)}
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
              onClick={handlePullAll}
              disabled={isPulling}
              className="btn-ghost px-5 py-2 text-sm"
            >
              <Icon name="ArrowPathIcon" size={14} />
              Pull All Groups
            </button>
          </div>
        </div>
      </div>

      {/* CLI Terminal */}
      {cliLog.length > 0 && (
        <div className="card-surface overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2">
              <Icon name="CommandLineIcon" size={13} style={{ color: 'var(--accent)' }} />
              <span className="text-xs font-semibold font-mono" style={{ color: 'var(--foreground)' }}>CLI Output</span>
            </div>
            <button onClick={() => setCliLog([])} className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Clear</button>
          </div>
          <div
            className="p-4 font-mono text-xs space-y-0.5 overflow-y-auto"
            style={{ backgroundColor: '#050508', maxHeight: '160px' }}
          >
            {cliLog.map((line, i) => (
              <div
                key={`pull-log-${i}`}
                style={{
                  color: line.startsWith('✓') ? 'var(--success)'
                    : line.startsWith('✗') ? 'var(--error)'
                    : line.startsWith('$') ? 'var(--accent)'
                    : 'var(--muted-foreground)',
                }}
              >
                {line}
              </div>
            ))}
          </div>
        </div>
      )}

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
          {jobs.map(job => (
            <div key={job.id} className="px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{job.groupName}</span>
                    <span className="text-2xs font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}>{job.groupId}</span>
                    {job.cliCommand && (
                      <span className="text-2xs font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(99,102,241,0.1)', color: 'var(--accent)', border: '1px solid rgba(99,102,241,0.2)' }}>
                        $ {job.cliCommand}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs font-mono" style={{ color: 'var(--muted-foreground)' }}>
                    <span>ID: {job.id}</span>
                    {job.startedAt && <span>Started: {job.startedAt}</span>}
                    {job.completedAt && <span>Done: {job.completedAt}</span>}
                    {job.durationMs && <span>{job.durationMs}ms</span>}
                    {job.httpStatus && <span>HTTP {job.httpStatus}</span>}
                  </div>
                  {job.errorMsg && (
                    <p className="mt-1.5 text-xs" style={{ color: 'var(--error)' }}>⚠ {job.errorMsg}</p>
                  )}
                  {job.status === 'pulling' && (
                    <div className="mt-2 flex items-center gap-2">
                      <LoadingSpinner size={12} />
                      <span className="text-xs" style={{ color: 'var(--warning)' }}>Pulling from Nusuk...</span>
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
          ))}
        </div>
      </div>

      {/* CLI Reference */}
      <div className="card-surface p-4">
        <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--muted-foreground)' }}>CLI Commands</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {[
            { cmd: 'toque pull <groupId>', http: 'POST /pull { groupId }', desc: 'Pull pilgrim data for a specific group' },
            { cmd: 'toque groups list', http: 'GET /groups/list', desc: 'Fetch all available pilgrim groups' },
          ].map(item => (
            <div key={item.cmd} className="p-3 rounded-lg" style={{ backgroundColor: 'var(--input)', border: '1px solid var(--border)' }}>
              <p className="font-mono text-xs font-bold mb-1" style={{ color: 'var(--accent)' }}>$ {item.cmd}</p>
              <p className="font-mono text-xs mb-1" style={{ color: 'var(--muted-foreground)' }}>→ {item.http}</p>
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
