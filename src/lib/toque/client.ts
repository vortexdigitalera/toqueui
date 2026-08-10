/**
 * Toque API Client
 * Maps directly to the toque Node.js bin/CLI HTTP endpoints.
 *
 * CLI → HTTP mapping:
 *   toque auth ping          → POST /ping
 *   toque auth refresh       → POST /refresh
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

export type FailureCategory = 'timeout' | 'invalid_auth' | 'backend_down' | 'network' | 'client_error' | 'unknown';

export interface RecoveryHint {
  category: FailureCategory;
  title: string;
  hint: string;
  action?: string;
}

export interface ToqueResponse<T = unknown> {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
  latencyMs: number;
  cliCommand: string;
  attempts?: number;
  failureCategory?: FailureCategory;
  recoveryHint?: RecoveryHint;
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

/**
 * Build the proxy URL for a given API path.
 * All requests go through /api/toque/<path> (Next.js server-side proxy)
 * to avoid CORS and network issues when fetching from the browser.
 * The real backend base URL is forwarded as ?_target=<baseUrl>.
 */
function buildProxyUrl(config: ToqueConfig, path: string): string {
  // Strip leading slash from path for the proxy route
  const cleanPath = path.replace(/^\//, '');
  const proxyBase = '/api/toque';
  const targetParam = encodeURIComponent(config.baseUrl.replace(/\/$/, ''));
  return `${proxyBase}/${cleanPath}?_target=${targetParam}`;
}

// ─── Failure Categorization ───────────────────────────────────────────────────

function categorizeFailure(status: number, error: string | null, latencyMs: number): RecoveryHint {
  const msg = (error || '').toLowerCase();

  // Timeout: request took too long or timed out explicitly
  if (latencyMs > 8000 || msg.includes('timeout') || msg.includes('timed out') || msg.includes('aborted')) {
    return {
      category: 'timeout',
      title: 'Request Timed Out',
      hint: 'The backend did not respond within the expected window. The container may be cold-starting or under heavy load.',
      action: 'Wait 15–30 seconds and retry. If the issue persists, check container uptime via the Cloudflare dashboard.',
    };
  }

  // Invalid auth: 401 / 403 or auth-related error messages
  if (status === 401 || status === 403 || msg.includes('unauthorized') || msg.includes('forbidden') || msg.includes('invalid api key') || msg.includes('invalid token') || msg.includes('jwt') || msg.includes('api key')) {
    return {
      category: 'invalid_auth',
      title: 'Authentication Failed',
      hint: 'Your API key or JWT token was rejected by the backend. The credential may be expired, revoked, or incorrect.',
      action: 'Verify your API key in the Connection Configuration panel. If using JWT, try "Refresh Token" to obtain a fresh credential.',
    };
  }

  // Backend down: 502/503/504 or connection refused / failed to fetch
  if (status === 502 || status === 503 || status === 504 || msg.includes('failed to fetch') || msg.includes('connection refused') || msg.includes('econnrefused') || msg.includes('network error') || msg.includes('fetch failed') || status === 0) {
    return {
      category: 'backend_down',
      title: 'Backend Unreachable',
      hint: 'The Toque Worker could not be reached. The service may be down, the base URL may be wrong, or a network issue is blocking the request.',
      action: 'Check the base URL is correct and the Cloudflare Worker is deployed and running. Verify there are no firewall or DNS issues.',
    };
  }

  // 4xx client errors (not auth)
  if (status >= 400 && status < 500) {
    return {
      category: 'client_error',
      title: 'Client Request Error',
      hint: `The server returned HTTP ${status}. The request may be malformed or the endpoint may not exist.`,
      action: 'Check the endpoint path and request body. Refer to the CLI Command Reference for correct usage.',
    };
  }

  // 5xx server errors (not 502/503/504 already handled)
  if (status >= 500) {
    return {
      category: 'backend_down',
      title: 'Server Error',
      hint: `The backend returned HTTP ${status}, indicating an internal server error.`,
      action: 'Check the Toque Worker logs in the Cloudflare dashboard for details. The container may need a restart.',
    };
  }

  return {
    category: 'unknown',
    title: 'Unknown Error',
    hint: error || 'An unexpected error occurred.',
    action: 'Check the base URL, API key, and network connectivity, then retry.',
  };
}

// ─── Exponential Backoff Retry ────────────────────────────────────────────────

interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  retryOn?: (status: number, error: string | null) => boolean;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  baseDelayMs: 400,
  maxDelayMs: 5000,
  retryOn: (status, error) => {
    // Retry on network errors (status 0), 502, 503, 504, and timeouts
    if (status === 0) return true;
    if (status === 502 || status === 503 || status === 504) return true;
    const msg = (error || '').toLowerCase();
    if (msg.includes('timeout') || msg.includes('failed to fetch') || msg.includes('network error') || msg.includes('fetch failed')) return true;
    return false;
  },
};

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function jitter(ms: number): number {
  return ms + Math.floor(Math.random() * ms * 0.3);
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  cliCommand?: string,
  retryOptions?: RetryOptions
): Promise<ToqueResponse<T>> {
  const config = getConfig();
  const url = buildProxyUrl(config, path);
  const cmd = cliCommand || `toque ${path.replace(/\//g, ' ').trim()}`;
  const opts: Required<RetryOptions> = { ...DEFAULT_RETRY_OPTIONS, ...retryOptions };

  let lastResult: ToqueResponse<T> | null = null;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    const start = Date.now();

    try {
      const fetchOpts: RequestInit = {
        method,
        headers: buildHeaders(config),
        signal: AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined,
      };
      if (body && !['GET', 'HEAD'].includes(method)) {
        fetchOpts.body = JSON.stringify(body);
      }

      const res = await fetch(url, fetchOpts);
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

      lastResult = {
        ok: res.ok,
        status: res.status,
        data,
        error,
        latencyMs,
        cliCommand: cmd,
        attempts: attempt,
      };

      // Success — return immediately
      if (res.ok) return lastResult;

      // Check if we should retry
      const shouldRetry = attempt < opts.maxAttempts && opts.retryOn(res.status, error);
      if (!shouldRetry) {
        const hint = categorizeFailure(res.status, error, latencyMs);
        return { ...lastResult, failureCategory: hint.category, recoveryHint: hint };
      }

    } catch (err: unknown) {
      const latencyMs = Date.now() - start;
      const msg = err instanceof Error ? err.message : 'Network error';

      lastResult = {
        ok: false,
        status: 0,
        data: null,
        error: msg,
        latencyMs,
        cliCommand: cmd,
        attempts: attempt,
      };

      const shouldRetry = attempt < opts.maxAttempts && opts.retryOn(0, msg);
      if (!shouldRetry) {
        const hint = categorizeFailure(0, msg, latencyMs);
        return { ...lastResult, failureCategory: hint.category, recoveryHint: hint };
      }
    }

    // Exponential backoff with jitter before next attempt
    const delay = jitter(Math.min(opts.baseDelayMs * Math.pow(2, attempt - 1), opts.maxDelayMs));
    await sleep(delay);
  }

  // Should not reach here, but satisfy TypeScript
  const hint = categorizeFailure(lastResult!.status, lastResult!.error, lastResult!.latencyMs);
  return { ...lastResult!, failureCategory: hint.category, recoveryHint: hint };
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
  request<AuthPingResponse>('POST', '/ping', { check: true }, 'toque auth ping');

export const toqueAuthRefresh = () =>
  request<AuthRefreshResponse>('POST', '/refresh', {}, 'toque auth refresh');

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
