import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Menu, X, Home, ListTodo, FileText, Package, Users, BarChart, LogOut } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { user, logout } = useAuth();
  const location = useLocation();

  const technicianLinks = [
    { to: '/dashboard', icon: Home, label: 'Home' },
    { to: '/tasks', icon: ListTodo, label: 'Tasks' },
    { to: '/logs', icon: FileText, label: 'Logs' },
    { to: '/inventory', icon: Package, label: 'Inventory' },
  ];

  const adminLinks = [
    { to: '/admin', icon: Home, label: 'Dashboard' },
    { to: '/admin/management', icon: Users, label: 'Management' },
    { to: '/admin/logs', icon: FileText, label: 'Logs' },
    { to: '/admin/inventory', icon: Package, label: 'Inventory' },
    { to: '/admin/reports', icon: BarChart, label: 'Reports' },
  ];

  const links = user?.role === 'admin' ? adminLinks : technicianLinks;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Header */}
      <header className="bg-card border-b border-border h-16 flex items-center px-4 justify-between sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden"
          >
            {sidebarOpen ? <X /> : <Menu />}
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">A</span>
            </div>
            <span className="font-bold text-lg">AquaGen</span>
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
          className={`${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } fixed lg:relative lg:translate-x-0 w-64 bg-card border-r border-border h-[calc(100vh-4rem)] transition-transform duration-300 z-30 flex flex-col`}
        >
          <nav className="flex-1 p-4 space-y-2">
            {links.map((link) => {
              const Icon = link.icon;
              const isActive = location.pathname === link.to;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted text-foreground'
                  }`}
                  onClick={() => window.innerWidth < 1024 && setSidebarOpen(false)}
                >
                  <Icon className="w-5 h-5" />
                  <span>{link.label}</span>
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
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
};
