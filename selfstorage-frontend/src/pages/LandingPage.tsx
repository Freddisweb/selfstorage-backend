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
          {/* Bild (unterste Ebene) */}
          <img
            src={storageImage}
            alt="Moderner Selfstorage-Gang"
            className="block w-full h-[420px] sm:h-[520px] object-cover z-0"
          />

          {/* Abdunkelungs-Layer */}
          <div className="absolute inset-0 bg-black/25 z-10" />

          {/* Button ganz oben */}
          <div className="absolute inset-0 z-20 flex items-center justify-center">
            <button
              type="button"
              onClick={onGoToFloorplan}
              className="
                rounded-full bg-[#2563eb] text-white
                text-3xl sm:text-4xl lg:text-5xl
                font-semibold tracking-wide
                px-16 sm:px-20 lg:px-24
                py-8 sm:py-10 lg:py-12
                shadow-[0_20px_40px_rgba(37,99,235,0.45)]
                ring-4 ring-white/40 hover:ring-white/60
                hover:bg-[#1e4fcc] hover:scale-110
                transition-all duration-200
                z-[9999]
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