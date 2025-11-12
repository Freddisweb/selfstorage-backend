import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import storageImage from "../assets/storage.jpg";

type Props = {
  isLoggedIn: boolean;
  userEmail?: string | null;
  onOpenLogin: () => void;
  onLogout: () => void;
  onGoToFloorplan: () => void;
};

export default function LandingPage({
  isLoggedIn,
  userEmail,
  onOpenLogin,
  onLogout,
  onGoToFloorplan,
}: Props) {
  return (
    <div className="min-h-screen w-full bg-[#f3f3f0] flex flex-col">
      {/* Header */}
      <header className="relative w-full flex items-center justify-center pt-10 pb-6">
        <h1 className="mt-2 text-[4rem] sm:text-[5rem] lg:text-[6rem] font-extrabold tracking-[0.35em] uppercase text-[#2563eb] text-center">
          SPACEONE
        </h1>

        {/* Login oben rechts */}
        <div className="absolute right-6 top-6 flex items-center gap-3">
          {isLoggedIn && userEmail && (
            <span className="hidden sm:inline text-xs text-slate-600">
              Eingeloggt als{" "}
              <span className="font-medium text-slate-900">{userEmail}</span>
            </span>
          )}

          {isLoggedIn ? (
            <Button
              onClick={onLogout}
              variant="primary"
              size="lg"
              className="bg-black hover:bg-neutral-900"
            >
              Logout
            </Button>
          ) : (
            <Button
              onClick={onOpenLogin}
              variant="primary"
              size="lg"
              className="bg-black hover:bg-neutral-900"
            >
              Registrieren / Einloggen
            </Button>
          )}
        </div>
      </header>

      {/* Inhalt mit Bild + Overlay-Button */}
      <main className="flex-1 flex flex-col items-center px-4 pb-14">
        <Card className="relative w-full max-w-5xl overflow-hidden bg-black rounded-2xl shadow-2xl">
          {/* Hintergrundbild */}
          <img
            src={storageImage}
            alt="Moderner Self-Storage-Gang"
            className="w-full h-[420px] sm:h-[520px] object-cover opacity-95"
          />

          {/* leichtes Abdunkelungs-Overlay für bessere Lesbarkeit */}
          <div className="absolute inset-0 bg-black/25" />

          {/* BIG Button zentriert auf dem Bild */}
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              type="button"
              onClick={onGoToFloorplan}
              className="
                rounded-full bg-[#2563eb] text-white
                text-2xl sm:text-3xl lg:text-4xl
                font-semibold tracking-wide
                px-12 sm:px-16 lg:px-20
                py-6 sm:py-7 lg:py-8
                shadow-[0_20px_40px_rgba(37,99,235,0.45)]
                ring-4 ring-white/40 hover:ring-white/60
                hover:bg-[#1e4fcc] hover:scale-105
                transition-all duration-200
              "
            >
              Jetzt buchen!
            </button>
          </div>
        </Card>
      </main>
    </div>
  );
}