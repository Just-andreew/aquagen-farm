import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { DataProvider } from '@/contexts/DataContext';
import { Toaster } from 'sonner';

// --- 1. EAGER IMPORTS (Crucial for initial load) ---
// We import the Layout and Auth pages directly so the user isn't staring at a blank screen while trying to log in.
import { Layout } from '@/components/Layout';
import { LoginPage } from '@/components/LoginPage';
import { SignUpPage } from '@/components/SignUpPage';

// --- 2. LAZY IMPORTS (Code Splitting) ---
// These pages are only downloaded when the user actually navigates to them.
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Tasks = lazy(() => import('@/pages/Tasks'));
const Logs = lazy(() => import('@/pages/Logs'));
const Inventory = lazy(() => import('@/pages/Inventory'));
const Management = lazy(() => import('@/pages/admin/Management'));
const NotFound = lazy(() => import('@/pages/NotFound'));

// --- 3. SECURITY GUARD ---
// This wrapper ensures only logged-in users can access the dashboard routes.
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#013333] flex items-center justify-center text-[#14B8A6] font-bold">
        Loading AquaGen...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// --- 4. MAIN APP COMPONENT ---
function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <Router>
          {/* Notifications component */}
          <Toaster position="top-center" richColors theme="dark" />
          
          <Routes>
            {/* --- PUBLIC ROUTES --- */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignUpPage />} />

            {/* --- PROTECTED ROUTES --- */}
            <Route
              element={
                <ProtectedRoute>
                  <Layout>
                    <Outlet />
                  </Layout>
                </ProtectedRoute>
              }
            >
              {/* Suspense boundary catches the lazy-loaded pages and shows a fallback while they download */}
              <Route
                path="/dashboard"
                element={
                  <Suspense fallback={<div className="p-8 text-center text-[#14B8A6]">Loading Dashboard...</div>}>
                    <Dashboard />
                  </Suspense>
                }
              />
              <Route
                path="/tasks"
                element={
                  <Suspense fallback={<div className="p-8 text-center text-[#14B8A6]">Loading Tasks...</div>}>
                    <Tasks />
                  </Suspense>
                }
              />
              <Route
                path="/logs"
                element={
                  <Suspense fallback={<div className="p-8 text-center text-[#14B8A6]">Loading Logs...</div>}>
                    <Logs />
                  </Suspense>
                }
              />
              <Route
                path="/inventory"
                element={
                  <Suspense fallback={<div className="p-8 text-center text-[#14B8A6]">Loading Inventory...</div>}>
                    <Inventory />
                  </Suspense>
                }
              />
              <Route
                path="/management"
                element={
                  <Suspense fallback={<div className="p-8 text-center text-[#14B8A6]">Loading Management...</div>}>
                    <Management />
                  </Suspense>
                }
              />
              
              {/* Catch-all for protected 404s */}
              <Route
                path="*"
                element={
                  <Suspense fallback={<div className="p-8 text-center text-[#14B8A6]">Loading...</div>}>
                    <NotFound />
                  </Suspense>
                }
              />
            </Route>
          </Routes>
        </Router>
      </DataProvider>
    </AuthProvider>
  );
}

export default App;