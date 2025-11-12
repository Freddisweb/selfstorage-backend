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

  // „Jetzt buchen“: zur Grundriss-Seite wechseln
  const goToFloorplan = () => navigate("/floorplan");

  // Box gewählt: ggf. Login öffnen, sonst später zu Booking-Details navigieren
  const handleSelectBox = (boxId: string) => {
    if (!isLoggedIn) {
      setIsLoginOpen(true);
      return;
    }
    // TODO: hier später auf /booking/:boxId routen
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
              authEmail={authUser?.email ?? null}
              onOpenLogin={() => setIsLoginOpen(true)}
              onLogout={handleLogout}
              onClickBookNow={goToFloorplan}
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