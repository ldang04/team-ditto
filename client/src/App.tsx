import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import CampaignsDashboard from './pages/CampaignsDashboard';
import ContentLibraryPage from './pages/ContentLibraryPage';
import LinkedInWriter from './pages/LinkedInWriter';
import BrandSetup from './pages/BrandSetup';
import Layout from './components/Layout';
import { Loader2 } from 'lucide-react';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isValidating } = useAuth();

  if (isValidating) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/setup"
          element={
            <PrivateRoute>
              <BrandSetup />
            </PrivateRoute>
          }
        />

        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout>
                <CampaignsDashboard />
              </Layout>
            </PrivateRoute>
          }
        />

        <Route
          path="/create"
          element={
            <PrivateRoute>
              <Layout>
                <LinkedInWriter />
              </Layout>
            </PrivateRoute>
          }
        />

        <Route
          path="/library"
          element={
            <PrivateRoute>
              <Layout>
                <ContentLibraryPage />
              </Layout>
            </PrivateRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
