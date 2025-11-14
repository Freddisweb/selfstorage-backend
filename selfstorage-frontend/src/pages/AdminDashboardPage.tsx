// src/pages/AdminDashboardPage.tsx
import { useEffect, useMemo, useState } from "react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import {
  listBookingsAdmin,
  cancelBookingAdmin,
  getAvailableBoxes,
  createBookingAdmin,          // <— wieder dazu
  type AdminBooking,
  type BoxPublic,
} from "../api";

type SortKey = "created_at" | "valid_until" | "box" | "email" | "price";

export default function AdminDashboardPage() {
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState(false);
  const [bookingsError, setBookingsError] = useState<string | null>(null);

  const [availableBoxes, setAvailableBoxes] = useState<BoxPublic[]>([]);
  const [isLoadingBoxes, setIsLoadingBoxes] = useState(false);
  const [boxesError, setBoxesError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "expired">("all");

  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [autoRefresh, setAutoRefresh] = useState(false);
  const [isCancellingId, setIsCancellingId] = useState<string | null>(null);

  // NEU: State für "Buchungsverwaltung" (neue Buchungen anlegen)
  const [newEmail, setNewEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newBoxId, setNewBoxId] = useState("");
  const [newDurationDays, setNewDurationDays] = useState<number>(1);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Helper: Status
  // ---------------------------------------------------------------------------
  const now = Date.now();

  function isActive(b: AdminBooking): boolean {
    if (!b.valid_until) return false;
    const end = new Date(b.valid_until).getTime();
    return end > now;
  }

  function isSoonExpiring(b: AdminBooking): boolean {
    if (!b.valid_until) return false;
    const end = new Date(b.valid_until).getTime();
    // "läuft bald ab" = innerhalb der nächsten 60 Minuten
    const ONE_HOUR_MS = 60 * 60 * 1000;
    return end > now && end - now < ONE_HOUR_MS;
  }

  function formatDateTime(iso?: string | null): string {
    if (!iso) return "–";
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  }

  // ---------------------------------------------------------------------------
  // API-Calls
  // ---------------------------------------------------------------------------
  async function loadBookings() {
    try {
      setIsLoadingBookings(true);
      setBookingsError(null);
      const data = await listBookingsAdmin();
      // Defensive: falls Backend keine sortierte Reihenfolge liefert
      const sorted = [...data].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setBookings(sorted);
    } catch (err: any) {
      console.error("Admin: Fehler beim Laden der Buchungen:", err);
      setBookingsError(
        err?.message ?? "Fehler beim Laden der Buchungen (Admin)."
      );
    } finally {
      setIsLoadingBookings(false);
    }
  }

  async function loadAvailableBoxes() {
    try {
      setIsLoadingBoxes(true);
      setBoxesError(null);
      // Nächste 60 Minuten – kannst du später parametrisierbar machen
      const data = await getAvailableBoxes({
        startInMinutes: 0,
        durationMinutes: 60,
      });
      setAvailableBoxes(data);
    } catch (err: any) {
      console.error("Admin: Fehler beim Laden der verfügbaren Boxen:", err);
      setBoxesError(
        err?.message ?? "Fehler beim Laden der verfügbaren Boxen (Admin)."
      );
    } finally {
      setIsLoadingBoxes(false);
    }
  }

  useEffect(() => {
    loadBookings();
    loadAvailableBoxes();
  }, []);

  // Auto-Refresh alle 30 Sekunden (optional)
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      loadBookings();
      loadAvailableBoxes();
    }, 30_000);
    return () => clearInterval(id);
  }, [autoRefresh]);

  // ---------------------------------------------------------------------------
  // Filter + Sortierung (nur clientseitig)
  // ---------------------------------------------------------------------------
  const filteredAndSortedBookings = useMemo(() => {
    let list = [...bookings];

    // Status-Filter
    if (statusFilter === "active") {
      list = list.filter((b) => isActive(b));
    } else if (statusFilter === "expired") {
      list = list.filter((b) => !isActive(b));
    }

    // Suchbegriff in email / user_name / box_id / box_name
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      list = list.filter((b) => {
        const fields = [
          b.user_email,
          b.user_name,
          b.box_id,
          (b as any).box_name,
          b.access_code,
        ];
        return fields.some((field) =>
          field ? String(field).toLowerCase().includes(q) : false
        );
      });
    }

    // Sortierung
    list.sort((a, b) => {
      let av: number | string = "";
      let bv: number | string = "";

      switch (sortKey) {
        case "created_at":
          av = new Date(a.created_at).getTime();
          bv = new Date(b.created_at).getTime();
          break;
        case "valid_until":
          av = new Date(a.valid_until).getTime();
          bv = new Date(b.valid_until).getTime();
          break;
        case "box":
          av = (a.box_id ?? "") + ((a as any).box_name ?? "");
          bv = (b.box_id ?? "") + ((b as any).box_name ?? "");
          break;
        case "email":
          av = (a.user_email ?? a.user_name ?? "").toLowerCase();
          bv = (b.user_email ?? b.user_name ?? "").toLowerCase();
          break;
        case "price":
          av = a.price_for_period ?? 0;
          bv = b.price_for_period ?? 0;
          break;
      }

      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return list;
  }, [bookings, searchTerm, statusFilter, sortKey, sortDir, now]);

  // ---------------------------------------------------------------------------
  // KPIs / Statistiken (nur clientseitig aus den Daten)
  // ---------------------------------------------------------------------------
  const stats = useMemo(() => {
    const total = bookings.length;
    const active = bookings.filter((b) => isActive(b)).length;
    const expired = total - active;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todayCount = bookings.filter((b) => {
      const t = new Date(b.created_at).getTime();
      return t >= todayStart.getTime() && t <= todayEnd.getTime();
    }).length;

    const revenueActive = bookings
      .filter((b) => isActive(b) && b.price_for_period != null)
      .reduce((sum, b) => sum + (b.price_for_period ?? 0), 0);

    return {
      total,
      active,
      expired,
      todayCount,
      revenueActive,
    };
  }, [bookings, now]);

  // ---------------------------------------------------------------------------
  // Aktionen
  // ---------------------------------------------------------------------------
  const handleCancelBooking = async (bookingId: string) => {
    if (!window.confirm("Buchung wirklich stornieren?")) return;

    try {
      setIsCancellingId(bookingId);
      await cancelBookingAdmin(bookingId);
      // Lokal rausschmeißen:
      setBookings((prev) => prev.filter((b) => b.id !== bookingId));
      // Verfügbare Boxen neu laden, weil sich damit die Verfügbarkeit ändert
      loadAvailableBoxes();
    } catch (err: any) {
      console.error("Admin: Fehler beim Stornieren:", err);
      alert(
        err?.message ??
          "Unbekannter Fehler beim Stornieren der Buchung (Admin)."
      );
    } finally {
      setIsCancellingId(null);
    }
  };

  const handleExportCsv = () => {
    if (filteredAndSortedBookings.length === 0) {
      alert("Keine Buchungen zum Exportieren.");
      return;
    }

    const header = [
      "id",
      "user_email",
      "user_name",
      "box_id",
      "access_code",
      "created_at",
      "valid_until",
      "price_for_period",
      "unit_label",
      "billed_units",
      "status",
    ];

    const rows = filteredAndSortedBookings.map((b) => {
      const status = isActive(b) ? "active" : "expired";

      return [
        b.id,
        b.user_email ?? "",
        b.user_name ?? "",
        b.box_id ?? "",
        b.access_code ?? "",
        b.created_at,
        b.valid_until,
        b.price_for_period ?? "",
        b.unit_label ?? "",
        b.billed_units ?? "",
        status,
      ]
        .map((value) => {
          const v = value ?? "";
          if (typeof v === "string" && v.includes(",")) {
            return `"${v.replace(/"/g, '""')}"`;
          }
          return String(v);
        })
        .join(",");
    });

    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bookings-admin-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sortIndicator = (key: SortKey) =>
    sortKey === key ? (sortDir === "asc" ? "▲" : "▼") : "";

  // NEU: Admin-Buchung anlegen wie im alten Code
  async function handleCreateBooking(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreateSuccess(null);

    if (!newEmail || !newBoxId) {
      setCreateError("Bitte mindestens E-Mail und Box-ID ausfüllen.");
      return;
    }
    if (newDurationDays <= 0) {
      setCreateError("Dauer muss mindestens 1 Tag sein.");
      return;
    }

    const durationMinutes = newDurationDays * 24 * 60;

    try {
      setIsCreating(true);
      const booking = await createBookingAdmin({
        user_email: newEmail,
        user_name: newUserName || undefined,
        box_id: newBoxId,
        duration_minutes: durationMinutes,
      });

      setBookings((prev) => [booking, ...prev]);
      setCreateSuccess(
        `Neue Buchung ${booking.id} für ${
          booking.user_email ?? newEmail
        } angelegt.`
      );
      setNewDurationDays(1);

      // Verfügbare Boxen nach neuer Buchung neu laden
      loadAvailableBoxes();
    } catch (err: any) {
      console.error("Admin: Fehler beim Anlegen der Buchung:", err);
      setCreateError(
        err?.message ?? "Fehler beim Anlegen der Buchung (Admin)."
      );
    } finally {
      setIsCreating(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen w-full bg-[#f3f3f0] flex flex-col">
      {/* Header */}
      <header className="w-full flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white/80 backdrop-blur">
        <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">
          Admin-Dashboard
        </h1>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <label className="inline-flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              className="rounded border-slate-300"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-Refresh (30s)
          </label>
          <span className="hidden sm:inline">
            Stand: {new Date().toLocaleTimeString()}
          </span>
        </div>
      </header>

      {/* Inhalt */}
      <main className="flex-1 flex flex-col gap-6 px-4 pb-10 pt-4 max-w-6xl mx-auto w-full">
        {/* KPI-Karten */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-4">
            <p className="text-xs text-slate-500">Buchungen gesamt</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">
              {stats.total}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-slate-500">Aktiv</p>
            <p className="mt-1 text-xl font-semibold text-emerald-700">
              {stats.active}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-slate-500">Abgelaufen</p>
            <p className="mt-1 text-xl font-semibold text-slate-700">
              {stats.expired}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-slate-500">Buchungen heute</p>
            <p className="mt-1 text-xl font-semibold text-sky-700">
              {stats.todayCount}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Aktiver Umsatz: {stats.revenueActive.toFixed(2)} €
            </p>
          </Card>
        </section>

        {/* NEU (wieder eingebaut): Buchungsverwaltung / neue Buchung anlegen */}
        <section>
          <Card className="p-4">
            <h2 className="text-sm sm:text-base font-semibold text-slate-900 mb-3">
              Buchungsverwaltung – neue Buchung anlegen
            </h2>

            {/* Formular */}
            <form
              onSubmit={handleCreateBooking}
              className="mb-4 grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs items-end border border-slate-200 rounded-xl p-3 bg-slate-50"
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

            {createError && (
              <p className="text-xs text-red-600 mb-1 whitespace-pre-line">
                {createError}
              </p>
            )}
            {createSuccess && (
              <p className="text-xs text-emerald-700 whitespace-pre-line">
                {createSuccess}
              </p>
            )}
          </Card>
        </section>

        {/* Buchungen – Filter + Tabelle (NEUER Code bleibt unverändert) */}
        <section className="space-y-3">
          <div className="flex flex-col sm:flex-row justify-between gap-3 items-start sm:items-center">
            <h2 className="text-sm sm:text-base font-semibold text-slate-900">
              Buchungen verwalten
            </h2>
            <div className="flex flex-wrap gap-2 items-center">
              <input
                type="text"
                placeholder="Suche nach E-Mail, Box, Code …"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2563eb]"
              />
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(
                    e.target.value as "all" | "active" | "expired"
                  )
                }
                className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2563eb]"
              >
                <option value="all">Alle</option>
                <option value="active">Nur aktive</option>
                <option value="expired">Nur abgelaufene</option>
              </select>
              <Button
                variant="ghost"
                size="sm"
                onClick={loadBookings}
                className="border border-slate-200"
              >
                ⟳ Buchungen neu laden
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExportCsv}
                className="border border-slate-200"
              >
                ⬇︎ CSV Export
              </Button>
            </div>
          </div>

          <Card className="p-0 overflow-hidden">
            {isLoadingBookings && (
              <p className="p-4 text-sm text-slate-500">Lade Buchungen …</p>
            )}
            {bookingsError && (
              <p className="p-4 text-sm text-red-600">{bookingsError}</p>
            )}
            {!isLoadingBookings && !bookingsError && (
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs sm:text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th
                        className="px-3 py-2 text-left cursor-pointer"
                        onClick={() => toggleSort("created_at")}
                      >
                        Erstellt {sortIndicator("created_at")}
                      </th>
                      <th
                        className="px-3 py-2 text-left cursor-pointer"
                        onClick={() => toggleSort("valid_until")}
                      >
                        Gültig bis {sortIndicator("valid_until")}
                      </th>
                      <th
                        className="px-3 py-2 text-left cursor-pointer"
                        onClick={() => toggleSort("email")}
                      >
                        Kunde {sortIndicator("email")}
                      </th>
                      <th
                        className="px-3 py-2 text-left cursor-pointer"
                        onClick={() => toggleSort("box")}
                      >
                        Box {sortIndicator("box")}
                      </th>
                      <th
                        className="px-3 py-2 text-left cursor-pointer"
                        onClick={() => toggleSort("price")}
                      >
                        Preis {sortIndicator("price")}
                      </th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-right">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAndSortedBookings.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-3 py-4 text-center text-slate-500"
                        >
                          Keine Buchungen gefunden.
                        </td>
                      </tr>
                    ) : (
                      filteredAndSortedBookings.map((b) => {
                        const active = isActive(b);
                        const soon = isSoonExpiring(b);

                        const statusLabel = active
                          ? soon
                            ? "läuft bald ab"
                            : "aktiv"
                          : "abgelaufen";

                        const statusColor = active
                          ? soon
                            ? "bg-amber-100 text-amber-800 border-amber-200"
                            : "bg-emerald-100 text-emerald-800 border-emerald-200"
                          : "bg-slate-100 text-slate-700 border-slate-200";

                        return (
                          <tr
                            key={b.id}
                            className="border-t border-slate-100 hover:bg-slate-50/70"
                          >
                            <td className="px-3 py-2 align-top">
                              {formatDateTime(b.created_at)}
                            </td>
                            <td className="px-3 py-2 align-top">
                              {formatDateTime(b.valid_until)}
                            </td>
                            <td className="px-3 py-2 align-top">
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {b.user_email ?? b.user_name ?? "—"}
                                </span>
                                {b.user_name && b.user_email && (
                                  <span className="text-[11px] text-slate-500">
                                    ({b.user_name})
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2 align-top">
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {b.box_id ?? "—"}
                                </span>
                                {(b as any).box_name && (
                                  <span className="text-[11px] text-slate-500">
                                    {(b as any).box_name}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2 align-top">
                              {b.price_for_period != null ? (
                                <div className="flex flex-col">
                                  <span className="font-medium">
                                    {b.price_for_period.toFixed(2)} €
                                  </span>
                                  {b.billed_units != null && b.unit_label && (
                                    <span className="text-[11px] text-slate-500">
                                      {b.billed_units} {b.unit_label}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                "–"
                              )}
                            </td>
                            <td className="px-3 py-2 align-top">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium ${statusColor}`}
                              >
                                {statusLabel}
                              </span>
                              {b.access_code && (
                                <div className="mt-1 text-[11px] text-slate-600">
                                  Code:{" "}
                                  <span className="font-mono">
                                    {b.access_code}
                                  </span>
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2 align-top text-right">
                              <div className="flex flex-col gap-1 items-end">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs"
                                  onClick={() =>
                                    navigator.clipboard.writeText(
                                      b.access_code ?? ""
                                    )
                                  }
                                  disabled={!b.access_code}
                                >
                                  Code kopieren
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs text-red-700 border-red-200 hover:bg-red-50"
                                  onClick={() => handleCancelBooking(b.id)}
                                  disabled={isCancellingId === b.id}
                                >
                                  {isCancellingId === b.id
                                    ? "Storniere…"
                                    : "Stornieren"}
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </section>

        {/* Verfügbare Boxen als Liste */}
        <section className="space-y-3">
          <div className="flex items-center justify_between">
            <h2 className="text-sm sm:text-base font-semibold text-slate-900">
              Verfügbare Boxen (nächste 60 Minuten)
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadAvailableBoxes}
              className="border border-slate-200"
            >
              ⟳ Boxen neu laden
            </Button>
          </div>

          <Card className="p-0 overflow-hidden">
            {isLoadingBoxes && (
              <p className="p-4 text-sm text-slate-500">
                Lade verfügbare Boxen …
              </p>
            )}
            {boxesError && (
              <p className="p-4 text-sm text-red-600">{boxesError}</p>
            )}
            {!isLoadingBoxes && !boxesError && (
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs sm:text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-3 py-2 text-left">Box</th>
                      <th className="px-3 py-2 text-left">Größe</th>
                      <th className="px-3 py-2 text-left">
                        Preis (Standardzeitraum)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {availableBoxes.length === 0 ? (
                      <tr>
                        <td
                          colSpan={3}
                          className="px-3 py-4 text-center text-slate-500"
                        >
                          Aktuell sind für den Zeitraum keine Boxen verfügbar.
                        </td>
                      </tr>
                    ) : (
                      availableBoxes.map((box) => (
                        <tr
                          key={box.id}
                          className="border-t border-slate-100 hover:bg-slate-50/70"
                        >
                          <td className="px-3 py-2">
                            <span className="font-medium">{box.name}</span>
                            <span className="ml-1 text-[11px] text-slate-500">
                              ({box.id})
                            </span>
                          </td>
                          <td className="px-3 py-2">{box.size_m2} m²</td>
                          <td className="px-3 py-2">
                            {box.price_for_period.toFixed(2)} € (
                            {box.billed_units} {box.unit_label})
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </section>
      </main>
    </div>
  );
}