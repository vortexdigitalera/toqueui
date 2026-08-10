'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import Icon from '@/components/ui/AppIcon';
import SectionCard from '@/components/ui/SectionCard';
import StatusBadge from '@/components/ui/StatusBadge';
import JsonViewer from '@/components/ui/JsonViewer';
import TimingDisplay from '@/components/ui/TimingDisplay';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorAlert from '@/components/ui/ErrorAlert';
import SkeletonBlock from '@/components/ui/SkeletonBlock';

interface SendFormValues {
  groupId: string;
}

type SendStatus = 'success' | 'error' | 'pending';

interface SendHistoryEntry {
  id: string;
  groupId: string;
  groupName: string;
  timestamp: string;
  status: SendStatus;
  latencyMs: number;
  visaCount?: number;
  errorCode?: string;
}

// Mock pilgrim groups for selector — backend: GET /groups/list
const MOCK_GROUPS = [
  { id: 'GRP-001', name: 'Hajj Group Alpha 2026' },
  { id: 'GRP-002', name: 'Umrah Package Delta' },
  { id: 'GRP-003', name: 'VIP Pilgrimage Group' },
  { id: 'GRP-004', name: 'Ramadan Umrah Batch 7' },
  { id: 'GRP-005', name: 'Corporate Hajj Delegation' },
];

// Mock send history — backend: stored locally or fetched from audit endpoint
const INITIAL_HISTORY: SendHistoryEntry[] = [
  { id: 'send-001', groupId: 'GRP-001', groupName: 'Hajj Group Alpha 2026', timestamp: '2026-08-10T06:44:12Z', status: 'success', latencyMs: 187, visaCount: 23 },
  { id: 'send-002', groupId: 'GRP-003', groupName: 'VIP Pilgrimage Group', timestamp: '2026-08-10T05:31:08Z', status: 'success', latencyMs: 214, visaCount: 8 },
  { id: 'send-003', groupId: 'GRP-002', groupName: 'Umrah Package Delta', timestamp: '2026-08-10T04:15:55Z', status: 'error', latencyMs: 1840, errorCode: 'CAPTCHA_EXPIRED' },
  { id: 'send-004', groupId: 'GRP-004', groupName: 'Ramadan Umrah Batch 7', timestamp: '2026-08-09T22:07:33Z', status: 'success', latencyMs: 156, visaCount: 41 },
  { id: 'send-005', groupId: 'GRP-001', groupName: 'Hajj Group Alpha 2026', timestamp: '2026-08-09T19:52:11Z', status: 'success', latencyMs: 203, visaCount: 23 },
  { id: 'send-006', groupId: 'GRP-005', groupName: 'Corporate Hajj Delegation', timestamp: '2026-08-09T17:30:44Z', status: 'error', latencyMs: 3201, errorCode: 'AUTH_TOKEN_EXPIRED' },
  { id: 'send-007', groupId: 'GRP-002', groupName: 'Umrah Package Delta', timestamp: '2026-08-09T14:18:22Z', status: 'success', latencyMs: 178, visaCount: 17 },
  { id: 'send-008', groupId: 'GRP-003', groupName: 'VIP Pilgrimage Group', timestamp: '2026-08-09T11:05:09Z', status: 'success', latencyMs: 192, visaCount: 8 },
];

// Mock send response — backend: POST /send { groupId }
function mockSendResponse(groupId: string) {
  const group = MOCK_GROUPS.find(g => g.id === groupId);
  return {
    success: true,
    groupId,
    groupName: group?.name ?? groupId,
    visasSent: Math.floor(8 + Math.random() * 40),
    processedAt: new Date().toISOString(),
    requestId: `req-${Date.now()}`,
    nusukResponse: {
      status: 'ACCEPTED',
      batchId: `BATCH-${Date.now()}`,
      pilgrimCount: Math.floor(8 + Math.random() * 40),
      visaType: 'UMRAH',
      validFrom: '2026-08-15',
      validTo: '2026-09-15',
    },
    browserSession: {
      sessionId: `sess-${Math.random().toString(36).slice(2, 10)}`,
      captchaUsed: true,
      retries: 0,
    },
  };
}

function formatTimestamp(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
}

