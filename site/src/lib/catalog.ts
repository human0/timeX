import fallback from '../data/catalog.fallback.json';

/**
 * The site's read-only catalogue, pulled from TBServer (GET /public/catalog) at build time.
 * If the server is unreachable the build uses the last saved copy in src/data, so a deploy
 * never fails because of the API. Refresh that copy by running the server's seed/export.
 */

export type ExchangeStatus = { id: string; label: string; description: string };
export type Service = {
  id: string;
  name: string;
  category: string;
  minHours: number;
  maxHours: number;
};
export type Stats = {
  /** Time traded in seconds, from the server (shown as whole hours). */
  secondsExchanged: number | null;
  ratings: { average: number; count: number } | null;
  professions: number | null;
  cities: number | null;
};
export type Catalog = {
  stats?: Stats;
  statuses: ExchangeStatus[];
  services: Service[];
  categories: string[];
};

const DEFAULT_API_BASE = 'https://tbserver-1059280513734.africa-south1.run.app';
const TIMEOUT_MS = 8000;

function isCatalog(value: unknown): value is Catalog {
  const v = value as Catalog | null;
  return (
    !!v &&
    Array.isArray(v.statuses) &&
    Array.isArray(v.services) &&
    Array.isArray(v.categories) &&
    v.statuses.every((s) => typeof s.id === 'string' && typeof s.label === 'string') &&
    v.services.every((s) => typeof s.name === 'string' && typeof s.category === 'string')
  );
}

export async function loadCatalog(): Promise<Catalog> {
  const base = (import.meta.env.PUBLIC_API_BASE as string | undefined) || DEFAULT_API_BASE;
  try {
    const response = await fetch(`${base.replace(/\/$/, '')}/public/catalog`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data: unknown = await response.json();
    if (!isCatalog(data)) throw new Error('unexpected response shape');
    return data;
  } catch (error) {
    console.warn(`[catalog] using saved copy: ${(error as Error).message}`);
    return fallback as Catalog;
  }
}

/** "2–3h", "3h", "1.5–3h": the typical time shown on each service. */
export function formatHours(service: Service): string {
  return service.minHours === service.maxHours
    ? `${service.minHours}h`
    : `${service.minHours}–${service.maxHours}h`;
}

/** "professional" → "Professional tasks". */
export function categoryTitle(category: string): string {
  return `${category.charAt(0).toUpperCase()}${category.slice(1)} tasks`;
}
