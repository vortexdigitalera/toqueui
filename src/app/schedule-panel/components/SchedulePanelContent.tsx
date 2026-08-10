'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import Icon from '@/components/ui/AppIcon';
import SectionCard from '@/components/ui/SectionCard';
import StatusBadge from '@/components/ui/StatusBadge';
import JsonViewer from '@/components/ui/JsonViewer';
import TimingDisplay from '@/components/ui/TimingDisplay';
import Toggle from '@/components/ui/Toggle';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorAlert from '@/components/ui/ErrorAlert';
import SkeletonBlock from '@/components/ui/SkeletonBlock';

type WorkflowStatus = 'pending' | 'running' | 'success' | 'error' | 'cancelled';

interface ScheduledWorkflow {
  id: string;
  groupId: string;
  groupName: string;
  scheduledTime: string;
  status: WorkflowStatus;
  pullBefore: boolean;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  latencyMs?: number;
  visasSent?: number;
  errorCode?: string;
}

interface ScheduleFormValues {
  targetTime: string;
  groupId: string;
}

// Mock pilgrim groups — backend: GET /groups/list
const MOCK_GROUPS = [
  { id: 'GRP-001', name: 'Hajj Group Alpha 2026' },
  { id: 'GRP-002', name: 'Umrah Package Delta' },
  { id: 'GRP-003', name: 'VIP Pilgrimage Group' },
  { id: 'GRP-004', name: 'Ramadan Umrah Batch 7' },
  { id: 'GRP-005', name: 'Corporate Hajj Delegation' },
];

// Mock active workflows — backend: GET /schedule/get
const INITIAL_WORKFLOWS: ScheduledWorkflow[] = [
  {
    id: 'WF-001',
    groupId: 'GRP-001',
    groupName: 'Hajj Group Alpha 2026',
    scheduledTime: '14:30:00.000',
    status: 'pending',
    pullBefore: true,
    createdAt: '2026-08-10T06:00:00Z',
  },
  {
    id: 'WF-002',
    groupId: 'GRP-002',
    groupName: 'Umrah Package Delta',
    scheduledTime: '09:00:00.000',
    status: 'running',
    pullBefore: false,
    createdAt: '2026-08-10T05:45:00Z',
    startedAt: '2026-08-10T09:00:00Z',
  },
  {
    id: 'WF-003',
    groupId: 'GRP-003',
    groupName: 'VIP Pilgrimage Group',
    scheduledTime: '07:00:00.000',
    status: 'success',
    pullBefore: true,
    createdAt: '2026-08-10T04:30:00Z',
    startedAt: '2026-08-10T07:00:00Z',
    completedAt: '2026-08-10T07:00:00.214Z',
    latencyMs: 214,
    visasSent: 8,
  },
  {
    id: 'WF-004',
    groupId: 'GRP-004',
    groupName: 'Ramadan Umrah Batch 7',
    scheduledTime: '06:30:00.000',
    status: 'error',
    pullBefore: true,
    createdAt: '2026-08-10T04:00:00Z',
    startedAt: '2026-08-10T06:30:00Z',
    completedAt: '2026-08-10T06:30:03.201Z',
    latencyMs: 3201,
    errorCode: 'AUTH_TOKEN_EXPIRED',
  },
  {
    id: 'WF-005',
    groupId: 'GRP-005',
    groupName: 'Corporate Hajj Delegation',
    scheduledTime: '15:00:00.000',
    status: 'pending',
    pullBefore: true,
    createdAt: '2026-08-10T07:00:00Z',
  },
  {
    id: 'WF-006',
    groupId: 'GRP-001',
    groupName: 'Hajj Group Alpha 2026',
    scheduledTime: '22:00:00.000',
    status: 'cancelled',
    pullBefore: false,
    createdAt: '2026-08-09T18:00:00Z',
  },
];

function formatTimestamp(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
    hour12: false,
  });
}

