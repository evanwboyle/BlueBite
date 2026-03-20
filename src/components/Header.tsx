import { Settings, Maximize2, Minimize2 } from 'lucide-react';
import { useState } from 'react';
import type { User } from '../types';
import { GlassPanel } from './ui';

interface HeaderProps {
  onSettingsClick: () => void;
  currentUser?: User | null;
  selectedButtery?: string | null;
}

function getRoleLabel(role?: string): string {
  switch (role) {
    case 'admin':
      return 'Admin';
    case 'staff':
      return 'Staff';
    case 'manager':
      return 'Manager';
    default:
      return 'Customer';
  }
}

export function Header({ onSettingsClick, currentUser, selectedButtery }: HeaderProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleFullscreenToggle = async () => {
    try {
      if (!isFullscreen) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  };

  return (
    <GlassPanel
      level="modal"
      as="div"
      className="flex items-center justify-between"
      style={{ padding: '16px 24px' }}
    >
      <div className="flex items-center gap-3">
        <h1
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '2rem',
            color: 'var(--text-primary)',
            letterSpacing: '-0.01em',
          }}
        >
          BlueBite
        </h1>
        {selectedButtery && (
          <span
            style={{
              color: 'var(--text-muted)',
              fontSize: '0.875rem',
              borderLeft: '1px solid rgba(120, 180, 255, 0.2)',
              paddingLeft: '12px',
              marginLeft: '4px',
            }}
          >
            {selectedButtery}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {currentUser && (
          <div className="flex items-center gap-2 mr-2">
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 500 }}>
              {currentUser.netId}
            </span>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--text-muted)',
                padding: '2px 8px',
                borderRadius: '9999px',
                border: '1px solid rgba(120, 180, 255, 0.2)',
                background: 'rgba(120, 180, 255, 0.08)',
              }}
            >
              {getRoleLabel(currentUser.role)}
            </span>
          </div>
        )}
        <button
          onClick={onSettingsClick}
          className="glass-button px-3 py-2 rounded-lg transition"
          title="Settings"
        >
          <Settings size={18} />
        </button>
        <button
          onClick={handleFullscreenToggle}
          className="glass-button px-3 py-2 rounded-lg transition"
          title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        >
          {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>
      </div>
    </GlassPanel>
  );
}
