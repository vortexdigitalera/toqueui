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

import { toqueSendVisa, toqueGroupsList, type SendVisaResponse, type Group } from '@/lib/toque/client';

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
  httpStatus?: number;
  cliCommand?: string;
}

const FALLBACK_GROUPS: Group[] = [
  { id: 'GRP-001', name: 'Hajj Group Alpha 2026' },
  { id: 'GRP-002', name: 'Umrah Package Delta' },
  { id: 'GRP-003', name: 'VIP Pilgrimage Group' },
  { id: 'GRP-004', name: 'Ramadan Umrah Batch 7' },
  { id: 'GRP-005', name: 'Corporate Hajj Delegation' },
];

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
  const [sendResponse, setSendResponse] = useState<SendVisaResponse | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendLatency, setSendLatency] = useState<number | null>(null);
  const [history, setHistory] = useState<SendHistoryEntry[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [groups, setGroups] = useState<Group[]>(FALLBACK_GROUPS);
  const [cliLog, setCliLog] = useState<string[]>([]);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<SendFormValues>({
    defaultValues: { groupId: '' },
  });

  const watchedGroupId = watch('groupId');

  const appendLog = (line: string) =>
    setCliLog(prev => [...prev.slice(-99), line]);

  const handleSelectGroup = (group: Group) => {
    setValue('groupId', group.id);
    setSelectedGroup(group.name);
    setShowGroupDropdown(false);
  };

  const handleLoadGroups = async () => {
    setIsLoadingGroups(true);
    appendLog('$ toque groups list');
    appendLog('→ GET /groups/list ...');
    const result = await toqueGroupsList();
    if (result.ok && result.data?.groups?.length) {
      setGroups(result.data.groups);
      appendLog(`✓ GET /groups/list → ${result.status} (${result.latencyMs}ms)  ${result.data.groups.length} groups`);
      toast.success(`${result.data.groups.length} groups loaded`);
    } else {
      appendLog(`✗ GET /groups/list → ${result.status || 'ERR'}: ${result.error || 'No groups'} — using cached list`);
      toast.error('Could not load groups — using cached list');
    }
    setIsLoadingGroups(false);
  };

  const onSend = handleSubmit(async (data) => {
    setIsSending(true);
    setSendError(null);
    setSendResponse(null);
    setSendLatency(null);

    const group = groups.find(g => g.id === data.groupId);
    appendLog(`$ toque send ${data.groupId}`);
    appendLog(`→ POST /send  { groupId: "${data.groupId}" } ...`);

    const result = await toqueSendVisa(data.groupId);
    setSendLatency(result.latencyMs);

    if (result.ok && result.data) {
      const d = result.data;
      setSendResponse(d);
      const newEntry: SendHistoryEntry = {
        id: `send-${Date.now()}`,
        groupId: data.groupId,
        groupName: group?.name ?? data.groupId,
        timestamp: new Date().toISOString(),
        status: 'success',
        latencyMs: result.latencyMs,
        visaCount: d.visasSent,
        httpStatus: result.status,
        cliCommand: `toque send ${data.groupId}`,
      };
      setHistory(prev => [newEntry, ...prev.slice(0, 9)]);
      appendLog(`✓ POST /send → ${result.status} (${result.latencyMs}ms)  visasSent: ${d.visasSent}  requestId: ${d.requestId}`);
      toast.success(`Visa send successful — ${d.visasSent} visas processed`);
    } else {
      const errMsg = result.error || `HTTP ${result.status}`;
      setSendError(`POST /send → ${result.status || 'ERR'}: ${errMsg}`);
      const newEntry: SendHistoryEntry = {
        id: `send-${Date.now()}`,
        groupId: data.groupId,
        groupName: group?.name ?? data.groupId,
        timestamp: new Date().toISOString(),
        status: 'error',
        latencyMs: result.latencyMs,
        errorCode: errMsg,
        httpStatus: result.status,
        cliCommand: `toque send ${data.groupId}`,
      };
      setHistory(prev => [newEntry, ...prev.slice(0, 9)]);
      appendLog(`✗ POST /send → ${result.status || 'ERR'}: ${errMsg}`);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold" style={{ color: 'var(--foreground)' }}>Send Visa</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Trigger Masar Nusuk visa send — wired to <span className="font-mono text-xs" style={{ color: 'var(--accent)' }}>POST /send · GET /groups/list</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xs uppercase tracking-wider font-medium" style={{ color: 'var(--muted-foreground)', letterSpacing: '0.07em' }}>Success Rate</p>
          <p className="font-mono font-bold text-xl" style={{ color: history.length > 0 ? 'var(--success)' : 'var(--muted-foreground)' }}>
            {history.length > 0 ? `${Math.round((successCount / history.length) * 100)}%` : '—'}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Sends', value: history.length.toString(), icon: 'PaperAirplaneIcon', color: 'var(--foreground)' },
          { label: 'Successful', value: successCount.toString(), icon: 'CheckCircleIcon', color: 'var(--success)' },
          { label: 'Failed', value: errorCount.toString(), icon: 'XCircleIcon', color: errorCount > 0 ? 'var(--error)' : 'var(--muted-foreground)' },
          { label: 'Avg Latency', value: `${avgLatency}ms`, icon: 'ClockIcon', color: avgLatency < 300 ? 'var(--success)' : avgLatency < 1000 ? 'var(--warning)' : 'var(--error)' },
        ].map(stat => (
          <div key={`stat-${stat.label}`} className="p-4 rounded-lg" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2 mb-1.5">
              <Icon name={stat.icon as Parameters<typeof Icon>[0]['name']} size={14} />
              <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted-foreground)', fontSize: '10px', letterSpacing: '0.07em' }}>{stat.label}</span>
            </div>
            <p className="font-mono font-bold text-2xl tabular-nums" style={{ color: stat.color }}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        {/* Send form */}
        <div className="xl:col-span-2 space-y-4">
          <SectionCard title="Send Configuration" description="Select a group and trigger visa send">
            <form onSubmit={onSend} className="space-y-5">
              <div>
                <label htmlFor="groupId" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>Group ID</label>
                <p className="text-xs mb-2" style={{ color: 'var(--muted-foreground)' }}>The Masar Nusuk pilgrim group identifier</p>

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
                          key={`send-group-${group.id}`}
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

                <div className="flex gap-2 mb-2">
                  <input
                    id="groupId"
                    type="text"
                    className="input-field flex-1 px-3 py-2.5 font-mono text-sm"
                    placeholder="GRP-001"
                    {...register('groupId', { required: 'Group ID is required' })}
                  />
                  <button type="button" onClick={handleLoadGroups} disabled={isLoadingGroups} className="btn-ghost px-3 py-2.5 text-xs">
                    {isLoadingGroups ? <LoadingSpinner size={12} /> : <Icon name="ArrowPathIcon" size={12} />}
                  </button>
                </div>
                {errors.groupId && <p className="mt-1.5 text-xs" style={{ color: 'var(--error)' }}>{errors.groupId.message}</p>}
              </div>

              <button type="submit" disabled={isSending} className="btn-primary w-full py-3 text-sm font-semibold">
                {isSending ? <><LoadingSpinner size={16} /> Sending...</> : <><Icon name="PaperAirplaneIcon" size={16} /> Send Visa — POST /send</>}
              </button>
            </form>
          </SectionCard>

          {sendError && (
            <ErrorAlert message="Visa send failed" detail={sendError} onRetry={() => handleSubmit(onSend as never)()} />
          )}

          {sendLatency !== null && (
            <div className="flex items-center gap-2 px-3 py-2 rounded" style={{ backgroundColor: 'var(--input)', border: '1px solid var(--border)' }}>
              <Icon name="ClockIcon" size={13} />
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Latency:</span>
              <TimingDisplay ms={sendLatency} />
            </div>
          )}
        </div>

        {/* Response + History */}
        <div className="xl:col-span-3 space-y-4">
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
                  <div key={`send-log-${i}`} style={{ color: line.startsWith('✓') ? 'var(--success)' : line.startsWith('✗') ? 'var(--error)' : line.startsWith('$') ? 'var(--accent)' : 'var(--muted-foreground)' }}>
                    {line}
                  </div>
                ))}
              </div>
            </div>
          )}

          {sendResponse && (
            <SectionCard title="Send Response" headerRight={<StatusBadge status="success" />}>
              <JsonViewer data={sendResponse} maxHeight={240} title="POST /send response" />
            </SectionCard>
          )}

          {/* History */}
          <SectionCard title="Send History" description="Recent visa send operations" noPadding>
            {history.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
                No sends yet — trigger a visa send above
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Group', 'CLI Command', 'HTTP', 'Latency', 'Visas', 'Status', 'Time'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left font-semibold" style={{ color: 'var(--muted-foreground)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {history.map(entry => (
                      <tr key={entry.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td className="px-4 py-2.5">
                          <p className="font-medium" style={{ color: 'var(--foreground)' }}>{entry.groupName}</p>
                          <p style={{ color: 'var(--muted-foreground)' }}>{entry.groupId}</p>
                        </td>
                        <td className="px-4 py-2.5" style={{ color: 'var(--accent)' }}>$ {entry.cliCommand}</td>
                        <td className="px-4 py-2.5" style={{ color: entry.httpStatus && entry.httpStatus < 300 ? 'var(--success)' : 'var(--error)' }}>
                          {entry.httpStatus || '—'}
                        </td>
                        <td className="px-4 py-2.5" style={{ color: entry.latencyMs < 300 ? 'var(--success)' : entry.latencyMs < 1000 ? 'var(--warning)' : 'var(--error)' }}>
                          {entry.latencyMs}ms
                        </td>
                        <td className="px-4 py-2.5" style={{ color: 'var(--foreground)' }}>{entry.visaCount ?? '—'}</td>
                        <td className="px-4 py-2.5">
                          <span className="px-1.5 py-0.5 rounded text-2xs font-semibold" style={{ backgroundColor: entry.status === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: entry.status === 'success' ? 'var(--success)' : 'var(--error)' }}>
                            {entry.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5" style={{ color: 'var(--muted-foreground)' }}>{formatTimestamp(entry.timestamp)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}