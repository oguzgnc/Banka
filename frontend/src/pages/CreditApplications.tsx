import { useCallback, useEffect, useState } from 'react';
import { CheckCircle, Clock, XCircle, Plus, Search, WifiOff, RefreshCw } from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000';

/**
 * DenizBank kredi başvuru şeması — TCKN formatı.
 * PostgreSQL prod bağlantısında tek satır değişmez.
 */

type AppStatus = 'Onaylandı' | 'Bekliyor' | 'Reddedildi';

interface AppSummary {
  onaylanan:  number;
  bekleyen:   number;
  reddedilen: number;
}

interface Application {
  Basvuru_No: string;
  TCKN:       string;
  Ad_Soyad:   string;
  Il:         string;
  Kredi_Turu: string;
  Tutar:      number;
  Tarih:      string;
  Durum:      AppStatus;
}

interface CreditData {
  summary:      AppSummary;
  applications:  Application[];
}

// ── Sabit konfigürasyonlar ──────────────────────────────────────────────────

const STATUS_CONFIG: Record<AppStatus, { badge: string; icon: React.ReactNode }> = {
  Onaylandı:  { badge: 'bg-green-100 text-green-800',  icon: <CheckCircle size={13} className="text-green-600" /> },
  Bekliyor:   { badge: 'bg-yellow-100 text-yellow-800', icon: <Clock       size={13} className="text-yellow-600" /> },
  Reddedildi: { badge: 'bg-red-100 text-red-800',      icon: <XCircle     size={13} className="text-red-600" /> },
};

function formatTutar(tutar: number): string {
  return `₺${tutar.toLocaleString('tr-TR').replace(',', '.')}`;
}

// ── Skeleton bileşenleri ────────────────────────────────────────────────────

function SkeletonStatCard() {
  return (
    <div className="rounded-lg p-5 flex items-center gap-4 border shadow-sm animate-pulse bg-slate-50 border-slate-200">
      <div className="w-10 h-10 bg-slate-200 rounded-lg flex-shrink-0" />
      <div className="space-y-2">
        <div className="h-3 w-28 bg-slate-200 rounded" />
        <div className="h-8 w-10 bg-slate-200 rounded" />
      </div>
    </div>
  );
}

