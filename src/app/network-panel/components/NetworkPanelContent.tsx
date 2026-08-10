'use client';

import React, { useState, useRef, useEffect } from 'react';
import Icon from '@/components/ui/AppIcon';



interface ChatMessage {
  id: string;
  role: 'user' | 'system' | 'error';
  content: string;
  timestamp: string;
  latencyMs?: number;
}

interface MetricPoint {
  label: string;
  value: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  color: string;
}

const INITIAL_MESSAGES: ChatMessage[] = [
  { id: 'm1', role: 'system', content: 'Connected to toque.vortex.name.ng — WebSocket channel open', timestamp: '07:00:01', latencyMs: 12 },
  { id: 'm2', role: 'user', content: 'GET /health', timestamp: '07:00:05' },
  { id: 'm3', role: 'system', content: '{"status":"ok","uptime":3600,"workers":4,"queue":0}', timestamp: '07:00:05', latencyMs: 38 },
  { id: 'm4', role: 'user', content: 'GET /groups/list', timestamp: '07:01:12' },
  { id: 'm5', role: 'system', content: '{"groups":[{"id":"GRP-001","name":"Hajj Group Alpha 2026","count":8},{"id":"GRP-002","name":"Umrah Package Delta","count":12}]}', timestamp: '07:01:12', latencyMs: 94 },
];

const METRICS: MetricPoint[] = [
  { label: 'Avg Latency', value: 94, unit: 'ms', trend: 'down', color: 'var(--success)' },
  { label: 'Req/min', value: 42, unit: 'rpm', trend: 'up', color: 'var(--accent)' },
  { label: 'Error Rate', value: 0.8, unit: '%', trend: 'stable', color: 'var(--warning)' },
  { label: 'Active Workers', value: 4, unit: '', trend: 'stable', color: 'var(--primary)' },
  { label: 'Queue Depth', value: 0, unit: '', trend: 'down', color: 'var(--success)' },
  { label: 'Uptime', value: 99.97, unit: '%', trend: 'stable', color: 'var(--success)' },
];

const LATENCY_BARS = [38, 94, 52, 120, 67, 44, 88, 210, 55, 72, 38, 49, 63, 91, 44];

