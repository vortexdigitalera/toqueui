'use client';

import React, { useState, useEffect } from 'react';
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
import {
  toqueHealth,
  toqueAuthPing,
  toqueAuthRefresh,
  type HealthResponse,
} from '@/lib/toque/client';

type AuthMode = 'api-key' | 'jwt';
type ConnectionStatus = 'connected' | 'disconnected' | 'checking';

interface ConfigFormValues {
  baseUrl: string;
  apiKey: string;
  jwtToken: string;
}

export default function AuthPanelContent() {
  const [authMode, setAuthMode] = useState<AuthMode>('api-key');
  const [showApiKey, setShowApiKey] = useState(false);
  const [showJwt, setShowJwt] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [testLatency, setTestLatency] = useState<number | null>(null);
  const [healthData, setHealthData] = useState<HealthResponse | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastTestedAt, setLastTestedAt] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [cliLog, setCliLog] = useState<string[]>([]);

  const { register, handleSubmit, setValue, watch, formState: { errors, isDirty } } = useForm<ConfigFormValues>({
    defaultValues: {
      baseUrl: 'https://toque.vortex.name.ng',
      apiKey: '',
      jwtToken: '',
    },
  });

  const watchedBaseUrl = watch('baseUrl');

  useEffect(() => {
    const timer = setTimeout(() => {
      const storedUrl = localStorage.getItem('toque_base_url') || 'https://toque.vortex.name.ng';
      const storedKey = localStorage.getItem('toque_api_key') || '';
      const storedJwt = localStorage.getItem('toque_jwt') || '';
      const storedMode = (localStorage.getItem('toque_auth_mode') as AuthMode) || 'api-key';
      const storedStatus = (localStorage.getItem('toque_connection_status') as ConnectionStatus) || 'disconnected';
      setValue('baseUrl', storedUrl);
      setValue('apiKey', storedKey);
      setValue('jwtToken', storedJwt);
      setAuthMode(storedMode);
      setConnectionStatus(storedStatus);
      setIsLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [setValue]);

  const appendLog = (line: string) =>
    setCliLog(prev => [...prev.slice(-49), line]);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestError(null);
    setConnectionStatus('checking');
    setCliLog([]);

    appendLog('$ toque health');
    appendLog('→ Connecting to ' + (watchedBaseUrl || 'https://toque.vortex.name.ng') + ' ...');

    const result = await toqueHealth();
    setTestLatency(result.latencyMs);

    if (result.ok && result.data) {
      setConnectionStatus('connected');
      setHealthData(result.data);
      setLastTestedAt(new Date().toLocaleTimeString('en-US', { hour12: false }));
      localStorage.setItem('toque_connection_status', 'connected');
      appendLog(`✓ GET /health → ${result.status} (${result.latencyMs}ms)`);
      appendLog(`  status: ${result.data.status}  version: ${result.data.version || '—'}  workers: ${result.data.workers ?? '—'}`);
      toast.success('Connection established — container is healthy');
    } else {
      setConnectionStatus('disconnected');
      const errMsg = result.error || `HTTP ${result.status}`;
      setTestError(`GET /health → ${result.status || 'ERR'}: ${errMsg}. Check base URL and API key.`);
      localStorage.setItem('toque_connection_status', 'disconnected');
      appendLog(`✗ GET /health → ${result.status || 'ERR'}: ${errMsg}`);
      toast.error('Connection failed — see error details below');
    }

    setIsTesting(false);
  };

  const handleAuthPing = async () => {
    appendLog('$ toque auth ping');
    const result = await toqueAuthPing();
    if (result.ok && result.data) {
      appendLog(`✓ POST /auth/ping → ${result.status} (${result.latencyMs}ms)`);
      appendLog(`  authenticated: ${result.data.authenticated}  token_valid: ${result.data.token_valid}  expires_in: ${result.data.expires_in}s`);
      toast.success(`Auth ping OK — token valid for ${result.data.expires_in}s`);
    } else {
      appendLog(`✗ POST /auth/ping → ${result.status || 'ERR'}: ${result.error}`);
      toast.error('Auth ping failed: ' + result.error);
    }
  };

  const handleAuthRefresh = async () => {
    setIsRefreshing(true);
    appendLog('$ toque auth refresh');
    const result = await toqueAuthRefresh();
    if (result.ok && result.data) {
      appendLog(`✓ POST /auth/refresh → ${result.status} (${result.latencyMs}ms)`);
      appendLog(`  new token issued  expires_in: ${result.data.expires_in}s`);
      if (result.data.token) {
        setValue('jwtToken', result.data.token);
        localStorage.setItem('toque_jwt', result.data.token);
      }
      toast.success('Auth token refreshed');
    } else {
      appendLog(`✗ POST /auth/refresh → ${result.status || 'ERR'}: ${result.error}`);
      toast.error('Token refresh failed: ' + result.error);
    }
    setIsRefreshing(false);
  };

  const onSave = handleSubmit(async (data) => {
    setIsSaving(true);
    localStorage.setItem('toque_base_url', data.baseUrl);
    localStorage.setItem('toque_api_key', data.apiKey);
    localStorage.setItem('toque_jwt', data.jwtToken);
    localStorage.setItem('toque_auth_mode', authMode);
    await new Promise(r => setTimeout(r, 200));
    setIsSaving(false);
    toast.success('Configuration saved');
  });

  const handleClearAll = () => {
    ['toque_base_url', 'toque_api_key', 'toque_jwt', 'toque_auth_mode', 'toque_connection_status'].forEach(k => localStorage.removeItem(k));
    setValue('baseUrl', 'https://toque.vortex.name.ng');
    setValue('apiKey', '');
    setValue('jwtToken', '');
    setAuthMode('api-key');
    setConnectionStatus('disconnected');
    setHealthData(null);
    setTestLatency(null);
    setCliLog([]);
    toast.success('Configuration cleared');
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <SkeletonBlock height={28} width="220px" />
        <SkeletonBlock height={12} width="340px" />
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-6">
          <SkeletonBlock height={320} />
          <SkeletonBlock height={320} />
        </div>
        <SkeletonBlock height={240} />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold" style={{ color: 'var(--foreground)' }}>Authentication</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Configure connection to your Toque/Nusuk Cloudflare Worker — wired to <span className="font-mono text-xs" style={{ color: 'var(--accent)' }}>GET /health · POST /auth/ping · POST /auth/refresh</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isDirty && (
            <span className="text-xs font-mono px-2 py-1 rounded" style={{ backgroundColor: 'rgba(245,158,11,0.1)', color: 'var(--warning)', border: '1px solid rgba(245,158,11,0.25)' }}>
              Unsaved changes
            </span>
          )}
          <StatusBadge status={connectionStatus} />
          {testLatency !== null && <TimingDisplay ms={testLatency} />}
        </div>
      </div>

      <form onSubmit={onSave}>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {/* Connection Config */}
          <SectionCard
            title="Connection Configuration"
            description="Base URL of your deployed Toque Worker endpoint"
            headerRight={
              <span className="font-mono text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}>
                Cloudflare Worker
              </span>
            }
          >
            <div className="space-y-5">
              <div>
                <label htmlFor="baseUrl" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>Base URL</label>
                <p className="text-xs mb-2" style={{ color: 'var(--muted-foreground)' }}>Root URL of your Toque Cloudflare Worker deployment</p>
                <input
                  id="baseUrl"
                  type="url"
                  className="input-field w-full px-3 py-2.5 font-mono text-sm"
                  placeholder="https://toque.vortex.name.ng"
                  {...register('baseUrl', {
                    required: 'Base URL is required',
                    pattern: { value: /^https?:\/\/.+/, message: 'Must be a valid URL' },
                  })}
                />
                {errors.baseUrl && <p className="mt-1.5 text-xs" style={{ color: 'var(--error)' }}>{errors.baseUrl.message}</p>}
              </div>

              <div className="flex items-center gap-2 p-3 rounded font-mono text-xs" style={{ backgroundColor: 'var(--input)', border: '1px solid var(--border)' }}>
                <Icon name="GlobeAltIcon" size={13} />
                <span style={{ color: 'var(--muted-foreground)' }}>Active endpoint:</span>
                <span className="truncate" style={{ color: 'var(--accent)' }}>{watchedBaseUrl || 'Not set'}</span>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>Authentication Mode</label>
                <div className="flex gap-2">
                  {(['api-key', 'jwt'] as AuthMode[]).map(mode => (
                    <button
                      key={`auth-mode-${mode}`}
                      type="button"
                      onClick={() => setAuthMode(mode)}
                      className="flex-1 py-2 px-3 rounded text-xs font-semibold transition-all duration-150"
                      style={{
                        backgroundColor: authMode === mode ? 'var(--primary)' : 'var(--input)',
                        color: authMode === mode ? 'white' : 'var(--muted-foreground)',
                        border: `1px solid ${authMode === mode ? 'var(--primary)' : 'var(--border)'}`,
                      }}
                    >
                      {mode === 'api-key' ? 'X-API-Key' : 'CF JWT Assertion'}
                    </button>
                  ))}
                </div>
              </div>

              {authMode === 'api-key' ? (
                <div>
                  <label htmlFor="apiKey" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>API Key</label>
                  <div className="relative">
                    <input
                      id="apiKey"
                      type={showApiKey ? 'text' : 'password'}
                      className="input-field w-full px-3 py-2.5 font-mono text-sm pr-10"
                      placeholder="toque_key_..."
                      {...register('apiKey')}
                    />
                    <button type="button" onClick={() => setShowApiKey(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Icon name={showApiKey ? 'EyeSlashIcon' : 'EyeIcon'} size={15} />
                    </button>
                  </div>
                  <p className="mt-1.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>Sent as <span className="font-mono">X-API-Key</span> header</p>
                </div>
              ) : (
                <div>
                  <label htmlFor="jwtToken" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>JWT Token</label>
                  <div className="relative">
                    <input
                      id="jwtToken"
                      type={showJwt ? 'text' : 'password'}
                      className="input-field w-full px-3 py-2.5 font-mono text-sm pr-10"
                      placeholder="eyJhbGciOiJSUzI1NiJ9..."
                      {...register('jwtToken')}
                    />
                    <button type="button" onClick={() => setShowJwt(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Icon name={showJwt ? 'EyeSlashIcon' : 'EyeIcon'} size={15} />
                    </button>
                  </div>
                  <p className="mt-1.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>Sent as <span className="font-mono">Authorization: Bearer</span> header</p>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={isSaving} className="btn-primary flex-1 py-2.5 text-sm">
                  {isSaving ? <LoadingSpinner size={14} /> : <Icon name="CheckIcon" size={14} />}
                  {isSaving ? 'Saving...' : 'Save Configuration'}
                </button>
                <button type="button" onClick={handleClearAll} className="btn-ghost px-4 py-2.5 text-sm">
                  <Icon name="TrashIcon" size={14} />
                  Clear
                </button>
              </div>
            </div>
          </SectionCard>

          {/* Connection Test */}
          <SectionCard
            title="Connection Test"
            description="Test live connection to toque backend"
            headerRight={lastTestedAt ? (
              <span className="text-xs font-mono" style={{ color: 'var(--muted-foreground)' }}>Last: {lastTestedAt}</span>
            ) : undefined}
          >
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="btn-primary w-full py-3 text-sm font-semibold"
                >
                  {isTesting ? <LoadingSpinner size={16} /> : <Icon name="SignalIcon" size={16} />}
                  {isTesting ? 'Testing...' : 'Test Connection — GET /health'}
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleAuthPing}
                    disabled={isTesting}
                    className="btn-ghost py-2.5 text-sm"
                  >
                    <Icon name="KeyIcon" size={14} />
                    Auth Ping
                  </button>
                  <button
                    type="button"
                    onClick={handleAuthRefresh}
                    disabled={isRefreshing}
                    className="btn-ghost py-2.5 text-sm"
                  >
                    {isRefreshing ? <LoadingSpinner size={14} /> : <Icon name="ArrowPathIcon" size={14} />}
                    Refresh Token
                  </button>
                </div>
              </div>

              {testError && (
                <ErrorAlert
                  message="Connection failed"
                  detail={testError}
                  onRetry={handleTestConnection}
                />
              )}

              {/* CLI log */}
              {cliLog.length > 0 && (
                <div
                  className="rounded-lg p-3 font-mono text-xs space-y-0.5 overflow-y-auto"
                  style={{ backgroundColor: '#050508', border: '1px solid var(--border)', maxHeight: '160px' }}
                >
                  {cliLog.map((line, i) => (
                    <div
                      key={`cli-log-${i}`}
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
              )}

              {healthData && (
                <JsonViewer
                  data={healthData}
                  maxHeight={200}
                  title="GET /health response"
                />
              )}
            </div>
          </SectionCard>
        </div>
      </form>

      {/* CLI Reference */}
      <SectionCard title="CLI Command Reference" description="Toque bin commands mapped to this panel">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { cmd: 'toque health', http: 'GET /health', desc: 'Check container health, uptime, worker status' },
            { cmd: 'toque auth ping', http: 'POST /auth/ping', desc: 'Verify current auth token is valid' },
            { cmd: 'toque auth refresh', http: 'POST /auth/refresh', desc: 'Obtain a fresh JWT from the container' },
          ].map(item => (
            <div key={item.cmd} className="p-3 rounded-lg" style={{ backgroundColor: 'var(--input)', border: '1px solid var(--border)' }}>
              <p className="font-mono text-xs font-bold mb-1" style={{ color: 'var(--accent)' }}>$ {item.cmd}</p>
              <p className="font-mono text-xs mb-1.5" style={{ color: 'var(--muted-foreground)' }}>→ {item.http}</p>
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}