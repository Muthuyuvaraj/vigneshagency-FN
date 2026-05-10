/**
 * API base URL.
 * - Dev: leave `VITE_API_URL` unset → same-origin `/api/...` (Vite proxy → localhost:3001).
 * - Production: `VITE_API_URL` is baked in at `vite build`. If missing (e.g. not set in Vercel),
 *   we fall back so deploys do not hit the frontend domain `/api/*` (404).
 */
const FALLBACK_PRODUCTION_API = "https://backend-v2-cwus.onrender.com";

export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const fromEnv = import.meta.env.VITE_API_URL;
  const trimmed =
    fromEnv != null && String(fromEnv).trim() !== "" ? String(fromEnv).trim().replace(/\/$/, "") : "";
  const base =
    trimmed ||
    (import.meta.env.PROD ? FALLBACK_PRODUCTION_API.replace(/\/$/, "") : "");
  return base ? `${base}${p}` : p;
}
