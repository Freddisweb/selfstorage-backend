// src/pages/LandingPage.tsx
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
        {/* Brand zentriert, sehr groß, blau und etwas vom oberen Rand abgesetzt */}
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

      {/* Inhalt */}
      <main className="flex-1 flex flex-col items-center px-4 pb-14">
        {/* Hero-Bereich: zentriert, nicht full-bleed */}
        <Card className="w-full max-w-5xl overflow-hidden relative bg-black/5">
          <img
            src={storageImage}
            alt="Moderner Selfstorage-Gang"
            className="w-full h-[420px] sm:h-[520px] object-cover"
          />

          {/* „Jetzt buchen!“ mittig auf dem Bild, extra groß */}
          <div className="absolute inset-0 flex items-center justify-center">
            <Button
              size="xl"
              onClick={onGoToFloorplan}
              className="shadow-xl hover:scale-110"
            >
              Jetzt buchen!
            </Button>
          </div>
        </Card>
      </main>
    </div>
  );
}