export default function SchedulePanelContent() {
  const [workflows, setWorkflows] = useState<ScheduledWorkflow[]>(INITIAL_WORKFLOWS);
  const [pullBefore, setPullBefore] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [lastCreated, setLastCreated] = useState<ScheduledWorkflow | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);
  const [statusFilter, setStatusFilter] = useState<WorkflowStatus | 'all'>('all');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<ScheduleFormValues>({
    defaultValues: { targetTime: '', groupId: '' },
  });

  const watchedGroupId = watch('groupId');

  const handleSelectGroup = (group: typeof MOCK_GROUPS[0]) => {
    setValue('groupId', group.id);
    setSelectedGroup(group.name);
    setShowGroupDropdown(false);
  };

  const onCreateSchedule = handleSubmit(async (data) => {
    setIsCreating(true);
    setCreateError(null);

    // Backend integration point: POST /schedule/create { groupId, targetTime, pullBefore }
    await new Promise(r => setTimeout(r, 900));

    const success = Math.random() > 0.08;
    if (success) {
      const group = MOCK_GROUPS.find(g => g.id === data.groupId);
      const newWorkflow: ScheduledWorkflow = {
        id: `WF-${String(workflows.length + 1).padStart(3, '0')}`,
        groupId: data.groupId,
        groupName: group?.name ?? data.groupId,
        scheduledTime: data.targetTime,
        status: 'pending',
        pullBefore,
        createdAt: new Date().toISOString(),
      };
      setWorkflows(prev => [newWorkflow, ...prev]);
      setLastCreated(newWorkflow);
      toast.success(`Workflow ${newWorkflow.id} scheduled for ${data.targetTime}`);
      reset();
      setSelectedGroup('');
      setPullBefore(true);
    } else {
      setCreateError('POST /schedule/create returned 500 — Cloudflare Workflow creation failed. Check Worker logs and ensure the container is running.');
      toast.error('Workflow creation failed');
    }

    setIsCreating(false);
  });

  const handleRefreshWorkflows = async () => {
    setIsRefreshing(true);
    // Backend integration point: GET /schedule/get
    await new Promise(r => setTimeout(r, 700));
    setIsRefreshing(false);
    toast.success('Workflows refreshed — 6 active workflows');
  };

  const handleCancelWorkflow = async (workflowId: string) => {
    setCancellingId(workflowId);
    setConfirmCancelId(null);
    // Backend integration point: POST /schedule/cancel { workflowId }
    await new Promise(r => setTimeout(r, 600));
    setWorkflows(prev =>
      prev.map(w => w.id === workflowId ? { ...w, status: 'cancelled' as WorkflowStatus } : w)
    );
    setCancellingId(null);
    toast.success(`Workflow ${workflowId} cancelled`);
  };

  const filteredWorkflows = statusFilter === 'all'
    ? workflows
    : workflows.filter(w => w.status === statusFilter);

  const pendingCount = workflows.filter(w => w.status === 'pending').length;
  const runningCount = workflows.filter(w => w.status === 'running').length;
  const successCount = workflows.filter(w => w.status === 'success').length;
  const errorCount = workflows.filter(w => w.status === 'error').length;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold" style={{ color: 'var(--foreground)' }}>
            Schedule
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Create and manage time-triggered visa send workflows via Cloudflare Workers
          </p>
        </div>
        <div className="flex items-center gap-3">
          {pendingCount > 0 && (
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{ backgroundColor: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)' }}
            >
              <span className="w-2 h-2 rounded-full pulse-dot" style={{ backgroundColor: 'var(--primary)' }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>
                {pendingCount} pending
              </span>
            </div>
          )}
          {runningCount > 0 && (
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{ backgroundColor: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)' }}
            >
              <span className="w-2 h-2 rounded-full pulse-dot" style={{ backgroundColor: 'var(--success)' }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--success)' }}>
                {runningCount} running
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Pending', value: pendingCount, color: 'var(--warning)', icon: 'ClockIcon', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.15)' },
          { label: 'Running', value: runningCount, color: 'var(--accent)', icon: 'PlayIcon', bg: 'rgba(99,102,241,0.06)', border: 'rgba(99,102,241,0.15)' },
          { label: 'Completed', value: successCount, color: 'var(--success)', icon: 'CheckCircleIcon', bg: 'rgba(34,197,94,0.06)', border: 'rgba(34,197,94,0.15)' },
          { label: 'Failed', value: errorCount, color: errorCount > 0 ? 'var(--error)' : 'var(--muted-foreground)', icon: 'XCircleIcon', bg: errorCount > 0 ? 'rgba(239,68,68,0.06)' : 'var(--card)', border: errorCount > 0 ? 'rgba(239,68,68,0.15)' : 'var(--border)' },
        ].map(stat => (
          <div
            key={`sched-stat-${stat.label}`}
            className="p-4 rounded-lg"
            style={{ backgroundColor: stat.bg, border: `1px solid ${stat.border}` }}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <Icon name={stat.icon as Parameters<typeof Icon>[0]['name']} size={14} />
              <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted-foreground)', fontSize: '10px', letterSpacing: '0.07em' }}>
                {stat.label}
              </span>
            </div>
            <p className="font-mono font-bold text-3xl tabular-nums" style={{ color: stat.color }}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        {/* Create workflow form */}
        <div className="xl:col-span-2 space-y-4">
          <SectionCard
            title="Create Scheduled Send"
            description="Schedule a visa send for a precise target time"
          >
            <form onSubmit={onCreateSchedule} className="space-y-5">
              {/* Target time */}
              <div>
                <label htmlFor="targetTime" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>
                  Target Time (UTC)
                </label>
                <p className="text-xs mb-2" style={{ color: 'var(--muted-foreground)' }}>
                  Sub-millisecond precision — format: HH:MM:SS.mmm (24-hour UTC)
                </p>
                <input
                  id="targetTime"
                  type="text"
                  className="input-field w-full px-3 py-2.5 font-mono text-sm"
                  placeholder="14:30:00.000"
                  {...register('targetTime', {
                    required: 'Target time is required',
                    pattern: {
                      value: /^\d{2}:\d{2}:\d{2}\.\d{3}$/,
                      message: 'Must be in HH:MM:SS.mmm format (e.g. 14:30:00.000)',
                    },
                  })}
                />
                {errors.targetTime && (
                  <p className="mt-1.5 text-xs" style={{ color: 'var(--error)' }}>
                    {errors.targetTime.message}
                  </p>
                )}

                {/* Quick presets */}
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {['09:00:00.000', '12:00:00.000', '14:30:00.000', '18:00:00.000', '22:00:00.000'].map(t => (
                    <button
                      key={`preset-${t}`}
                      type="button"
                      onClick={() => setValue('targetTime', t)}
                      className="font-mono px-2 py-1 rounded text-2xs transition-colors duration-100"
                      style={{
                        backgroundColor: watch('targetTime') === t ? 'rgba(99,102,241,0.2)' : 'var(--input)',
                        color: watch('targetTime') === t ? 'var(--accent)' : 'var(--muted-foreground)',
                        border: `1px solid ${watch('targetTime') === t ? 'rgba(99,102,241,0.4)' : 'var(--border)'}`,
                        fontSize: '10px',
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Group ID */}
              <div>
                <label htmlFor="schedGroupId" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>
                  Group ID
                </label>
                <p className="text-xs mb-2" style={{ color: 'var(--muted-foreground)' }}>
                  Target pilgrim group for the scheduled visa send
                </p>

                <div className="relative mb-2">
                  <button
                    type="button"
                    onClick={() => setShowGroupDropdown(v => !v)}
                    className="btn-ghost w-full px-3 py-2.5 text-sm justify-between"
                  >
                    <span style={{ color: selectedGroup ? 'var(--foreground)' : 'var(--muted-foreground)', fontSize: '13px' }}>
                      {selectedGroup || 'Select group...'}
                    </span>
                    <Icon name="ChevronDownIcon" size={14} />
                  </button>

                  {showGroupDropdown && (
                    <div
                      className="absolute top-full left-0 right-0 mt-1 rounded-lg z-20 overflow-hidden animate-fade-in"
                      style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}
                    >
                      {MOCK_GROUPS.map(group => (
                        <button
                          key={`sched-group-${group.id}`}
                          type="button"
                          onClick={() => handleSelectGroup(group)}
                          className="w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors duration-100"
                          style={{ borderBottom: '1px solid var(--border)' }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--muted)')}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          <div>
                            <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{group.name}</p>
                            <p className="text-xs font-mono" style={{ color: 'var(--muted-foreground)' }}>{group.id}</p>
                          </div>
                          {watchedGroupId === group.id && <Icon name="CheckIcon" size={14} />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <input
                  id="schedGroupId"
                  type="text"
                  className="input-field w-full px-3 py-2.5 font-mono text-sm"
                  placeholder="GRP-001"
                  {...register('groupId', {
                    required: 'Group ID is required',
                    pattern: {
                      value: /^[A-Z0-9\-_]+$/i,
                      message: 'Group ID must be alphanumeric',
                    },
                  })}
                />
                {errors.groupId && (
                  <p className="mt-1.5 text-xs" style={{ color: 'var(--error)' }}>
                    {errors.groupId.message}
                  </p>
                )}
              </div>

              {/* Pull Before toggle */}
              <div
                className="p-3 rounded-lg"
                style={{ backgroundColor: 'var(--input)', border: '1px solid var(--border)' }}
              >
                <Toggle
                  checked={pullBefore}
                  onChange={setPullBefore}
                  label="Pull Before Send"
                  description="Refresh credentials (auth, captcha, entityId) immediately before executing the visa send at the scheduled time"
                  id="pull-before-toggle"
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isCreating}
                className="btn-primary w-full py-3 text-sm font-semibold"
              >
                {isCreating ? (
                  <>
                    <LoadingSpinner size={16} />
                    Creating workflow...
                  </>
                ) : (
                  <>
                    <Icon name="CalendarDaysIcon" size={16} />
                    Schedule Send — POST /schedule/create
                  </>
                )}
              </button>
            </form>
          </SectionCard>

          {/* Create error */}
          {createError && (
            <ErrorAlert
              message="Workflow creation failed"
              detail={createError}
              onRetry={() => handleSubmit(onCreateSchedule as never)()}
            />
          )}

          {/* Last created workflow */}
          {lastCreated && (
            <SectionCard title="Workflow Created" headerRight={<StatusBadge status="pending" />}>
              <JsonViewer
                data={{
                  workflowId: lastCreated.id,
                  groupId: lastCreated.groupId,
                  scheduledTime: lastCreated.scheduledTime,
                  pullBefore: lastCreated.pullBefore,
                  createdAt: lastCreated.createdAt,
                  status: 'pending',
                }}
                maxHeight={200}
                title="POST /schedule/create response"
              />
            </SectionCard>
          )}
        </div>

        {/* Workflows table */}
        <div className="xl:col-span-3">
          <SectionCard
            title="Active Workflows"
            description="Cloudflare Workflow instances — scheduled, running, and recent"
            headerRight={
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRefreshWorkflows}
                  disabled={isRefreshing}
                  className="btn-ghost px-3 py-1.5 text-xs"
                >
                  {isRefreshing ? <LoadingSpinner size={12} /> : <Icon name="ArrowPathIcon" size={13} />}
                  {isRefreshing ? 'Refreshing...' : 'Refresh'}
                </button>
                <span className="font-mono text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}>
                  {filteredWorkflows.length} workflows
                </span>
              </div>
            }
            noPadding
          >
            {/* Filter tabs */}
            <div
              className="flex gap-1 px-4 py-3 overflow-x-auto"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              {(['all', 'pending', 'running', 'success', 'error', 'cancelled'] as const).map(f => (
                <button
                  key={`filter-${f}`}
                  onClick={() => setStatusFilter(f)}
                  className="px-3 py-1 rounded text-xs font-medium transition-all duration-150 whitespace-nowrap"
                  style={{
                    backgroundColor: statusFilter === f ? 'rgba(99,102,241,0.15)' : 'transparent',
                    color: statusFilter === f ? 'var(--accent)' : 'var(--muted-foreground)',
                    border: `1px solid ${statusFilter === f ? 'rgba(99,102,241,0.3)' : 'transparent'}`,
                  }}
                >
                  {f === 'all' ? `All (${workflows.length})` : `${f.charAt(0).toUpperCase() + f.slice(1)} (${workflows.filter(w => w.status === f).length})`}
                </button>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Workflow ID', 'Group', 'Target Time', 'Pull?', 'Status', 'Result', 'Actions'].map(col => (
                      <th
                        key={`sched-th-${col}`}
                        className="text-left px-4 py-3 font-medium"
                        style={{ color: 'var(--muted-foreground)', fontSize: '11px', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isRefreshing ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <tr key={`skel-row-${i + 1}`} style={{ borderBottom: '1px solid var(--border)' }}>
                        {Array.from({ length: 7 }).map((__, j) => (
                          <td key={`skel-cell-${i + 1}-${j + 1}`} className="px-4 py-3">
                            <SkeletonBlock height={14} width={j === 0 ? '70px' : j === 1 ? '120px' : '60px'} />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : filteredWorkflows.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <Icon name="CalendarDaysIcon" size={32} />
                          <p className="mt-3 text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                            No {statusFilter !== 'all' ? statusFilter : ''} workflows
                          </p>
                          <p className="mt-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                            {statusFilter === 'all' ?'Create a scheduled send using the form to the left'
                              : `No workflows with status "${statusFilter}" found`}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredWorkflows.map((wf, idx) => (
                      <tr
                        key={wf.id}
                        className="transition-colors duration-100"
                        style={{
                          borderBottom: '1px solid var(--border)',
                          backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.04)')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)')}
                      >
                        {/* Workflow ID */}
                        <td className="px-4 py-3 font-mono text-xs font-semibold" style={{ color: 'var(--accent)', whiteSpace: 'nowrap' }}>
                          {wf.id}
                        </td>

                        {/* Group */}
                        <td className="px-4 py-3" style={{ maxWidth: '140px' }}>
                          <p className="text-xs font-medium truncate" style={{ color: 'var(--foreground)' }}>
                            {wf.groupName}
                          </p>
                          <p className="text-2xs font-mono" style={{ color: 'var(--muted-foreground)' }}>
                            {wf.groupId}
                          </p>
                        </td>

                        {/* Target time */}
                        <td className="px-4 py-3 font-mono text-xs font-semibold" style={{ color: 'var(--foreground)', whiteSpace: 'nowrap' }}>
                          {wf.scheduledTime}
                        </td>

                        {/* Pull before */}
                        <td className="px-4 py-3">
                          <span
                            className="inline-flex items-center gap-1 text-2xs font-semibold px-1.5 py-0.5 rounded"
                            style={{
                              backgroundColor: wf.pullBefore ? 'rgba(34,197,94,0.1)' : 'rgba(100,116,139,0.1)',
                              color: wf.pullBefore ? 'var(--success)' : 'var(--muted-foreground)',
                              border: `1px solid ${wf.pullBefore ? 'rgba(34,197,94,0.2)' : 'rgba(100,116,139,0.15)'}`,
                            }}
                          >
                            {wf.pullBefore ? '✓ Yes' : '✗ No'}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          <StatusBadge status={wf.status as 'pending' | 'running' | 'success' | 'error' | 'cancelled'} />
                        </td>

                        {/* Result */}
                        <td className="px-4 py-3 font-mono text-xs" style={{ whiteSpace: 'nowrap' }}>
                          {wf.status === 'success' && wf.latencyMs !== undefined && (
                            <div className="flex items-center gap-1.5">
                              <TimingDisplay ms={wf.latencyMs} showLabel={false} />
                              <span style={{ color: 'var(--success)' }}>{wf.visasSent}v</span>
                            </div>
                          )}
                          {wf.status === 'error' && (
                            <span style={{ color: 'var(--error)', fontSize: '10px' }}>{wf.errorCode}</span>
                          )}
                          {wf.status === 'running' && (
                            <span className="flex items-center gap-1" style={{ color: 'var(--accent)' }}>
                              <LoadingSpinner size={10} />
                              <span style={{ fontSize: '10px' }}>In progress</span>
                            </span>
                          )}
                          {(wf.status === 'pending' || wf.status === 'cancelled') && (
                            <span style={{ color: 'var(--muted-foreground)', fontSize: '10px' }}>—</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3">
                          {(wf.status === 'pending' || wf.status === 'running') && (
                            <>
                              {confirmCancelId === wf.id ? (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => handleCancelWorkflow(wf.id)}
                                    disabled={cancellingId === wf.id}
                                    className="btn-danger px-2 py-1"
                                    style={{ fontSize: '11px' }}
                                  >
                                    {cancellingId === wf.id ? <LoadingSpinner size={10} /> : 'Confirm'}
                                  </button>
                                  <button
                                    onClick={() => setConfirmCancelId(null)}
                                    className="btn-ghost px-2 py-1"
                                    style={{ fontSize: '11px' }}
                                  >
                                    Keep
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setConfirmCancelId(wf.id)}
                                  className="btn-ghost px-2.5 py-1.5"
                                  style={{ fontSize: '11px', color: 'var(--error)', borderColor: 'rgba(239,68,68,0.25)' }}
                                  title={`Cancel workflow ${wf.id} — this cannot be undone`}
                                >
                                  <Icon name="XMarkIcon" size={12} />
                                  Cancel
                                </button>
                              )}
                            </>
                          )}
                          {(wf.status === 'success' || wf.status === 'error' || wf.status === 'cancelled') && (
                            <span className="text-2xs font-mono" style={{ color: 'var(--muted-foreground)' }}>
                              {mounted ? formatTimestamp(wf.completedAt ?? wf.createdAt) : '—'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      </div>

      {/* Schedule configuration reference */}
      <SectionCard
        title="Workflow Configuration Reference"
        description="How Cloudflare Workflow scheduling works in Toque"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              icon: 'ClockIcon',
              title: 'Time Precision',
              body: 'Target times are specified in HH:MM:SS.mmm format (UTC). The Cloudflare Worker will execute the visa send at the exact millisecond specified.',
              accent: 'var(--accent)',
            },
            {
              icon: 'ArrowPathIcon',
              title: 'Pull Before Send',
              body: 'When enabled, the workflow automatically runs a full credential refresh (auth token, captcha, entityId) immediately before executing the visa send. Recommended for schedules more than 30 minutes out.',
              accent: 'var(--success)',
            },
            {
              icon: 'ExclamationTriangleIcon',
              title: 'Cancellation',
              body: 'Pending workflows can be cancelled at any time before execution. Running workflows may have already sent visas — cancellation stops any retry logic but cannot reverse completed sends.',
              accent: 'var(--warning)',
            },
          ].map(item => (
            <div
              key={`ref-${item.title}`}
              className="p-4 rounded-lg"
              style={{ backgroundColor: 'var(--input)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="w-7 h-7 rounded flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${item.accent}18`, border: `1px solid ${item.accent}30` }}
                >
                  <Icon name={item.icon as Parameters<typeof Icon>[0]['name']} size={14} />
                </div>
                <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                  {item.title}
                </p>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}