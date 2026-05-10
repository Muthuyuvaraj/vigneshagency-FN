/**
 * API base URL.
 * - Leave `VITE_API_URL` unset to use same-origin `/api/...` (Vite dev proxy → localhost:3001).
 * - In production, set `VITE_API_URL=https://your-api.example.com`
 */
export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const raw = import.meta.env.VITE_API_URL;
  const base = raw != null && String(raw).trim() !== "" ? String(raw).replace(/\/$/, "") : "";
  return base ? `${base}${p}` : p;
}
