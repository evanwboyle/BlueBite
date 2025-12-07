import { Menu, Maximize2, Minimize2 } from 'lucide-react';
import { useState } from 'react';
import bluebiteLogo from '../assets/android-chrome-192x192.png';
import { useColorPalette } from '../hooks/useColorPalette';

interface HeaderProps {
  selectedButtery: string | null;
  onSettingsClick: () => void;
}

export function Header({ selectedButtery, onSettingsClick }: HeaderProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { primaryColor, textColor } = useColorPalette(selectedButtery);

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

  const hoverBgOpacity = 'rgba(0, 0, 0, 0.2)';

  // Get buttery logo path - convert buttery name to SVG filename
  const getButteryLogoPath = (buttery: string | null) => {
    if (!buttery) return null;
    return `/assets/resco-icons/${buttery}.svg`;
  };

  const butteryLogoPath = getButteryLogoPath(selectedButtery);

  return (
    <header
      className="shadow-lg transition-colors duration-300"
      style={{ backgroundColor: primaryColor }}
    >
      <div className="flex items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <img src={bluebiteLogo} alt="BlueBite logo" className="w-10 h-10 rounded-full" />
          <h1
            className="text-2xl font-bold transition-colors duration-300"
            style={{ color: textColor }}
          >
            BlueBite
          </h1>
        </div>

        {/* Center section - Buttery logo and name */}
        {selectedButtery && butteryLogoPath && (
          <div className="flex items-center gap-3">
            <img
              src={butteryLogoPath}
              alt={`${selectedButtery} logo`}
              className="h-12 w-12 object-contain"
              onError={(e) => {
                // Hide image if it fails to load
                e.currentTarget.style.display = 'none';
              }}
            />
            <h2
              className="text-3xl font-bold transition-colors duration-300"
              style={{ color: textColor }}
            >
              {selectedButtery}
            </h2>
          </div>
        )}

        <nav className="hidden md:flex gap-3 text-sm font-medium">
          <button
            onClick={handleFullscreenToggle}
            className="px-3 py-2 rounded transition"
            style={{ color: textColor }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = hoverBgOpacity}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </button>
          <button
            onClick={onSettingsClick}
            className="px-3 py-2 rounded transition"
            style={{ color: textColor }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = hoverBgOpacity}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            Settings
          </button>
        </nav>
        <button className="md:hidden" style={{ color: textColor }}>
          <Menu size={24} />
        </button>
      </div>
    </header>
  );
}
