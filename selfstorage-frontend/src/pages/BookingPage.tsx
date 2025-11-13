// src/pages/BookingPage.tsx
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { createMyBooking, BookingPublic } from "../api";

export default function BookingPage() {
  const { boxId } = useParams<{ boxId: string }>();
  const navigate = useNavigate();

  const [durationMinutes, setDurationMinutes] = useState(60);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [booking, setBooking] = useState<BookingPublic | null>(null);

  if (!boxId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f3f3f0]">
        <Card className="p-6">
          <p className="text-sm text-red-600">
            Keine Box gewählt.{" "}
            <button
              className="underline"
              onClick={() => navigate("/floorplan")}
            >
              Zurück zur Auswahl
            </button>
          </p>
        </Card>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const result = await createMyBooking({
        boxId,
        durationMinutes,
        // optional: hier könnte man den Anzeigenamen aus JWT/Backend holen
        userName: "SpaceOne-Kunde",
      });
      setBooking(result);
    } catch (err: any) {
      setErrorMsg(err?.message ?? "Fehler beim Anlegen der Buchung.");
    } finally {
      setIsSubmitting(false);
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

  return (
    <div className="min-h-screen w-full bg-[#f3f3f0] flex flex-col items-center px-4 py-10">
      <Card className="w-full max-w-lg p-6">
        <button
          type="button"
          onClick={() => navigate("/floorplan")}
          className="text-xs text-slate-500 hover:text-slate-800"
        >
          ← Zurück zur Box-Auswahl
        </button>

        <h2 className="mt-2 text-xl font-semibold text-slate-900">
          Buchung für Box {boxId}
        </h2>

        {!booking && (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Dauer der Buchung
              </label>
              <select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value={60}>1 Stunde</option>
                <option value={120}>2 Stunden</option>
                <option value={60 * 24}>1 Tag</option>
                <option value={60 * 24 * 2}>2 Tage</option>
              </select>
            </div>

            {errorMsg && (
              <p className="text-sm text-red-600">{errorMsg}</p>
            )}

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full justify-center"
            >
              {isSubmitting ? "Buchen …" : "Buchung abschließen"}
            </Button>
          </form>
        )}

        {booking && (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-emerald-700 font-semibold">
              Buchung erfolgreich angelegt!
            </p>
            <p className="text-sm text-slate-700">
              Zugangscode:{" "}
              <span className="font-mono font-bold">
                {booking.access_code ?? "–"}
              </span>
            </p>
            <p className="text-xs text-slate-500">
              Gültig von: {formatDateTime(booking.created_at)}
              <br />
              Bis: {formatDateTime(booking.valid_until)}
            </p>
            <Button
              className="w-full justify-center mt-2"
              onClick={() => navigate("/")}
            >
              Zur Startseite
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}