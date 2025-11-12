import { useEffect, useState } from "react";

const API_BASE_URL = "http://127.0.0.1:8000";

type PricingMode = "hourly" | "daily";

interface Box {
  id: string;
  name: string;
  size_m2: number;
  device_id: string;
  pricing_mode: PricingMode;
  price_per_m2_hour: number;
  price_per_m2_day: number;
}

interface BoxCreatePayload {
  id: string;
  name: string;
  size_m2: number;
  device_id: string;
  pricing_mode: PricingMode;
  price_per_m2_hour: number;
  price_per_m2_day: number;
}

interface BoxUpdatePayload {
  name?: string;
  size_m2?: number;
  device_id?: string;
  pricing_mode?: PricingMode;
  price_per_m2_hour?: number;
  price_per_m2_day?: number;
}

const AdminBoxes: React.FC = () => {
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [savingBoxId, setSavingBoxId] = useState<string | null>(null);
  const [deletingBoxId, setDeletingBoxId] = useState<string | null>(null);

  const [editDrafts, setEditDrafts] = useState<Record<string, Box>>({});
  const [createForm, setCreateForm] = useState<BoxCreatePayload>({
    id: "",
    name: "",
    size_m2: 1,
    device_id: "",
    pricing_mode: "hourly",
    price_per_m2_hour: 0.5,
    price_per_m2_day: 8.0,
  });

  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  // ------------------ Helper ------------------

  const getAuthHeaders = () => {
    const token = localStorage.getItem("access_token");
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  };

  const handleApiError = async (res: Response) => {
    const text = await res.text();
    const msg = `Fehler (${res.status}): ${text.slice(0, 300)}`;
    throw new Error(msg);
  };

  // ------------------ Daten laden ------------------

  const fetchBoxes = async () => {
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`${API_BASE_URL}/boxes/`, {
        method: "GET",
        headers: getAuthHeaders(),
      });

      if (res.status === 401) {
        throw new Error("Nicht eingeloggt oder Token abgelaufen.");
      }
      if (res.status === 403) {
        throw new Error("Keine Admin-Rechte. Bitte mit Admin-Account einloggen.");
      }
      if (!res.ok) {
        await handleApiError(res);
      }

      const data: Box[] = await res.json();
      setBoxes(data);

      // Drafts initialisieren
      const drafts: Record<string, Box> = {};
      data.forEach((box) => {
        drafts[box.id] = { ...box };
      });
      setEditDrafts(drafts);
    } catch (err: any) {
      setErrorMsg(err.message ?? "Unbekannter Fehler beim Laden der Boxen.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBoxes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------ Bearbeiten ------------------

  const updateDraftField = (id: string, field: keyof Box, value: string) => {
    setEditDrafts((prev) => {
      const old = prev[id] ?? boxes.find((b) => b.id === id);
      if (!old) return prev;

      let parsed: any = value;
      if (field === "size_m2" || field === "price_per_m2_hour" || field === "price_per_m2_day") {
        parsed = Number(value.replace(",", "."));
        if (Number.isNaN(parsed)) parsed = 0;
      }

      return {
        ...prev,
        [id]: {
          ...old,
          [field]: parsed,
        },
      };
    });
  };

  const handleSave = async (boxId: string) => {
    const draft = editDrafts[boxId];
    if (!draft) return;

    setSavingBoxId(boxId);
    setErrorMsg(null);

    const payload: BoxUpdatePayload = {
      name: draft.name,
      size_m2: draft.size_m2,
      device_id: draft.device_id,
      pricing_mode: draft.pricing_mode,
      price_per_m2_hour: draft.price_per_m2_hour,
      price_per_m2_day: draft.price_per_m2_day,
    };

    try {
      const res = await fetch(`${API_BASE_URL}/boxes/${encodeURIComponent(boxId)}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        await handleApiError(res);
      }

      const updated: Box = await res.json();

      setBoxes((prev) => prev.map((b) => (b.id === boxId ? updated : b)));
      setEditDrafts((prev) => ({
        ...prev,
        [boxId]: { ...updated },
      }));
    } catch (err: any) {
      setErrorMsg(err.message ?? "Fehler beim Speichern der Box.");
    } finally {
      setSavingBoxId(null);
    }
  };

  const handleResetDraft = (boxId: string) => {
    const original = boxes.find((b) => b.id === boxId);
    if (!original) return;
    setEditDrafts((prev) => ({
      ...prev,
      [boxId]: { ...original },
    }));
  };

  // ------------------ Löschen ------------------

  const handleDelete = async (boxId: string) => {
    if (!window.confirm(`Box ${boxId} wirklich löschen?`)) return;

    setDeletingBoxId(boxId);
    setErrorMsg(null);

    try {
      const res = await fetch(`${API_BASE_URL}/boxes/${encodeURIComponent(boxId)}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      if (!res.ok) {
        await handleApiError(res);
      }

      setBoxes((prev) => prev.filter((b) => b.id !== boxId));
      setEditDrafts((prev) => {
        const copy = { ...prev };
        delete copy[boxId];
        return copy;
      });
    } catch (err: any) {
      setErrorMsg(err.message ?? "Fehler beim Löschen der Box.");
    } finally {
      setDeletingBoxId(null);
    }
  };

  // ------------------ Neue Box ------------------

  const handleCreateChange = (field: keyof BoxCreatePayload, value: string) => {
    setCreateForm((prev) => {
      let parsed: any = value;

      if (field === "size_m2" || field === "price_per_m2_hour" || field === "price_per_m2_day") {
        parsed = Number(value.replace(",", "."));
        if (Number.isNaN(parsed)) parsed = 0;
      }

      return {
        ...prev,
        [field]: parsed,
      };
    });
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreateSuccess(null);

    if (!createForm.id.trim()) {
      setCreateError("Bitte eine eindeutige ID angeben (z. B. BOX-11).");
      return;
    }
    if (!createForm.name.trim()) {
      setCreateError("Bitte einen Namen für die Box angeben.");
      return;
    }
    if (!createForm.device_id.trim()) {
      setCreateError("Bitte ein device_id angeben (z. B. TTLock-Gerät).");
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/boxes/`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(createForm),
      });

      if (!res.ok) {
        await handleApiError(res);
      }

      const created: Box = await res.json();
      setBoxes((prev) => [...prev, created]);
      setEditDrafts((prev) => ({
        ...prev,
        [created.id]: { ...created },
      }));

      setCreateSuccess(`Box ${created.id} wurde angelegt.`);
      setCreateForm({
        id: "",
        name: "",
        size_m2: 1,
        device_id: "",
        pricing_mode: "hourly",
        price_per_m2_hour: 0.5,
        price_per_m2_day: 8.0,
      });
    } catch (err: any) {
      setCreateError(err.message ?? "Fehler beim Anlegen der Box.");
    }
  };

  // ------------------ Render ------------------

  return (
    <section className="w-full flex justify-center">
      <div className="w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              Admin: Box-Verwaltung
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Hier kannst du Boxen anlegen, Preise ändern und Boxen löschen. Nur als Admin sichtbar.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchBoxes}
            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Neu laden
          </button>
        </header>

        {errorMsg && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {errorMsg}
          </div>
        )}

        {isLoading && (
          <p className="text-sm text-slate-500">Boxen werden geladen …</p>
        )}

        {/* Neue Box anlegen */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">
            Neue Box anlegen
          </h3>
          <form
            className="grid gap-3 md:grid-cols-3 lg:grid-cols-4 items-end"
            onSubmit={handleCreateSubmit}
          >
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">
                ID
              </label>
              <input
                type="text"
                value={createForm.id}
                onChange={(e) => handleCreateChange("id", e.target.value)}
                placeholder="z. B. BOX-11"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">
                Name
              </label>
              <input
                type="text"
                value={createForm.name}
                onChange={(e) => handleCreateChange("name", e.target.value)}
                placeholder="z. B. Extra Box"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">
                Fläche (m²)
              </label>
              <input
                type="number"
                step="0.1"
                value={createForm.size_m2}
                onChange={(e) => handleCreateChange("size_m2", e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">
                device_id
              </label>
              <input
                type="text"
                value={createForm.device_id}
                onChange={(e) => handleCreateChange("device_id", e.target.value)}
                placeholder="z. B. TTLock / Seam ID"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">
                Abrechnung
              </label>
              <select
                value={createForm.pricing_mode}
                onChange={(e) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    pricing_mode: e.target.value as PricingMode,
                  }))
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="hourly">Stundenweise</option>
                <option value="daily">Tagesweise</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">
                €/m² Stunde
              </label>
              <input
                type="number"
                step="0.01"
                value={createForm.price_per_m2_hour}
                onChange={(e) =>
                  handleCreateChange("price_per_m2_hour", e.target.value)
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">
                €/m² Tag
              </label>
              <input
                type="number"
                step="0.01"
                value={createForm.price_per_m2_day}
                onChange={(e) =>
                  handleCreateChange("price_per_m2_day", e.target.value)
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div className="mt-2">
              <button
                type="submit"
                className="inline-flex items-center rounded-full bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-sky-700"
              >
                Box anlegen
              </button>
            </div>
          </form>
          {createError && (
            <p className="text-xs text-red-600 mt-1">{createError}</p>
          )}
          {createSuccess && (
            <p className="text-xs text-emerald-600 mt-1">{createSuccess}</p>
          )}
        </div>

        {/* Bestehende Boxen */}
        <div className="rounded-2xl border border-slate-200 bg-white/90 shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3">
            <h3 className="text-sm font-medium text-slate-800">
              Bestehende Boxen
            </h3>
          </div>

          {boxes.length === 0 && !isLoading && (
            <p className="px-4 py-4 text-sm text-slate-500">
              Noch keine Boxen angelegt.
            </p>
          )}

          {boxes.length > 0 && (
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">
                      ID
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">
                      Name
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">
                      m²
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">
                      device_id
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">
                      Modus
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">
                      €/m² Stunde
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">
                      €/m² Tag
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">
                      Aktionen
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {boxes.map((box) => {
                    const draft = editDrafts[box.id] ?? box;
                    return (
                      <tr key={box.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 text-xs font-mono text-slate-700">
                          {box.id}
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={draft.name}
                            onChange={(e) =>
                              updateDraftField(box.id, "name", e.target.value)
                            }
                            className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            step="0.1"
                            value={draft.size_m2}
                            onChange={(e) =>
                              updateDraftField(
                                box.id,
                                "size_m2",
                                e.target.value
                              )
                            }
                            className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={draft.device_id}
                            onChange={(e) =>
                              updateDraftField(
                                box.id,
                                "device_id",
                                e.target.value
                              )
                            }
                            className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={draft.pricing_mode}
                            onChange={(e) =>
                              updateDraftField(
                                box.id,
                                "pricing_mode",
                                e.target.value
                              )
                            }
                            className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
                          >
                            <option value="hourly">hourly</option>
                            <option value="daily">daily</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            step="0.01"
                            value={draft.price_per_m2_hour}
                            onChange={(e) =>
                              updateDraftField(
                                box.id,
                                "price_per_m2_hour",
                                e.target.value
                              )
                            }
                            className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            step="0.01"
                            value={draft.price_per_m2_day}
                            onChange={(e) =>
                              updateDraftField(
                                box.id,
                                "price_per_m2_day",
                                e.target.value
                              )
                            }
                            className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
                          />
                        </td>
                        <td className="px-3 py-2 text-right space-x-2">
                          <button
                            type="button"
                            onClick={() => handleResetDraft(box.id)}
                            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                          >
                            Zurücksetzen
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSave(box.id)}
                            disabled={savingBoxId === box.id}
                            className="inline-flex items-center rounded-full bg-sky-600 px-3 py-1 text-[11px] font-medium text-white shadow-sm hover:bg-sky-700 disabled:bg-sky-300"
                          >
                            {savingBoxId === box.id ? "Speichern…" : "Speichern"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(box.id)}
                            disabled={deletingBoxId === box.id}
                            className="inline-flex items-center rounded-full bg-red-50 px-3 py-1 text-[11px] font-medium text-red-700 hover:bg-red-100 disabled:bg-red-100"
                          >
                            {deletingBoxId === box.id ? "Löschen…" : "Löschen"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default AdminBoxes;