import { useEffect, useRef, useState } from 'react';
import { LogIn } from 'lucide-react';
import { API_BASE_URL } from '../utils/config';
import bluebiteLogo from '../assets/android-chrome-192x192.png';
import { GlassPanel, GlassButton, GlassDivider, Text } from './ui';
import { MarbleBackground } from './MarbleBackground';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
// CAS only validates localhost until the app is registered with Yale, so with Google configured it is opt-in.
const SHOW_CAS = !GOOGLE_CLIENT_ID || import.meta.env.VITE_ENABLE_CAS === 'true';

interface GoogleIdApi {
  initialize: (config: { client_id: string; callback: (r: { credential: string }) => void; hd?: string }) => void;
  renderButton: (el: HTMLElement, options: Record<string, unknown>) => void;
}

function loadGoogleScript(): Promise<GoogleIdApi> {
  const api = () => (window as unknown as { google?: { accounts?: { id?: GoogleIdApi } } }).google?.accounts?.id;
  return new Promise((resolve, reject) => {
    if (api()) return resolve(api()!);
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => (api() ? resolve(api()!) : reject(new Error('Google sign-in did not load')));
    script.onerror = () => reject(new Error('Google sign-in did not load'));
    document.head.appendChild(script);
  });
}

export function LoginPage() {
  const googleButton = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCASLogin = () => {
    window.location.href = `${API_BASE_URL}/auth/login`;
  };

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let cancelled = false;
    loadGoogleScript()
      .then((google) => {
        if (cancelled || !googleButton.current) return;
        google.initialize({
          client_id: GOOGLE_CLIENT_ID,
          hd: 'yale.edu', // only a hint for the account chooser; the server enforces the domain
          callback: async ({ credential }) => {
            setError(null);
            try {
              const res = await fetch(`${API_BASE_URL}/auth/google`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ credential }),
              });
              if (res.ok) {
                window.location.reload(); // the app checks /auth/user on load
                return;
              }
              const body = await res.json().catch(() => ({}));
              setError(body.error || 'Sign in failed');
            } catch {
              setError('Could not reach the server');
            }
          },
        });
        google.renderButton(googleButton.current, { theme: 'filled_black', size: 'large', shape: 'pill', width: 320 });
      })
      .catch((err) => setError(err.message));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="relative h-screen w-full overflow-hidden">
      <MarbleBackground />

      {/* Content layer */}
      <div
        className="relative flex flex-col items-center justify-center h-full"
        style={{ zIndex: 10 }}
      >
        {/* Outer glass modal */}
        <GlassPanel
          level="modal"
          className="flex flex-col items-center max-w-lg w-full"
          style={{ boxShadow: 'var(--shadow-glass-heavy), var(--shadow-glow-blue)' }}
        >
          {/* Logo and title */}
          <div className="flex flex-col items-center gap-4 mb-8">
            <img
              src={bluebiteLogo}
              alt="BlueBite logo"
              className="w-24 h-24 rounded-full"
              style={{
                boxShadow: '0 0 30px rgba(59, 130, 246, 0.3), 0 0 60px rgba(59, 130, 246, 0.15)',
              }}
            />
            <Text variant="brand">BlueBite</Text>
            <Text variant="label" className="text-center">
              Yale Buttery Ordering System
            </Text>
          </div>

          <GlassDivider className="mb-8" />

          <div className="w-full">
            <Text variant="title" className="text-center mb-6">
              Sign in to continue
            </Text>
            {GOOGLE_CLIENT_ID && (
              <div className="flex flex-col items-center gap-3">
                <div ref={googleButton} />
                <Text variant="whisper" className="text-center">Use your Yale Google account</Text>
              </div>
            )}
            {error && (
              <Text variant="label" className="text-center mt-4" style={{ color: 'rgb(248 113 113)' }}>
                {error}
              </Text>
            )}
            {SHOW_CAS && (
              <GlassButton variant="primary" onClick={handleCASLogin} className="w-full text-base mt-4">
                <LogIn size={20} />
                Login with Yale CAS
              </GlassButton>
            )}
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
