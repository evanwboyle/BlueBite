import { X, Settings, LogOut } from 'lucide-react';
import { API_BASE_URL } from '../utils/config';
import type { User } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onUserLogout: () => void;
}

export function SettingsModal({ isOpen, onClose, currentUser, onUserLogout }: SettingsModalProps) {
  if (!isOpen) return null;

  const handleCASLogin = () => {
    // Redirect to backend CAS login endpoint
    window.location.href = `${API_BASE_URL}/auth/login`;
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
      onUserLogout();
    } catch (error) {
      console.error('Failed to logout:', error);
    }
  };

  return (
    <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(107, 114, 128, 0.3)' }} onClick={onClose}>
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
        {/* Header with Close */}
        <div className="sticky top-0 flex items-center justify-between p-6 border-b bg-white">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Settings size={24} />
            Settings
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {currentUser ? (
            <div className="space-y-3">
              <div className="w-full bg-blue-900 text-white px-2 py-2 rounded text-center text-sm">
                Logged in as {currentUser.netId}
              </div>
              <button
                onClick={handleLogout}
                className="w-full bg-red-600 text-white px-2 py-2 rounded text-center text-sm font-medium hover:bg-red-700 transition flex items-center justify-center gap-2"
              >
                <LogOut size={14} />
                Logout
              </button>
            </div>
          ) : (
            <button
              onClick={handleCASLogin}
              className="w-full bg-blue-900 text-white px-2 py-2 rounded text-center text-sm font-medium hover:bg-blue-950 transition"
            >
              Login with Yale CAS
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
