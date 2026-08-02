import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Menu, X, Home, ListTodo, FileText, Package, Users, BarChart, LogOut, DollarSign, Settings as SettingsIcon } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
    setIsPinned(false);
  }, [location.pathname]);

  const technicianLinks = [
    { to: '/dashboard', icon: Home, label: 'Home' },
    { to: '/tasks', icon: ListTodo, label: 'Tasks' },
    { to: '/logs', icon: FileText, label: 'Logs' },
    { to: '/inventory', icon: Package, label: 'Inventory' },
  ];

  const adminLinks = [
    { to: '/admin', icon: Home, label: 'Dashboard' },
    { to: '/admin/management', icon: Users, label: 'Management' },
    { to: '/admin/financials', icon: DollarSign, label: 'Financials' },
    { to: '/admin/logs', icon: FileText, label: 'Logs' },
    { to: '/admin/inventory', icon: Package, label: 'Inventory' },
    { to: '/admin/reports', icon: BarChart, label: 'Reports' },
    { to: '/admin/settings', icon: SettingsIcon, label: 'Bot Access' },
  ];

  const links = user?.role === 'admin' ? adminLinks : technicianLinks;

  const desktopWidthClass = isPinned ? 'lg:w-64' : 'lg:w-16 lg:hover:w-64';
  const mobileTransformClass = mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0';
  const spanClass = isPinned 
    ? "opacity-100" 
    : "opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap";

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Top Header */}
      <header className="bg-card border-b border-border h-16 shrink-0 flex items-center px-4 justify-between z-40">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (window.innerWidth >= 1024) {
                setIsPinned(!isPinned);
              } else {
                setMobileOpen(!mobileOpen);
              }
            }}
          >
            <span className="hidden lg:flex"><Menu className={isPinned ? "text-primary" : ""} /></span>
            <span className="flex lg:hidden">{mobileOpen ? <X /> : <Menu />}</span>
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">A</span>
            </div>
            <span className="font-bold text-lg hidden sm:inline">AquaGen</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground hidden sm:inline">{user?.name}</span>
          <Button variant="ghost" size="icon" onClick={logout}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`
            fixed lg:relative w-64 bg-card border-r border-border h-full transition-all duration-300 z-30 flex flex-col group overflow-hidden
            ${desktopWidthClass} ${mobileTransformClass}
          `}
        >
          <nav className="flex-1 px-2 py-4 space-y-2 overflow-x-hidden">
            {links.map((link) => {
              const Icon = link.icon;
              const isActive = location.pathname === link.to;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted text-foreground'
                  }`}
                  onClick={() => window.innerWidth < 1024 && setMobileOpen(false)}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <span className={spanClass}>{link.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
    </div>
  );
};
