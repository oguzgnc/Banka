import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Save, Pencil, X, WifiOff, TrendingUp } from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000';

interface MarketTrendRow {
  id: number;
  urun_adi: string;
  etki_puani: number;
  aciklama: string;
}

interface DraftState {
  etki_puani: string;
  aciklama: string;
}

function SkeletonTable() {
  return (
    <div className="bg-white shadow-sm border border-slate-200 rounded-lg overflow-hidden animate-pulse">
      <div className="px-6 py-4 border-b border-slate-200">
        <div className="h-4 w-44 bg-slate-200 rounded" />
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="px-6 py-4 flex items-center gap-4">
            <div className="h-3 w-24 bg-slate-100 rounded" />
            <div className="h-8 w-24 bg-slate-100 rounded" />
            <div className="h-8 flex-1 bg-slate-100 rounded" />
            <div className="h-8 w-24 bg-slate-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MarketSettings() {
  const [rows, setRows] = useState<MarketTrendRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<DraftState>({ etki_puani: '0.0', aciklama: '' });

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/market-trends`);
      if (!res.ok) throw new Error('Sunucu beklenmedik bir hata döndürdü.');
      setRows(await res.json() as MarketTrendRow[]);
    } catch {
      setError('Backend\'e bağlanılamadı. Lütfen API sunucusunun çalıştığını kontrol edin.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const startEdit = (row: MarketTrendRow) => {
    setEditingId(row.id);
    setDraft({
      etki_puani: row.etki_puani.toFixed(1),
      aciklama: row.aciklama ?? '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft({ etki_puani: '0.0', aciklama: '' });
  };

  const saveRow = async (id: number) => {
    const etki = Number(draft.etki_puani);
    if (!Number.isFinite(etki) || etki < -2 || etki > 2) {
      setError('Etki puanı -2.0 ile +2.0 arasında olmalıdır.');
      return;
    }

    setSavingId(id);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/market-trends/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          etki_puani: etki,
          aciklama: draft.aciklama,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Güncelleme başarısız.');
      }

      const updated = await res.json() as MarketTrendRow;
      setRows((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      cancelEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bağlantı hatası.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp size={24} className="text-green-700" />
            Piyasa Ayarları
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Ürün bazlı pazar etkisini yönetin: yeni başvuruların teşvik skoruna dinamik etki uygular.
          </p>
        </div>
        {!loading && (
          <button
            onClick={fetchRows}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <RefreshCw size={14} />
            Yenile
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-lg px-5 py-4">
          <WifiOff size={18} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold">İşlem Hatası</p>
            <p className="text-sm mt-0.5 text-red-600">{error}</p>
          </div>
          <button
            onClick={fetchRows}
            className="ml-auto text-xs font-semibold underline underline-offset-2 hover:text-red-800 flex-shrink-0"
          >
            Tekrar Dene
          </button>
        </div>
      )}

      {loading ? (
        <SkeletonTable />
      ) : (
        <div className="bg-white shadow-sm border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-800">Ürün Bazlı Pazar Doygunluğu Etkileri</h2>
            <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-medium">
              {rows.length} ürün
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="text-left px-6 py-3">Ürün</th>
                  <th className="text-left px-6 py-3">Etki Puanı</th>
                  <th className="text-left px-6 py-3">AI Açıklaması</th>
                  <th className="text-right px-6 py-3">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => {
                  const isEditing = editingId === row.id;
                  const isSaving = savingId === row.id;
                  return (
                    <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-800">{row.urun_adi}</td>
                      <td className="px-6 py-4 text-slate-700">
                        {isEditing ? (
                          <input
                            type="number"
                            min={-2}
                            max={2}
                            step={0.1}
                            value={draft.etki_puani}
                            onChange={(e) => setDraft((d) => ({ ...d, etki_puani: e.target.value }))}
                            className="w-28 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                        ) : (
                          <span className="font-semibold">{row.etki_puani.toFixed(1)}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {isEditing ? (
                          <input
                            type="text"
                            value={draft.aciklama}
                            onChange={(e) => setDraft((d) => ({ ...d, aciklama: e.target.value }))}
                            placeholder="Örn: Arz fazlası var, fiyat baskısı bekleniyor"
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                        ) : (
                          <span>{row.aciklama || '—'}</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => saveRow(row.id)}
                                disabled={isSaving}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-70"
                              >
                                <Save size={13} />
                                {isSaving ? 'Kaydediliyor...' : 'Kaydet'}
                              </button>
                              <button
                                onClick={cancelEdit}
                                disabled={isSaving}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-70"
                              >
                                <X size={13} />
                                Vazgeç
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => startEdit(row)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200"
                            >
                              <Pencil size={13} />
                              Düzenle
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
