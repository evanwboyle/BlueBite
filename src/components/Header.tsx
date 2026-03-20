import { Settings, ShoppingCart, Maximize2, Minimize2 } from 'lucide-react';
import { useState } from 'react';
import type { User } from '../types';

interface HeaderProps {
  onSettingsClick: () => void;
  onCartClick?: () => void;
  cartCount?: number;
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

export function Header({ onSettingsClick, onCartClick, cartCount = 0, currentUser, selectedButtery }: HeaderProps) {
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
    <header
      className="glass-container flex items-center justify-between px-6 py-4"
      style={{
        borderRadius: 'var(--radius-card)',
      }}
    >
      <div className="flex items-center gap-3">
        <h1
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '1.75rem',
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
        {onCartClick && (
          <button
            onClick={onCartClick}
            className="glass-button px-3 py-2 rounded-lg transition relative"
            title="Cart"
          >
            <ShoppingCart size={18} />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>
        )}
        <button
          onClick={handleFullscreenToggle}
          className="glass-button px-3 py-2 rounded-lg transition"
          title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        >
          {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>
      </div>
    </header>
  );
}
