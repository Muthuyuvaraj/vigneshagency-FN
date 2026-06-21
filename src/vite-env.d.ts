/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Full backend origin, e.g. https://api.example.com — omit in dev to use Vite `/api` proxy */
  readonly VITE_API_URL?: string;
}

