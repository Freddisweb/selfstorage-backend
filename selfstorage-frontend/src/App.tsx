// src/App.tsx
import { useState } from "react";
import { BrowserRouter as Router, Routes, Route, useNavigate } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import FloorplanPage from "./pages/FloorplanPage";
import LoginModal from "./components/LoginModal";

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

  const handleSelectBox = (boxId: string) => {
    if (!isLoggedIn) {
      setIsLoginOpen(true);
      return;
    }
    alert(`Hier würden wir jetzt die Buchung für Box ${boxId} starten.`);
  };

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
              onSelectBox={handleSelectBox}
            />
          }
        />
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