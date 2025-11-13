// src/App.tsx
import { useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
} from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import FloorplanPage from "./pages/FloorplanPage";
import LoginModal from "./components/LoginModal";
import BookingPage from "./pages/BookingPage";

interface AuthUser {
  email: string;
}

function AppShell() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  const isLoggedIn = !!authUser || !!localStorage.getItem("access_token");
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    setAuthUser(null);
  };

  const handleLoginSuccess = (email: string) => {
    setAuthUser({ email });
    setIsLoginOpen(false);
  };

  const goToFloorplan = () => navigate("/floorplan");

  return (
    <>
      <Routes>
        <Route
          path="/"
          element={
            <LandingPage
              isLoggedIn={isLoggedIn}
              userEmail={authUser?.email ?? null}
              onOpenLogin={() => setIsLoginOpen(true)}
              onLogout={handleLogout}
              onGoToFloorplan={goToFloorplan}
            />
          }
        />

        <Route
          path="/floorplan"
          element={
            <FloorplanPage
              onBackToLanding={() => navigate("/")}
            />
          }
        />

        <Route path="/booking/:boxId" element={<BookingPage />} />
      </Routes>

      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />
    </>
  );
}

export default function App() {
  return (
    <Router>
      <AppShell />
    </Router>
  );
}