import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import ThemesPage from './pages/ThemesPage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import TextGenerationPage from './pages/TextGenerationPage';
import ImageGenerationPage from './pages/ImageGenerationPage';
import ValidationPage from './pages/ValidationPage';
import ContentLibraryPage from './pages/ContentLibraryPage';
import Layout from './components/Layout';
import { Loader2 } from 'lucide-react';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isValidating } = useAuth();
  
  // Show loading state while validating stored API key
  if (isValidating) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600 mx-auto mb-4" />
          <p className="text-gray-600">Validating authentication...</p>
        </div>
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
          path="/"
          element={
            <PrivateRoute>
              <Layout>
                <Dashboard />
              </Layout>
            </PrivateRoute>
          }
        />
        <Route
          path="/themes"
          element={
            <PrivateRoute>
              <Layout>
                <ThemesPage />
              </Layout>
            </PrivateRoute>
          }
        />
        <Route
          path="/projects"
          element={
            <PrivateRoute>
              <Layout>
                <ProjectsPage />
              </Layout>
            </PrivateRoute>
          }
        />
        <Route
          path="/projects/:id"
          element={
            <PrivateRoute>
              <Layout>
                <ProjectDetailPage />
              </Layout>
            </PrivateRoute>
          }
        />
        <Route
          path="/generate/text"
          element={
            <PrivateRoute>
              <Layout>
                <TextGenerationPage />
              </Layout>
            </PrivateRoute>
          }
        />
        <Route
          path="/generate/image"
          element={
            <PrivateRoute>
              <Layout>
                <ImageGenerationPage />
              </Layout>
            </PrivateRoute>
          }
        />
        <Route
          path="/validate"
          element={
            <PrivateRoute>
              <Layout>
                <ValidationPage />
              </Layout>
            </PrivateRoute>
          }
        />
        <Route
          path="/content"
          element={
            <PrivateRoute>
              <Layout>
                <ContentLibraryPage />
              </Layout>
            </PrivateRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;

