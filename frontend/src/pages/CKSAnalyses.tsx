import { useCallback, useEffect, useState } from 'react';
import {
  FileSearch,
  Download,
  Filter,
  TrendingUp,
  CheckCircle,
  WifiOff,
  RefreshCw,
} from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000';

/**
 * DenizBank ÇKS şemasıyla birebir uyumlu interface'ler.
 * PostgreSQL prod bağlantısında tek satır değişmez.
 */

interface Summary {
  analiz_edilen:   number;
  ortalama_skor:   number;
  tamamlanan_oran: number;
}

interface Farmer {
  TCKN:        string;
  Ad_Soyad:    string;
  Il:          string;
  Urun1_Adi:   string;
  Urun1_Alan:  number;
  Kredi_Skoru: number;
  Durum:       'Onaylı' | 'İncelemede' | 'Riskli';
}

interface CKSData {
  summary: Summary;
  farmers: Farmer[];
}

// ── Alt bileşenler ──────────────────────────────────────────────────────────

const DURUM_STYLE: Record<Farmer['Durum'], string> = {
  Onaylı:      'bg-green-100 text-green-800',
  İncelemede:  'bg-yellow-100 text-yellow-800',
  Riskli:      'bg-red-100 text-red-800',
};

function StatusBadge({ status }: { status: Farmer['Durum'] }) {
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${DURUM_STYLE[status]}`}>
      {status}
    </span>
  );
}

function ScoreBar({ score }: { score: number }) {
  const color = score > 80 ? 'bg-green-500' : score >= 60 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-sm font-semibold text-slate-700 w-8 text-right">{score}</span>
    </div>
  );
}

// ── Skeleton bileşenleri ────────────────────────────────────────────────────

function SkeletonSummaryCard() {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm flex items-center gap-4 animate-pulse">
      <div className="w-10 h-10 rounded-lg bg-slate-200 flex-shrink-0" />
      <div className="space-y-2 flex-1">
        <div className="h-3 w-28 bg-slate-200 rounded" />
        <div className="h-6 w-16 bg-slate-100 rounded" />
      </div>
    </div>
  );
}

function SkeletonTable() {
  return (
    <div className="bg-white shadow-sm border border-slate-200 rounded-lg overflow-hidden animate-pulse">
      <div className="px-6 py-4 border-b border-slate-200">
        <div className="h-4 w-48 bg-slate-200 rounded" />
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="px-6 py-4 flex items-center gap-4">
            <div className="h-3 w-16 bg-slate-100 rounded" />
            <div className="h-3 w-28 bg-slate-100 rounded" />
            <div className="h-3 w-20 bg-slate-100 rounded" />
            <div className="h-3 w-14 bg-slate-100 rounded" />
            <div className="h-3 w-20 bg-slate-100 rounded" />
            <div className="h-2 flex-1 bg-slate-100 rounded-full" />
            <div className="h-5 w-20 bg-slate-100 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Ana bileşen ─────────────────────────────────────────────────────────────

export default function CKSAnalyses() {
  const [data, setData] = useState<CKSData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/cks-analyses`);
      if (!res.ok) throw new Error('Sunucu beklenmedik bir hata döndürdü.');
      setData(await res.json() as CKSData);
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
          label: 'Analiz Edilen Çiftçi',
          value: data.summary.analiz_edilen.toLocaleString('tr-TR'),
          icon: FileSearch,
          color: 'text-blue-600',
          bg: 'bg-blue-50',
        },
        {
          label: 'Ortalama ÇKS Skoru',
          value: data.summary.ortalama_skor.toFixed(1),
          icon: TrendingUp,
          color: 'text-green-600',
          bg: 'bg-green-50',
        },
        {
          label: 'Tamamlanan Analiz',
          value: `%${data.summary.tamamlanan_oran}`,
          icon: CheckCircle,
          color: 'text-purple-600',
          bg: 'bg-purple-50',
        },
      ]
    : [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">ÇKS Analizleri</h1>
          <p className="text-slate-500 text-sm mt-1">Çiftçi Kayıt Sistemi verisi tabanlı kredi analizleri</p>
        </div>
        <div className="flex gap-2">
          {!loading && (
            <button
              onClick={fetchData}
              className="flex items-center gap-2 px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <RefreshCw size={15} />
              Yenile
            </button>
          )}
          <button className="flex items-center gap-2 px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">
            <Filter size={15} />
            Filtrele
          </button>
          <button className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
            <Download size={15} />
            Dışa Aktar
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
          ? Array.from({ length: 3 }).map((_, i) => <SkeletonSummaryCard key={i} />)
          : summaryCards.map((c) => (
              <div
                key={c.label}
                className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm flex items-center gap-4"
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${c.bg}`}>
                  <c.icon size={20} className={c.color} />
                </div>
                <div>
                  <p className="text-xs text-slate-500">{c.label}</p>
                  <p className="text-2xl font-bold text-slate-900">{c.value}</p>
                </div>
              </div>
            ))}
      </div>

      {/* Table */}
      {loading ? (
        <SkeletonTable />
      ) : (
        <div className="bg-white shadow-sm border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-800">Çiftçi ÇKS Analiz Listesi</h2>
            <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-medium">
              {data?.farmers.length ?? 0} kayıt
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="text-left px-6 py-3">TCKN</th>
                <th className="text-left px-6 py-3">Ad Soyad</th>
                <th className="text-left px-6 py-3">İl</th>
                <th className="text-left px-6 py-3">Alan (ha)</th>
                <th className="text-left px-6 py-3">Ürün</th>
                <th className="text-left px-6 py-3 min-w-[160px]">Kredi Skoru</th>
                <th className="text-left px-6 py-3">Durum</th>
              </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.farmers.map((row, idx) => (
                  <tr key={`${row.TCKN}-${idx}`} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-slate-500 tracking-wider">
                      {row.TCKN}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-800">{row.Ad_Soyad}</td>
                    <td className="px-6 py-4 text-slate-600">{row.Il}</td>
                    <td className="px-6 py-4 text-slate-600 text-xs">
                      {row.Urun1_Alan.toFixed(1)} ha
                    </td>
                    <td className="px-6 py-4 text-slate-600">{row.Urun1_Adi}</td>
                    <td className="px-6 py-4">
                      <ScoreBar score={row.Kredi_Skoru} />
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={row.Durum} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
