import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { createPortal } from 'react-dom';

interface ButteryOption {
  name: string;
  itemCount: number;
}

interface ButterySelectorProps {
  selected: string | null;
  options: ButteryOption[];
  onChange: (buttery: string | null) => void;
}

export function ButterySelector({ selected, options, onChange }: ButterySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  const displayName = selected || 'All Butteries';

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 8,
        left: rect.left,
      });
    }
  }, [isOpen]);

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <span className="font-medium text-gray-700">{displayName}</span>
        <ChevronDown
          size={16}
          className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && createPortal(
        <div
          className="fixed bg-white border border-gray-200 rounded-lg shadow-lg overflow-y-auto z-[9999]"
          style={{
            top: `${menuPosition.top}px`,
            left: `${menuPosition.left}px`,
            width: buttonRef.current?.offsetWidth || 'auto',
            maxHeight: '25vh',
          }}
        >
          <button
            onClick={() => {
              onChange(null);
              handleClose();
            }}
            className={`w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors ${
              !selected ? 'bg-blue-100 font-semibold text-bluebite-primary' : ''
            }`}
          >
            All Butteries
          </button>

          {options.map((option) => (
            <button
              key={option.name}
              onClick={() => {
                onChange(option.name);
                handleClose();
              }}
              className={`w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-t border-gray-100 ${
                selected === option.name ? 'bg-blue-100 font-semibold text-bluebite-primary' : ''
              }`}
            >
              <div className="flex justify-between items-center">
                <span>{option.name}</span>
                <span className="text-sm text-gray-500 ml-2">{option.itemCount}</span>
              </div>
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
