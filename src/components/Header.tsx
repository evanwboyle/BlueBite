import { Menu, Maximize2, Minimize2 } from 'lucide-react';
import { useState } from 'react';
import bluebiteLogo from '../assets/android-chrome-192x192.png';
import type { User } from '../types';

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

function getRoleBadgeClasses(role?: string): string {
  switch (role) {
    case 'admin':
      return 'bg-red-500/20 text-red-300 border-red-500/40';
    case 'staff':
      return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
    case 'manager':
      return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
    default:
      return 'bg-gray-500/20 text-gray-300 border-gray-500/40';
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
    <header className="bg-blue-900 text-white shadow-lg">
      <div className="flex items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <img src={bluebiteLogo} alt="BlueBite logo" className="w-10 h-10 rounded-full" />
          <h1 className="text-2xl font-bold">BlueBite</h1>
          {selectedButtery && (
            <span className="text-sm text-blue-200 border-l border-blue-700 pl-3 ml-1">
              {selectedButtery}
            </span>
          )}
        </div>

        <nav className="hidden md:flex gap-3 text-sm font-medium items-center">
          {currentUser && (
            <div className="flex items-center gap-2 mr-2">
              <span className="text-blue-200 text-sm">{currentUser.netId}</span>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getRoleBadgeClasses(currentUser.role)}`}
              >
                {getRoleLabel(currentUser.role)}
              </span>
            </div>
          )}
          <button
            onClick={handleFullscreenToggle}
            className="hover:bg-blue-700 px-3 py-2 rounded transition"
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </button>
          <button onClick={onSettingsClick} className="hover:bg-blue-700 px-3 py-2 rounded transition pr-4">Settings</button>
        </nav>
        <button className="md:hidden">
          <Menu size={24} />
        </button>
      </div>
    </header>
  );
}
