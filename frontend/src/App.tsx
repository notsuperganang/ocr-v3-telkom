// Main App component with routing and providers
import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { Toaster } from './components/ui/toaster';

// Lazy load all page components for better code splitting
const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const UploadPage = lazy(() => import('./pages/UploadPage').then(m => ({ default: m.UploadPage })));
const ContractsPageMain = lazy(() => import('./pages/ContractsPage').then(m => ({ default: m.ContractsPage })));
const ContractDetailPage = lazy(() => import('./pages/ContractDetailPage').then(m => ({ default: m.ContractDetailPage })));
const ContractEditPage = lazy(() => import('./pages/ContractEditPage').then(m => ({ default: m.ContractEditPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then(m => ({ default: m.ProfilePage })));
const UserManagementPage = lazy(() => import('./pages/UserManagementPage').then(m => ({ default: m.UserManagementPage })));
const ProcessingPage = lazy(() => import('./pages/ProcessingPage').then(m => ({ default: m.ProcessingPage })));
const ReviewPage = lazy(() => import('./pages/ReviewPage').then(m => ({ default: m.ReviewPage })));
const SegmentsPage = lazy(() => import('./pages/SegmentsPage').then(m => ({ default: m.SegmentsPage })));
const WitelsPage = lazy(() => import('./pages/WitelsPage').then(m => ({ default: m.WitelsPage })));
const AccountManagersPage = lazy(() => import('./pages/AccountManagersPage').then(m => ({ default: m.AccountManagersPage })));
const AccountsPage = lazy(() => import('./pages/AccountsPage').then(m => ({ default: m.AccountsPage })));
const AccountHistoryPage = lazy(() => import('./pages/AccountHistoryPage').then(m => ({ default: m.AccountHistoryPage })));

// Loading fallback component
const PageLoader = () => (
  <div className="flex h-screen items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-[#d71920]" />
      <p className="text-sm text-muted-foreground">Memuat halaman...</p>
    </div>
  </div>
);

// Create a client with optimized cache settings
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh without refetch
      gcTime: 10 * 60 * 1000, // 10 minutes - keep unused data in cache (formerly cacheTime)
      refetchOnMount: false, // Don't refetch if data is fresh
      refetchOnReconnect: true, // Refetch when internet reconnects
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<LoginPage />} />

              {/* Protected routes */}
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <Suspense fallback={<PageLoader />}>
                        <Routes>
                          <Route path="/" element={<DashboardPage />} />
                          <Route path="/upload" element={<UploadPage />} />
                          <Route path="/contracts" element={<ContractsPageMain />} />
                          <Route path="/contracts/:contractId" element={<ContractDetailPage />} />
                          <Route path="/contracts/:contractId/edit" element={<ContractEditPage />} />
                          <Route path="/profile" element={<ProfilePage />} />
                          <Route path="/users" element={<UserManagementPage />} />
                          <Route path="/segments" element={<SegmentsPage />} />
                          <Route path="/witels" element={<WitelsPage />} />
                          <Route path="/account-managers" element={<AccountManagersPage />} />
                          <Route path="/accounts" element={<AccountsPage />} />
                          <Route path="/account-history" element={<AccountHistoryPage />} />
                          <Route path="/processing/:jobId" element={<ProcessingPage />} />
                          <Route path="/review/:jobId" element={<ReviewPage />} />
                          <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                      </Suspense>
                    </Layout>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </Suspense>
        </Router>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
