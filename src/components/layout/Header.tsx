import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, HardHat, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { MobileNav } from './MobileNav';

interface HeaderProps {
  title?: string;
  subtitle?: string;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="glass-header shadow-elevation-1 sticky top-0 z-30 transition-all duration-normal">
      <div className="px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
        <div className="flex items-center justify-between">
          {/* Left Section: Mobile Nav + Logo/Title */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Mobile Navigation - Only visible on mobile */}
            <MobileNav />

            {/* Logo - Hidden on mobile, visible on larger screens */}
            <div className="hidden lg:flex items-center gap-3">
              <div className="p-2 rounded-input bg-gradient-to-br from-accent-500 to-accent-600 shadow-elevation-1 transition-transform duration-normal hover:scale-105">
                <HardHat className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <span className="text-lg sm:text-xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">Comptabilité PL</span>
            </div>

            {/* Page Title - Visible on all screens */}
            {title && (
              <div className="flex flex-col ml-2 lg:ml-4 pl-4 lg:pl-6 border-l-2 border-primary-200">
                <h1 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-800 truncate max-w-[150px] sm:max-w-none">
                  {title}
                </h1>
                {subtitle && (
                  <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">{subtitle}</p>
                )}
              </div>
            )}
          </div>

          {/* Right Section: User Info + Logout (Hidden on mobile, shown via MobileNav) */}
          <div className="hidden lg:flex items-center gap-4">
            {/* User Profile Photo */}
            {user?.profile_image_url ? (
              <img
                src={user.profile_image_url}
                alt={user.full_name || user.username}
                className="w-10 h-10 rounded-full object-cover border-2 border-gray-200 shadow-sm"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center border-2 border-gray-200">
                <User className="w-5 h-5 text-gray-400" />
              </div>
            )}
            {/* User Info */}
            <div className="text-right px-4 py-2 rounded-input bg-surface-secondary border border-gray-100 transition-all duration-fast hover:border-gray-200">
              <p className="text-sm font-semibold text-gray-800">{user?.full_name || user?.username}</p>
              <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
            </div>

            {/* Logout Button */}
            <Button
              onClick={handleLogout}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 hover-lift interactive-scale"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden xl:inline">Déconnexion</span>
            </Button>
          </div>

          {/* Mobile Logo - Only visible on mobile when no title */}
          {!title && (
            <div className="lg:hidden flex items-center gap-2">
              <div className="p-1.5 rounded-badge bg-gradient-to-br from-accent-500 to-accent-600 shadow-elevation-1">
                <HardHat className="h-5 w-5 text-white" />
              </div>
              <span className="text-base font-bold text-gray-800">Comptabilité PL</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
