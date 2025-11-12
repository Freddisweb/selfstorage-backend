import { useEffect, useState } from "react";

const API_BASE_URL = "http://127.0.0.1:8000";

// Typ für Admin-Box (Backend-Form)
interface AdminBox {
  id: string;
  name: string;
  size_m2: number;
  device_id: string;
  pricing_mode: "hourly" | "daily";
  price_per_m2_hour: number;
  price_per_m2_day: number;
}

const AdminPanel: React.FC = () => {
  const [boxes, setBoxes] = useState<AdminBox[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form-State für neue Box
  const [newBox, setNewBox] = useState<AdminBox>({
    id: "",
    name: "",
    size_m2: 1,
    device_id: "",
    pricing_mode: "daily",
    price_per_m2_hour: 0.5,
    price_per_m2_day: 8.0,
  });

  // Boxen laden
  const loadBoxes = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const token = localStorage.getItem("access_token");
      if (!token) {
        throw new Error("Kein Token vorhanden. Bitte einloggen.");
      }

      const res = await fetch(`${API_BASE_URL}/boxes/`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Fehler beim Laden der Boxen (${res.status}): ${txt.slice(0, 200)}`);
      }

      const data: AdminBox[] = await res.json();
      setBoxes(data);
    } catch (err: any) {
      setErrorMsg(err.message ?? "Unbekannter Fehler beim Laden der Boxen.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBoxes();
  }, []);

  // Handler für Form-Inputs
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;

    setNewBox((prev) => {
      // numerische Felder
      if (name === "size_m2" || name === "price_per_m2_hour" || name === "price_per_m2_day") {
        return {
          ...prev,
          [name]: Number(value),
        };
      }

      // pricing_mode
      if (name === "pricing_mode") {
        return {
          ...prev,
          pricing_mode: value as "hourly" | "daily",
        };
      }

      // string-Felder
      return {
        ...prev,
        [name]: value,
      };
    });
  };

  // Neue Box anlegen
  const handleCreateBox = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const token = localStorage.getItem("access_token");
      if (!token) {
        throw new Error("Kein Token vorhanden. Bitte einloggen.");
      }

      const res = await fetch(`${API_BASE_URL}/boxes/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newBox),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Fehler beim Anlegen der Box (${res.status}): ${txt.slice(0, 200)}`);
      }

      const created: AdminBox = await res.json();
      setSuccessMsg(`Box '${created.name}' erfolgreich angelegt.`);
      // Liste neu laden
      await loadBoxes();

      // Form zurücksetzen (ID lasse ich leer, damit du sie neu eingeben musst)
      setNewBox({
        id: "",
        name: "",
        size_m2: 1,
        device_id: "",
        pricing_mode: "daily",
        price_per_m2_hour: 0.5,
        price_per_m2_day: 8.0,
      });
    } catch (err: any) {
      setErrorMsg(err.message ?? "Unbekannter Fehler beim Anlegen der Box.");
    }
  };

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-xl font-semibold text-slate-900">
          Adminbereich
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Hier kannst du Boxen und Preise verwalten. Nur sichtbar, wenn du
          als Admin eingeloggt bist.
        </p>
      </header>

      {/* Status / Meldungen */}
      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {successMsg}
        </div>
      )}

      {/* Box-Liste */}
      <div className="rounded-2xl border border-slate-200 bg-white/90 shadow-sm">
        <div className="border-b border-slate-100 px-5 py-3">
          <h3 className="text-sm font-semibold text-slate-900">
            Vorhandene Boxen
          </h3>
        </div>

        <div className="px-5 py-4">
          {isLoading && (
            <p className="text-sm text-slate-500">Lade Boxen …</p>
          )}

          {!isLoading && boxes.length === 0 && (
            <p className="text-sm text-slate-500">
              Noch keine Boxen vorhanden.
            </p>
          )}

          {!isLoading && boxes.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-3 py-2 font-medium text-slate-600">ID</th>
                    <th className="px-3 py-2 font-medium text-slate-600">Name</th>
                    <th className="px-3 py-2 font-medium text-slate-600">Größe (m²)</th>
                    <th className="px-3 py-2 font-medium text-slate-600">Device ID</th>
                    <th className="px-3 py-2 font-medium text-slate-600">Modus</th>
                    <th className="px-3 py-2 font-medium text-slate-600">€/m² Stunde</th>
                    <th className="px-3 py-2 font-medium text-slate-600">€/m² Tag</th>
                  </tr>
                </thead>
                <tbody>
                  {boxes.map((box) => (
                    <tr key={box.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-2 text-xs font-mono text-slate-700">
                        {box.id}
                      </td>
                      <td className="px-3 py-2 text-sm text-slate-900">
                        {box.name}
                      </td>
                      <td className="px-3 py-2 text-sm text-slate-700">
                        {box.size_m2}
                      </td>
                      <td className="px-3 py-2 text-xs font-mono text-slate-500">
                        {box.device_id}
                      </td>
                      <td className="px-3 py-2 text-sm text-slate-700">
                        {box.pricing_mode === "hourly" ? "Stundenweise" : "Tagesweise"}
                      </td>
                      <td className="px-3 py-2 text-sm text-slate-700">
                        {(box.price_per_m2_hour ?? 0).toFixed(2)} €€
                      </td>
                      <td className="px-3 py-2 text-sm text-slate-700">
                        {(box.price_per_m2_day ?? 0).toFixed(2)} €
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Neue Box anlegen */}
      <div className="rounded-2xl border border-slate-200 bg-white/90 shadow-sm">
        <div className="border-b border-slate-100 px-5 py-3">
          <h3 className="text-sm font-semibold text-slate-900">
            Neue Box anlegen
          </h3>
        </div>

        <form onSubmit={handleCreateBox} className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Box-ID
              </label>
              <input
                type="text"
                name="id"
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="z. B. BOX-11"
                value={newBox.id}
                onChange={handleInputChange}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">
                Name
              </label>
              <input
                type="text"
                name="name"
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="z. B. Große Box 11"
                value={newBox.name}
                onChange={handleInputChange}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">
                Größe (m²)
              </label>
              <input
                type="number"
                step="0.1"
                min="0.5"
                name="size_m2"
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={newBox.size_m2}
                onChange={handleInputChange}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">
                Device ID
              </label>
              <input
                type="text"
                name="device_id"
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Seam-Geräte-ID"
                value={newBox.device_id}
                onChange={handleInputChange}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">
                Abrechnungsmodus
              </label>
              <select
                name="pricing_mode"
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={newBox.pricing_mode}
                onChange={handleInputChange}
              >
                <option value="hourly">Stundenweise</option>
                <option value="daily">Tagesweise</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">
                Preis pro m² und Stunde (€)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                name="price_per_m2_hour"
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={newBox.price_per_m2_hour}
                onChange={handleInputChange}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">
                Preis pro m² und Tag (€)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                name="price_per_m2_day"
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={newBox.price_per_m2_day}
                onChange={handleInputChange}
              />
            </div>
          </div>

          <button
            type="submit"
            className="inline-flex items-center rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700"
          >
            Box anlegen
          </button>
        </form>
      </div>
    </section>
  );
};

export default AdminPanel;