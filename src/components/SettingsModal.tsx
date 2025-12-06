import { X, Settings, LogOut } from 'lucide-react';
import { API_BASE_URL } from '../utils/config';
import type { User } from '../types';
import { ButterySelector } from './ButterySelector';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onUserLogout: () => void;
  isEditMode: boolean;
  onToggleEditMode: (enabled: boolean) => void;
  selectedButtery: string | null;
  butteryOptions: Array<{ name: string; itemCount: number }>;
  onButteryChange: (buttery: string | null) => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  currentUser,
  onUserLogout,
  isEditMode,
  onToggleEditMode,
  selectedButtery,
  butteryOptions,
  onButteryChange
}: SettingsModalProps) {

  console.log('SettingsModal Props:', {
    selectedButtery,
    butteryOptions,
    onButteryChange
  });

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

  // Check if user has staff or admin role
  const canEditMode = currentUser?.role === 'staff' || currentUser?.role === 'admin';

  return (
    <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }} onClick={onClose}>
      <div className="glass-container rounded-lg max-w-2xl w-full max-h-[95vh] shadow-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header with Close */}
        <div className="sticky top-0 flex items-center justify-between p-6 glass-header z-10">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Settings size={24} />
            Settings
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 transition"
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="space-y-6">
            {/* Account Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Account</h3>
              {currentUser ? (
                <div className="space-y-4">
                  <div className="glass-profile-card border-blue-500/30 text-blue-300 px-4 py-3 rounded-lg text-sm font-medium">
                    Logged in as <span className="font-bold text-white">{currentUser.netId}</span>
                  </div>
                  <div className="text-sm text-gray-400">
                    <span className="font-medium text-gray-300">Role:</span> {currentUser.role === 'admin' ? 'Admin' : currentUser.role === 'staff' ? 'Staff' : 'Customer'}
                  </div>

                  {/* Edit Mode Toggle - Only show for staff and admin */}
                  {canEditMode && (
                    <div className="border-t border-white/10 pt-4 mt-4">
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <div className="flex-1">
                            <span className="font-medium text-white">Edit Mode</span>
                            <p className="text-xs text-gray-400">Enable menu editing capabilities</p>
                          </div>
                        </label>
                        <button
                          onClick={() => onToggleEditMode(!isEditMode)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            isEditMode ? 'bg-bluebite-primary' : 'bg-gray-600'
                          }`}
                          role="switch"
                          aria-checked={isEditMode}
                          aria-label="Toggle Edit Mode"
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              isEditMode ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                      {isEditMode && (
                        <div className="mt-2 text-xs text-blue-400 font-medium">
                          Edit Mode is ON
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    onClick={handleLogout}
                    className="w-full bg-red-500/30 text-red-400 border border-red-500/50 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-500/40 hover:border-red-500/60 transition flex items-center justify-center gap-2 backdrop-blur-sm"
                  >
                    <LogOut size={16} />
                    Logout
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleCASLogin}
                  className="w-full glass-button-primary px-4 py-3 rounded-lg text-sm font-medium transition"
                >
                  Login with Yale CAS
                </button>
              )}
            </div>

            {/* Buttery Selector Section */}
            <div className="border-t border-white/10 pt-4 mt-4">
              <h3 className="text-lg font-semibold text-white">Buttery Selector</h3>
              <ButterySelector
                selected={selectedButtery}
                options={butteryOptions}
                onChange={onButteryChange}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
