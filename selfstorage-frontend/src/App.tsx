// src/App.tsx
console.log("VITE_API_BASE_URL =", import.meta.env.VITE_API_BASE_URL);

import { useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
} from "react-router-dom";

import LandingPage from "./pages/LandingPage";
import FloorplanPage from "./pages/FloorplanPage";
import BookingPage from "./pages/BookingPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import LoginModal from "./components/LoginModal";
import type { BoxPublic } from "./api";

interface AuthUser {
  email: string;
  role: "admin" | "customer";
}

function AppShell() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  const navigate = useNavigate();

  const isLoggedIn = !!authUser || !!localStorage.getItem("access_token");
  const isAdmin = authUser?.role === "admin";

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    setAuthUser(null);
  };

  const handleLoginSuccess = (user: { email: string; role: "admin" | "customer" }) => {
    setAuthUser(user);
    setIsLoginOpen(false);

    // Admins direkt ins Dashboard
    if (user.role === "admin") {
      navigate("/admin");
    }
  };

  const handleSelectBox = (box: BoxPublic) => {
    if (!isLoggedIn) {
      setIsLoginOpen(true);
      return;
    }
    navigate(`/booking/${box.id}`, { state: { box } });
  };

  return (
    <>
      <Routes>
        <Route
          path="/"
          element={
            <LandingPage
              isLoggedIn={isLoggedIn}
              isAdmin={isAdmin}
              userEmail={authUser?.email ?? null}
              onOpenLogin={() => setIsLoginOpen(true)}
              onLogout={handleLogout}
              onGoToFloorplan={() => navigate("/floorplan")}
              onGoToAdmin={isAdmin ? () => navigate("/admin") : undefined}
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

        <Route path="/booking/:boxId" element={<BookingPage />} />

        <Route
          path="/admin"
          element={
            isAdmin ? (
              <AdminDashboardPage
                onBackToLanding={() => navigate("/")}
              />
            ) : (
              // Falls jemand /admin direkt öffnet ohne Admin-Rechte
              <LandingPage
                isLoggedIn={isLoggedIn}
                isAdmin={false}
                userEmail={authUser?.email ?? null}
                onOpenLogin={() => setIsLoginOpen(true)}
                onLogout={handleLogout}
                onGoToFloorplan={() => navigate("/floorplan")}
              />
            )
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