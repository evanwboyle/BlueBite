import { LogIn } from 'lucide-react';
import { API_BASE_URL } from '../utils/config';
import bluebiteLogo from '../assets/android-chrome-192x192.png';
import { GlassPanel, GlassButton, GlassDivider, Text } from './ui';
const MarbleBackground = () => (
  <iframe
    src="/marble-bg.html"
    style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', border: 'none', zIndex: 0, pointerEvents: 'none' }}
    title="background"
  />
);

export function LoginPage() {
  const handleCASLogin = () => {
    window.location.href = `${API_BASE_URL}/auth/login`;
  };

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
            <GlassButton
              variant="primary"
              onClick={handleCASLogin}
              className="w-full text-base"
            >
              <LogIn size={20} />
              Login with Yale CAS
            </GlassButton>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
