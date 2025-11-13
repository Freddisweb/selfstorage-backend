// src/pages/FloorplanPage.tsx
import { useEffect, useState } from "react";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { getAvailableBoxes, BoxPublic } from "../api";

type Props = {
  onBackToLanding: () => void;
  onSelectBox: (boxId: string) => void;
};

export default function FloorplanPage({ onBackToLanding, onSelectBox }: Props) {
  const [boxes, setBoxes] = useState<BoxPublic[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        setErrorMsg(null);
        // Erstmal: sofortige Buchung, Dauer 60 Min (kannst du später parametrisieren)
        const data = await getAvailableBoxes({
          startInMinutes: 0,
          durationMinutes: 60,
        });
        setBoxes(data);
      } catch (err: any) {
        setErrorMsg(
          err?.message ?? "Fehler beim Laden der verfügbaren Boxen."
        );
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="min-h-screen w-full bg-[#f3f3f0] flex flex-col">
      {/* Header */}
      <header className="w-full flex items-center justify-between px-6 py-4">
        <button
          type="button"
          onClick={onBackToLanding}
          className="text-sm text-slate-600 hover:text-slate-900"
        >
          ← Zurück
        </button>
        <h2 className="text-xl sm:text-2xl font-semibold text-slate-900">
          Grundriss – verfügbare Boxen
        </h2>
        <div className="w-16" />
      </header>

      {/* Inhalt */}
      <main className="flex-1 flex flex-col items-center px-4 pb-10">
        <Card className="w-full max-w-5xl rounded-3xl shadow-lg p-6 bg-white/90">
          <p className="mb-4 text-sm text-slate-500">
            Wähle eine Box im Grundriss aus, um mit der Buchung zu starten.
          </p>

          {isLoading && (
            <p className="text-sm text-slate-500">Lade verfügbare Boxen …</p>
          )}

          {errorMsg && (
            <p className="text-sm text-red-600 mb-4">{errorMsg}</p>
          )}

          {!isLoading && !errorMsg && boxes.length === 0 && (
            <p className="text-sm text-slate-500">
              Aktuell sind für den ausgewählten Zeitraum keine Boxen verfügbar.
            </p>
          )}

          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {boxes.map((box) => (
              <button
                key={box.id}
                type="button"
                onClick={() => onSelectBox(box.id)}
                className="aspect-[4/3] rounded-xl bg-slate-100 hover:bg-sky-100 border border-slate-200 hover:border-sky-300 text-xs sm:text-sm font-medium text-slate-700 flex flex-col items-center justify-center hover:scale-105 transition-transform duration-150"
              >
                <span className="font-semibold">{box.name}</span>
                <span className="text-[11px] text-slate-500">
                  {box.size_m2} m²
                </span>
                <span className="mt-1 text-[11px] text-slate-600">
                  ab {box.price_for_period.toFixed(2)} €
                </span>
              </button>
            ))}
          </div>
        </Card>
      </main>
    </div>
  );
}