/**
 * Toque API Client
 * Maps directly to the toque Node.js bin/CLI HTTP endpoints.
 *
 * CLI → HTTP mapping:
 *   toque auth ping          → POST /auth/ping
 *   toque auth refresh       → POST /auth/refresh
 *   toque pull <groupId>     → POST /pull  { groupId }
 *   toque send <groupId>     → POST /send  { groupId }
 *   toque schedule create    → POST /schedule/create { groupId, targetTime, pullBefore }
 *   toque schedule get       → GET  /schedule/get
 *   toque schedule cancel    → POST /schedule/cancel { workflowId }
 *   toque captcha pull       → POST /captcha/pull  { limit }
 *   toque captcha watch      → GET  /captcha/watch  (SSE)
 *   toque captcha start      → POST /captcha/start
 *   toque captcha stop       → POST /captcha/stop
 *   toque captcha set        → POST /captcha/set   { ...params }
 *   toque captcha solve      → POST /captcha/solve { token }
 *   toque captcha status     → GET  /captcha/status
 *   toque groups list        → GET  /groups/list
 *   toque health             → GET  /health
 *   toque bench run          → POST /bench/run { endpoint, iterations, concurrency }
 *   toque bench results      → GET  /bench/results
 */

export interface ToqueConfig {
  baseUrl: string;
  apiKey: string;
  jwtToken: string;
  authMode: 'api-key' | 'jwt';
}

export interface ToqueResponse<T = unknown> {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
  latencyMs: number;
  cliCommand: string;
}

function getConfig(): ToqueConfig {
  if (typeof window === 'undefined') {
    return { baseUrl: 'https://toque.vortex.name.ng', apiKey: '', jwtToken: '', authMode: 'api-key' };
  }
  return {
    baseUrl: localStorage.getItem('toque_base_url') || 'https://toque.vortex.name.ng',
    apiKey: localStorage.getItem('toque_api_key') || '',
    jwtToken: localStorage.getItem('toque_jwt') || '',
    authMode: (localStorage.getItem('toque_auth_mode') as 'api-key' | 'jwt') || 'api-key',
  };
}

function buildHeaders(config: ToqueConfig): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.authMode === 'api-key' && config.apiKey) {
    h['X-API-Key'] = config.apiKey;
  } else if (config.authMode === 'jwt' && config.jwtToken) {
    h['Authorization'] = `Bearer ${config.jwtToken}`;
  }
  return h;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  cliCommand?: string
): Promise<ToqueResponse<T>> {
  const config = getConfig();
  const url = `${config.baseUrl.replace(/\/$/, '')}${path}`;
  const start = Date.now();
  const cmd = cliCommand || `toque ${path.replace(/\//g, ' ').trim()}`;

  try {
    const opts: RequestInit = {
      method,
      headers: buildHeaders(config),
    };
    if (body && !['GET', 'HEAD'].includes(method)) {
      opts.body = JSON.stringify(body);
    }

    const res = await fetch(url, opts);
    const latencyMs = Date.now() - start;

    let data: T | null = null;
    let error: string | null = null;

    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const json = await res.json();
      if (res.ok) {
        data = json as T;
      } else {
        error = json?.message || json?.error || `HTTP ${res.status}`;
      }
    } else {
      const text = await res.text();
      if (res.ok) {
        data = text as unknown as T;
      } else {
        error = text || `HTTP ${res.status}`;
      }
    }

    return { ok: res.ok, status: res.status, data, error, latencyMs, cliCommand: cmd };
  } catch (err: unknown) {
    const latencyMs = Date.now() - start;
    const msg = err instanceof Error ? err.message : 'Network error';
    return { ok: false, status: 0, data: null, error: msg, latencyMs, cliCommand: cmd };
  }
}

// ─── Health ──────────────────────────────────────────────────────────────────

export interface HealthResponse {
  status: string;
  uptime: string | number;
  container: string;
  version: string;
  worker: string;
  browser: string;
  region: string;
  lastPull: string;
  authValid: boolean;
  captchaSolved: boolean;
  workers?: number;
  queue?: number;
}

export const toqueHealth = () =>
  request<HealthResponse>('GET', '/health', undefined, 'toque health');

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthPingResponse {
  authenticated: boolean;
  token_valid: boolean;
  expires_in: number;
  user?: string;
}

export interface AuthRefreshResponse {
  token: string;
  expires_in: number;
  refreshed_at: string;
}

export const toqueAuthPing = () =>
  request<AuthPingResponse>('POST', '/auth/ping', { check: true }, 'toque auth ping');

export const toqueAuthRefresh = () =>
  request<AuthRefreshResponse>('POST', '/auth/refresh', {}, 'toque auth refresh');

// ─── Groups ───────────────────────────────────────────────────────────────────

export interface Group {
  id: string;
  name: string;
  count?: number;
  status?: string;
}

export interface GroupsListResponse {
  groups: Group[];
  total?: number;
}

export const toqueGroupsList = () =>
  request<GroupsListResponse>('GET', '/groups/list', undefined, 'toque groups list');

// ─── Pull ─────────────────────────────────────────────────────────────────────

export interface PullResponse {
  jobId: string;
  groupId: string;
  pulledCount: number;
  totalCount: number;
  durationMs: number;
  status: 'done' | 'error';
  errorMsg?: string;
}

export const toquePull = (groupId: string) =>
  request<PullResponse>('POST', '/pull', { groupId }, `toque pull ${groupId}`);

