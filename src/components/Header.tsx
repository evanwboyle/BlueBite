import { Menu } from 'lucide-react';

export function Header() {
  return (
    <header className="bg-blue-600 text-white shadow-lg">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
            <span className="text-blue-600 font-bold text-lg">B</span>
          </div>
          <h1 className="text-2xl font-bold">BlueBite</h1>
        </div>
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
