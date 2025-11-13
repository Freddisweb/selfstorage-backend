// src/api.ts

// Basis-URL kommt aus Vite-Env (Render: VITE_API_BASE_URL)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string | undefined;

if (!API_BASE_URL) {
  console.warn(
    "[api] VITE_API_BASE_URL ist nicht gesetzt. Bitte in der Frontend-Umgebung konfigurieren."
  );
}

// JWT aus localStorage holen (LoginModal speichert das Token dort)
function getAuthHeaders() {
  const token = localStorage.getItem("access_token");
  if (!token) {
    throw new Error("Kein Token gefunden. Bitte erneut einloggen.");
  }
  return {
    Authorization: `Bearer ${token}`,
  };
}

// Variante: optionaler Auth-Header (für Endpunkte, die *ohne* Token zur Not auch laufen können)
function getOptionalAuthHeaders(): HeadersInit {
  const token = localStorage.getItem("access_token");
  if (!token) {
    return {};
  }
  return {
    Authorization: `Bearer ${token}`,
  };
}

export interface BoxPublic {
  id: string;
  name: string;
  size_m2: number;
  pricing_mode: "hourly" | "daily";
  unit_label: string;
  billed_units: number;
  price_for_period: number;
}

export interface BookingPublic {
  id: string;
  user_name: string;
  box_id: string;
  access_code: string | null;
  created_at: string;
  valid_until: string;
  pricing_mode?: string;
  unit_label?: string;
  billed_units?: number;
  price_for_period?: number;
}

// Verfügbare Boxen für Zeitraum holen
export async function getAvailableBoxes(params: {
  startInMinutes: number;
  durationMinutes: number;
}): Promise<BoxPublic[]> {
  if (!API_BASE_URL) {
    throw new Error("API-Basis-URL ist nicht konfiguriert (VITE_API_BASE_URL).");
  }

  const url = new URL(`${API_BASE_URL}/boxes/available`);
  url.searchParams.set("start_in_minutes", String(params.startInMinutes));
  url.searchParams.set("duration_minutes", String(params.durationMinutes));

  const res = await fetch(url.toString(), {
    headers: {
      ...getOptionalAuthHeaders(), // <-- hier hängt jetzt der Token dran, falls vorhanden
    },
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(
      `API error (${res.status}): ${txt.slice(0, 200) || "Unbekannter Fehler"}`
    );
  }
  return res.json();
}

// Eigene Buchung anlegen (Login zwingend erforderlich)
export async function createMyBooking(params: {
  boxId: string;
  durationMinutes: number;
  userName?: string;
}): Promise<BookingPublic> {
  if (!API_BASE_URL) {
    throw new Error("API-Basis-URL ist nicht konfiguriert (VITE_API_BASE_URL).");
  }

  const headers = {
    "Content-Type": "application/json",
    ...getAuthHeaders(), // <-- hier DARF es knallen, wenn kein Login
  };

  const body = {
    user_name: params.userName ?? "Frontend-User",
    box_id: params.boxId,
    duration_minutes: params.durationMinutes,
  };

  const res = await fetch(`${API_BASE_URL}/bookings/me`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Booking API error: ${res.status} - ${text.slice(0, 300)}`
    );
  }

  return res.json();
}