function SkeletonTable() {
  return (
    <div className="bg-white shadow-sm border border-slate-200 rounded-lg overflow-hidden animate-pulse">
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <div className="h-4 w-36 bg-slate-200 rounded" />
        <div className="h-8 w-48 bg-slate-100 rounded-lg" />
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="px-6 py-4 flex items-center gap-4">
            <div className="h-3 w-28 bg-slate-100 rounded font-mono" />
            <div className="h-3 w-20 bg-slate-100 rounded" />
            <div className="h-3 w-28 bg-slate-100 rounded" />
            <div className="h-3 w-16 bg-slate-100 rounded" />
            <div className="h-3 w-24 bg-slate-100 rounded" />
            <div className="h-3 w-20 bg-slate-100 rounded ml-auto" />
            <div className="h-3 w-20 bg-slate-100 rounded" />
            <div className="h-5 w-24 bg-slate-100 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Ana bileşen ─────────────────────────────────────────────────────────────

export default function CreditApplications() {
  const [data, setData]       = useState<CreditData | null>(null);
  const [loading, setLoading]  = useState(true);
  const [error, setError]      = useState<string | null>(null);
  const [search, setSearch]    = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/credit-applications`);
      if (!res.ok) throw new Error('Sunucu beklenmedik bir hata döndürdü.');
      setData(await res.json() as CreditData);
    } catch {
      setError('Backend\'e bağlanılamadı. Lütfen API sunucusunun çalıştığını kontrol edin.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = (data?.applications ?? []).filter((a) =>
    search === '' ||
    a.Basvuru_No.toLowerCase().includes(search.toLowerCase()) ||
    a.TCKN.includes(search) ||
    a.Ad_Soyad.toLowerCase().includes(search.toLowerCase()) ||
    a.Il.toLowerCase().includes(search.toLowerCase())
  );

  const statCards = data
    ? [
        {
          label:  'Onaylanan',
          value:  data.summary.onaylanan,
          color:  'text-green-700',
          bg:     'bg-green-50',
          border: 'border-green-200',
          icon:   <CheckCircle size={20} className="text-green-600" />,
        },
        {
          label:  'Bekliyor',
          value:  data.summary.bekleyen,
          color:  'text-yellow-700',
          bg:     'bg-yellow-50',
          border: 'border-yellow-200',
          icon:   <Clock size={20} className="text-yellow-600" />,
        },
        {
          label:  'Reddedilen',
          value:  data.summary.reddedilen,
          color:  'text-red-700',
          bg:     'bg-red-50',
          border: 'border-red-200',
          icon:   <XCircle size={20} className="text-red-600" />,
        },
      ]
    : [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Kredi Başvuruları</h1>
          <p className="text-slate-500 text-sm mt-1">Aktif kredi başvurularını yönetin ve takip edin</p>
        </div>
        <div className="flex gap-2">
          {!loading && (
            <button
              onClick={fetchData}
              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <RefreshCw size={14} />
              Yenile
            </button>
          )}
          <button className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
            <Plus size={15} />
            Yeni Başvuru
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-lg px-5 py-4">
          <WifiOff size={18} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold">Bağlantı Hatası</p>
            <p className="text-sm mt-0.5 text-red-600">{error}</p>
          </div>
          <button
            onClick={fetchData}
            className="ml-auto text-xs font-semibold underline underline-offset-2 hover:text-red-800 flex-shrink-0"
          >
            Tekrar Dene
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => <SkeletonStatCard key={i} />)
          : statCards.map((c) => (
              <div
                key={c.label}
                className={`${c.bg} border ${c.border} rounded-lg p-5 flex items-center gap-4 shadow-sm`}
              >
                <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
                  {c.icon}
                </div>
                <div>
                  <p className="text-xs text-slate-500">{c.label}</p>
                  <p className={`text-3xl font-black ${c.color}`}>{c.value}</p>
                </div>
              </div>
            ))}
      </div>

      {/* Applications Table */}
      {loading ? (
        <SkeletonTable />
      ) : (
        <div className="bg-white shadow-sm border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-semibold text-slate-800">Başvuru Listesi</h2>
              <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-medium">
                {filtered.length} kayıt
              </span>
            </div>
            <div className="relative max-w-xs w-full">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Başvuru no, TCKN, çiftçi veya il ara..."
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="text-left px-6 py-3">Başvuru No</th>
                  <th className="text-left px-6 py-3">TCKN</th>
                  <th className="text-left px-6 py-3">Çiftçi Adı</th>
                  <th className="text-left px-6 py-3">İl</th>
                  <th className="text-left px-6 py-3">Kredi Türü</th>
                  <th className="text-right px-6 py-3">Tutar</th>
                  <th className="text-left px-6 py-3">Tarih</th>
                  <th className="text-left px-6 py-3">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center text-slate-400 text-sm">
                      Arama kriterine uygun başvuru bulunamadı.
                    </td>
                  </tr>
                ) : (
                  filtered.map((row) => {
                    const cfg = STATUS_CONFIG[row.Durum];
                    return (
                      <tr
                        key={row.Basvuru_No}
                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <td className="px-6 py-4 font-mono text-xs text-slate-500">{row.Basvuru_No}</td>
                        <td className="px-6 py-4 font-mono text-xs text-slate-600 tracking-wider">{row.TCKN}</td>
                        <td className="px-6 py-4 font-medium text-slate-800">{row.Ad_Soyad}</td>
                        <td className="px-6 py-4 text-slate-600">{row.Il}</td>
                        <td className="px-6 py-4 text-slate-600">{row.Kredi_Turu}</td>
                        <td className="px-6 py-4 text-right font-semibold text-slate-800">
                          {formatTutar(row.Tutar)}
                        </td>
                        <td className="px-6 py-4 text-slate-500 text-xs whitespace-nowrap">{row.Tarih}</td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.badge}`}
                          >
                            {cfg.icon}
                            {row.Durum}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
