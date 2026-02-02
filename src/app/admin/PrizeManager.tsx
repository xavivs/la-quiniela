"use client";

import { useState, useEffect } from "react";
import { QUINIELA_NAMES } from "@/lib/quiniela-constants";

type Prize = {
  id: string;
  user_id: string;
  amount: number;
  notes?: string | null;
  users?: { quiniela_name: string | null };
};

type Props = {
  jornadaId: string;
};

export default function PrizeManager({ jornadaId }: Props) {
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPrize, setEditingPrize] = useState<string | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [amount, setAmount] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPrizes();
  }, [jornadaId]);

  async function loadPrizes() {
    setLoading(true);
    try {
      const res = await fetch(`/api/quiniela/prizes?jornada_id=${jornadaId}`);
      const data = await res.json();
      if (res.ok) {
        const prizesMapped = (data.prizes ?? []).map((p: { id: string; user_id: string; amount: number; notes?: string | null; users?: { quiniela_name: string | null } }) => ({
          id: p.id,
          user_id: p.user_id,
          amount: Number(p.amount),
          notes: p.notes,
          users: p.users ? { quiniela_name: p.users.quiniela_name } : null,
        }));
        setPrizes(prizesMapped);
      }
    } catch {
      // ignore
    }
    setLoading(false);
  }

  function toggleUser(name: string) {
    setSelectedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  async function handleSave() {
    if (selectedUsers.size === 0 || !amount) {
      alert("Selecciona al menos un usuario y un monto.");
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum < 0) {
      alert("El monto debe ser un número positivo.");
      return;
    }

    setSaving(true);
    const names = Array.from(selectedUsers);
    let ok = 0;
    let errMsg = "";

    for (const name of names) {
      try {
        const userRes = await fetch(`/api/users/by-quiniela-name?name=${encodeURIComponent(name)}`);
        const userData = await userRes.json();
        if (!userRes.ok || !userData.user_id) {
          errMsg = (errMsg ? errMsg + "; " : "") + name + ": usuario no encontrado";
          continue;
        }

        const res = await fetch("/api/quiniela/prizes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jornada_id: jornadaId,
            user_id: userData.user_id,
            amount: amountNum,
            notes: notes.trim() || null,
          }),
        });

        const data = await res.json();
        if (res.ok) ok++;
        else errMsg = (errMsg ? errMsg + "; " : "") + (data.error || "Error");
      } catch {
        errMsg = (errMsg ? errMsg + "; " : "") + name + ": error de conexión";
      }
    }

    setSaving(false);
    if (ok > 0) {
      loadPrizes();
      setEditingPrize(null);
      setSelectedUsers(new Set());
      setAmount("");
      setNotes("");
    }
    if (errMsg) alert(errMsg);
  }

  async function handleDelete(prizeId: string) {
    if (!confirm("¿Eliminar este premio?")) return;

    try {
      const res = await fetch(`/api/quiniela/prizes/${prizeId}`, { method: "DELETE" });
      if (res.ok) loadPrizes();
      else {
        const data = await res.json();
        alert(data.error || "Error al eliminar.");
      }
    } catch {
      alert("Error de conexión.");
    }
  }

  if (loading) return <p className="text-sm text-slate-600">Cargando premios...</p>;

  return (
    <div className="mt-4 space-y-3 rounded-lg border border-purple-200 bg-purple-50/50 p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-800">Premios de esta jornada</h4>
        {!editingPrize && (
          <button
            onClick={() => setEditingPrize("new")}
            className="rounded bg-purple-600 px-2 py-1 text-xs font-medium text-white hover:bg-purple-700"
          >
            + Añadir premio(s)
          </button>
        )}
      </div>

      {editingPrize && (
        <div className="space-y-2 rounded border border-purple-300 bg-white p-3">
          <div className="text-xs font-medium text-slate-700">Selecciona quién ha cobrado (puedes elegir varios)</div>
          <div className="flex flex-wrap gap-2">
            {QUINIELA_NAMES.map((name) => (
              <label key={name} className="flex cursor-pointer items-center gap-1.5 rounded border border-slate-200 px-2 py-1.5 hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={selectedUsers.has(name)}
                  onChange={() => toggleUser(name)}
                  className="rounded border-slate-300"
                />
                <span className="text-sm">{name}</span>
              </label>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Monto (€) por persona</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Notas (opcional)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej: Pleno 15"
                className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded bg-purple-600 px-3 py-1 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
            <button
              onClick={() => {
                setEditingPrize(null);
                setSelectedUsers(new Set());
                setAmount("");
                setNotes("");
              }}
              className="rounded border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {prizes.length === 0 && !editingPrize && (
        <p className="text-xs text-slate-500">No hay premios registrados para esta jornada.</p>
      )}

      {prizes.length > 0 && (
        <div className="space-y-2">
          {prizes.map((prize) => {
            const userName = prize.users?.quiniela_name || "Usuario desconocido";
            return (
              <div
                key={prize.id}
                className="flex items-center justify-between rounded border border-purple-200 bg-white p-2"
              >
                <div>
                  <span className="font-medium text-slate-800">{userName}</span>
                  <span className="ml-2 text-sm font-semibold text-green-700">
                    {prize.amount.toFixed(2)} €
                  </span>
                  {prize.notes && (
                    <span className="ml-2 text-xs text-slate-500">({prize.notes})</span>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(prize.id)}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  Eliminar
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
