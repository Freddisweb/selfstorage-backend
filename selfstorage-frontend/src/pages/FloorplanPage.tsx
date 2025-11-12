// src/pages/FloorplanPage.tsx

interface FloorplanPageProps {
    onBackToLanding: () => void;
    onSelectBox: (boxId: string) => void;
  }
  
  const FloorplanPage: React.FC<FloorplanPageProps> = ({
    onBackToLanding,
    onSelectBox,
  }) => {
    return (
      <div className="min-h-screen w-full bg-[#f3f3f0] flex flex-col items-center px-4 pb-12 pt-8">
        <div className="w-full max-w-5xl flex items-center justify-between mb-6">
          <h2 className="text-xl sm:text-2xl font-semibold text-slate-900">
            Grundriss – verfügbare Boxen
          </h2>
          <button
            type="button"
            onClick={onBackToLanding}
            className="text-xs sm:text-sm text-slate-600 hover:text-slate-900 underline"
          >
            Zurück zur Startseite
          </button>
        </div>
  
        {/* Platzhalter-Grundriss – später ersetzen durch echtes Grundriss-Bild */}
        <div className="w-full max-w-5xl bg-white rounded-3xl shadow-lg p-6">
          <p className="mb-4 text-sm text-slate-500">
            (Platzhalter) Klicke auf eine Box, um die Buchung zu starten.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {["BOX-01", "BOX-02", "BOX-03", "BOX-04", "BOX-05", "BOX-06"].map(
              (boxId) => (
                <button
                  key={boxId}
                  type="button"
                  onClick={() => onSelectBox(boxId)}
                  className="aspect-[4/3] rounded-xl bg-slate-100 hover:bg-sky-100 border border-slate-200 hover:border-sky-300 text-sm font-medium text-slate-700 flex items-center justify-center hover:scale-105 transition-transform duration-150"
                >
                  {boxId}
                </button>
              )
            )}
          </div>
        </div>
      </div>
    );
  };
  
  export default FloorplanPage;