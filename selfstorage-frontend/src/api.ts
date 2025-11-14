// src/api.ts

// Basis-URL kommt aus Vite-Env (Render / Localhost)
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as
  | string
  | undefined;

if (!API_BASE_URL) {
  console.warn(
    "[api] VITE_API_BASE_URL ist nicht gesetzt. Bitte im Frontend-Environment konfigurieren."
  );
}

// --------------------------------------------------
// Helpers für Auth
// --------------------------------------------------

/**
 * JWT aus localStorage holen (LoginModal speichert das Token dort)
 * Wird für Endpunkte benutzt, die zwingend Login brauchen.
 */
function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem("access_token");
  if (!token) {
    throw new Error("Kein Token gefunden. Bitte erneut einloggen.");
  }
  return {
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Variante: optionaler Auth-Header (für Endpunkte, die zur Not auch ohne Token gehen)
 */
function getOptionalAuthHeaders(): HeadersInit {
  const token = localStorage.getItem("access_token");
  if (!token) {
    return {};
  }
  return {
    Authorization: `Bearer ${token}`,
  };
}

// --------------------------------------------------
// Typen
// --------------------------------------------------

export interface AuthMeResponse {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  is_admin: boolean;
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

/**
 * Admin-Sicht auf Buchungen – erweitert um ein paar Felder,
 * so wie sie typischerweise in deinem Backend auftauchen könnten.
 */
export interface AdminBooking extends BookingPublic {
  user_email?: string;
  box_name?: string;
  is_active?: boolean;
}

// --------------------------------------------------
// Auth / User
// --------------------------------------------------

/**
 * /auth/me – Infos über den aktuell eingeloggten User
 * (Token wird intern aus localStorage gelesen)
 */
export async function getMe(): Promise<AuthMeResponse> {
  if (!API_BASE_URL) {
    throw new Error(
      "API-Basis-URL ist nicht konfiguriert (VITE_API_BASE_URL)."
    );
  }

  const res = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: {
      ...getAuthHeaders(),
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(
      `auth/me error (${res.status}): ${
        txt.slice(0, 200) || "Unbekannter Fehler"
      }`
    );
  }

  return res.json();
}

// --------------------------------------------------
// Box-Verfügbarkeit (Kunde)
// --------------------------------------------------

/**
 * Verfügbare Boxen für einen Zeitraum holen
 */
export async function getAvailableBoxes(params: {
  startInMinutes: number;
  durationMinutes: number;
}): Promise<BoxPublic[]> {
  if (!API_BASE_URL) {
    throw new Error(
      "API-Basis-URL ist nicht konfiguriert (VITE_API_BASE_URL)."
    );
  }

  const url = new URL(`${API_BASE_URL}/boxes/available`);
  url.searchParams.set("start_in_minutes", String(params.startInMinutes));
  url.searchParams.set("duration_minutes", String(params.durationMinutes));

  const res = await fetch(url.toString(), {
    headers: {
      ...getOptionalAuthHeaders(), // Wenn Token vorhanden → hängt dran
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

// --------------------------------------------------
// Eigene Buchung (Kunde)
// --------------------------------------------------

/**
 * Eigene Buchung anlegen (KUNDEN-Sicht, braucht Login)
 */
export async function createMyBooking(params: {
  boxId: string;
  durationMinutes: number;
  userName?: string;
}): Promise<BookingPublic> {
  if (!API_BASE_URL) {
    throw new Error(
      "API-Basis-URL ist nicht konfiguriert (VITE_API_BASE_URL)."
    );
  }

  const headers = {
    "Content-Type": "application/json",
    ...getAuthHeaders(), // DARF knallen, wenn kein Login
  };

  const body = {
    user_name: params.userName ?? "Webkunde",
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

// --------------------------------------------------
// Admin: Buchungen verwalten
// --------------------------------------------------

export interface CreateBookingAdminParams {
  user_email: string;
  box_id: string;
  duration_minutes: number;
  user_name?: string;
}

/**
 * Admin: Liste aller Buchungen holen
 * (entspricht GET /bookings/)
 */
export async function listBookingsAdmin(): Promise<AdminBooking[]> {
  if (!API_BASE_URL) {
    throw new Error(
      "API-Basis-URL ist nicht konfiguriert (VITE_API_BASE_URL)."
    );
  }

  const res = await fetch(`${API_BASE_URL}/bookings/`, {
    headers: {
      Accept: "application/json",
      ...getAuthHeaders(),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Admin bookings error: ${res.status} - ${text}`);
  }

  return res.json();
}

/**
 * Admin: neue Buchung für einen Kunden anlegen
 * (entspricht POST /bookings/)
 */
export async function createBookingAdmin(
  params: CreateBookingAdminParams
): Promise<AdminBooking> {
  if (!API_BASE_URL) {
    throw new Error(
      "API-Basis-URL ist nicht konfiguriert (VITE_API_BASE_URL)."
    );
  }

  const res = await fetch(`${API_BASE_URL}/bookings/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Admin create booking error: ${res.status} - ${text}`);
  }

  return res.json();
}

/**
 * Admin: Buchung löschen / stornieren
 * (entspricht DELETE /bookings/{booking_id})
 */
export async function cancelBookingAdmin(bookingId: string): Promise<void> {
  if (!API_BASE_URL) {
    throw new Error(
      "API-Basis-URL ist nicht konfiguriert (VITE_API_BASE_URL)."
    );
  }

  const res = await fetch(`${API_BASE_URL}/bookings/${bookingId}`, {
    method: "DELETE",
    headers: {
      ...getAuthHeaders(),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Booking cancel error: ${res.status} - ${text}`);
  }
}
