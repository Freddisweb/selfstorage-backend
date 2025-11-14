// src/pages/AdminDashboardPage.tsx
import { useEffect, useMemo, useState } from "react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import {
  listBookingsAdmin,
  cancelBookingAdmin,
  type AdminBooking,
} from "../api";

type Props = {
  onBackToLanding: () => void;
};

function formatDateTime(iso?: string | null): string {
  if (!iso) return "–";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function AdminDashboardPage({ onBackToLanding }: Props) {
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [onlyActive, setOnlyActive] = useState(true);
  const [isCancellingId, setIsCancellingId] = useState<string | null>(null);

  // Kennzahlen aus den Buchungen
  const stats = useMemo(() => {
    const total = bookings.length;
    const activeCount = bookings.filter((b) => b.is_active !== false).length;
    const uniqueBoxes = new Set(bookings.map((b) => b.box_id)).size;
    return { total, activeCount, uniqueBoxes };
  }, [bookings]);

  const loadBookings = async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);
      const data = await listBookingsAdmin({
        q: search.trim() || undefined,
        onlyActive,
        limit: 100,
        offset: 0,
      });
      setBookings(data);
    } catch (err: any) {
      console.error("Admin loadBookings error:", err);
      setErrorMsg(
        err?.message ?? "Fehler beim Laden der Buchungen (Admin-Ansicht)."
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Beim ersten Aufruf direkt laden
    loadBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadBookings();
  };

  const handleCancelBooking = async (booking: AdminBooking) => {
    if (!window.confirm(`Buchung ${booking.id} wirklich stornieren?`)) return;

    try {
      setIsCancellingId(booking.id);
      await cancelBookingAdmin(booking.id);
      // aus der Liste entfernen
      setBookings((prev) => prev.filter((b) => b.id !== booking.id));
    } catch (err: any) {
      alert(
        err?.message ?? "Fehler beim Stornieren der Buchung. Bitte erneut versuchen."
      );
    } finally {
      setIsCancellingId(null);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#f3f3f0] flex flex-col">
      {/* Header */}
      <header className="w-full flex items-center justify-between px-6 py-4">
        <button
          type="button"
          onClick={onBackToLanding}
          className="text-sm text-slate-600 hover:text-slate-900"
        >
          ← Zurück zur Startseite
        </button>
        <h2 className="text-xl sm:text-2xl font-semibold text-slate-900">
          Admin-Dashboard
        </h2>
        <div className="w-16" />
      </header>

      <main className="flex-1 flex flex-col gap-6 px-4 pb-10 items-center">
        {/* Kennzahlen-Karten */}
        <div className="w-full max-w-6xl grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-4 bg-white/90 rounded-2xl shadow-md">
            <p className="text-xs text-slate-500 mb-1">Gesamte Buchungen</p>
            <p className="text-2xl font-semibold text-slate-900">
              {stats.total}
            </p>
          </Card>
          <Card className="p-4 bg-white/90 rounded-2xl shadow-md">
            <p className="text-xs text-slate-500 mb-1">Aktive Buchungen</p>
            <p className="text-2xl font-semibold text-emerald-700">
              {stats.activeCount}
            </p>
          </Card>
          <Card className="p-4 bg-white/90 rounded-2xl shadow-md">
            <p className="text-xs text-slate-500 mb-1">Boxen mit Buchungen</p>
            <p className="text-2xl font-semibold text-slate-900">
              {stats.uniqueBoxes}
            </p>
          </Card>
        </div>

        {/* Filter + Tabelle */}
        <Card className="w-full max-w-6xl p-6 bg-white/90 rounded-3xl shadow-lg">
          <form
            onSubmit={handleSearchSubmit}
            className="flex flex-col sm:flex-row gap-3 items-start sm:items-end mb-4"
          >
            <div className="flex-1 w-full">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Suche (E-Mail, Name, Box-ID …*)
              </label>
              <input
                type="text"
                className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2563eb]"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="z.B. kunde@kunde.de oder B001"
              />
              <p className="mt-1 text-[10px] text-slate-400">
                *Genau welche Felder durchsucht werden, hängt von deiner
                Backend-Implementierung ab.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  className="rounded border-slate-300"
                  checked={onlyActive}
                  onChange={(e) => setOnlyActive(e.target.checked)}
                />
                Nur aktive
              </label>
              <Button
                type="submit"
                size="sm"
                className="px-4 py-2 text-xs"
                disabled={isLoading}
              >
                {isLoading ? "Laden …" : "Filtern"}
              </Button>
            </div>
          </form>

          {errorMsg && (
            <p className="text-sm text-red-600 mb-3">{errorMsg}</p>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full text-xs sm:text-sm text-left">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-3">Buchungs-ID</th>
                  <th className="py-2 pr-3">Kunde</th>
                  <th className="py-2 pr-3">E-Mail</th>
                  <th className="py-2 pr-3">Box</th>
                  <th className="py-2 pr-3">Zugangscode</th>
                  <th className="py-2 pr-3">gültig bis</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3 text-right">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {bookings.length === 0 && !isLoading && (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-4 text-center text-slate-400"
                    >
                      Keine Buchungen gefunden.
                    </td>
                  </tr>
                )}
                {bookings.map((b) => {
                  const isActive = b.is_active !== false;
                  return (
                    <tr
                      key={b.id}
                      className="border-b border-slate-100 hover:bg-slate-50/60"
                    >
                      <td className="py-2 pr-3 font-mono text-[11px] sm:text-xs">
                        {b.id}
                      </td>
                      <td className="py-2 pr-3">
                        {b.user_name || "–"}
                      </td>
                      <td className="py-2 pr-3">
                        {b.user_email || "–"}
                      </td>
                      <td className="py-2 pr-3">
                        {b.box_name ?? b.box_id}
                      </td>
                      <td className="py-2 pr-3 font-mono text-[11px]">
                        {b.access_code ?? "–"}
                      </td>
                      <td className="py-2 pr-3">
                        {formatDateTime(b.valid_until)}
                      </td>
                      <td className="py-2 pr-3">
                        {isActive ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                            aktiv
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                            beendet
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        {isActive ? (
                          <button
                            type="button"
                            onClick={() => handleCancelBooking(b)}
                            disabled={isCancellingId === b.id}
                            className="text-[11px] sm:text-xs text-red-600 hover:text-red-800 disabled:text-slate-300"
                          >
                            {isCancellingId === b.id
                              ? "Storniere …"
                              : "Stornieren"}
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-300">
                            –
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </main>
    </div>
  );
}