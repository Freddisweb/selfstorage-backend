import { useState } from "react";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (email: string) => void;
}

// Basis-URL aus Vite-Env
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string | undefined;

const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginMessage, setLoginMessage] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginMessage(null);
    setIsLoggingIn(true);

    try {
      if (!API_BASE_URL) {
        throw new Error("API-Basis-URL ist nicht gesetzt.");
      }

      const body = new URLSearchParams();
      body.append("username", email);
      body.append("password", password);

      // 1) Login beim Backend
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(
          `Login fehlgeschlagen (${res.status}): ${txt.slice(0, 200)}`
        );
      }

      const data = await res.json();
      const token = data.access_token as string | undefined;

      if (!token) {
        throw new Error("Login erfolgreich, aber kein Token erhalten.");
      }

      localStorage.setItem("access_token", token);

      // 2) /auth/me, um die echte Mail aus dem Backend zu holen
      let backendEmail = email;
      try {
        const meRes = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (meRes.ok) {
          const meData = await meRes.json();
          if (meData.email) {
            backendEmail = meData.email;
          }
        } else {
          console.warn("auth/me fehlgeschlagen:", meRes.status);
        }
      } catch (err) {
        console.warn("Fehler beim Aufruf von /auth/me:", err);
      }

      setLoginMessage("Login erfolgreich.");
      setPassword("");

      // App informieren
      onLoginSuccess(backendEmail);

      setTimeout(() => {
        setLoginMessage(null);
        onClose();
      }, 600);
    } catch (err: any) {
      console.error("Login-Fehler:", err);
      setLoginError(
        err?.message ?? "Unbekannter Fehler beim Login. Bitte erneut versuchen."
      );
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-2">
          Einloggen
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          Bitte melde dich an, um deine Buchung abzuschließen.
        </p>

        {loginMessage && (
          <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            {loginMessage}
          </div>
        )}

        {loginError && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
            {loginError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700">
              E-Mail
            </label>
            <input
              type="email"
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2563eb]"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">
              Passwort
            </label>
            <input
              type="password"
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2563eb]"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoggingIn}
            className="mt-2 w-full inline-flex items-center justify-center rounded-full bg-[#2563eb] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#1d4ed8] disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            {isLoggingIn ? "Login …" : "Einloggen"}
          </button>
        </form>

        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full text-center text-xs text-slate-500 hover:text-slate-700"
        >
          Abbrechen
        </button>
      </div>
    </div>
  );
};

export default LoginModal;