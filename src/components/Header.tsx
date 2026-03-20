import { Settings, Maximize2, Minimize2, ExternalLink } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
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
  const [popoutOpen, setPopoutOpen] = useState(false);
  const popoutRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoutRef.current && !popoutRef.current.contains(e.target as Node)) {
        setPopoutOpen(false);
      }
    };
    if (popoutOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [popoutOpen]);

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
        <div className="relative" ref={popoutRef}>
          <button
            onClick={() => setPopoutOpen(!popoutOpen)}
            className="glass-button px-4 py-3 rounded-xl transition"
            title="Open in new window"
          >
            <ExternalLink size={28} />
          </button>
          {popoutOpen && (
            <div
              className="absolute right-0 top-full mt-2 w-48 rounded-xl overflow-hidden shadow-xl"
              style={{
                background: 'var(--glass-fog)',
                backdropFilter: 'var(--blur-lg)',
                border: 'var(--border-glass-bright)',
                zIndex: 100,
              }}
            >
              <button
                onClick={() => {
                  const url = new URL(window.location.href);
                  url.searchParams.set('view', 'menu');
                  window.open(url.toString(), '_blank');
                  setPopoutOpen(false);
                }}
                className="w-full text-left px-5 py-3 text-sm font-medium transition-colors"
                style={{ color: 'var(--text-primary)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(120, 180, 255, 0.12)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                Menu
              </button>
              <div style={{ height: '1px', background: 'rgba(120, 180, 255, 0.10)' }} />
              <button
                onClick={() => {
                  const url = new URL(window.location.href);
                  url.searchParams.set('view', 'orders');
                  window.open(url.toString(), '_blank');
                  setPopoutOpen(false);
                }}
                className="w-full text-left px-5 py-3 text-sm font-medium transition-colors"
                style={{ color: 'var(--text-primary)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(120, 180, 255, 0.12)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                Orders
              </button>
            </div>
          )}
        </div>
        <button
          onClick={onSettingsClick}
          className="glass-button px-4 py-3 rounded-xl transition"
          title="Settings"
        >
          <Settings size={28} />
        </button>
        <button
          onClick={handleFullscreenToggle}
          className="glass-button px-4 py-3 rounded-xl transition"
          title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        >
          {isFullscreen ? <Minimize2 size={28} /> : <Maximize2 size={28} />}
        </button>
      </div>
    </GlassPanel>
  );
}
