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

type AuthMode = 'api-key' | 'jwt';
type ConnectionStatus = 'connected' | 'disconnected' | 'checking';

interface ConfigFormValues {
  baseUrl: string;
  apiKey: string;
  jwtToken: string;
}

// Mock health response — backend: GET /health
const MOCK_HEALTH_RESPONSE = {
  status: 'healthy',
  uptime: '2d 14h 32m',
  container: 'running',
  version: '1.2.0',
  worker: 'active',
  browser: 'stealth',
  region: 'MEA',
  lastPull: '2026-08-10T06:44:12Z',
  authValid: true,
  captchaSolved: false,
};

const MOCK_LATENCY = 142;

export default function AuthPanelContent() {
  const [authMode, setAuthMode] = useState<AuthMode>('api-key');
  const [showApiKey, setShowApiKey] = useState(false);
  const [showJwt, setShowJwt] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [testLatency, setTestLatency] = useState<number | null>(null);
  const [healthData, setHealthData] = useState<typeof MOCK_HEALTH_RESPONSE | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastTestedAt, setLastTestedAt] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const { register, handleSubmit, setValue, watch, formState: { errors, isDirty } } = useForm<ConfigFormValues>({
    defaultValues: {
      baseUrl: 'https://toque.vortex.name.ng',
      apiKey: '',
      jwtToken: '',
    },
  });

  const watchedBaseUrl = watch('baseUrl');

  // Load from localStorage
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
    }, 600);
    return () => clearTimeout(timer);
  }, [setValue]);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestError(null);
    setConnectionStatus('checking');

    // Backend integration point: GET /health with auth headers
    await new Promise(r => setTimeout(r, 1200));

    const success = Math.random() > 0.15;
    if (success) {
      setConnectionStatus('connected');
      setHealthData(MOCK_HEALTH_RESPONSE);
      setTestLatency(MOCK_LATENCY);
      setLastTestedAt(new Date().toLocaleTimeString('en-US', { hour12: false }));
      localStorage.setItem('toque_connection_status', 'connected');
      toast.success('Connection established — container is healthy');
    } else {
      setConnectionStatus('disconnected');
      setTestError('GET /health returned 502 — container may be starting up. Check your base URL and API key.');
      localStorage.setItem('toque_connection_status', 'disconnected');
      toast.error('Connection failed — see error details below');
    }

    setIsTesting(false);
  };

  const onSave = handleSubmit(async (data) => {
    setIsSaving(true);
    await new Promise(r => setTimeout(r, 400));
    localStorage.setItem('toque_base_url', data.baseUrl);
    localStorage.setItem('toque_api_key', data.apiKey);
    localStorage.setItem('toque_jwt', data.jwtToken);
    localStorage.setItem('toque_auth_mode', authMode);
    setIsSaving(false);
    toast.success('Configuration saved to local storage');
  });

  const handleClearAll = () => {
    localStorage.removeItem('toque_base_url');
    localStorage.removeItem('toque_api_key');
    localStorage.removeItem('toque_jwt');
    localStorage.removeItem('toque_auth_mode');
    localStorage.removeItem('toque_connection_status');
    setValue('baseUrl', 'https://toque.vortex.name.ng');
    setValue('apiKey', '');
    setValue('jwtToken', '');
    setAuthMode('api-key');
    setConnectionStatus('disconnected');
    setHealthData(null);
    setTestLatency(null);
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
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold" style={{ color: 'var(--foreground)' }}>
            Authentication
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Configure connection to your Toque/Nusuk Cloudflare Worker container
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isDirty && (
            <span
              className="text-xs font-mono px-2 py-1 rounded"
              style={{ backgroundColor: 'rgba(245,158,11,0.1)', color: 'var(--warning)', border: '1px solid rgba(245,158,11,0.25)' }}
            >
              Unsaved changes
            </span>
          )}
          <StatusBadge status={connectionStatus} />
          {testLatency !== null && <TimingDisplay ms={testLatency} />}
        </div>
      </div>

      <form onSubmit={onSave}>
        <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-2 gap-5">
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
              {/* Base URL */}
              <div>
                <label htmlFor="baseUrl" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>
                  Base URL
                </label>
                <p className="text-xs mb-2" style={{ color: 'var(--muted-foreground)' }}>
                  The root URL of your Toque Cloudflare Worker deployment
                </p>
                <input
                  id="baseUrl"
                  type="url"
                  className="input-field w-full px-3 py-2.5 font-mono text-sm"
                  placeholder="https://toque.vortex.name.ng"
                  {...register('baseUrl', {
                    required: 'Base URL is required',
                    pattern: {
                      value: /^https?:\/\/.+/,
                      message: 'Must be a valid URL starting with http:// or https://',
                    },
                  })}
                />
                {errors.baseUrl && (
                  <p className="mt-1.5 text-xs" style={{ color: 'var(--error)' }}>
                    {errors.baseUrl.message}
                  </p>
                )}
              </div>

              {/* Current URL preview */}
              <div
                className="flex items-center gap-2 p-3 rounded font-mono text-xs"
                style={{ backgroundColor: 'var(--input)', border: '1px solid var(--border)' }}
              >
                <Icon name="GlobeAltIcon" size={13} />
                <span style={{ color: 'var(--muted-foreground)' }}>Active endpoint:</span>
                <span className="truncate" style={{ color: 'var(--accent)' }}>
                  {watchedBaseUrl || 'Not set'}
                </span>
              </div>

              {/* Auth mode toggle */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                  Authentication Mode
                </label>
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
                <p className="mt-1.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  {authMode === 'api-key' ?'Sends X-API-Key header with every request' :'Sends Cf-Access-Jwt-Assertion header — for Cloudflare Access protected workers'}
                </p>
              </div>
            </div>
          </SectionCard>

          {/* Credentials */}
          <SectionCard
            title={authMode === 'api-key' ? 'API Key Credential' : 'JWT Token Credential'}
            description={authMode === 'api-key' ? 'Sent as X-API-Key header' : 'Sent as Cf-Access-Jwt-Assertion header'}
          >
            <div className="space-y-5">
              {authMode === 'api-key' ? (
                <div>
                  <label htmlFor="apiKey" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>
                    API Key
                  </label>
                  <p className="text-xs mb-2" style={{ color: 'var(--muted-foreground)' }}>
                    Your Toque worker X-API-Key value. Stored in localStorage — not transmitted to any third party.
                  </p>
                  <div className="relative">
                    <input
                      id="apiKey"
                      type={showApiKey ? 'text' : 'password'}
                      className="input-field w-full px-3 py-2.5 font-mono text-sm pr-10"
                      placeholder="tq_live_xxxxxxxxxxxxxxxxxxxx"
                      {...register('apiKey', {
                        required: authMode === 'api-key' ? 'API Key is required' : false,
                      })}
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(v => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2"
                      style={{ color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                      aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                    >
                      <Icon name={showApiKey ? 'EyeSlashIcon' : 'EyeIcon'} size={15} />
                    </button>
                  </div>
                  {errors.apiKey && (
                    <p className="mt-1.5 text-xs" style={{ color: 'var(--error)' }}>
                      {errors.apiKey.message}
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <label htmlFor="jwtToken" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>
                    CF Access JWT Token
                  </label>
                  <p className="text-xs mb-2" style={{ color: 'var(--muted-foreground)' }}>
                    Cloudflare Access JWT assertion token from your CF Access app. Usually starts with eyJ...
                  </p>
                  <div className="relative">
                    <textarea
                      id="jwtToken"
                      rows={3}
                      className="input-field w-full px-3 py-2.5 font-mono text-xs pr-10 resize-none"
                      placeholder="eyJhbGciOiJSUzI1NiIsImtpZCI6..."
                      style={{ lineHeight: '1.6' }}
                      {...register('jwtToken', {
                        required: authMode === 'jwt' ? 'JWT token is required' : false,
                      })}
                    />
                    <button
                      type="button"
                      onClick={() => setShowJwt(v => !v)}
                      className="absolute right-2.5 top-3"
                      style={{ color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                      aria-label={showJwt ? 'Hide JWT' : 'Show JWT'}
                    >
                      <Icon name={showJwt ? 'EyeSlashIcon' : 'EyeIcon'} size={15} />
                    </button>
                  </div>
                  {errors.jwtToken && (
                    <p className="mt-1.5 text-xs" style={{ color: 'var(--error)' }}>
                      {errors.jwtToken.message}
                    </p>
                  )}
                </div>
              )}

              {/* Security notice */}
              <div
                className="flex items-start gap-2 p-3 rounded text-xs"
                style={{ backgroundColor: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)' }}
              >
                <Icon name="ShieldCheckIcon" size={13} className="shrink-0 mt-0.5" />
                <p style={{ color: 'var(--muted-foreground)' }}>
                  Credentials are stored only in your browser&apos;s localStorage and sent directly to your configured base URL. They are never transmitted to any external service.
                </p>
              </div>

              {/* Key fingerprint preview */}
              {watch('apiKey') && authMode === 'api-key' && (
                <div
                  className="flex items-center gap-2 p-2.5 rounded font-mono text-xs"
                  style={{ backgroundColor: 'var(--input)', border: '1px solid var(--border)' }}
                >
                  <Icon name="FingerPrintIcon" size={13} />
                  <span style={{ color: 'var(--muted-foreground)' }}>Key:</span>
                  <span style={{ color: 'var(--accent)' }}>
                    {watch('apiKey').slice(0, 8)}{'•'.repeat(Math.max(0, watch('apiKey').length - 8))}
                  </span>
                  <span className="ml-auto" style={{ color: 'var(--muted-foreground)' }}>
                    {watch('apiKey').length} chars
                  </span>
                </div>
              )}
            </div>
          </SectionCard>
        </div>

        {/* Action buttons */}
        <div
          className="flex items-center gap-3 mt-4 p-4 rounded-lg"
          style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <button
            type="submit"
            disabled={isSaving}
            className="btn-primary px-5 py-2.5 text-sm"
          >
            {isSaving ? <LoadingSpinner size={14} /> : <Icon name="CloudArrowUpIcon" size={15} />}
            {isSaving ? 'Saving...' : 'Save Configuration'}
          </button>

          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting}
            className="btn-ghost px-5 py-2.5 text-sm"
          >
            {isTesting ? <LoadingSpinner size={14} /> : <Icon name="SignalIcon" size={15} />}
            {isTesting ? 'Testing...' : 'Test Connection'}
          </button>

          <div className="flex-1" />

          <button
            type="button"
            onClick={handleClearAll}
            className="btn-danger px-4 py-2.5 text-sm"
          >
            <Icon name="TrashIcon" size={14} />
            Clear All
          </button>
        </div>
      </form>

      {/* Test error */}
      {testError && (
        <ErrorAlert
          message="Connection test failed"
          detail={testError}
          onRetry={handleTestConnection}
        />
      )}

      {/* Health response viewer */}
      {healthData && (
        <SectionCard
          title="Health Response"
          description={`GET /health — ${testLatency}ms`}
          headerRight={
            <div className="flex items-center gap-2">
              {testLatency !== null && <TimingDisplay ms={testLatency} showLabel={false} />}
              <StatusBadge status="connected" label="Healthy" />
              {lastTestedAt && (
                <span className="text-xs font-mono" style={{ color: 'var(--muted-foreground)' }}>
                  at {lastTestedAt}
                </span>
              )}
            </div>
          }
        >
          <JsonViewer data={healthData} maxHeight={280} title="GET /health" />
        </SectionCard>
      )}

      {/* Connection checklist */}
      <SectionCard title="Connection Checklist" description="Verify all requirements before running visa operations">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {[
            { label: 'Base URL configured', ok: !!watchedBaseUrl, detail: watchedBaseUrl || 'Not set' },
            { label: 'Auth credential set', ok: !!(watch('apiKey') || watch('jwtToken')), detail: authMode === 'api-key' ? 'X-API-Key' : 'CF JWT' },
            { label: 'Container reachable', ok: connectionStatus === 'connected', detail: connectionStatus === 'connected' ? 'Healthy' : 'Not tested' },
            { label: 'Worker active', ok: healthData?.worker === 'active', detail: healthData?.worker ?? 'Unknown' },
            { label: 'Auth valid', ok: healthData?.authValid === true, detail: healthData?.authValid ? 'Valid' : 'Unknown' },
            { label: 'Region set', ok: !!healthData?.region, detail: healthData?.region ?? 'Unknown' },
          ].map(item => (
            <div
              key={`checklist-${item.label}`}
              className="flex items-center gap-3 p-3 rounded"
              style={{
                backgroundColor: item.ok ? 'rgba(34,197,94,0.05)' : 'rgba(100,116,139,0.05)',
                border: `1px solid ${item.ok ? 'rgba(34,197,94,0.15)' : 'var(--border)'}`,
              }}
            >
              <span className="shrink-0">
                <Icon
                  name={item.ok ? 'CheckCircleIcon' : 'XCircleIcon'}
                  size={16}
                  variant={item.ok ? 'solid' : 'outline'}
                />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium" style={{ color: item.ok ? 'var(--success)' : 'var(--muted-foreground)' }}>
                  {item.label}
                </p>
                <p className="text-2xs font-mono truncate" style={{ color: 'var(--muted-foreground)' }}>
                  {item.detail}
                </p>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Container metadata */}
      {healthData && (
        <SectionCard title="Container Metadata" description="Runtime details from last health check">
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-4 gap-4">
            {[
              { label: 'Version', value: healthData.version, icon: 'TagIcon' },
              { label: 'Uptime', value: healthData.uptime, icon: 'ClockIcon' },
              { label: 'Browser', value: healthData.browser, icon: 'ComputerDesktopIcon' },
              { label: 'Region', value: healthData.region, icon: 'MapPinIcon' },
            ].map(stat => (
              <div
                key={`meta-${stat.label}`}
                className="p-4 rounded-lg"
                style={{ backgroundColor: 'var(--input)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <Icon name={stat.icon as Parameters<typeof Icon>[0]['name']} size={13} />
                  <span className="text-xs uppercase tracking-wider font-medium" style={{ color: 'var(--muted-foreground)', letterSpacing: '0.06em' }}>
                    {stat.label}
                  </span>
                </div>
                <p className="font-mono font-semibold text-base" style={{ color: 'var(--foreground)' }}>
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}