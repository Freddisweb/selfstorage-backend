import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminPanel from "../components/AdminPanel";

const API_BASE_URL = "http://127.0.0.1:8000";

interface AuthUser {
  id: string;
  email: string;
  is_admin: boolean;
}

const AdminPage = () => {
  const navigate = useNavigate();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = async () => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      navigate("/"); // kein Token → zurück zur Startseite
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        localStorage.removeItem("access_token");
        navigate("/");
        return;
      }

      const data = await res.json();
      if (!data.is_admin) {
        navigate("/"); // kein Admin → kein Zugriff
        return;
      }

      setAuthUser({
        id: data.id,
        email: data.email,
        is_admin: data.is_admin,
      });
    } catch {
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMe();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-slate-500">
        Lade Admin-Daten…
      </div>
    );
  }

  if (!authUser) return null;

  return (
    <div className="min-h-screen bg-neutral-50 text-slate-900">
      {/* Header */}
      <header className="flex justify-between items-center px-8 py-6 border-b border-slate-200 bg-white shadow-sm">
        <h1 className="text-2xl font-bold text-blue-700">SpaceOne Admin</h1>

        <div className="text-right text-xs text-slate-500">
          <p>Eingeloggt als</p>
          <p className="font-medium text-slate-800">{authUser.email}</p>
          <button
            onClick={() => {
              localStorage.removeItem("access_token");
              navigate("/");
            }}
            className="mt-2 rounded-full bg-black text-white px-4 py-1.5 text-xs hover:bg-neutral-800"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Inhalt */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        <h2 className="text-xl font-semibold mb-4">Admin-Dashboard</h2>
        <p className="text-slate-500 mb-6">
          Hier kannst du Boxen verwalten, Preise anpassen und Buchungen
          einsehen.
        </p>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <AdminPanel />
        </div>
      </main>
    </div>
  );
};

export default AdminPage;