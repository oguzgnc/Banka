import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, TrendingDown, ShieldCheck, Info, WifiOff, RefreshCw } from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000';

type RiskLevel = 'Yüksek' | 'Orta' | 'Düşük';

interface RiskSummary {
  high_risk_count: number;
  medium_risk_count: number;
  low_risk_count: number;
  total_affected: number;
}

interface RiskRegion {
  bolge: string;
  risk_seviyesi: RiskLevel;
  risk_nedeni: string;
  etkilenen_ciftci: number;
  degisim: string;
}

interface RiskMapData {
  summary: RiskSummary;
  regions: RiskRegion[];
}

// ── Sabit konfigürasyonlar ──────────────────────────────────────────────────

const LEVEL_CONFIG: Record<RiskLevel, { badge: string; dot: string; icon: React.ReactNode }> = {
  Yüksek: {
    badge: 'bg-red-100 text-red-800',
    dot:   'bg-red-500',
    icon:  <AlertTriangle size={14} className="text-red-500" />,
  },
  Orta: {
    badge: 'bg-yellow-100 text-yellow-800',
    dot:   'bg-yellow-500',
    icon:  <Info size={14} className="text-yellow-500" />,
  },
  Düşük: {
    badge: 'bg-green-100 text-green-800',
    dot:   'bg-green-500',
    icon:  <ShieldCheck size={14} className="text-green-600" />,
  },
};

// ── Skeleton bileşenleri ────────────────────────────────────────────────────

function SkeletonSummaryCard() {
  return (
    <div className="rounded-lg p-5 flex items-center gap-4 border animate-pulse bg-slate-50 border-slate-200">
      <div className="h-10 w-10 bg-slate-200 rounded" />
      <div className="h-4 w-32 bg-slate-200 rounded" />
    </div>
  );
}

function SkeletonTable() {
  return (
    <div className="bg-white shadow-sm border border-slate-200 rounded-lg overflow-hidden animate-pulse">
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <div className="h-4 w-36 bg-slate-200 rounded" />
        <div className="h-3 w-48 bg-slate-100 rounded" />
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="px-6 py-4 flex items-center gap-4">
            <div className="h-3 w-40 bg-slate-100 rounded" />
            <div className="h-5 w-20 bg-slate-100 rounded-full" />
            <div className="h-3 flex-1 bg-slate-100 rounded" />
            <div className="h-3 w-16 bg-slate-100 rounded" />
            <div className="h-3 w-12 bg-slate-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Ana bileşen ─────────────────────────────────────────────────────────────

export default function RiskMap() {
  const [data, setData] = useState<RiskMapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/risk-map`);
      if (!res.ok) throw new Error('Sunucu beklenmedik bir hata döndürdü.');
      setData(await res.json() as RiskMapData);
    } catch {
      setError('Backend\'e bağlanılamadı. Lütfen API sunucusunun çalıştığını kontrol edin.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const summaryCards = data
    ? [
        {
          label:  'Yüksek Riskli Bölge',
          value:  data.summary.high_risk_count,
          color:  'text-red-600',
          bg:     'bg-red-50',
          border: 'border-red-200',
        },
        {
          label:  'Orta Riskli Bölge',
          value:  data.summary.medium_risk_count,
          color:  'text-yellow-600',
          bg:     'bg-yellow-50',
          border: 'border-yellow-200',
        },
        {
          label:  'Düşük Riskli Bölge',
          value:  data.summary.low_risk_count,
          color:  'text-green-600',
          bg:     'bg-green-50',
          border: 'border-green-200',
        },
      ]
    : [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Risk Haritası</h1>
          <p className="text-slate-500 text-sm mt-1">Bölgesel tarımsal risk değerlendirmesi ve analizi</p>
        </div>
        {!loading && (
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <RefreshCw size={14} />
            Yenile
          </button>
        )}
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
          ? Array.from({ length: 3 }).map((_, i) => <SkeletonSummaryCard key={i} />)
          : summaryCards.map((c) => (
              <div
                key={c.label}
                className={`${c.bg} border ${c.border} rounded-lg p-5 flex items-center gap-4`}
              >
                <p className={`text-4xl font-black ${c.color}`}>{c.value}</p>
                <p className="text-sm font-medium text-slate-700">{c.label}</p>
              </div>
            ))}
      </div>

      {/* Risk Table */}
      {loading ? (
        <SkeletonTable />
      ) : (
        <div className="bg-white shadow-sm border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-800">Risk Bölge Listesi</h2>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <TrendingDown size={13} className="text-green-500" />
              <span>
                Toplam etkilenen:{' '}
                <strong className="text-slate-700">
                  {data?.summary.total_affected.toLocaleString('tr-TR')}
                </strong>{' '}
                çiftçi
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="text-left px-6 py-3">Bölge</th>
                  <th className="text-left px-6 py-3">Risk Seviyesi</th>
                  <th className="text-left px-6 py-3">Risk Nedeni</th>
                  <th className="text-right px-6 py-3">Etkilenen Çiftçi</th>
                  <th className="text-right px-6 py-3">Değişim</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.regions.map((row) => {
                  const cfg = LEVEL_CONFIG[row.risk_seviyesi];
                  const isRising = row.degisim.startsWith('+');
                  return (
                    <tr key={row.bolge} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-800">{row.bolge}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {row.risk_seviyesi}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{row.risk_nedeni}</td>
                      <td className="px-6 py-4 text-right text-slate-700 font-medium">
                        {row.etkilenen_ciftci.toLocaleString('tr-TR')}
                      </td>
                      <td className={`px-6 py-4 text-right text-xs font-semibold ${isRising ? 'text-red-600' : 'text-green-600'}`}>
                        {row.degisim}
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
