export type StagingHealth = {
  status: 'ok' | 'degraded' | string;
  service: string;
  version: string;
  database: 'connected' | 'disconnected' | 'not_configured' | 'connecting' | string;
};

const STAGING_API_BASE_URL = 'https://hoctap-staging-api.onrender.com';

export async function getStagingHealth(signal?: AbortSignal): Promise<StagingHealth> {
  // Intentionally hard-coded to staging: no environment fallback to production.
  const response = await fetch(`${STAGING_API_BASE_URL}/api/v1/health`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal,
  });

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`Health endpoint returned HTTP ${response.status}.`);
  }
  if (!payload || typeof payload !== 'object') {
    throw new Error('Health endpoint returned an invalid response.');
  }

  const health = payload as Partial<StagingHealth>;
  if (typeof health.status !== 'string' ||
      typeof health.service !== 'string' ||
      typeof health.version !== 'string' ||
      typeof health.database !== 'string') {
    throw new Error('Health endpoint response is missing required fields.');
  }
  if (health.service !== 'hoc-tap-quest-api') {
    throw new Error('Unexpected API service identity; refusing to display it as staging.');
  }
  return health as StagingHealth;
}
