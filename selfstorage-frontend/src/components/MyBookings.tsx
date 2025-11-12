import { useEffect, useState } from "react";

const API_BASE_URL = "http://127.0.0.1:8000";

interface Booking {
  id: string;
  box_id: string;
  user_name: string;
  access_code?: string | null;
  created_at: string;
  valid_until: string;
  pricing_mode?: string | null;
  unit_label?: string | null;
  billed_units?: number | null;
  price_for_period?: number | null;
}

interface MyBookingsProps {
  isAdmin: boolean;
}

const MyBookings = ({ isAdmin }: MyBookingsProps) => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [isCancellingId, setIsCancellingId] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const token = localStorage.getItem("access_token");

  // Buchungen laden
  const loadBookings = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    setInfoMsg(null);

    if (!token) {
      setErrorMsg("Bitte einloggen, um deine Buchungen zu sehen.");
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/bookings/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.status === 401) {
        throw new Error("Nicht eingeloggt oder Token abgelaufen.");
      }

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(
          `Fehler beim Laden der Buchungen (${res.status}): ${txt.slice(0, 200)}`
        );
      }

      const data: Booking[] = await res.json();
      setBookings(data);
    } catch (err: any) {
      setErrorMsg(err.message ?? "Unbekannter Fehler beim Laden der Buchungen.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Buchung stornieren – nur Admins sehen den Button überhaupt
  const handleCancel = async (booking: Booking) => {
    if (!token) {
      setErrorMsg("Bitte einloggen, um Buchungen zu stornieren.");
      return;
    }

    const confirmCancel = window.confirm(
      `Buchung für Box ${booking.box_id} wirklich stornieren?`
    );
    if (!confirmCancel) return;

    setIsCancellingId(booking.id);
    setErrorMsg(null);
    setInfoMsg(null);

    try {
      const res = await fetch(`${API_BASE_URL}/bookings/${booking.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.status === 401) {
        throw new Error("Nicht eingeloggt oder Token abgelaufen.");
      }

      if (res.status === 403) {
        // Sollte eigentlich nie passieren, weil normale User den Button gar nicht sehen,
        // aber falls doch:
        throw new Error("Nur Admins können Buchungen stornieren.");
      }

      if (res.status === 404) {
        throw new Error("Buchung wurde nicht gefunden (evtl. bereits gelöscht).");
      }

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(
          `Fehler beim Stornieren der Buchung (${res.status}): ${txt.slice(0, 200)}`
        );
      }

      setBookings((prev) => prev.filter((b) => b.id !== booking.id));
      setInfoMsg(
        `Buchung für Box ${booking.box_id} wurde erfolgreich storniert.`
      );
    } catch (err: any) {
      setErrorMsg(err.message ?? "Unbekannter Fehler beim Stornieren.");
    } finally {
      setIsCancellingId(null);
    }
  };

  const formatDateTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString();
    } catch {
      return iso;
    }
  };

  const formatPriceLine = (b: Booking) => {
    if (
      b.price_for_period == null ||
      b.billed_units == null ||
      !b.unit_label
    ) {
      return null;
    }

    const unit =
      b.unit_label === "hour"
        ? "Stunde(n)"
        : b.unit_label === "day"
        ? "Tag(e)"
        : b.unit_label;

    return `${b.price_for_period.toFixed(2)} € (${b.billed_units} ${unit})`;
  };

  return (
    <section className="w-full">
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">
          Meine Buchungen
        </h2>
        <p className="text-sm text-slate-500">
          Hier siehst du deine aktuellen und vergangenen Buchungen inklusive Zugangscode.
        </p>

        {infoMsg && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {infoMsg}
          </div>
        )}

        {errorMsg && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {errorMsg}
          </div>
        )}

        {isLoading && (
          <p className="text-sm text-slate-500">Lade Buchungen …</p>
        )}

        {!isLoading && bookings.length === 0 && !errorMsg && (
          <p className="text-sm text-slate-500">
            Du hast aktuell keine Buchungen.
          </p>
        )}

        <div className="space-y-4">
          {bookings.map((b) => (
            <article
              key={b.id}
              className="rounded-2xl border border-slate-200 bg-white/90 shadow-sm px-5 py-4"
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                {/* Linke Seite: Infos */}
                <div className="flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">
                    {b.box_id}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    Gebucht von:{" "}
                    <span className="font-medium">{b.user_name}</span>
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    Zugangscode:{" "}
                    <span className="font-mono font-semibold">
                      {b.access_code ?? "–"}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Von: {formatDateTime(b.created_at)} <br />
                    Bis: {formatDateTime(b.valid_until)}
                  </p>
                  {formatPriceLine(b) && (
                    <p className="mt-1 text-xs text-slate-500">
                      Preis: {formatPriceLine(b)}
                    </p>
                  )}
                </div>

                {/* Rechte Seite: Aktionen – nur für Admin sichtbar */}
                {isAdmin && (
                  <div className="flex flex-col items-end gap-2">
                    <button
                      type="button"
                      onClick={() => handleCancel(b)}
                      disabled={isCancellingId === b.id}
                      className="inline-flex items-center rounded-full border border-red-300 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isCancellingId === b.id
                        ? "Storniere …"
                        : "Buchung stornieren"}
                    </button>
                    <p className="text-[11px] text-slate-400 text-right">
                      Als Admin kannst du Buchungen direkt freigeben.
                    </p>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default MyBookings;