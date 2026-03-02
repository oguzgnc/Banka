import { useCallback, useEffect, useState } from 'react';
import { Users, FileText, AlertTriangle, RefreshCw, WifiOff } from 'lucide-react';
import KPICard from '../components/KPICard';
import TurkeyMap from '../components/TurkeyMap';
import CropTrendsChart from '../components/CropTrendsChart';
import RecommendationsTable from '../components/RecommendationsTable';

const API_BASE = 'http://127.0.0.1:8000';

interface Farmer {
  id?: number;
  TCKN: string;
  ad_soyad: string;
  Il: string;
  Urun1_Adi: string;
  Urun1_Alan: number;
  Onerilen_Urun?: string;
  Tesvik_Skoru: number;
  Risk_Durumu?: string;
  Durum: string;
}

function SkeletonCard() {
  return (
    <div className="bg-white shadow-sm border border-slate-200 rounded-lg p-6 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-3 w-32 bg-slate-200 rounded" />
          <div className="h-8 w-20 bg-slate-200 rounded" />
        </div>
        <div className="w-12 h-12 bg-slate-200 rounded-lg" />
      </div>
      <div className="mt-4 h-3 w-24 bg-slate-200 rounded" />
    </div>
  );
}

function SkeletonMap() {
  return (
    <div className="bg-white shadow-sm border border-slate-200 rounded-lg p-6 animate-pulse h-full">
      <div className="mb-4 flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-4 w-40 bg-slate-200 rounded" />
          <div className="h-3 w-32 bg-slate-100 rounded" />
        </div>
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-3 w-12 bg-slate-100 rounded" />)}
        </div>
      </div>
      <div className="flex-1 bg-slate-100 rounded-lg min-h-[320px]" />
    </div>
  );
}

function SkeletonChart() {
  return (
    <div className="bg-white shadow-sm border border-slate-200 rounded-lg p-6 animate-pulse h-full">
      <div className="mb-4 space-y-2">
        <div className="h-4 w-40 bg-slate-200 rounded" />
        <div className="h-3 w-56 bg-slate-100 rounded" />
      </div>
      <div className="h-[300px] bg-slate-100 rounded-lg flex items-end gap-2 px-4 pb-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 bg-slate-200 rounded-t"
            style={{ height: `${40 + i * 12}%` }}
          />
        ))}
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
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="px-6 py-4 flex gap-6">
            <div className="h-3 w-32 bg-slate-100 rounded" />
            <div className="h-3 w-24 bg-slate-100 rounded" />
            <div className="h-3 w-28 bg-slate-100 rounded" />
            <div className="h-3 w-10 bg-slate-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<Farmer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/cks-analyses`);

      if (!res.ok) throw new Error('Sunucu beklenmedik bir hata döndürdü.');

      setData(await res.json() as Farmer[]);
    } catch {
      setError('Backend\'e bağlanılamadı. Lütfen API sunucusunun çalıştığını kontrol edin.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toplamCiftci = data.length;
  const bekleyenKredi = data.filter((d) => d.Durum === 'İncelemede').length;
  const yuksekRiskli = data.filter((d) => d.Durum === 'Riskli' || d.Durum === 'Reddedildi').length;

  const kpiCards = [
        {
          title: 'Toplam Çiftçi Sayısı',
          value: toplamCiftci.toLocaleString('tr-TR'),
          change: 12,
          changeLabel: 'geçen aya göre',
          icon: Users,
          iconColor: 'text-green-700',
          iconBg: 'bg-green-100',
        },
        {
          title: 'Bekleyen Kredi Başvurusu',
          value: bekleyenKredi.toLocaleString('tr-TR'),
          change: -8,
          changeLabel: 'geçen aya göre',
          icon: FileText,
          iconColor: 'text-blue-700',
          iconBg: 'bg-blue-100',
        },
        {
          title: 'Yüksek Riskli Başvuru',
          value: yuksekRiskli.toLocaleString('tr-TR'),
          change: -5,
          changeLabel: 'geçen aya göre',
          icon: AlertTriangle,
          iconColor: 'text-orange-700',
          iconBg: 'bg-orange-100',
        },
      ];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gösterge Paneli</h1>
          <p className="text-slate-500 text-sm mt-1">
            Tarımsal kredi portföyünüzün güncel özeti — Şubat 2026
          </p>
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
          : kpiCards.map((card) => <KPICard key={card.title} {...card} />)}
      </div>

      {/* Map + Chart */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div style={{ minHeight: '400px' }} className="flex">
          <div className="flex-1">
            {loading ? <SkeletonMap /> : <TurkeyMap data={data} />}
          </div>
        </div>
        <div style={{ minHeight: '400px' }} className="flex">
          <div className="flex-1">
            {loading ? <SkeletonChart /> : <CropTrendsChart data={data} />}
          </div>
        </div>
      </div>

      {/* Recommendations Table */}
      {loading ? (
        <SkeletonTable />
      ) : (
        <RecommendationsTable data={data} />
      )}
    </div>
  );
}
