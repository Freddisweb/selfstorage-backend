import { useEffect, useState } from "react";

const API_BASE_URL = "http://127.0.0.1:8000";

interface Box {
  id: string;
  name: string;
  size_m2: number;
  pricing_mode: string; // "hourly" | "daily"
  unit_label: string;   // "hour" | "day"
  billed_units: number;
  price_for_period: number;
}

interface BookingResponse {
  id: string;
  box_id: string;
  access_code?: string;
  valid_until: string;
}

type DurationKey = "1h" | "2h" | "1d" | "7d" | "31d";

const DURATION_OPTIONS: {
  key: DurationKey;
  label: string;
  minutes: number;
}[] = [
  { key: "1h", label: "1 Stunde", minutes: 60 },
  { key: "2h", label: "2 Stunden", minutes: 120 },
  { key: "1d", label: "1 Tag", minutes: 24 * 60 },
  { key: "7d", label: "1 Woche", minutes: 7 * 24 * 60 },
  { key: "31d", label: "1 Monat (31 Tage)", minutes: 31 * 24 * 60 },
];

const BoxList: React.FC = () => {
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [isBooking, setIsBooking] = useState(false);
  const [bookingMessage, setBookingMessage] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);

  const [selectedDuration, setSelectedDuration] = useState<DurationKey>("1d");

  const selectedDurationMinutes =
    DURATION_OPTIONS.find((d) => d.key === selectedDuration)?.minutes ?? 24 * 60;

  // Verfügbare Boxen laden – immer, wenn sich der Zeitraum ändert
  useEffect(() => {
    const fetchBoxes = async () => {
      setIsLoading(true);
      setErrorMsg(null);
      try {
        const params = new URLSearchParams({
          start_in_minutes: "0",
          duration_minutes: String(selectedDurationMinutes),
        });

        const res = await fetch(`${API_BASE_URL}/boxes/available?${params.toString()}`);

        if (!res.ok) {
          throw new Error(`Fehler beim Laden der Boxen (${res.status})`);
        }
        const data: Box[] = await res.json();
        setBoxes(data);
      } catch (err: any) {
        setErrorMsg(err.message ?? "Unbekannter Fehler beim Laden der Boxen.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchBoxes();
  }, [selectedDurationMinutes]);

  // Buchung auslösen – NUR mit Login möglich (POST /bookings/me)
  const handleBook = async (box: Box) => {
    setIsBooking(true);
    setBookingMessage(null);
    setBookingError(null);

    try {
      const token = localStorage.getItem("access_token");
      if (!token) {
        throw new Error(
          "Bitte einloggen, um eine Box zu buchen (Login-Rechts in der Seitenleiste)."
        );
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };

      const res = await fetch(`${API_BASE_URL}/bookings/me`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          user_name: "Demo-Kunde", // wird im Backend eigentlich aus dem User ermittelt
          box_id: box.id,
          duration_minutes: selectedDurationMinutes,
        }),
      });

      if (res.status === 401) {
        throw new Error("Nicht eingeloggt oder Token abgelaufen.");
      }

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Fehler (${res.status}): ${txt.slice(0, 200)}`);
      }

      const data: BookingResponse = await res.json();
      setBookingMessage(
        `✅ Buchung erstellt: Box ${data.box_id}, Zugangscode ${
          data.access_code ?? "siehe Admin"
        }`
      );
    } catch (err: any) {
      setBookingError(err.message);
    } finally {
      setIsBooking(false);
    }
  };

  // Hilfsfunktionen für Labels
  const getModeLabel = (mode: string) => {
    if (mode === "hourly") return "Stundenweise";
    if (mode === "daily") return "Tagesweise";
    return mode;
  };

  const getUnitLabel = (unit: string) => {
    if (unit === "hour") return "Stunde(n)";
    if (unit === "day") return "Tag(e)";
    return unit;
  };

  return (
    <section className="w-full">
      <div className="space-y-5">
        {/* Filter / Zeitraum-Leiste */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Buchungszeitraum
              </p>
              <p className="text-sm text-slate-600">
                Wähle, für welchen Zeitraum du eine Box benötigst. Preise werden
                entsprechend berechnet.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setSelectedDuration(opt.key)}
                  className={
                    "rounded-full px-3 py-1 text-xs font-medium border " +
                    (selectedDuration === opt.key
                      ? "border-sky-500 bg-sky-50 text-sky-700"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50")
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Status- & Info-Meldungen */}
        {bookingMessage && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {bookingMessage}
          </div>
        )}
        {bookingError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {bookingError}
          </div>
        )}
        {errorMsg && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {errorMsg}
          </div>
        )}
        {isLoading && (
          <p className="text-center text-sm text-slate-500">
            Lade verfügbare Boxen …
          </p>
        )}
        {!isLoading && boxes.length === 0 && !errorMsg && (
          <p className="text-center text-sm text-slate-500">
            Aktuell sind keine Boxen für diesen Zeitraum verfügbar.
          </p>
        )}

        {/* Karten-Layout für Boxen */}
        <div className="space-y-4">
          {boxes.map((box) => (
            <article
              key={box.id}
              className="rounded-3xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between">
                {/* Linker Bereich: Name, ID, Größe */}
                <div className="flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-600">
                    {box.id}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-900">
                    {box.name}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Fläche{" "}
                    <span className="font-medium">
                      {box.size_m2.toFixed(1)} m²
                    </span>
                  </p>
                </div>

                {/* Rechter Bereich: Preis & Button */}
                <div className="flex flex-col items-end gap-2 min-w-[220px]">
                  <span className="inline-flex items-center rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 ring-1 ring-sky-100">
                    {getModeLabel(box.pricing_mode)}
                  </span>

                  <div className="text-right">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">
                      Preis für gewählten Zeitraum
                    </p>
                    <p className="text-xl font-semibold text-slate-900">
                      {box.price_for_period.toFixed(2)} €
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {box.billed_units} {getUnitLabel(box.unit_label)}
                    </p>
                  </div>

                  <button
                    onClick={() => handleBook(box)}
                    disabled={isBooking}
                    className="mt-1 inline-flex items-center rounded-full bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-sky-700 disabled:bg-sky-300 disabled:cursor-not-allowed"
                  >
                    {isBooking ? "Buchen …" : "Box auswählen & buchen"}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BoxList;