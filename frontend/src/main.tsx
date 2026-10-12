import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'

// Handle Google OAuth popup redirect
if (typeof window !== 'undefined' && window.opener && (window.location.hash.includes('id_token=') || window.location.hash.includes('access_token='))) {
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  const idToken = params.get('id_token');
  const accessToken = params.get('access_token');
  try {
    window.opener.postMessage(
      { type: 'GOOGLE_AUTH_CALLBACK', token: idToken || accessToken },
      '*'
    );
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
