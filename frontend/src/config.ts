declare global {
  interface Window {
    __APP_CONFIG__?: { apiBaseUrl?: string }
  }
}

// In Docker the URL comes from /config.js, which is written when the container starts.
// VITE_API_BASE_URL is only for running the dev server outside Docker.
const configuredUrl: string =
  window.__APP_CONFIG__?.apiBaseUrl || import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'

export const apiBaseUrl = configuredUrl.replace(/\/+$/, '')
