'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
import {
  toqueScheduleCreate,
  toqueScheduleGet,
  toqueScheduleCancel,
  toqueGroupsList,
  type ScheduledWorkflow,
  type ScheduleCreatePayload,
  type Group,
} from '@/lib/toque/client';

type WorkflowStatus = 'pending' | 'running' | 'success' | 'error' | 'cancelled';

interface ScheduleFormValues {
  targetTime: string;
  targetDate: string;
  timezone: string;
  groupId: string;
  priority: 'low' | 'normal' | 'high';
  maxRetries: number;
}

const FALLBACK_GROUPS: Group[] = [
  { id: 'GRP-001', name: 'Hajj Group Alpha 2026' },
  { id: 'GRP-002', name: 'Umrah Package Delta' },
  { id: 'GRP-003', name: 'VIP Pilgrimage Group' },
  { id: 'GRP-004', name: 'Ramadan Umrah Batch 7' },
  { id: 'GRP-005', name: 'Corporate Hajj Delegation' },
];

const TIMEZONES = [
  { label: 'UTC', value: 'UTC' },
  { label: 'Asia/Riyadh (AST +3)', value: 'Asia/Riyadh' },
  { label: 'Asia/Mecca (AST +3)', value: 'Asia/Mecca' },
  { label: 'Asia/Dubai (GST +4)', value: 'Asia/Dubai' },
  { label: 'Asia/Karachi (PKT +5)', value: 'Asia/Karachi' },
  { label: 'Asia/Jakarta (WIB +7)', value: 'Asia/Jakarta' },
  { label: 'Europe/London (GMT)', value: 'Europe/London' },
  { label: 'America/New_York (EST)', value: 'America/New_York' },
];

const TIME_PRESETS = [
  { label: '06:00', value: '06:00:00.000' },
  { label: '09:00', value: '09:00:00.000' },
  { label: '12:00', value: '12:00:00.000' },
  { label: '14:30', value: '14:30:00.000' },
  { label: '18:00', value: '18:00:00.000' },
  { label: '22:00', value: '22:00:00.000' },
];

function formatTimestamp(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
}

function getToday() {
  return new Date().toISOString().split('T')[0];
}

