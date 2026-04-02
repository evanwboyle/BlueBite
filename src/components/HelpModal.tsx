import { X } from 'lucide-react';
import { GlassPanel } from './ui';

interface HelpModalProps {
  onClose: () => void;
}

export function HelpModal({ onClose }: HelpModalProps) {
  return (
    <div
      className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onClose}
    >
      <GlassPanel
        level="modal"
        className="max-w-2xl w-full max-h-[95vh] flex flex-col"
        style={{ padding: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between p-6 glass-header z-10">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            Help
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 transition"
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 px-6 pt-3 pb-6 overflow-y-auto">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Contact for Help with BlueBite</h3>
            <div className="space-y-2 text-sm">
              <p className="text-gray-300">
                <span className="text-gray-500 w-16 inline-block">Name</span>
                {import.meta.env.VITE_CONTACT_NAME}
              </p>
              <p className="text-gray-300">
                <span className="text-gray-500 w-16 inline-block">Phone</span>
                {import.meta.env.VITE_CONTACT_NUMBER}
              </p>
              <p className="text-gray-300">
                <span className="text-gray-500 w-16 inline-block">Email</span>
                {import.meta.env.VITE_CONTACT_EMAIL}
              </p>
            </div>
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}