// ─── Send Visa ────────────────────────────────────────────────────────────────

export interface SendVisaResponse {
  success: boolean;
  groupId: string;
  groupName?: string;
  visasSent: number;
  processedAt: string;
  requestId: string;
  nusukResponse?: {
    status: string;
    batchId: string;
    pilgrimCount: number;
    visaType: string;
    validFrom: string;
    validTo: string;
  };
  browserSession?: {
    sessionId: string;
    captchaUsed: boolean;
    retries: number;
  };
}

export const toqueSendVisa = (groupId: string) =>
  request<SendVisaResponse>('POST', '/send', { groupId }, `toque send ${groupId}`);

// ─── Schedule ─────────────────────────────────────────────────────────────────

export interface ScheduledWorkflow {
  id: string;
  groupId: string;
  groupName?: string;
  scheduledTime: string;
  targetDate?: string;
  timezone?: string;
  status: 'pending' | 'running' | 'success' | 'error' | 'cancelled';
  pullBefore: boolean;
  retryOnFail?: boolean;
  maxRetries?: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  latencyMs?: number;
  visasSent?: number;
  errorCode?: string;
}

export interface ScheduleGetResponse {
  workflows: ScheduledWorkflow[];
  total: number;
  pending: number;
  running: number;
  success: number;
  error: number;
}

export interface ScheduleCreatePayload {
  groupId: string;
  targetTime: string;
  targetDate?: string;
  timezone?: string;
  pullBefore: boolean;
  retryOnFail?: boolean;
  maxRetries?: number;
  priority?: 'low' | 'normal' | 'high';
}

export interface ScheduleCreateResponse {
  workflowId: string;
  groupId: string;
  scheduledTime: string;
  status: 'pending';
  createdAt: string;
  estimatedExecution?: string;
}

export const toqueScheduleGet = () =>
  request<ScheduleGetResponse>('GET', '/schedule/get', undefined, 'toque schedule get');

export const toqueScheduleCreate = (payload: ScheduleCreatePayload) =>
  request<ScheduleCreateResponse>('POST', '/schedule/create', payload, `toque schedule create --group ${payload.groupId} --time ${payload.targetTime}`);

export const toqueScheduleCancel = (workflowId: string) =>
  request<{ cancelled: boolean; workflowId: string }>('POST', '/schedule/cancel', { workflowId }, `toque schedule cancel ${workflowId}`);

// ─── CAPTCHA ──────────────────────────────────────────────────────────────────

export interface CaptchaPullResponse {
  challenges: Array<{ id: string; type: string; site: string; expires: number }>;
  count: number;
  queueDepth: number;
}

export interface CaptchaStatusResponse {
  workerPool: string;
  workers: number;
  maxWorkers: number;
  queueDepth: number;
  solved1m: number;
  solved1h: number;
  avgLatencyMs: number;
  errorRate: number;
  provider: string;
  uptime: string;
}

export interface CaptchaSolveResponse {
  solved: boolean;
  token: string;
  latencyMs: number;
  provider: string;
  verification: string;
}

export const toqueCaptchaPull = (limit = 10) =>
  request<CaptchaPullResponse>('POST', '/captcha/pull', { limit }, `toque captcha pull --limit ${limit}`);

export const toqueCaptchaStart = () =>
  request<{ started: boolean; workers: number; pids: number[] }>('POST', '/captcha/start', {}, 'toque captcha start');

export const toqueCaptchaStop = () =>
  request<{ stopped: boolean; drained: number }>('POST', '/captcha/stop', {}, 'toque captcha stop');

export const toqueCaptchaSet = (params: Record<string, string | number>) =>
  request<{ applied: Record<string, unknown>; saved: boolean }>('POST', '/captcha/set', params, `toque captcha set ${Object.entries(params).map(([k, v]) => `${k}=${v}`).join(' ')}`);

export const toqueCaptchaSolve = (token: string) =>
  request<CaptchaSolveResponse>('POST', '/captcha/solve', { token }, 'toque captcha solve <token>');

export const toqueCaptchaStatus = () =>
  request<CaptchaStatusResponse>('GET', '/captcha/status', undefined, 'toque captcha status');

export const toqueCaptchaWatch = (filter = 'all') =>
  request<{ subscribed: boolean; filter: string; stream: string }>('GET', `/captcha/watch?filter=${filter}`, undefined, `toque captcha watch --filter ${filter}`);

// ─── Benchmarking ─────────────────────────────────────────────────────────────

export interface BenchRunPayload {
  endpoint: string;
  iterations: number;
  concurrency: number;
  label?: string;
}

export interface BenchRunResponse {
  runId: string;
  label: string;
  endpoint: string;
  iterations: number;
  concurrency: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  p95Ms: number;
  successRate: number;
  status: 'done' | 'error';
  startedAt: string;
  completedAt: string;
}

export const toqueBenchRun = (payload: BenchRunPayload) =>
  request<BenchRunResponse>('POST', '/bench/run', payload, `toque bench run --endpoint "${payload.endpoint}" --iter ${payload.iterations} --concurrency ${payload.concurrency}`);

export const toqueBenchResults = () =>
  request<{ runs: BenchRunResponse[] }>('GET', '/bench/results', undefined, 'toque bench results');

// ─── Network / Raw API ────────────────────────────────────────────────────────

export const toqueRawRequest = (method: string, path: string, body?: unknown) =>
  request(method, path, body, `toque api ${method} ${path}`);