export default function SendVisaPanelContent() {
  const [isSending, setIsSending] = useState(false);
  const [sendResponse, setSendResponse] = useState<ReturnType<typeof mockSendResponse> | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendLatency, setSendLatency] = useState<number | null>(null);
  const [history, setHistory] = useState<SendHistoryEntry[]>(INITIAL_HISTORY);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [groupsLoaded, setGroupsLoaded] = useState(true);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<SendFormValues>({
    defaultValues: { groupId: '' },
  });

  const watchedGroupId = watch('groupId');

  const handleSelectGroup = (group: typeof MOCK_GROUPS[0]) => {
    setValue('groupId', group.id);
    setSelectedGroup(group.name);
    setShowGroupDropdown(false);
  };

  const handleLoadGroups = async () => {
    setIsLoadingGroups(true);
    // Backend integration point: GET /groups/list
    await new Promise(r => setTimeout(r, 800));
    setGroupsLoaded(true);
    setIsLoadingGroups(false);
    toast.success('Groups loaded — 5 groups available');
  };

  const onSend = handleSubmit(async (data) => {
    setIsSending(true);
    setSendError(null);
    setSendResponse(null);
    setSendLatency(null);

    const start = Date.now();
    // Backend integration point: POST /send { groupId: data.groupId }
    await new Promise(r => setTimeout(r, 800 + Math.random() * 600));
    const elapsed = Date.now() - start;

    const success = Math.random() > 0.12;

    if (success) {
      const response = mockSendResponse(data.groupId);
      setSendResponse(response);
      setSendLatency(elapsed);

      const group = MOCK_GROUPS.find(g => g.id === data.groupId);
      const newEntry: SendHistoryEntry = {
        id: `send-${Date.now()}`,
        groupId: data.groupId,
        groupName: group?.name ?? data.groupId,
        timestamp: new Date().toISOString(),
        status: 'success',
        latencyMs: elapsed,
        visaCount: response.visasSent,
      };
      setHistory(prev => [newEntry, ...prev.slice(0, 9)]);
      toast.success(`Visa send successful — ${response.visasSent} visas processed`);
    } else {
      const errorMsg = 'POST /send returned 422 — CAPTCHA may have expired or auth token is stale. Run a Pull to refresh credentials.';
      setSendError(errorMsg);
      setSendLatency(elapsed);

      const group = MOCK_GROUPS.find(g => g.id === data.groupId);
      const newEntry: SendHistoryEntry = {
        id: `send-${Date.now()}`,
        groupId: data.groupId,
        groupName: group?.name ?? data.groupId,
        timestamp: new Date().toISOString(),
        status: 'error',
        latencyMs: elapsed,
        errorCode: 'CAPTCHA_EXPIRED',
      };
      setHistory(prev => [newEntry, ...prev.slice(0, 9)]);
      toast.error('Visa send failed — check error details');
    }

    setIsSending(false);
  });

  const successCount = history.filter(h => h.status === 'success').length;
  const errorCount = history.filter(h => h.status === 'error').length;
  const avgLatency = history.length > 0
    ? Math.round(history.reduce((sum, h) => sum + h.latencyMs, 0) / history.length)
    : 0;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold" style={{ color: 'var(--foreground)' }}>
            Send Visa
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Trigger Masar Nusuk visa send for a pilgrim group via POST /send
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-2xs uppercase tracking-wider font-medium" style={{ color: 'var(--muted-foreground)', letterSpacing: '0.07em' }}>
              Success Rate
            </p>
            <p className="font-mono font-bold text-xl" style={{ color: history.length > 0 ? 'var(--success)' : 'var(--muted-foreground)' }}>
              {history.length > 0 ? `${Math.round((successCount / history.length) * 100)}%` : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Sends', value: history.length.toString(), icon: 'PaperAirplaneIcon', color: 'var(--foreground)' },
          { label: 'Successful', value: successCount.toString(), icon: 'CheckCircleIcon', color: 'var(--success)' },
          { label: 'Failed', value: errorCount.toString(), icon: 'XCircleIcon', color: errorCount > 0 ? 'var(--error)' : 'var(--muted-foreground)' },
          { label: 'Avg Latency', value: `${avgLatency}ms`, icon: 'ClockIcon', color: avgLatency < 300 ? 'var(--success)' : avgLatency < 1000 ? 'var(--warning)' : 'var(--error)' },
        ].map(stat => (
          <div
            key={`stat-${stat.label}`}
            className="p-4 rounded-lg"
            style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <Icon name={stat.icon as Parameters<typeof Icon>[0]['name']} size={14} />
              <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted-foreground)', fontSize: '10px', letterSpacing: '0.07em' }}>
                {stat.label}
              </span>
            </div>
            <p className="font-mono font-bold text-2xl tabular-nums" style={{ color: stat.color }}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        {/* Send form */}
        <div className="xl:col-span-2 space-y-4">
          <SectionCard
            title="Send Configuration"
            description="Select a group and trigger visa send"
          >
            <form onSubmit={onSend} className="space-y-5">
              {/* Group selector */}
              <div>
                <label htmlFor="groupId" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>
                  Group ID
                </label>
                <p className="text-xs mb-2" style={{ color: 'var(--muted-foreground)' }}>
                  The Masar Nusuk pilgrim group identifier to send visas for
                </p>

                {/* Quick select from loaded groups */}
                {groupsLoaded && (
                  <div className="relative mb-2">
                    <button
                      type="button"
                      onClick={() => setShowGroupDropdown(v => !v)}
                      className="btn-ghost w-full px-3 py-2.5 text-sm justify-between"
                      style={{ fontSize: '13px' }}
                    >
                      <span style={{ color: selectedGroup ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
                        {selectedGroup || 'Select from loaded groups...'}
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
                            key={`group-opt-${group.id}`}
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
                            {watchedGroupId === group.id && (
                              <Icon name="CheckIcon" size={14} />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <input
                  id="groupId"
                  type="text"
                  className="input-field w-full px-3 py-2.5 font-mono text-sm"
                  placeholder="GRP-001 or paste group ID..."
                  {...register('groupId', {
                    required: 'Group ID is required',
                    pattern: {
                      value: /^[A-Z0-9\-_]+$/i,
                      message: 'Group ID must be alphanumeric (e.g. GRP-001)',
                    },
                  })}
                />
                {errors.groupId && (
                  <p className="mt-1.5 text-xs" style={{ color: 'var(--error)' }}>
                    {errors.groupId.message}
                  </p>
                )}

                {!groupsLoaded && (
                  <button
                    type="button"
                    onClick={handleLoadGroups}
                    disabled={isLoadingGroups}
                    className="mt-2 btn-ghost w-full py-2 text-xs"
                  >
                    {isLoadingGroups ? <LoadingSpinner size={12} /> : <Icon name="ArrowPathIcon" size={13} />}
                    {isLoadingGroups ? 'Loading groups...' : 'Load groups from /groups/list'}
                  </button>
                )}
              </div>

              {/* Warning notice */}
              <div
                className="flex items-start gap-2 p-3 rounded text-xs"
                style={{ backgroundColor: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}
              >
                <Icon name="ExclamationTriangleIcon" size={13} className="shrink-0 mt-0.5" />
                <p style={{ color: 'var(--warning)' }}>
                  Ensure credentials are fresh before sending. Run a Pull if last pull was more than 30 minutes ago.
                </p>
              </div>

              {/* Send button */}
              <button
                type="submit"
                disabled={isSending}
                className="btn-primary w-full py-3 text-sm font-semibold"
                style={{ fontSize: '14px' }}
              >
                {isSending ? (
                  <>
                    <LoadingSpinner size={16} />
                    Sending visa request...
                  </>
                ) : (
                  <>
                    <Icon name="PaperAirplaneIcon" size={16} />
                    Send Visa — POST /send
                  </>
                )}
              </button>
            </form>
          </SectionCard>

          {/* Loading skeleton during send */}
          {isSending && (
            <SectionCard title="Awaiting Response">
              <div className="space-y-3">
                <SkeletonBlock height={14} width="60%" />
                <SkeletonBlock height={14} width="80%" />
                <SkeletonBlock height={14} width="40%" />
                <SkeletonBlock height={80} />
              </div>
            </SectionCard>
          )}

          {/* Error state */}
          {sendError && !isSending && (
            <ErrorAlert
              message="Visa send failed"
              detail={sendError}
              onRetry={() => handleSubmit(onSend as never)()}
            />
          )}
        </div>

        {/* Response panel */}
        <div className="xl:col-span-3 space-y-4">
          {sendResponse && !isSending ? (
            <SectionCard
              title="Send Response"
              description={`POST /send — completed`}
              headerRight={
                <div className="flex items-center gap-2">
                  {sendLatency !== null && <TimingDisplay ms={sendLatency} />}
                  <StatusBadge status="success" label="Accepted" />
                </div>
              }
            >
              <div className="space-y-4">
                {/* Quick metrics */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Visas Sent', value: sendResponse.visasSent.toString(), color: 'var(--success)' },
                    { label: 'Batch ID', value: sendResponse.nusukResponse.batchId, color: 'var(--accent)' },
                    { label: 'Visa Type', value: sendResponse.nusukResponse.visaType, color: 'var(--foreground)' },
                  ].map(m => (
                    <div
                      key={`resp-metric-${m.label}`}
                      className="p-3 rounded text-center"
                      style={{ backgroundColor: 'var(--input)', border: '1px solid var(--border)' }}
                    >
                      <p className="text-2xs uppercase tracking-wider mb-1" style={{ color: 'var(--muted-foreground)', letterSpacing: '0.07em' }}>
                        {m.label}
                      </p>
                      <p className="font-mono font-bold text-sm truncate" style={{ color: m.color }}>
                        {m.value}
                      </p>
                    </div>
                  ))}
                </div>

                <JsonViewer data={sendResponse} maxHeight={320} title="POST /send response" />
              </div>
            </SectionCard>
          ) : !isSending && !sendError ? (
            <SectionCard title="Send Response">
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
                  style={{ backgroundColor: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}
                >
                  <Icon name="PaperAirplaneIcon" size={22} />
                </div>
                <p className="text-base font-medium" style={{ color: 'var(--foreground)' }}>
                  No send executed yet
                </p>
                <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  Select a group ID and click Send Visa to trigger a POST /send request. The full response JSON will appear here.
                </p>
              </div>
            </SectionCard>
          ) : null}

          {/* Error response panel */}
          {sendError && sendLatency !== null && !isSending && (
            <SectionCard
              title="Send Response"
              description="POST /send — failed"
              headerRight={
                <div className="flex items-center gap-2">
                  <TimingDisplay ms={sendLatency} />
                  <StatusBadge status="error" label="Failed" />
                </div>
              }
            >
              <JsonViewer
                data={{ error: true, message: sendError, timestamp: new Date().toISOString() }}
                maxHeight={200}
                title="POST /send error"
              />
            </SectionCard>
          )}
        </div>
      </div>

      {/* Send history table */}
      <SectionCard
        title="Recent Send History"
        description="Last 10 visa send operations"
        headerRight={
          <span className="font-mono text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}>
            {history.length} records
          </span>
        }
        noPadding
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Request ID', 'Group ID', 'Group Name', 'Timestamp (UTC)', 'Status', 'Latency', 'Visas / Error'].map(col => (
                  <th
                    key={`th-${col}`}
                    className="text-left px-5 py-3 font-medium"
                    style={{ color: 'var(--muted-foreground)', fontSize: '11px', letterSpacing: '0.04em', whiteSpace: 'nowrap', backgroundColor: 'var(--card)' }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map((row, idx) => (
                <tr
                  key={row.id}
                  className="transition-colors duration-100"
                  style={{
                    borderBottom: '1px solid var(--border)',
                    backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.04)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)')}
                >
                  <td className="px-5 py-3 font-mono text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    {row.id}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs font-semibold" style={{ color: 'var(--accent)' }}>
                    {row.groupId}
                  </td>
                  <td className="px-5 py-3 text-sm" style={{ color: 'var(--foreground)', maxWidth: '180px' }}>
                    <span className="block truncate">{row.groupName}</span>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs" style={{ color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>
                    {formatTimestamp(row.timestamp)}
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-5 py-3">
                    <TimingDisplay ms={row.latencyMs} showLabel={false} />
                  </td>
                  <td className="px-5 py-3 font-mono text-xs">
                    {row.status === 'success' ? (
                      <span style={{ color: 'var(--success)' }}>{row.visaCount} visas</span>
                    ) : (
                      <span style={{ color: 'var(--error)' }}>{row.errorCode}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {history.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10">
              <Icon name="PaperAirplaneIcon" size={32} />
              <p className="mt-3 text-sm font-medium" style={{ color: 'var(--foreground)' }}>No sends yet</p>
              <p className="mt-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                Completed visa sends will appear here with full timing and status details
              </p>
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}