export default function SchedulePanelContent() {
  const [workflows, setWorkflows] = useState<ScheduledWorkflow[]>([]);
  const [groups, setGroups] = useState<Group[]>(FALLBACK_GROUPS);
  const [pullBefore, setPullBefore] = useState(true);
  const [retryOnFail, setRetryOnFail] = useState(true);
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
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [cliLog, setCliLog] = useState<string[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [countdown, setCountdown] = useState<string>('');

  useEffect(() => { setMounted(true); }, []);

  const appendLog = (line: string) =>
    setCliLog(prev => [...prev.slice(-99), line]);

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<ScheduleFormValues>({
    defaultValues: {
      targetTime: '',
      targetDate: getToday(),
      timezone: 'UTC',
      groupId: '',
      priority: 'normal',
      maxRetries: 3,
    },
  });

  const watchedGroupId = watch('groupId');
  const watchedTargetTime = watch('targetTime');
  const watchedTargetDate = watch('targetDate');
  const watchedTimezone = watch('timezone');

  // Countdown to next scheduled workflow
  useEffect(() => {
    const pending = workflows.filter(w => w.status === 'pending');
    if (!pending.length || !mounted) return;

    const interval = setInterval(() => {
      const now = new Date();
      const times = pending.map(w => {
        const [h, m, s] = w.scheduledTime.split(':').map(Number);
        const t = new Date();
        t.setHours(h, m, Math.floor(s || 0), 0);
        if (t < now) t.setDate(t.getDate() + 1);
        return t.getTime() - now.getTime();
      });
      const nearest = Math.min(...times);
      if (nearest < 0) { setCountdown(''); return; }
      const h = Math.floor(nearest / 3600000);
      const m = Math.floor((nearest % 3600000) / 60000);
      const s = Math.floor((nearest % 60000) / 1000);
      setCountdown(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [workflows, mounted]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => handleRefreshWorkflows(), 15000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const handleLoadGroups = async () => {
    setIsLoadingGroups(true);
    appendLog('$ toque groups list');
    const result = await toqueGroupsList();
    if (result.ok && result.data?.groups?.length) {
      setGroups(result.data.groups);
      appendLog(`✓ GET /groups/list → ${result.status} (${result.latencyMs}ms)  ${result.data.groups.length} groups`);
      toast.success(`${result.data.groups.length} groups loaded`);
    } else {
      appendLog(`✗ GET /groups/list → ${result.status || 'ERR'}: ${result.error}`);
    }
    setIsLoadingGroups(false);
  };

  const handleSelectGroup = (group: Group) => {
    setValue('groupId', group.id);
    setSelectedGroup(group.name);
    setShowGroupDropdown(false);
  };

  const onCreateSchedule = handleSubmit(async (data) => {
    setIsCreating(true);
    setCreateError(null);

    const payload: ScheduleCreatePayload = {
      groupId: data.groupId,
      targetTime: data.targetTime,
      targetDate: data.targetDate || undefined,
      timezone: data.timezone || 'UTC',
      pullBefore,
      retryOnFail,
      maxRetries: data.maxRetries,
      priority: data.priority,
    };

    const cliCmd = `toque schedule create --group ${data.groupId} --time ${data.targetTime} --date ${data.targetDate} --tz ${data.timezone} --pull-before ${pullBefore} --retry ${retryOnFail} --priority ${data.priority}`;
    appendLog(`$ ${cliCmd}`);
    appendLog(`→ POST /schedule/create  ${JSON.stringify(payload)}`);

    const result = await toqueScheduleCreate(payload);

    if (result.ok && result.data) {
      const d = result.data;
      const newWorkflow: ScheduledWorkflow = {
        id: d.workflowId,
        groupId: data.groupId,
        groupName: groups.find(g => g.id === data.groupId)?.name ?? data.groupId,
        scheduledTime: data.targetTime,
        targetDate: data.targetDate,
        timezone: data.timezone,
        status: 'pending',
        pullBefore,
        retryOnFail,
        maxRetries: data.maxRetries,
        createdAt: d.createdAt || new Date().toISOString(),
      };
      setWorkflows(prev => [newWorkflow, ...prev]);
      setLastCreated(newWorkflow);
      appendLog(`✓ POST /schedule/create → ${result.status} (${result.latencyMs}ms)  workflowId: ${d.workflowId}`);
      toast.success(`Workflow ${d.workflowId} scheduled for ${data.targetTime} (${data.timezone})`);
      reset({ targetTime: '', targetDate: getToday(), timezone: 'UTC', groupId: '', priority: 'normal', maxRetries: 3 });
      setSelectedGroup('');
      setPullBefore(true);
      setRetryOnFail(true);
    } else {
      const errMsg = result.error || `HTTP ${result.status}`;
      setCreateError(`POST /schedule/create → ${result.status || 'ERR'}: ${errMsg}`);
      appendLog(`✗ POST /schedule/create → ${result.status || 'ERR'}: ${errMsg}`);
      toast.error('Workflow creation failed: ' + errMsg);
    }

    setIsCreating(false);
  });

  const handleRefreshWorkflows = useCallback(async () => {
    setIsRefreshing(true);
    appendLog('$ toque schedule get');
    appendLog('→ GET /schedule/get ...');
    const result = await toqueScheduleGet();
    if (result.ok && result.data) {
      setWorkflows(result.data.workflows || []);
      appendLog(`✓ GET /schedule/get → ${result.status} (${result.latencyMs}ms)  ${result.data.total || 0} workflows`);
      toast.success(`${result.data.total || 0} workflows loaded`);
    } else {
      appendLog(`✗ GET /schedule/get → ${result.status || 'ERR'}: ${result.error}`);
      toast.error('Could not load workflows: ' + result.error);
    }
    setIsRefreshing(false);
  }, []);

  const handleCancelWorkflow = async (workflowId: string) => {
    setCancellingId(workflowId);
    setConfirmCancelId(null);
    appendLog(`$ toque schedule cancel ${workflowId}`);
    appendLog(`→ POST /schedule/cancel  { workflowId: "${workflowId}" } ...`);
    const result = await toqueScheduleCancel(workflowId);
    if (result.ok) {
      setWorkflows(prev => prev.map(w => w.id === workflowId ? { ...w, status: 'cancelled' as WorkflowStatus } : w));
      appendLog(`✓ POST /schedule/cancel → ${result.status} (${result.latencyMs}ms)`);
      toast.success(`Workflow ${workflowId} cancelled`);
    } else {
      appendLog(`✗ POST /schedule/cancel → ${result.status || 'ERR'}: ${result.error}`);
      toast.error('Cancel failed: ' + result.error);
    }
    setCancellingId(null);
  };

  const filteredWorkflows = statusFilter === 'all' ? workflows : workflows.filter(w => w.status === statusFilter);
  const pendingCount = workflows.filter(w => w.status === 'pending').length;
  const runningCount = workflows.filter(w => w.status === 'running').length;
  const successCount = workflows.filter(w => w.status === 'success').length;
  const errorCount = workflows.filter(w => w.status === 'error').length;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold" style={{ color: 'var(--foreground)' }}>Schedule</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Time-triggered visa send workflows — wired to <span className="font-mono text-xs" style={{ color: 'var(--accent)' }}>POST /schedule/create · GET /schedule/get · POST /schedule/cancel</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          {countdown && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ backgroundColor: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)' }}>
              <Icon name="ClockIcon" size={12} />
              <span className="text-xs font-mono font-semibold" style={{ color: 'var(--accent)' }}>Next: {countdown}</span>
            </div>
          )}
          {pendingCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ backgroundColor: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)' }}>
              <span className="w-2 h-2 rounded-full pulse-dot" style={{ backgroundColor: 'var(--warning)' }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--warning)' }}>{pendingCount} pending</span>
            </div>
          )}
          {runningCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ backgroundColor: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)' }}>
              <span className="w-2 h-2 rounded-full pulse-dot" style={{ backgroundColor: 'var(--success)' }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--success)' }}>{runningCount} running</span>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Pending', value: pendingCount, color: 'var(--warning)', icon: 'ClockIcon', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.15)' },
          { label: 'Running', value: runningCount, color: 'var(--accent)', icon: 'PlayIcon', bg: 'rgba(99,102,241,0.06)', border: 'rgba(99,102,241,0.15)' },
          { label: 'Completed', value: successCount, color: 'var(--success)', icon: 'CheckCircleIcon', bg: 'rgba(34,197,94,0.06)', border: 'rgba(34,197,94,0.15)' },
          { label: 'Failed', value: errorCount, color: errorCount > 0 ? 'var(--error)' : 'var(--muted-foreground)', icon: 'XCircleIcon', bg: errorCount > 0 ? 'rgba(239,68,68,0.06)' : 'var(--card)', border: errorCount > 0 ? 'rgba(239,68,68,0.15)' : 'var(--border)' },
        ].map(stat => (
          <div key={`sched-stat-${stat.label}`} className="p-4 rounded-lg" style={{ backgroundColor: stat.bg, border: `1px solid ${stat.border}` }}>
            <div className="flex items-center gap-2 mb-1.5">
              <Icon name={stat.icon as Parameters<typeof Icon>[0]['name']} size={14} />
              <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted-foreground)', fontSize: '10px', letterSpacing: '0.07em' }}>{stat.label}</span>
            </div>
            <p className="font-mono font-bold text-3xl tabular-nums" style={{ color: stat.color }}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        {/* Create workflow form */}
        <div className="xl:col-span-2 space-y-4">
          <SectionCard title="Create Scheduled Send" description="Schedule a visa send for a precise target time">
            <form onSubmit={onCreateSchedule} className="space-y-4">

              {/* Target Time */}
              <div>
                <label htmlFor="targetTime" className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>
                  Target Time (HH:MM:SS.mmm)
                </label>
                <p className="text-xs mb-2" style={{ color: 'var(--muted-foreground)' }}>Sub-millisecond precision — 24-hour format</p>
                <input
                  id="targetTime"
                  type="text"
                  className="input-field w-full px-3 py-2.5 font-mono text-sm"
                  placeholder="14:30:00.000"
                  {...register('targetTime', {
                    required: 'Target time is required',
                    pattern: { value: /^\d{2}:\d{2}:\d{2}\.\d{3}$/, message: 'Format: HH:MM:SS.mmm (e.g. 14:30:00.000)' },
                  })}
                />
                {errors.targetTime && <p className="mt-1 text-xs" style={{ color: 'var(--error)' }}>{errors.targetTime.message}</p>}
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {TIME_PRESETS.map(t => (
                    <button
                      key={`preset-${t.value}`}
                      type="button"
                      onClick={() => setValue('targetTime', t.value)}
                      className="font-mono px-2 py-1 rounded text-2xs transition-colors duration-100"
                      style={{
                        backgroundColor: watchedTargetTime === t.value ? 'rgba(99,102,241,0.2)' : 'var(--input)',
                        color: watchedTargetTime === t.value ? 'var(--accent)' : 'var(--muted-foreground)',
                        border: `1px solid ${watchedTargetTime === t.value ? 'rgba(99,102,241,0.4)' : 'var(--border)'}`,
                        fontSize: '10px',
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Target Date */}
              <div>
                <label htmlFor="targetDate" className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>
                  Target Date
                </label>
                <input
                  id="targetDate"
                  type="date"
                  className="input-field w-full px-3 py-2.5 font-mono text-sm"
                  {...register('targetDate', { required: 'Target date is required' })}
                />
                {errors.targetDate && <p className="mt-1 text-xs" style={{ color: 'var(--error)' }}>{errors.targetDate.message}</p>}
              </div>

              {/* Timezone */}
              <div>
                <label htmlFor="timezone" className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>
                  Timezone
                </label>
                <select
                  id="timezone"
                  className="input-field w-full px-3 py-2.5 text-sm"
                  {...register('timezone')}
                >
                  {TIMEZONES.map(tz => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </select>
                {watchedTargetTime && watchedTargetDate && (
                  <p className="mt-1 text-xs font-mono" style={{ color: 'var(--accent)' }}>
                    → {watchedTargetDate}T{watchedTargetTime} [{watchedTimezone}]
                  </p>
                )}
              </div>

              {/* Group ID */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="schedGroupId" className="block text-sm font-medium" style={{ color: 'var(--foreground)' }}>Group ID</label>
                  <button type="button" onClick={handleLoadGroups} disabled={isLoadingGroups} className="text-xs flex items-center gap-1" style={{ color: 'var(--accent)' }}>
                    {isLoadingGroups ? <LoadingSpinner size={10} /> : <Icon name="ArrowPathIcon" size={10} />}
                    Reload
                  </button>
                </div>
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
                    <div className="absolute top-full left-0 right-0 mt-1 rounded-lg z-20 overflow-hidden animate-fade-in" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
                      {groups.map(group => (
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
                  {...register('groupId', { required: 'Group ID is required', pattern: { value: /^[A-Z0-9\-_]+$/i, message: 'Alphanumeric only' } })}
                />
                {errors.groupId && <p className="mt-1 text-xs" style={{ color: 'var(--error)' }}>{errors.groupId.message}</p>}
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>Priority</label>
                <div className="flex gap-2">
                  {(['low', 'normal', 'high'] as const).map(p => {
                    const color = p === 'high' ? 'var(--error)' : p === 'normal' ? 'var(--accent)' : 'var(--muted-foreground)';
                    const active = watch('priority') === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setValue('priority', p)}
                        className="flex-1 py-2 px-3 rounded text-xs font-semibold capitalize transition-all"
                        style={{
                          backgroundColor: active ? `${color}18` : 'var(--input)',
                          color: active ? color : 'var(--muted-foreground)',
                          border: `1px solid ${active ? color : 'var(--border)'}`,
                        }}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Max Retries */}
              <div>
                <label htmlFor="maxRetries" className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>
                  Max Retries
                </label>
                <input
                  id="maxRetries"
                  type="number"
                  min={0}
                  max={10}
                  className="input-field w-full px-3 py-2.5 font-mono text-sm"
                  {...register('maxRetries', { min: 0, max: 10 })}
                />
              </div>

              {/* Toggles */}
              <div className="space-y-3 p-3 rounded-lg" style={{ backgroundColor: 'var(--input)', border: '1px solid var(--border)' }}>
                <Toggle
                  checked={pullBefore}
                  onChange={setPullBefore}
                  label="Pull Before Send"
                  description="Refresh auth, captcha, and entityId immediately before executing the visa send"
                  id="pull-before-toggle"
                />
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                  <Toggle
                    checked={retryOnFail}
                    onChange={setRetryOnFail}
                    label="Retry on Failure"
                    description="Automatically retry the workflow if it fails (up to max retries)"
                    id="retry-on-fail-toggle"
                  />
                </div>
              </div>

              {/* CLI preview */}
              {watchedGroupId && watchedTargetTime && (
                <div className="p-3 rounded font-mono text-xs" style={{ backgroundColor: '#050508', border: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--accent)' }}>$ </span>
                  <span style={{ color: 'var(--foreground)' }}>
                    toque schedule create --group {watchedGroupId} --time {watchedTargetTime} --date {watchedTargetDate} --tz {watchedTimezone} --pull-before {String(pullBefore)} --retry {String(retryOnFail)} --priority {watch('priority')}
                  </span>
                </div>
              )}

              <button type="submit" disabled={isCreating} className="btn-primary w-full py-3 text-sm font-semibold">
                {isCreating ? <><LoadingSpinner size={16} /> Creating workflow...</> : <><Icon name="CalendarDaysIcon" size={16} /> Schedule Send — POST /schedule/create</>}
              </button>
            </form>
          </SectionCard>

          {createError && (
            <ErrorAlert message="Workflow creation failed" detail={createError} onRetry={() => handleSubmit(onCreateSchedule as never)()} />
          )}

          {lastCreated && (
            <SectionCard title="Workflow Created" headerRight={<StatusBadge status="pending" />}>
              <JsonViewer
                data={{
                  workflowId: lastCreated.id,
                  groupId: lastCreated.groupId,
                  scheduledTime: lastCreated.scheduledTime,
                  targetDate: lastCreated.targetDate,
                  timezone: lastCreated.timezone,
                  pullBefore: lastCreated.pullBefore,
                  retryOnFail: lastCreated.retryOnFail,
                  maxRetries: lastCreated.maxRetries,
                  priority: (lastCreated as ScheduledWorkflow & { priority?: string }).priority,
                  status: 'pending',
                  createdAt: lastCreated.createdAt,
                }}
                maxHeight={220}
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
                  type="button"
                  onClick={() => setAutoRefresh(v => !v)}
                  className="px-2 py-1 rounded text-xs font-medium transition-all"
                  style={{
                    backgroundColor: autoRefresh ? 'rgba(34,197,94,0.1)' : 'var(--input)',
                    color: autoRefresh ? 'var(--success)' : 'var(--muted-foreground)',
                    border: `1px solid ${autoRefresh ? 'rgba(34,197,94,0.25)' : 'var(--border)'}`,
                  }}
                >
                  <Icon name="ArrowPathIcon" size={11} />
                  {autoRefresh ? 'Auto' : 'Manual'}
                </button>
                <button onClick={handleRefreshWorkflows} disabled={isRefreshing} className="btn-ghost px-3 py-1.5 text-xs">
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
            <div className="flex gap-1 px-4 py-3 overflow-x-auto" style={{ borderBottom: '1px solid var(--border)' }}>
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
                    {['Workflow ID', 'Group', 'Target Time', 'Date', 'TZ', 'Pull?', 'Priority', 'Status', 'Result', 'Actions'].map(col => (
                      <th key={`sched-th-${col}`} className="text-left px-4 py-3 font-medium" style={{ color: 'var(--muted-foreground)', fontSize: '11px', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isRefreshing ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <tr key={`skel-row-${i + 1}`} style={{ borderBottom: '1px solid var(--border)' }}>
                        {Array.from({ length: 10 }).map((__, j) => (
                          <td key={`skel-cell-${i + 1}-${j + 1}`} className="px-4 py-3">
                            <SkeletonBlock height={14} width={j === 0 ? '70px' : j === 1 ? '120px' : '60px'} />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : filteredWorkflows.length === 0 ? (
                    <tr>
                      <td colSpan={10}>
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <Icon name="CalendarDaysIcon" size={32} />
                          <p className="mt-3 text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                            No {statusFilter !== 'all' ? statusFilter : ''} workflows
                          </p>
                          <p className="mt-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                            {statusFilter === 'all' ?'Create a scheduled send using the form, or click Refresh to load from server'
                              : `No workflows with status "${statusFilter}" found`}
                          </p>
                          <button onClick={handleRefreshWorkflows} className="mt-3 btn-ghost px-4 py-2 text-xs">
                            <Icon name="ArrowPathIcon" size={12} /> Load from server
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredWorkflows.map((wf, idx) => {
                      const wfWithPriority = wf as ScheduledWorkflow & { priority?: string };
                      return (
                        <tr
                          key={wf.id}
                          className="transition-colors duration-100"
                          style={{ borderBottom: '1px solid var(--border)', backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.04)')}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)')}
                        >
                          <td className="px-4 py-3 font-mono text-xs font-semibold" style={{ color: 'var(--accent)', whiteSpace: 'nowrap' }}>{wf.id}</td>
                          <td className="px-4 py-3" style={{ maxWidth: '140px' }}>
                            <p className="text-xs font-medium truncate" style={{ color: 'var(--foreground)' }}>{wf.groupName}</p>
                            <p className="text-2xs font-mono" style={{ color: 'var(--muted-foreground)' }}>{wf.groupId}</p>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs font-semibold" style={{ color: 'var(--foreground)', whiteSpace: 'nowrap' }}>{wf.scheduledTime}</td>
                          <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>{wf.targetDate || '—'}</td>
                          <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--muted-foreground)' }}>{wf.timezone || 'UTC'}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1 text-2xs font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: wf.pullBefore ? 'rgba(34,197,94,0.1)' : 'rgba(100,116,139,0.1)', color: wf.pullBefore ? 'var(--success)' : 'var(--muted-foreground)', border: `1px solid ${wf.pullBefore ? 'rgba(34,197,94,0.2)' : 'rgba(100,116,139,0.15)'}` }}>
                              {wf.pullBefore ? '✓ Yes' : '✗ No'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {wfWithPriority.priority ? (
                              <span className="text-2xs font-semibold capitalize" style={{ color: wfWithPriority.priority === 'high' ? 'var(--error)' : wfWithPriority.priority === 'normal' ? 'var(--accent)' : 'var(--muted-foreground)' }}>
                                {wfWithPriority.priority}
                              </span>
                            ) : <span style={{ color: 'var(--muted-foreground)' }}>—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={wf.status as 'pending' | 'running' | 'success' | 'error' | 'cancelled'} />
                          </td>
                          <td className="px-4 py-3 font-mono text-xs" style={{ whiteSpace: 'nowrap' }}>
                            {wf.status === 'success' && wf.latencyMs !== undefined && (
                              <div className="flex items-center gap-1.5">
                                <TimingDisplay ms={wf.latencyMs} showLabel={false} />
                                <span style={{ color: 'var(--success)' }}>{wf.visasSent}v</span>
                              </div>
                            )}
                            {wf.status === 'error' && <span style={{ color: 'var(--error)', fontSize: '10px' }}>{wf.errorCode}</span>}
                            {wf.status === 'running' && (
                              <span className="flex items-center gap-1" style={{ color: 'var(--accent)' }}>
                                <LoadingSpinner size={10} />
                                <span style={{ fontSize: '10px' }}>In progress</span>
                              </span>
                            )}
                            {(wf.status === 'pending' || wf.status === 'cancelled') && <span style={{ color: 'var(--muted-foreground)', fontSize: '10px' }}>—</span>}
                          </td>
                          <td className="px-4 py-3">
                            {(wf.status === 'pending' || wf.status === 'running') && (
                              <>
                                {confirmCancelId === wf.id ? (
                                  <div className="flex items-center gap-1.5">
                                    <button onClick={() => handleCancelWorkflow(wf.id)} disabled={cancellingId === wf.id} className="btn-danger px-2 py-1" style={{ fontSize: '11px' }}>
                                      {cancellingId === wf.id ? <LoadingSpinner size={10} /> : 'Confirm'}
                                    </button>
                                    <button onClick={() => setConfirmCancelId(null)} className="btn-ghost px-2 py-1" style={{ fontSize: '11px' }}>Keep</button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setConfirmCancelId(wf.id)}
                                    className="btn-ghost px-2.5 py-1.5"
                                    style={{ fontSize: '11px', color: 'var(--error)', borderColor: 'rgba(239,68,68,0.25)' }}
                                  >
                                    <Icon name="XMarkIcon" size={12} /> Cancel
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
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>
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
          <div className="p-4 font-mono text-xs space-y-0.5 overflow-y-auto" style={{ backgroundColor: '#050508', maxHeight: '160px' }}>
            {cliLog.map((line, i) => (
              <div key={`sched-log-${i}`} style={{ color: line.startsWith('✓') ? 'var(--success)' : line.startsWith('✗') ? 'var(--error)' : line.startsWith('$') ? 'var(--accent)' : 'var(--muted-foreground)' }}>
                {line}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reference */}
      <SectionCard title="CLI Command Reference" description="Toque bin commands mapped to this panel">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { cmd: 'toque schedule create --group <id> --time HH:MM:SS.mmm --date YYYY-MM-DD --tz UTC --pull-before true --retry true --priority normal', http: 'POST /schedule/create', desc: 'Create a time-triggered visa send workflow' },
            { cmd: 'toque schedule get', http: 'GET /schedule/get', desc: 'List all active and recent workflows' },
            { cmd: 'toque schedule cancel <workflowId>', http: 'POST /schedule/cancel', desc: 'Cancel a pending or running workflow' },
          ].map(item => (
            <div key={item.cmd.slice(0, 20)} className="p-3 rounded-lg" style={{ backgroundColor: 'var(--input)', border: '1px solid var(--border)' }}>
              <p className="font-mono text-xs font-bold mb-1 break-all" style={{ color: 'var(--accent)', fontSize: '10px' }}>$ {item.cmd}</p>
              <p className="font-mono text-xs mb-1.5" style={{ color: 'var(--muted-foreground)' }}>→ {item.http}</p>
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}