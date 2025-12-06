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
    <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(107, 114, 128, 0.3)' }} onClick={onClose}>
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[95vh] shadow-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header with Close */}
        <div className="sticky top-0 flex items-center justify-between p-6 border-b bg-white z-10">
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

        {/* Content Area */}
        <div className="flex-1 p-6">
          <div className="space-y-6">
            {/* Account Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Account</h3>
              {currentUser ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 text-blue-900 px-4 py-3 rounded-lg text-sm font-medium">
                    Logged in as <span className="font-bold">{currentUser.netId}</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    <span className="font-medium text-gray-900">Role:</span> {currentUser.role === 'admin' ? 'Admin' : currentUser.role === 'staff' ? 'Staff' : 'Customer'}
                  </div>

                  {/* Edit Mode Toggle - Only show for staff and admin */}
                  {canEditMode && (
                    <div className="border-t pt-4 mt-4">
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <div className="flex-1">
                            <span className="font-medium text-gray-900">Edit Mode</span>
                            <p className="text-xs text-gray-500">Enable menu editing capabilities</p>
                          </div>
                        </label>
                        <button
                          onClick={() => onToggleEditMode(!isEditMode)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            isEditMode ? 'bg-bluebite-primary' : 'bg-gray-300'
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
                        <div className="mt-2 text-xs text-bluebite-primary font-medium">
                          Edit Mode is ON
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    onClick={handleLogout}
                    className="w-full bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition flex items-center justify-center gap-2"
                  >
                    <LogOut size={16} />
                    Logout
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleCASLogin}
                  className="w-full bg-blue-900 text-white px-4 py-3 rounded-lg text-sm font-medium hover:bg-blue-950 transition"
                >
                  Login with Yale CAS
                </button>
              )}
            </div>

            {/* Buttery Selector Section */}
            <div className="border-t pt-4 mt-4">
              <h3 className="text-lg font-semibold text-gray-900">Buttery Selector</h3>
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
