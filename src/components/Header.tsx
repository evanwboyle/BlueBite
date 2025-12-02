import { Menu } from 'lucide-react';
import { ButterySelector } from './ButterySelector';

interface HeaderProps {
  selectedButtery: string | null;
  butteryOptions: Array<{name: string; itemCount: number}>;
  onButteryChange: (buttery: string | null) => void;
}

export function Header({ selectedButtery, butteryOptions, onButteryChange }: HeaderProps) {
  return (
    <header className="bg-gradient-to-r from-bluebite-primary to-bluebite-dark text-white shadow-lg">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
            <span className="text-bluebite-primary font-bold text-lg">B</span>
          </div>
          <h1 className="text-2xl font-bold">BlueBite</h1>
        </div>

        <ButterySelector
          selected={selectedButtery}
          options={butteryOptions}
          onChange={onButteryChange}
        />

        <nav className="hidden md:flex gap-6 text-sm font-medium">
          <button className="hover:bg-blue-700 px-3 py-2 rounded transition">Orders</button>
          <button className="hover:bg-blue-700 px-3 py-2 rounded transition">Settings</button>
        </nav>
        <button className="md:hidden">
          <Menu size={24} />
        </button>
      </div>
    </header>
  );
}
