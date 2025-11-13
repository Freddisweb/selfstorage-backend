// src/pages/BookingPage.tsx
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

interface BoxDetail {
  id: string;
  name: string;
  size_m2: number;
  device_id: string;
  allow_hourly: boolean;
  allow_daily: boolean;
  allow_monthly: boolean;
  price_per_hour: number;
  price_per_day: number;
  price_per_31days: number;
}

interface BookingResponse {
  id: string;
  access_code?: string | null;
  valid_until?: string | null;
  price_for_period?: number | null;
  unit_label?: string | null;
  billed_units?: number | null;
  box_id?: string;
}

export default function BookingPage() {
  const { boxId } = useParams<{ boxId: string }>();
  const navigate = useNavigate();

  const [box, setBox] = useState<BoxDetail | null>(null);
  const [isLoadingBox, setIsLoadingBox] = useState(false);
  const [boxError, setBoxError] = useState<string | null>(null);

  const [durationDays, setDurationDays] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successBooking, setSuccessBooking] = useState<BookingResponse | null>(
    null
  );

  // Box-Daten laden
  useEffect(() => {
    const loadBox = async () => {
      if (!boxId) {
        setBoxError("Keine Box-ID angegeben.");
        return;
      }

      try {
        setIsLoadingBox(true);
        setBoxError(null);

        const res = await fetch(`${API_BASE_URL}/boxes/${boxId}`);
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(
            `Fehler beim Laden der Box (${res.status}): ${txt.slice(0, 200)}`
          );
        }

        const data: BoxDetail = await res.json();
        setBox(data);
      } catch (err: unknown) {
        if (err instanceof Error) {
          setBoxError(err.message);
        } else {
          setBoxError("Unbekannter Fehler beim Laden der Box.");
        }
      } finally {
        setIsLoadingBox(false);
      }
    };

    loadBox();
  }, [boxId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSuccessBooking(null);

    const token = localStorage.getItem("access_token");
    if (!token) {
      setSubmitError("Bitte melde dich zuerst an.");
      return;
    }

    if (!boxId) {
      setSubmitError("Es wurde keine Box-ID übergeben.");
      return;
    }

    if (durationDays <= 0) {
      setSubmitError("Bitte eine Dauer von mindestens 1 Tag wählen.");
      return;
    }

    const durationMinutes = durationDays * 24 * 60;

    try {
      setIsSubmitting(true);

      const res = await fetch(`${API_BASE_URL}/bookings/me`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_name: "Webkunde",
          box_id: boxId,
          duration_minutes: durationMinutes,
        }),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(
          `Fehler beim Anlegen der Buchung (${res.status}): ${txt.slice(
            0,
            200
          )}`
        );
      }

      const data: BookingResponse = await res.json();
      setSuccessBooking(data);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setSubmitError(err.message);
      } else {
        setSubmitError("Unbekannter Fehler bei der Buchung.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDateTime = (iso?: string | null) => {
    if (!iso) return "–";
    try {
      const d = new Date(iso);
      return d.toLocaleString();
    } catch {
      return iso;
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#f3f3f0] flex flex-col">
      {/* Header */}
      <header className="w-full flex items-center justify-between px-6 py-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-sm text-slate-600 hover:text-slate-900"
        >
          ← Zurück
        </button>
        <h2 className="text-xl sm:text-2xl font-semibold text-slate-900">
          Buchung
        </h2>
        <div className="w-16" />
      </header>

      {/* Inhalt */}
      <main className="flex-1 flex flex-col items-center px-4 pb-10">
        <Card className="w-full max-w-3xl rounded-3xl shadow-lg p-6 bg-white/90">
          {isLoadingBox && (
            <p className="text-sm text-slate-500">Lade Boxdetails …</p>
          )}

          {boxError && (
            <p className="text-sm text-red-600 mb-4">{boxError}</p>
          )}

          {!isLoadingBox && !boxError && box && (
            <>
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-slate-900">
                  {box.name}
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Größe: <span className="font-medium">{box.size_m2} m²</span>
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Tagespreis:{" "}
                  <span className="font-medium">
                    {box.price_per_day.toFixed(2)} € / Tag
                  </span>
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Buchungsdauer (Tage)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={durationDays}
                    onChange={(e) =>
                      setDurationDays(
                        isNaN(Number(e.target.value))
                          ? 1
                          : Number(e.target.value)
                      )
                    }
                    className="mt-1 block w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2563eb]"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Später können wir hier noch Stunden / Monate hinzufügen.
                  </p>
                </div>

                {submitError && (
                  <p className="text-sm text-red-600">{submitError}</p>
                )}

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="mt-2"
                >
                  {isSubmitting ? "Buchen …" : "Buchung abschließen"}
                </Button>
              </form>

              {successBooking && (
                <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  <p className="font-semibold mb-1">
                    Buchung erfolgreich angelegt!
                  </p>
                  <p>
                    Zugangscode:{" "}
                    <span className="font-mono font-semibold">
                      {successBooking.access_code ?? "–"}
                    </span>
                  </p>
                  <p className="text-xs mt-1">
                    gültig bis: {formatDateTime(successBooking.valid_until)}
                  </p>
                  {successBooking.price_for_period != null &&
                    successBooking.unit_label && (
                      <p className="text-xs mt-1">
                        Preis: {successBooking.price_for_period.toFixed(2)} € (
                        {successBooking.billed_units}{" "}
                        {successBooking.unit_label})
                      </p>
                    )}
                </div>
              )}
            </>
          )}
        </Card>
      </main>
    </div>
  );
}