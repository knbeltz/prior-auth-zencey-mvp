import { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { ModalsProvider } from "@mantine/modals";
import { NavigationProgress } from "@mantine/nprogress";

// Pages
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import Dashboard from "./pages/Dashboard";
import PatientGroupPage from "./pages/PatientGroupPage";
import PatientDetailsPage from "./pages/PatientDetailsPage";
import DisputePage from "./pages/DisputePage";

// Context
import { AuthProvider, useAuth } from "./context/AuthContext";
import { PatientGroupProvider } from "./context/PatientGroupContext";

// Components
import ProtectedRoute from "./components/ProtectedRoute";
import LoadingOverlay from "./components/LoadingOverlay";

function AppContent() {
  const { user, loading } = useAuth();
  const [colorScheme, setColorScheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    if (
      user?.preferences?.theme === "light" ||
      user?.preferences?.theme === "dark"
    ) {
      setColorScheme(user.preferences.theme);
    }
  }, [user]);

  if (loading) {
    return <LoadingOverlay />;
  }

  return (
    <MantineProvider
      defaultColorScheme={colorScheme}
      theme={{
        primaryColor: "blue",
        fontFamily: "Inter, system-ui, sans-serif",
        headings: {
          fontFamily: "Inter, system-ui, sans-serif",
        },
      }}
    >
      <ModalsProvider>
        <Notifications position="top-right" />
        <NavigationProgress />

        <Router>
          <Routes>
            <Route
              path="/login"
              element={
                user ? <Navigate to="/dashboard" replace /> : <LoginPage />
              }
            />
            <Route
              path="/signup"
              element={
                user ? <Navigate to="/dashboard" replace /> : <SignupPage />
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <PatientGroupProvider>
                    <Dashboard />
                  </PatientGroupProvider>
                </ProtectedRoute>
              }
            />
            <Route
              path="/group/:groupId"
              element={
                <ProtectedRoute>
                  <PatientGroupProvider>
                    <PatientGroupPage />
                  </PatientGroupProvider>
                </ProtectedRoute>
              }
            />
            <Route
              path="/patient/:patientId"
              element={
                <ProtectedRoute>
                  <PatientGroupProvider>
                    <PatientDetailsPage />
                  </PatientGroupProvider>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dispute/:disputeId"
              element={
                <ProtectedRoute>
                  <PatientGroupProvider>
                    <DisputePage />
                  </PatientGroupProvider>
                </ProtectedRoute>
              }
            />
            <Route
              path="/"
              element={<Navigate to={user ? "/dashboard" : "/login"} replace />}
            />
            <Route
              path="*"
              element={<Navigate to={user ? "/dashboard" : "/login"} replace />}
            />
          </Routes>
        </Router>
      </ModalsProvider>
    </MantineProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
