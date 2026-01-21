// Main App component with routing and providers
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { UploadPage } from './pages/UploadPage';
import { ContractsPage as ContractsPageMain } from './pages/ContractsPage';
import { ContractDetailPage } from './pages/ContractDetailPage';
import { ContractEditPage } from './pages/ContractEditPage';
import { ProfilePage } from './pages/ProfilePage';
import { UserManagementPage } from './pages/UserManagementPage';
import { ProcessingPage } from './pages/ProcessingPage';
import { ReviewPage } from './pages/ReviewPage';
import { SegmentsPage } from './pages/SegmentsPage';
import { WitelsPage } from './pages/WitelsPage';
import { AccountManagersPage } from './pages/AccountManagersPage';
import { AccountsPage } from './pages/AccountsPage';
import { AccountHistoryPage } from './pages/AccountHistoryPage';
import { Toaster } from './components/ui/toaster';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            
            {/* Protected routes */}
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <Layout>
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
                  </Layout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </Router>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
