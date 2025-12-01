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

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
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

