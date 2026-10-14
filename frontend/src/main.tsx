import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'

// Handle Google OAuth popup redirect (note: Google COOP headers clear both window.opener and window.name)
if (
  typeof window !== 'undefined' &&
  (window.location.hash.includes('id_token=') || window.location.hash.includes('access_token=')) &&
  (window.opener ||
    window.name === 'google_oauth_window' ||
    localStorage.getItem('caffeechko_oauth_popup_pending') === 'true')
) {
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  const idToken = params.get('id_token');
  const accessToken = params.get('access_token');
  const token = idToken || accessToken;
  const payload = { type: 'GOOGLE_AUTH_CALLBACK', token };

  try {
    localStorage.removeItem('caffeechko_oauth_popup_pending');
  } catch {}

  try {
    localStorage.setItem('caffeechko_google_oauth_callback', JSON.stringify({ ...payload, ts: Date.now() }));
  } catch {}

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel('caffeechko_google_oauth');
      bc.postMessage(payload);
      bc.close();
    }
  } catch {}

  try {
    if (window.opener) {
      window.opener.postMessage(payload, '*');
    }
  } catch {}

  window.close();
} else {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  )
}
