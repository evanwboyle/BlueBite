import { Settings, Maximize2, Minimize2, ExternalLink, MessageSquare, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import type { User } from '../types';
import { GlassPanel } from './ui';
import { getCrestPath } from './ButterySelectionPage';

interface HeaderProps {
  onSettingsClick: () => void;
  currentUser?: User | null;
  selectedButtery?: string | null;
  butteryOptions?: Array<{ name: string; itemCount: number }>;
  onButteryChange?: (buttery: string) => void;
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

export function Header({ onSettingsClick, currentUser, selectedButtery, butteryOptions, onButteryChange }: HeaderProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [popoutOpen, setPopoutOpen] = useState(false);
  const [butteryDropdownOpen, setButteryDropdownOpen] = useState(false);
  const popoutRef = useRef<HTMLDivElement>(null);
  const butteryDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoutRef.current && !popoutRef.current.contains(e.target as Node)) {
        setPopoutOpen(false);
      }
      if (butteryDropdownRef.current && !butteryDropdownRef.current.contains(e.target as Node)) {
        setButteryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
      className="relative flex items-center justify-between"
      style={{ padding: '16px 24px', zIndex: 20 }}
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
      </div>

      {selectedButtery && butteryOptions && onButteryChange && (() => {
        const crestPath = getCrestPath(selectedButtery);
        return (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" ref={butteryDropdownRef}>
            <button
              onClick={() => setButteryDropdownOpen(prev => !prev)}
              className="flex items-center gap-3 px-4 py-2 rounded-lg transition-colors"
              style={{
                background: butteryDropdownOpen ? 'rgba(120, 180, 255, 0.12)' : 'transparent',
                border: '1px solid',
                borderColor: butteryDropdownOpen ? 'rgba(120, 180, 255, 0.35)' : 'rgba(120, 180, 255, 0.18)',
                cursor: 'pointer',
              }}
              onMouseEnter={e => {
                if (!butteryDropdownOpen) {
                  e.currentTarget.style.background = 'rgba(120, 180, 255, 0.08)';
                  e.currentTarget.style.borderColor = 'rgba(120, 180, 255, 0.28)';
                }
              }}
              onMouseLeave={e => {
                if (!butteryDropdownOpen) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'rgba(120, 180, 255, 0.18)';
                }
              }}
            >
              {crestPath && (
                <img src={crestPath} alt="" className="h-8 w-8 object-contain" />
              )}
              <span
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '2rem',
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.01em',
                  whiteSpace: 'nowrap',
                }}
              >
                {selectedButtery}
              </span>
              {crestPath && (
                <img src={crestPath} alt="" className="h-8 w-8 object-contain" />
              )}
              <ChevronDown
                size={18}
                style={{
                  color: 'var(--text-secondary)',
                  transform: butteryDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s',
                  flexShrink: 0,
                }}
              />
            </button>

            {butteryDropdownOpen && (
              <div
                className="absolute left-1/2 -translate-x-1/2 top-full mt-2 rounded-xl overflow-hidden shadow-xl"
                style={{
                  background: 'var(--glass-fog)',
                  backdropFilter: 'var(--blur-lg)',
                  border: 'var(--border-glass-bright)',
                  zIndex: 9999,
                  minWidth: '220px',
                }}
              >
                {butteryOptions.map((option, i) => {
                  const optCrest = getCrestPath(option.name);
                  const isSelected = option.name === selectedButtery;
                  return (
                    <div key={option.name}>
                      {i > 0 && <div style={{ height: '1px', background: 'rgba(120, 180, 255, 0.08)' }} />}
                      <button
                        onClick={() => {
                          onButteryChange(option.name);
                          setButteryDropdownOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left"
                        style={{
                          color: 'var(--text-primary)',
                          background: isSelected ? 'rgba(120, 180, 255, 0.14)' : 'transparent',
                        }}
                        onMouseEnter={e => {
                          if (!isSelected) e.currentTarget.style.background = 'rgba(120, 180, 255, 0.10)';
                        }}
                        onMouseLeave={e => {
                          if (!isSelected) e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        {optCrest
                          ? <img src={optCrest} alt="" className="h-6 w-6 object-contain flex-shrink-0" />
                          : <div className="h-6 w-6 flex-shrink-0" />
                        }
                        <span style={{ whiteSpace: 'nowrap' }}>{option.name}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

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
        <a
          href="https://docs.google.com/forms/d/e/1FAIpQLSdns6E4vlZEGxu37n7IlN6_lFoPPZ_j5C9umbJMLBwAkOAv2Q/viewform?usp=dialog"
          target="_blank"
          rel="noopener noreferrer"
          className="glass-button px-4 py-3 rounded-xl transition flex items-center gap-2 text-sm font-medium"
          style={{ textDecoration: 'none', color: 'var(--text-primary)' }}
        >
          <MessageSquare size={20} />
          <span>Feedback</span>
        </a>
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
