// src/App.tsx
console.log("VITE_API_BASE_URL =", import.meta.env.VITE_API_BASE_URL);

import { useEffect, useState } from "react";
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
import { getMe } from "./api";

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

  // Beim Laden versuchen, /auth/me abzurufen
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return;

    (async () => {
      try {
        const me = await getMe();
        setAuthUser({
          email: me.email,
          role: me.is_admin ? "admin" : "customer",
        });
      } catch (err) {
        console.warn("Konnte /auth/me beim Start nicht laden:", err);
        localStorage.removeItem("access_token");
        setAuthUser(null);
      }
    })();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    setAuthUser(null);
    navigate("/");
  };

  const handleLoginSuccess = async () => {
    try {
      const me = await getMe();
      setAuthUser({
        email: me.email,
        role: me.is_admin ? "admin" : "customer",
      });

      if (me.is_admin) {
        navigate("/admin");
      }
    } catch (err) {
      console.error("Fehler bei getMe nach Login:", err);
    } finally {
      setIsLoginOpen(false);
    }
  };

  const handleSelectBox = (box: import("./api").BoxPublic) => {
    if (!isLoggedIn) {
      setIsLoginOpen(true);
      return;
    }

    navigate(`/booking/${box.id}`, {
      state: { box },
    });
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
        <Route path="/admin" element={<AdminDashboardPage />} />
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