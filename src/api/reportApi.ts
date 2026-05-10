import { apiUrl } from "./config";

const REPORTS_PATH = "/api/reports";

/** Point for charts (backend may use `name`/`label` and `total`/`totalSales`). */
export type ReportOverviewRow = {
  name?: string;
  label?: string;
  total?: number;
  totalSales?: number;
  [key: string]: unknown;
};

/** Response from `GET /api/reports?range=...` — shape may vary; fields optional for safety. */
export type ReportData = {
  totalSales?: number;
  outstanding?: number;
  totalCrates?: number;
  totalLiters?: number;
  revenue?: number;
  overview?: ReportOverviewRow[];
  [key: string]: unknown;
};

async function readErrorBody(res: Response): Promise<string> {
  try {
    const t = await res.text();
    return t || `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

/**
 * GET aggregated report for period `range` (`daily` | `weekly` | `monthly` | `quarterly` | `halfyearly`).
 * Uses `apiUrl` so dev uses Vite proxy → localhost:3001.
 */
export async function getReports(range: string): Promise<ReportData> {
  const q = new URLSearchParams({ range });
  const res = await fetch(apiUrl(`${REPORTS_PATH}?${q.toString()}`));
  if (!res.ok) {
    throw new Error(await readErrorBody(res));
  }
  return res.json() as Promise<ReportData>;
}