export default function NetworkPanelContent() {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [wsStatus, setWsStatus] = useState<'connected' | 'disconnected'>('connected');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isSending) return;
    const userMsg: ChatMessage = {
      id: `m${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsSending(true);

    await new Promise(r => setTimeout(r, 400 + Math.random() * 600));
    const latency = Math.floor(30 + Math.random() * 200);
    const responses: Record<string, string> = {
      'GET /health': '{"status":"ok","uptime":3720,"workers":4,"queue":0}',
      'GET /groups/list': '{"groups":[{"id":"GRP-001","name":"Hajj Group Alpha 2026","count":8}]}',
      'GET /schedule/get': '{"workflows":6,"pending":2,"running":1,"success":3}',
      'POST /auth/ping': '{"authenticated":true,"token_valid":true,"expires_in":3600}',
    };
    const reply = responses[userMsg.content] ?? `{"error":"unknown_command","hint":"Try GET /health, GET /groups/list, GET /schedule/get"}`;
    const sysMsg: ChatMessage = {
      id: `m${Date.now() + 1}`,
      role: reply.includes('"error"') ? 'error' : 'system',
      content: reply,
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
      latencyMs: latency,
    };
    setMessages(prev => [...prev, sysMsg]);
    setIsSending(false);
  };

  const maxBar = Math.max(...LATENCY_BARS);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold" style={{ color: 'var(--foreground)' }}>Network</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Live API chat terminal and real-time performance metrics
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ backgroundColor: wsStatus === 'connected' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${wsStatus === 'connected' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}` }}>
          <span className="w-2 h-2 rounded-full pulse-dot" style={{ backgroundColor: wsStatus === 'connected' ? 'var(--success)' : 'var(--error)' }} />
          <span className="text-xs font-semibold" style={{ color: wsStatus === 'connected' ? 'var(--success)' : 'var(--error)' }}>
            WS {wsStatus === 'connected' ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {METRICS.map(m => (
          <div key={m.label} className="card-surface p-3 flex flex-col gap-1">
            <span className="text-2xs uppercase tracking-widest" style={{ color: 'var(--muted-foreground)' }}>{m.label}</span>
            <div className="flex items-end gap-1">
              <span className="text-xl font-bold font-mono" style={{ color: m.color }}>{m.value}</span>
              {m.unit && <span className="text-2xs mb-0.5" style={{ color: 'var(--muted-foreground)' }}>{m.unit}</span>}
            </div>
            <div className="flex items-center gap-1">
              <Icon name={m.trend === 'up' ? 'ArrowUpIcon' : m.trend === 'down' ? 'ArrowDownIcon' : 'MinusIcon'} size={10} />
              <span className="text-2xs" style={{ color: 'var(--muted-foreground)' }}>{m.trend}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Chat terminal */}
        <div className="lg:col-span-3 card-surface flex flex-col" style={{ height: '420px' }}>
          <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2">
              <Icon name="CommandLineIcon" size={14} style={{ color: 'var(--accent)' }} />
              <span className="text-xs font-semibold font-mono" style={{ color: 'var(--foreground)' }}>API Terminal</span>
            </div>
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#ef4444' }} />
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#f59e0b' }} />
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#22c55e' }} />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-xs" style={{ backgroundColor: '#050508' }}>
            {messages.map(msg => (
              <div key={msg.id} className="flex gap-2">
                <span style={{ color: 'var(--muted-foreground)', minWidth: '56px' }}>{msg.timestamp}</span>
                <span style={{ color: msg.role === 'user' ? 'var(--accent)' : msg.role === 'error' ? 'var(--error)' : 'var(--success)', minWidth: '14px' }}>
                  {msg.role === 'user' ? '›' : msg.role === 'error' ? '✗' : '‹'}
                </span>
                <span className="flex-1 break-all" style={{ color: msg.role === 'user' ? 'var(--foreground)' : msg.role === 'error' ? 'var(--error)' : '#86efac' }}>
                  {msg.content}
                </span>
                {msg.latencyMs !== undefined && (
                  <span style={{ color: msg.latencyMs > 150 ? 'var(--warning)' : 'var(--muted-foreground)', minWidth: '48px', textAlign: 'right' }}>
                    {msg.latencyMs}ms
                  </span>
                )}
              </div>
            ))}
            {isSending && (
              <div className="flex gap-2">
                <span style={{ color: 'var(--muted-foreground)', minWidth: '56px' }}>--:--:--</span>
                <span style={{ color: 'var(--muted-foreground)' }}>‹</span>
                <span style={{ color: 'var(--muted-foreground)' }}>processing...</span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <div className="flex gap-2 p-3" style={{ borderTop: '1px solid var(--border)', backgroundColor: '#050508' }}>
            <span className="font-mono text-xs self-center" style={{ color: 'var(--accent)' }}>›</span>
            <input
              className="flex-1 bg-transparent font-mono text-xs outline-none"
              style={{ color: 'var(--foreground)' }}
              placeholder="GET /health, POST /auth/ping..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              disabled={isSending}
            />
            <button
              onClick={handleSend}
              disabled={isSending || !input.trim()}
              className="btn-primary px-3 py-1.5 text-xs"
            >
              Send
            </button>
          </div>
        </div>

        {/* Latency chart */}
        <div className="lg:col-span-2 card-surface flex flex-col" style={{ height: '420px' }}>
          <div className="px-4 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
            <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>Latency History</span>
            <p className="text-2xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>Last 15 requests (ms)</p>
          </div>
          <div className="flex-1 p-4 flex flex-col justify-end gap-1">
            <div className="flex items-end gap-1.5 h-48">
              {LATENCY_BARS.map((val, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t transition-all"
                    style={{
                      height: `${(val / maxBar) * 100}%`,
                      backgroundColor: val > 150 ? 'var(--error)' : val > 80 ? 'var(--warning)' : 'var(--success)',
                      opacity: 0.8,
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-2xs font-mono" style={{ color: 'var(--muted-foreground)' }}>oldest</span>
              <span className="text-2xs font-mono" style={{ color: 'var(--muted-foreground)' }}>latest</span>
            </div>
            <div className="flex gap-4 mt-3">
              {[{ label: '< 80ms', color: 'var(--success)' }, { label: '80–150ms', color: 'var(--warning)' }, { label: '> 150ms', color: 'var(--error)' }].map(l => (
                <div key={l.label} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: l.color }} />
                  <span className="text-2xs" style={{ color: 'var(--muted-foreground)' }}>{l.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
