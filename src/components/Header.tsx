import { Menu } from 'lucide-react';
import bluebiteLogo from '../assets/android-chrome-192x192.png';

interface HeaderProps {
  onSettingsClick: () => void;
}

export function Header({ onSettingsClick }: HeaderProps) {
  return (
    <header className="bg-gradient-to-r from-bluebite-primary to-bluebite-dark text-white shadow-lg">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <img src={bluebiteLogo} alt="BlueBite logo" className="w-10 h-10 rounded-full" />
          <h1 className="text-2xl font-bold">BlueBite</h1>
        </div>

        <nav className="hidden md:flex gap-6 text-sm font-medium">
          <button className="hover:bg-blue-700 px-3 py-2 rounded transition">Orders</button>
          <button onClick={onSettingsClick} className="hover:bg-blue-700 px-3 py-2 rounded transition">Settings</button>
        </nav>
        <button className="md:hidden">
          <Menu size={24} />
        </button>
      </div>
    </header>
  );
}
