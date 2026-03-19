import { LogIn, LogOut, Store } from 'lucide-react';
import { API_BASE_URL } from '../utils/config';
import type { User } from '../types';
import bluebiteLogo from '../assets/android-chrome-192x192.png';

interface LoginPageProps {
  currentUser: User | null;
  butteryOptions: Array<{ name: string; itemCount: number }>;
  onSelectButtery: (buttery: string) => void;
  onUserLogout: () => void;
}

function getRoleLabel(role?: string): string {
  switch (role) {
    case 'admin':
      return 'Admin';
    case 'staff':
      return 'Staff';
    case 'manager':
      return 'Manager';
    default:
      return 'Customer';
  }
}

function getRoleBadgeClasses(role?: string): string {
  switch (role) {
    case 'admin':
      return 'bg-red-500/20 text-red-400 border-red-500/40';
    case 'staff':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/40';
    case 'manager':
      return 'bg-purple-500/20 text-purple-400 border-purple-500/40';
    default:
      return 'bg-gray-500/20 text-gray-400 border-gray-500/40';
  }
}

export function LoginPage({
  currentUser,
  butteryOptions,
  onSelectButtery,
  onUserLogout,
}: LoginPageProps) {
  const handleCASLogin = () => {
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
    <div
      className="h-screen flex flex-col items-center justify-center"
      style={{
        background:
          'linear-gradient(135deg, rgba(15, 20, 25, 0.98) 0%, rgba(25, 30, 40, 0.95) 100%)',
      }}
    >
      <div className="flex flex-col items-center gap-8 max-w-lg w-full px-6">
        {/* Logo and title */}
        <div className="flex flex-col items-center gap-4">
          <img
            src={bluebiteLogo}
            alt="BlueBite logo"
            className="w-24 h-24 rounded-full shadow-lg"
          />
          <h1 className="text-4xl font-bold text-white">BlueBite</h1>
          <p className="text-gray-400 text-center">
            Yale Buttery Ordering System
          </p>
        </div>

        {!currentUser ? (
          /* Step 1: CAS Login */
          <div className="glass-container rounded-lg w-full p-8 shadow-xl">
            <h2 className="text-xl font-semibold text-white text-center mb-6">
              Sign in to continue
            </h2>
            <button
              onClick={handleCASLogin}
              className="w-full glass-button-primary px-6 py-4 rounded-lg text-base font-medium transition flex items-center justify-center gap-3"
            >
              <LogIn size={20} />
              Login with Yale CAS
            </button>
          </div>
        ) : (
          /* Step 2: Logged in — show user info + buttery selection */
          <>
            {/* User info card */}
            <div className="glass-container rounded-lg w-full p-6 shadow-xl">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm text-gray-400">Signed in as</p>
                  <p className="text-lg font-semibold text-white">
                    {currentUser.netId}
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium border ${getRoleBadgeClasses(currentUser.role)}`}
                >
                  {getRoleLabel(currentUser.role)}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="text-sm text-gray-500 hover:text-red-400 transition flex items-center gap-1 mt-1"
              >
                <LogOut size={14} />
                Sign out
              </button>
            </div>

            {/* Buttery selection */}
            <div className="glass-container rounded-lg w-full p-6 shadow-xl">
              <h2 className="text-xl font-semibold text-white text-center mb-2">
                Select your Buttery
              </h2>
              <p className="text-sm text-gray-400 text-center mb-6">
                Choose which buttery to view and order from
              </p>

              {butteryOptions.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  Loading butteries...
                </p>
              ) : (
                <div className="space-y-2">
                  {butteryOptions.map((option) => (
                    <button
                      key={option.name}
                      onClick={() => onSelectButtery(option.name)}
                      className="w-full flex items-center justify-between px-5 py-4 rounded-lg border border-white/10 hover:border-blue-500/50 hover:bg-blue-500/10 transition group"
                    >
                      <div className="flex items-center gap-3">
                        <Store
                          size={20}
                          className="text-gray-500 group-hover:text-blue-400 transition"
                        />
                        <span className="font-medium text-white">
                          {option.name}
                        </span>
                      </div>
                      <span className="text-sm text-gray-500">
                        {option.itemCount} items
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
