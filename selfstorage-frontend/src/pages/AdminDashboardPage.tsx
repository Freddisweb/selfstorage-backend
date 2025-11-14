// src/pages/AdminDashboardPage.tsx
import { useEffect, useState, useMemo } from "react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import {
  listBookingsAdmin,
  cancelBookingAdmin,
  createBookingAdmin,
  getAvailableBoxes,
  type AdminBooking,
  type BoxPublic,
} from "../api";

type StatusFilter = "all" | "active" | "expired";

function computeIsActive(booking: AdminBooking): boolean {
  // 1. Falls Backend ein is_active-Feld liefert, nutzen wir das
  if (typeof booking.is_active === "boolean") {
    return booking.is_active;
  }

  // 2. Sonst über valid_until berechnen
  if (!booking.valid_until) return false;
  try {
    const end = new Date(booking.valid_until).getTime();
    if (Number.isNaN(end)) return false;
    const now = Date.now();
    return end > now;
  } catch {
    return false;
  }
}

export default function AdminDashboardPage() {
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filter-State
  const [filterCustomer, setFilterCustomer] = useState("");
  const [filterBoxId, setFilterBoxId] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [filterFrom, setFilterFrom] = useState<string>(""); // yyyy-mm-dd
  const [filterTo, setFilterTo] = useState<string>("");

  // Formular für neue Buchung
  const [newEmail, setNewEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newBoxId, setNewBoxId] = useState("");
  const [newDurationDays, setNewDurationDays] = useState<number>(1);
  const [isCreating, setIsCreating] = useState(false);

  // Admin-Übersicht: aktuell verfügbare Boxen
  const [availableBoxes, setAvailableBoxes] = useState<BoxPublic[]>([]);
  const [isLoadingBoxes, setIsLoadingBoxes] = useState(false);
  const [errorBoxes, setErrorBoxes] = useState<string | null>(null);

  // --------------------------------------------------
  // Daten laden
  // --------------------------------------------------
  const loadBookings = async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      const data = await listBookingsAdmin();
      setBookings(data);
    } catch (err: any) {
      console.error("Admin bookings load error:", err);
      setErrorMsg(
        err?.message ??
          "Fehler beim Laden der Buchungen (Admin). Prüfe, ob du als Admin eingeloggt bist."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const loadAvailableBoxes = async () => {
    try {
      setIsLoadingBoxes(true);
      setErrorBoxes(null);

      // Zeitraum: jetzt + 60 Min (kannst du später anpassen)
      const data = await getAvailableBoxes({
        startInMinutes: 0,
        durationMinutes: 60,
      });

      setAvailableBoxes(data);
    } catch (err: any) {
      console.error("Admin load available boxes error:", err);
      setErrorBoxes(
        err?.message ??
          "Fehler beim Laden der verfügbaren Boxen. Bitte später erneut versuchen."
      );
    } finally {
      setIsLoadingBoxes(false);
    }
  };

  useEffect(() => {
    loadBookings();
    loadAvailableBoxes();
  }, []);

  // --------------------------------------------------
  // Datum-Helper für Filter
  // --------------------------------------------------
  const toDate = (iso?: string | null) => {
    if (!iso) return null;
    try {
      return new Date(iso);
    } catch {
      return null;
    }
  };

  const filterFromDate = filterFrom ? new Date(filterFrom + "T00:00:00") : null;
  const filterToDate = filterTo ? new Date(filterTo + "T23:59:59") : null;

  // --------------------------------------------------
  // Client-seitige Filter (mit korrektem Status)
  // --------------------------------------------------
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const hayCustomer = (b.user_name ?? "") + " " + (b.user_email ?? "");
      const hayBox = (b.box_id ?? "") + " " + (b.box_name ?? "");
      const active = computeIsActive(b);

      if (
        filterCustomer &&
        !hayCustomer.toLowerCase().includes(filterCustomer.toLowerCase())
      ) {
        return false;
      }

      if (
        filterBoxId &&
        !hayBox.toLowerCase().includes(filterBoxId.toLowerCase())
      ) {
        return false;
      }

      if (statusFilter === "active" && !active) return false;
      if (statusFilter === "expired" && active) return false;

      const created = toDate(b.created_at);
      if (filterFromDate && created && created < filterFromDate) return false;
      if (filterToDate && created && created > filterToDate) return false;

      return true;
    });
  }, [
    bookings,
    filterCustomer,
    filterBoxId,
    statusFilter,
    filterFromDate,
    filterToDate,
  ]);

  // --------------------------------------------------
  // Buchung stornieren
  // --------------------------------------------------
  const handleCancelBooking = async (booking: AdminBooking) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    console.log("Storniere Buchung (ID):", booking.id, "box_id:", booking.box_id);

    if (!window.confirm(`Buchung ${booking.id} wirklich stornieren?`)) {
      return;
    }

    try {
      await cancelBookingAdmin(booking.id);
      setSuccessMsg(`Buchung ${booking.id} wurde erfolgreich storniert.`);
      setBookings((prev) => prev.filter((b) => b.id !== booking.id));

      // WICHTIG: verfügbare Boxen neu laden
      loadAvailableBoxes();
    } catch (err: any) {
      console.error("Cancel booking error:", err);
      setErrorMsg(
        err?.message ??
          `Fehler beim Stornieren der Buchung ${booking.id}. Details in der Konsole.`
      );
    }
  };

  // --------------------------------------------------
  // Neue Buchung anlegen (Admin)
  // --------------------------------------------------
  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!newEmail || !newBoxId) {
      setErrorMsg("Bitte mindestens E-Mail und Box-ID ausfüllen.");
      return;
    }
    if (newDurationDays <= 0) {
      setErrorMsg("Dauer muss mindestens 1 Tag sein.");
      return;
    }

    const durationMinutes = newDurationDays * 24 * 60;

    try {
      setIsCreating(true);
      const booking = await createBookingAdmin({
        user_email: newEmail,
        box_id: newBoxId,
        duration_minutes: durationMinutes,
        user_name: newUserName || undefined,
      });

      setSuccessMsg(
        `Neue Buchung ${booking.id} für ${booking.user_email ?? newEmail} angelegt.`
      );
      setBookings((prev) => [booking, ...prev]);

      // WICHTIG: verfügbare Boxen neu laden
      loadAvailableBoxes();
    } catch (err: any) {
      console.error("Create booking admin error:", err);
      setErrorMsg(
        err?.message ?? "Fehler beim Anlegen der Buchung (Admin)."
      );
    } finally {
      setIsCreating(false);
    }
  };

  // Bestehende Buchung als Vorlage in das Formular übernehmen
  const useBookingAsTemplate = (booking: AdminBooking) => {
    setNewEmail(booking.user_email || "");
    setNewUserName(booking.user_name || "");
    setNewBoxId(booking.box_id || "");
    setNewDurationDays(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // --------------------------------------------------
  // Datum formatieren
  // --------------------------------------------------
  const fmtDateTime = (iso?: string | null) => {
    if (!iso) return "–";
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  // --------------------------------------------------
  // Render
  // --------------------------------------------------
  return (
    <div className="min-h-screen w-full bg-[#f3f3f0] flex flex-col">
      <header className="w-full flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
          Admin-Dashboard
        </h1>
        <span className="text-[11px] text-slate-500">
          Nur für Administratoren sichtbar
        </span>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 pb-10 pt-4">
        {/* Buchungsverwaltung */}
        <Card className="w-full max-w-6xl rounded-3xl shadow-lg p-6 bg-white/95">
          <h2 className="text-lg font-semibold mb-3 text-slate-900">
            Buchungsverwaltung
          </h2>

          {/* Formular: Neue Buchung anlegen */}
          <form
            onSubmit={handleCreateBooking}
            className="mb-6 grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs items-end border border-slate-200 rounded-xl p-3 bg-slate-50"
          >
            <div className="sm:col-span-2">
              <label className="block font-medium text-slate-700 mb-1">
                Kunden-E-Mail
              </label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#2563eb]"
                required
              />
            </div>
            <div className="sm:col-span-1">
              <label className="block font-medium text-slate-700 mb-1">
                Kundenname (optional)
              </label>
              <input
                type="text"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#2563eb]"
              />
            </div>
            <div className="sm:col-span-1">
              <label className="block font-medium text-slate-700 mb-1">
                Box-ID
              </label>
              <input
                type="text"
                value={newBoxId}
                onChange={(e) => setNewBoxId(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#2563eb]"
                required
              />
            </div>
            <div className="sm:col-span-1">
              <label className="block font-medium text-slate-700 mb-1">
                Dauer (Tage)
              </label>
              <input
                type="number"
                min={1}
                value={newDurationDays}
                onChange={(e) =>
                  setNewDurationDays(
                    isNaN(Number(e.target.value))
                      ? 1
                      : Number(e.target.value)
                  )
                }
                className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#2563eb]"
              />
            </div>
            <div className="sm:col-span-1 flex items-end">
              <Button
                type="submit"
                disabled={isCreating}
                className="w-full text-xs py-2"
              >
                {isCreating ? "Anlegen …" : "Neue Buchung anlegen"}
              </Button>
            </div>
          </form>

          {/* Filterleiste */}
          <div className="mb-4 grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs">
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Kunde (Name / E-Mail)
              </label>
              <input
                type="text"
                value={filterCustomer}
                onChange={(e) => setFilterCustomer(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#2563eb]"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Box-ID / Name
              </label>
              <input
                type="text"
                value={filterBoxId}
                onChange={(e) => setFilterBoxId(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#2563eb]"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as StatusFilter)
                }
                className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#2563eb]"
              >
                <option value="all">Alle</option>
                <option value="active">Nur aktive</option>
                <option value="expired">Nur abgelaufene</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Von (Erstellungsdatum)
              </label>
              <input
                type="date"
                value={filterFrom}
                onChange={(e) => setFilterFrom(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#2563eb]"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Bis (Erstellungsdatum)
              </label>
              <input
                type="date"
                value={filterTo}
                onChange={(e) => setFilterTo(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#2563eb]"
              />
            </div>
          </div>

          <div className="mb-4 flex flex-wrap gap-2 text-xs">
            <Button type="button" onClick={loadBookings} className="px-4 py-2">
              Neu laden
            </Button>
            <Button
              type="button"
              onClick={() => {
                setFilterCustomer("");
                setFilterBoxId("");
                setStatusFilter("all");
                setFilterFrom("");
                setFilterTo("");
              }}
              className="px-4 py-2 bg-slate-200 text-slate-800 hover:bg-slate-300"
            >
              Filter zurücksetzen
            </Button>
          </div>

          {isLoading && (
            <p className="text-sm text-slate-500 mb-3">
              Lade Buchungen …
            </p>
          )}

          {errorMsg && (
            <p className="text-sm text-red-600 mb-3 whitespace-pre-line">
              {errorMsg}
            </p>
          )}

          {successMsg && (
            <p className="text-sm text-emerald-700 mb-3 whitespace-pre-line">
              {successMsg}
            </p>
          )}

          {/* Tabelle */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">
                    Booking-ID
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">
                    Kunde
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">
                    Box
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">
                    Zeitraum
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">
                    Preis
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">
                    Status
                  </th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-700">
                    Aktionen
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredBookings.length === 0 && !isLoading && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-4 text-center text-slate-500"
                    >
                      Keine Buchungen gefunden.
                    </td>
                  </tr>
                )}

                {filteredBookings.map((b) => {
                  const active = computeIsActive(b);
                  return (
                    <tr
                      key={b.id}
                      className="border-t border-slate-100 hover:bg-slate-50"
                    >
                      <td className="px-3 py-2 font-mono text-[11px]">
                        {b.id}
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-800">
                          {b.user_name || "–"}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {b.user_email || "–"}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-800">
                          {b.box_name || "–"}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {b.box_id || "–"}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-[11px] text-slate-700">
                        <div>von: {fmtDateTime(b.created_at)}</div>
                        <div>bis: {fmtDateTime(b.valid_until)}</div>
                        {b.access_code && (
                          <div className="mt-1">
                            Code:{" "}
                            <span className="font-mono font-semibold">
                              {b.access_code}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-[11px] text-slate-700">
                        {b.price_for_period != null && b.unit_label ? (
                          <>
                            {b.price_for_period.toFixed(2)} € (
                            {b.billed_units} {b.unit_label})
                          </>
                        ) : (
                          "–"
                        )}
                      </td>
                      <td className="px-3 py-2 text-[11px]">
                        {active ? (
                          <span className="inline-flex px-2 py-1 rounded-full bg-emerald-100 text-emerald-800">
                            aktiv
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-1 rounded-full bg-slate-200 text-slate-700">
                            abgelaufen
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right space-x-2">
                        <Button
                          type="button"
                          onClick={() => useBookingAsTemplate(b)}
                          className="inline-flex items-center justify-center px-3 py-1 text-xs bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-full"
                        >
                          Als Vorlage
                        </Button>
                        <Button
                          type="button"
                          onClick={() => handleCancelBooking(b)}
                          className="inline-flex items-center justify-center px-3 py-1 text-xs bg-red-500 hover:bg-red-600 text-white rounded-full"
                        >
                          Stornieren
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Verfügbare Boxen – ALS LISTE */}
        <Card className="mt-6 w-full max-w-6xl rounded-3xl shadow-lg p-6 bg-white/95">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-slate-900">
              Aktuell verfügbare Boxen (nächste 60 Minuten)
            </h2>
            <Button
              type="button"
              onClick={loadAvailableBoxes}
              className="text-xs px-3 py-2"
            >
              Boxen neu laden
            </Button>
          </div>

          {isLoadingBoxes && (
            <p className="text-sm text-slate-500 mb-2">
              Lade verfügbare Boxen …
            </p>
          )}

          {errorBoxes && (
            <p className="text-sm text-red-600 mb-2 whitespace-pre-line">
              {errorBoxes}
            </p>
          )}

          {!isLoadingBoxes && !errorBoxes && availableBoxes.length === 0 && (
            <p className="text-sm text-slate-500">
              Derzeit sind keine Boxen für den gewählten Zeitraum verfügbar.
            </p>
          )}

          {availableBoxes.length > 0 && (
            <div className="overflow-x-auto border border-slate-200 rounded-xl mt-3">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">
                      Box
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">
                      Größe
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">
                      Preis aktuell
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {availableBoxes.map((box) => (
                    <tr
                      key={box.id}
                      className="border-t border-slate-100 hover:bg-slate-50"
                    >
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-800">
                          {box.name}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          ID: {box.id}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-[11px] text-slate-700">
                        {box.size_m2} m²
                      </td>
                      <td className="px-3 py-2 text-[11px] text-slate-700">
                        {box.price_for_period.toFixed(2)} € ({box.billed_units}{" "}
                        {box.unit_label})
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}