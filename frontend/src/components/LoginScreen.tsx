import React, { useState, useEffect } from 'react';
import { Coffee, ShieldCheck, AlertCircle, RotateCcw } from 'lucide-react';
import { api, setAuthToken, setSessionUserId, type DevConfig } from '../api';
import { Button, Input } from './ui';

interface LoginScreenProps {
  onLoginSuccess: (user: any) => void;
  addToast: (type: 'success' | 'warning' | 'error', title: string, message: string) => void;
  devConfig?: DevConfig;
  isDevVisible?: boolean;
}

function decodeJwtPayload(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLoginSuccess,
  addToast,
  devConfig,
  isDevVisible = false
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [domain, setDomain] = useState(devConfig?.googleWorkspaceDomain || 'firma.cz');
  const [company, setCompany] = useState(devConfig?.instanceName || 'firma');
  const [googleClientId, setGoogleClientId] = useState(devConfig?.googleClientId || '');
  const [isResettingDb, setIsResettingDb] = useState(false);
  const [simEmail, setSimEmail] = useState('');
  const [simName, setSimName] = useState('Nový Zaměstnanec');

  const handleResetDb = async () => {
    if (!window.confirm('Opravdu chcete obnovit databázi ze šablony? Všechna lokální testovací data a noví uživatelé budou smazáni a nahrazeni čistou šablonou.')) {
      return;
    }
    setIsResettingDb(true);
    try {
      const res = await api.resetDevDatabase();
      if (res?.data) {
        addToast('success', 'Databáze resetována', 'Vývojářská databáze byla obnovena z čisté šablony dochazka_dev.template.db.');
      } else {
        addToast('warning', 'Reset databáze', 'Požadavek na reset byl odeslán.');
      }
    } catch {
      addToast('error', 'Chyba resetu', 'Nepodařilo se resetovat databázi ze šablony.');
    } finally {
      setIsResettingDb(false);
    }
  };

  useEffect(() => {
    if (devConfig) {
      if (devConfig.googleWorkspaceDomain) setDomain(devConfig.googleWorkspaceDomain);
      if (devConfig.instanceName) setCompany(devConfig.instanceName);
      if (devConfig.googleClientId) setGoogleClientId(devConfig.googleClientId);
    } else {
      api.getDevConfig().then((res) => {
        if (res?.data) {
          if (res.data.googleWorkspaceDomain) setDomain(res.data.googleWorkspaceDomain);
          if (res.data.instanceName) setCompany(res.data.instanceName);
          if (res.data.googleClientId) setGoogleClientId(res.data.googleClientId);
        }
      });
    }
  }, [devConfig]);

  // Listen for OAuth message from Google popup or redirect
  useEffect(() => {
    // Check if the current window was directly redirected back with tokens in the URL hash
    if (typeof window !== 'undefined' && window.location.hash.includes('id_token=')) {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const idToken = params.get('id_token');
      if (idToken) {
        window.history.replaceState(null, '', window.location.pathname);
        processGoogleToken(idToken);
      }
    }

    const handleOAuthMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'GOOGLE_AUTH_CALLBACK' && event.data?.token) {
        await processGoogleToken(event.data.token, event.data.email, event.data.name);
      }
    };

    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, []);

  const processGoogleToken = async (idToken: string, email?: string, name?: string) => {
    setIsLoading(true);
    setErrorMessage(null);

    // Automatically extract email and name from JWT id_token if not passed explicitly
    if (!email && idToken.includes('.')) {
      const decoded = decodeJwtPayload(idToken);
      if (decoded) {
        email = decoded.email;
        name = decoded.name || decoded.email?.split('@')[0];
      }
    }

    try {
      const res = await api.loginWithGoogle({
        idToken,
        email: email || '',
        name: name || ''
      });

      if (!res) {
        setErrorMessage('Server je momentálně nedostupný. Zkontrolujte připojení k backendu.');
        return;
      }

      if (res.error) {
        setErrorMessage(res.error.message || 'Přihlášení se nezdařilo.');
        addToast('error', 'Chyba přihlášení', res.error.message || 'Neautorizovaný přístup');
        return;
      }

      if (res.data) {
        const { accessToken, user } = res.data;
        if (accessToken) setAuthToken(accessToken);
        if (user?.id) setSessionUserId(user.id);

        addToast(
          'success',
          'Úspěšné přihlášení',
          `Vítejte, ${user.name} (${user.roleLabel}). Přístup povolen pro doménu @${domain}.`
        );

        onLoginSuccess(user);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Chyba při komunikaci se serverem.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleOAuthClick = () => {
    setErrorMessage(null);

    const clientId = googleClientId?.trim() || (window as any).__GOOGLE_CLIENT_ID__;

    if (!clientId) {
      if (isDevVisible) {
        setErrorMessage(
          'Google Client ID není nastaveno. Pro přihlášení reálným Google účtem zadejte své Client ID v horní Dev liště (Nastavení). Pro okamžité otestování OAuth klikněte níže na "Simulovat Google přihlášení".'
        );
        const details = document.getElementById('gw-simulator-details') as HTMLDetailsElement | null;
        if (details) details.open = true;
      } else {
        setErrorMessage(
          'Přihlášení přes Google Workspace není nakonfigurováno (chybí Google Client ID). Kontaktujte administrátora.'
        );
      }
      return;
    }

    setIsLoading(true);
    const redirectUri = window.location.origin;
    const scope = encodeURIComponent('openid email profile');
    const nonce = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2) + Date.now().toString(36);
    const hdParam = domain && !domain.includes('gmail.com') ? `&hd=${encodeURIComponent(domain)}` : '';

    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token%20id_token&scope=${scope}&nonce=${encodeURIComponent(nonce)}${hdParam}&prompt=select_account`;

    const popup = window.open(
      googleAuthUrl,
      'google_oauth_window',
      'width=500,height=650,left=300,top=100,status=no,toolbar=no,menubar=no'
    );

    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
      window.location.href = googleAuthUrl;
      return;
    }

    const checkTimer = setInterval(async () => {
      if (popup.closed) {
        clearInterval(checkTimer);
        setIsLoading(false);
      }
    }, 1000);
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-3xl p-8 sm:p-10 shadow-sm transition-colors text-center space-y-7">
        {/* Brand Icon & Heading */}
        <div className="flex flex-col items-center space-y-3">
          <div className="w-16 h-16 rounded-3xl bg-amber-500/15 text-amber-700 dark:text-amber-400 flex items-center justify-center shadow-sm">
            <Coffee className="w-8 h-8" />
          </div>

          <div>
            <div className="flex items-center justify-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                caffeechko
              </h1>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300">
                {company}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              firemní docházkový systém
            </p>
          </div>
        </div>

        {/* Error Alert if any */}
        {errorMessage && (
          <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2.5 text-left">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {/* Single Primary Action: Google Workspace OAuth Button */}
        <div className="space-y-3 pt-2">
          <button
            onClick={handleGoogleOAuthClick}
            disabled={isLoading}
            className="w-full h-14 rounded-2xl bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-750 border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-white font-semibold text-sm flex items-center justify-center gap-3 shadow-sm hover:shadow active:scale-98 transition-all"
          >
            {/* Google Multi-color Logo */}
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>{isLoading ? 'Otevírám Google přihlášení...' : 'Přihlásit se přes Google Workspace'}</span>
          </button>

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 dark:text-zinc-500 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>Vyžadován firemní účet @{domain}</span>
          </div>

          {/* Test Google Workspace Simulator for Local Testing (strictly DEV only) */}
          {isDevVisible && (
            <div className="pt-4 border-t border-slate-100 dark:border-zinc-800">
              <details id="gw-simulator-details" className="text-left group" open={!googleClientId}>
                <summary className="text-[11px] text-yellow-800 dark:text-yellow-300 hover:text-yellow-900 dark:hover:text-yellow-200 cursor-pointer text-center list-none select-none font-mono font-semibold flex items-center justify-center gap-1.5 py-1">
                  <span>⚡ Lokální simulátor Google Workspace</span>
                  {!googleClientId && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-400 text-slate-950 font-bold shadow-sm">
                      DEV NÁSTROJ
                    </span>
                  )}
                </summary>

                <div className="mt-3 p-4 rounded-2xl bg-yellow-400/10 dark:bg-yellow-950/20 border border-yellow-500/30 space-y-3 text-xs">
                  <p className="text-[11px] text-slate-600 dark:text-zinc-300 leading-relaxed">
                    Nemáte ještě Google Cloud Console projekt? Vyberte jeden z testovacích profilů pro okamžité otestování OAuth flow v doméně <strong>@{domain}</strong>:
                  </p>

                  {/* Quick Presets */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => processGoogleToken('simulated-google-token', `ondrej.novak@${domain}`, 'Ondřej Novák')}
                      className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-yellow-500/40 hover:border-yellow-500 text-left transition-all group shadow-sm"
                    >
                      <div className="font-bold text-slate-900 dark:text-white text-xs group-hover:text-yellow-700 dark:group-hover:text-yellow-400">
                        Ondřej Novák
                      </div>
                      <div className="text-[10px] text-yellow-800 dark:text-yellow-400 font-mono">
                        Nový (Čeká na schválení)
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => processGoogleToken('simulated-google-token', `martin.kovar@${domain}`, 'Martin Kovář')}
                      className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-yellow-500/40 hover:border-yellow-500 text-left transition-all group shadow-sm"
                    >
                      <div className="font-bold text-slate-900 dark:text-white text-xs group-hover:text-yellow-700 dark:group-hover:text-yellow-400">
                        Martin Kovář
                      </div>
                      <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono">
                        Schválený zaměstnanec
                      </div>
                    </button>
                  </div>

                  {/* Custom simulated user */}
                  <div className="pt-2 border-t border-yellow-500/20 space-y-2">
                    <Input
                      label="Vlastní Google E-mail"
                      type="email"
                      value={simEmail || `novy.zamestnanec@${domain}`}
                      onChange={(e) => setSimEmail(e.target.value)}
                      placeholder={`jmeno@${domain}`}
                    />
                    <Input
                      label="Jméno a příjmení"
                      value={simName}
                      onChange={(e) => setSimName(e.target.value)}
                      placeholder="Jméno Příjmení"
                    />
                    <Button
                      variant="filled"
                      colorKey="primary"
                      size="sm"
                      fullWidth
                      onClick={() => {
                        processGoogleToken(
                          'simulated-google-token',
                          simEmail || `novy.zamestnanec@${domain}`,
                          simName || 'Nový Zaměstnanec'
                        );
                      }}
                    >
                      Odeslat Google OAuth token
                    </Button>
                  </div>

                  {/* Reset DB to template action */}
                  <div className="pt-2.5 border-t border-yellow-500/20 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                      Testovací data:
                    </span>
                    <Button
                      variant="surface"
                      colorKey="amber"
                      size="xs"
                      icon={RotateCcw}
                      loading={isResettingDb}
                      onClick={handleResetDb}
                      title="Smaže lokální testovací data a obnoví čistou šablonu dochazka_dev.template.db"
                    >
                      Resetovat DB do šablony
                    </Button>
                  </div>
                </div>
              </details>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

