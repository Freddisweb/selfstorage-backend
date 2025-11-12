import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
// import storageImage from "../assets/storage.jpg"; // <— Bild vorerst deaktiviert

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
    <div className="min-h-screen w-full bg-gray-100 flex flex-col">
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

      {/* Inhalt ohne Bild */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 pb-14">
        <Card className="w-full max-w-3xl flex flex-col items-center justify-center bg-white rounded-2xl shadow-lg p-10 border border-gray-300">
          <h2 className="text-3xl font-semibold mb-8 text-gray-800 text-center">
            Willkommen bei SPACEONE
          </h2>

          <Button
            size="xl"
            onClick={onGoToFloorplan}
            className="text-2xl px-10 py-6 font-semibold bg-[#2563eb] hover:bg-[#1e4fcc] text-white shadow-2xl hover:scale-105 transition-transform duration-200"
          >
            Jetzt buchen!
          </Button>
        </Card>
      </main>
    </div>
  );
}