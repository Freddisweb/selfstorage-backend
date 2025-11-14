// src/pages/BookingPage.tsx
import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { createMyBooking, type BoxPublic, type BookingPublic } from "../api";

interface LocationState {
  box?: BoxPublic;
}

export default function BookingPage() {
  const { boxId } = useParams<{ boxId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state || {}) as LocationState;

  const box = state.box;

  const [durationDays, setDurationDays] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successBooking, setSuccessBooking] = useState<BookingPublic | null>(
    null
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSuccessBooking(null);

    const token = localStorage.getItem("access_token");
    if (!token) {
      setSubmitError("Bitte melde dich zuerst an.");
      return;
    }

    if (!box) {
      setSubmitError("Keine Boxdaten vorhanden. Bitte zurück zum Grundriss.");
      return;
    }

    if (durationDays <= 0) {
      setSubmitError("Bitte eine Dauer von mindestens 1 Tag wählen.");
      return;
    }

    const durationMinutes = durationDays * 24 * 60;

    try {
      setIsSubmitting(true);

      // Hier geht alles an dein Backend (/bookings/me)
      const booking = await createMyBooking({
        boxId: box.id,
        durationMinutes,
        userName: "Webkunde",
      });

      setSuccessBooking(booking);
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

  // Wenn keine Box im State ist (z.B. direkter Aufruf von /booking/B001)
  if (!box) {
    return (
      <div className="min-h-screen w-full bg-[#f3f3f0] flex flex-col">
        <header className="w-full flex items-center justify-between px-6 py-4">
          <button
            type="button"
            onClick={() => navigate("/floorplan")}
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            ← Zurück zum Grundriss
          </button>
          <h2 className="text-xl sm:text-2xl font-semibold text-slate-900">
            Buchung
          </h2>
          <div className="w-16" />
        </header>
        <main className="flex-1 flex flex-col items-center px-4 pb-10">
          <Card className="w-full max-w-3xl rounded-3xl shadow-lg p-6 bg-white/90">
            <p className="text-sm text-red-600">
              Für diese Buchung konnten keine Boxdaten gefunden werden. Bitte
              wähle die Box erneut im Grundriss aus.
            </p>
          </Card>
        </main>
      </div>
    );
  }

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
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-slate-900">
              {box.name}
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Größe: <span className="font-medium">{box.size_m2} m²</span>
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Preis aktuell:{" "}
              <span className="font-medium">
                {box.price_for_period.toFixed(2)} € ({box.billed_units}{" "}
                {box.unit_label})
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

            <Button type="submit" disabled={isSubmitting} className="mt-2">
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
        </Card>
      </main>
    </div>
  );
}