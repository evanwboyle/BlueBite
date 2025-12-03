import { X, Settings, LogOut } from 'lucide-react';

interface User {
  netId: string;
  name?: string;
  role: string;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onUserLogin: (user: User) => void;
  onUserLogout: () => void;
}

export function SettingsModal({ isOpen, onClose, currentUser, onUserLogin, onUserLogout }: SettingsModalProps) {
  if (!isOpen) return null;

  const handleCASLogin = () => {
    // Redirect to backend CAS login endpoint
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
    window.location.href = `${apiUrl}/auth/login`;
  };

  const handleLogout = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      await fetch(`${apiUrl}/auth/logout`, {
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
              <div
                style={{
                  WebkitTextSizeAdjust: '100%',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
                  boxSizing: 'border-box',
                  display: 'block',
                  marginBottom: '0',
                  fontSize: '14px',
                  fontWeight: 400,
                  lineHeight: '1.42857143',
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  verticalAlign: 'middle',
                  userSelect: 'none',
                  border: '1px solid transparent',
                  borderRadius: '4px',
                  width: '100%',
                  backgroundColor: '#00356b',
                  color: '#fff',
                  padding: '8px',
                }}
              >
                Logged in as {currentUser.netId}
              </div>
              <button
                onClick={handleLogout}
                style={{
                  WebkitTextSizeAdjust: '100%',
                  WebkitTapHighlightColor: 'rgba(0,0,0,0)',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
                  boxSizing: 'border-box',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  marginBottom: '0',
                  fontSize: '14px',
                  fontWeight: 400,
                  lineHeight: '1.42857143',
                  textAlign: 'center',
                  verticalAlign: 'middle',
                  touchAction: 'manipulation',
                  cursor: 'pointer',
                  userSelect: 'none',
                  backgroundImage: 'none',
                  border: '1px solid transparent',
                  borderRadius: '4px',
                  width: '100%',
                  backgroundColor: '#c53030',
                  color: '#fff',
                  padding: '8px',
                }}
              >
                <LogOut size={14} />
                Logout
              </button>
            </div>
          ) : (
            <button
              onClick={handleCASLogin}
              style={{
                WebkitTextSizeAdjust: '100%',
                WebkitTapHighlightColor: 'rgba(0,0,0,0)',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
                boxSizing: 'border-box',
                textDecoration: 'none',
                display: 'inline-block',
                marginBottom: '0',
                fontSize: '14px',
                fontWeight: 400,
                lineHeight: '1.42857143',
                textAlign: 'center',
                whiteSpace: 'nowrap',
                verticalAlign: 'middle',
                touchAction: 'manipulation',
                cursor: 'pointer',
                userSelect: 'none',
                backgroundImage: 'none',
                border: '1px solid transparent',
                borderRadius: '4px',
                width: '100%',
                backgroundColor: '#00356b',
                color: '#fff',
                padding: '8px',
              }}
            >
              Login with Yale CAS
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
