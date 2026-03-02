import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  FileSearch,
  Download,
  Filter,
  TrendingUp,
  CheckCircle,
  WifiOff,
  RefreshCw,
  Plus,
  X,
  MapPin,
  Sprout,
  Layers,
  Brain,
  UploadCloud,
} from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000';

const ILLER = [
  'Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Aksaray', 'Amasya', 'Ankara',
  'Antalya', 'Ardahan', 'Artvin', 'Aydın', 'Balıkesir', 'Bartın', 'Batman', 'Bayburt',
  'Bilecik', 'Bingöl', 'Bitlis', 'Bolu', 'Burdur', 'Bursa', 'Çanakkale', 'Çankırı',
  'Çorum', 'Denizli', 'Diyarbakır', 'Düzce', 'Edirne', 'Elazığ', 'Erzincan', 'Erzurum',
  'Eskişehir', 'Gaziantep', 'Giresun', 'Gümüşhane', 'Hakkari', 'Hatay', 'Iğdır',
  'Isparta', 'İstanbul', 'İzmir', 'Kahramanmaraş', 'Karabük', 'Karaman', 'Kars',
  'Kastamonu', 'Kayseri', 'Kilis', 'Kırıkkale', 'Kırklareli', 'Kırşehir', 'Kocaeli',
  'Konya', 'Kütahya', 'Malatya', 'Manisa', 'Mardin', 'Mersin', 'Muğla', 'Muş',
  'Nevşehir', 'Niğde', 'Ordu', 'Osmaniye', 'Rize', 'Sakarya', 'Samsun', 'Siirt',
  'Sinop', 'Sivas', 'Şanlıurfa', 'Şırnak', 'Tekirdağ', 'Tokat', 'Trabzon', 'Tunceli',
  'Uşak', 'Van', 'Yalova', 'Yozgat', 'Zonguldak',
];

const URUNLER = [
  'Mısır', 'Buğday', 'Pamuk', 'Arpa', 'Ayçiçeği', 'Şeker Pancarı', 'Yonca', 'Pirinç',
  'Mercimek', 'Nohut', 'Haşhaş', 'Patates', 'Fındık', 'Zeytin', 'Üzüm Bağı', 'İncir', 'Fıstık',
];

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
  id?: number;
  TCKN:         string;
  ad_soyad:     string;
  Il:           string;
  Urun1_Adi:    string;
  Urun1_Alan:   number;
  Onerilen_Urun?: string;
  Tesvik_Skoru: number;
  Risk_Durumu?: string;
  Durum:        string;
}

interface MarketTrend {
  id: number;
  urun_adi: string;
  etki_puani: number;
  aciklama: string;
}

function normalizeUrun(value: string): string {
  return value.trim().toLocaleLowerCase('tr-TR');
}

/**
 * Çiftçinin skoru, ili ve ürününe göre Yapay Zeka karar özeti metni üretir (XAI).
 */
function generateAIReasoning(farmer: Farmer): string {
  const krediSkoru = Math.round((farmer.Tesvik_Skoru ?? 0) * 10);
  const { Il, Urun1_Adi, Durum } = farmer;
  if (Durum === 'Riskli' || Durum === 'Reddedildi') {
    if (Durum === 'Reddedildi') {
      return `Bu başvuru kredi onayına uygun görülmedi. ${Il} bölgesinde ${Urun1_Adi} ekimi model tarafından yüksek riskli değerlendirildi.`;
    }
    return `${Il} bölgesinde ${Urun1_Adi} ekimi su stresi ve iklim koşulları sebebiyle yüksek temerrüt (ödememe) riski taşıyor. Modelimiz bu başvuruyu riskli buldu.`;
  }
  if (Durum === 'İncelemede') {
    return `${Il} bölgesinde ${Urun1_Adi} üretimi orta risk sınıfında. Ek belge veya tarla ziyareti ile skor netleştirilebilir.`;
  }
  return `Bölge toprak analizi ve pazar talebi ${Urun1_Adi} için uygun. Yüksek karlılık ve geri ödeme potansiyeli tespit edildi (skor: ${krediSkoru}).`;
}

// ── Alt bileşenler ──────────────────────────────────────────────────────────

const DURUM_STYLE: Record<string, string> = {
  Onaylı:      'bg-green-100 text-green-800',
  Onaylandı:   'bg-green-100 text-green-800',
  İncelemede:  'bg-yellow-100 text-yellow-800',
  Riskli:      'bg-red-100 text-red-800',
  Reddedildi:  'bg-red-100 text-red-800',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${DURUM_STYLE[status] ?? 'bg-slate-100 text-slate-700'}`}>
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

const formInitial = {
  ad_soyad: '',
  TCKN: '',
  Il: '',
  Urun1_Adi: '',
  Urun1_Alan: '',
};

export default function CKSAnalyses() {
  // 1. Sadece useState tanımlamaları
  const [data, setData] = useState<Farmer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });
  const [selectedFarmer, setSelectedFarmer] = useState<Farmer | null>(null);
  const [marketTrends, setMarketTrends] = useState<MarketTrend[]>([]);
  const [form, setForm] = useState(formInitial);
  const [bulkUploading, setBulkUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // 2. fetchData (diğer callback'lerden önce tanımlanmalı)
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/cks-analyses`);
      if (!res.ok) throw new Error('Sunucu beklenmedik bir hata döndürdü.');
      setData(await res.json());
    } catch {
      setError('Backend\'e bağlanılamadı. Lütfen API sunucusunun çalıştığını kontrol edin.');
    } finally {
      setLoading(false);
    }
  }, []);

  // 3. fetchData'yı çağıran useEffect (hemen sonra)
  useEffect(() => { fetchData(); }, [fetchData]);

  const fetchMarketTrends = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/market-trends`);
      if (!res.ok) return;
      setMarketTrends(await res.json() as MarketTrend[]);
    } catch {
      // Piyasa etkisi özeti opsiyonel; hata durumunda ana ekran akışı devam etsin.
    }
  }, []);

  useEffect(() => {
    fetchMarketTrends();
  }, [fetchMarketTrends]);

  // 4. Yardımcı callback'ler (fetchData artık tanımlı)
  const showToast = useCallback((message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), 4000);
  }, []);

  const handleStatusUpdate = useCallback(async (tckn: string, yeniDurum: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/applications/${encodeURIComponent(tckn)}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durum: yeniDurum }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Güncelleme başarısız.');
      }
      setSelectedFarmer(null);
      await fetchData();
      showToast('Durum güncellendi.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Bağlantı hatası.');
    }
  }, [fetchData, showToast]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_BASE}/api/applications/bulk-upload`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Yükleme başarısız.');
      }
      const result = (await res.json()) as { eklenen?: number };
      const count = result.eklenen ?? 0;
      showToast(`${count} kayıt başarıyla analiz edildi ve veritabanına eklendi.`);
      await fetchData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Bağlantı hatası.');
    } finally {
      setBulkUploading(false);
      e.target.value = '';
    }
  }, [fetchData, showToast]);

  const handleNewApplicationSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const tckn = form.TCKN.replace(/\D/g, '');
    if (tckn.length !== 11) {
      showToast('TCKN 11 haneli olmalıdır.');
      return;
    }
    const alan = Number(form.Urun1_Alan);
    if (!form.Il || !form.Urun1_Adi || !form.ad_soyad || Number.isNaN(alan) || alan <= 0) {
      showToast('Tüm alanları doldurun; alan (ha) 0\'dan büyük olmalıdır.');
      return;
    }
    setFormLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          TCKN: tckn,
          ad_soyad: form.ad_soyad.trim(),
          Il: form.Il,
          Urun1_Adi: form.Urun1_Adi,
          Urun1_Alan: alan,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'İstek başarısız.');
      }
      setShowNewModal(false);
      setForm({ ad_soyad: '', TCKN: '', Il: '', Urun1_Adi: '', Urun1_Alan: '' });
      showToast('Analiz başarıyla eklendi. Yeni kayıt tablonun en üstünde.');
      await fetchData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Bağlantı hatası.');
    } finally {
      setFormLoading(false);
    }
  }, [form, fetchData, showToast]);

  const totalAnalyzed = data.length;
  const avgScore = data.length > 0
    ? data.reduce((acc, f) => acc + (f.Tesvik_Skoru ?? 0) * 10, 0) / data.length
    : 0;
  const tamamlananOran = 92; // statik (backend summary dönmüyor)

  const summaryCards = !loading
    ? [
        {
          label: 'Analiz Edilen Çiftçi',
          value: totalAnalyzed.toLocaleString('tr-TR'),
          icon: FileSearch,
          color: 'text-blue-600',
          bg: 'bg-blue-50',
        },
        {
          label: 'Ortalama ÇKS Skoru',
          value: avgScore.toFixed(1),
          icon: TrendingUp,
          color: 'text-green-600',
          bg: 'bg-green-50',
        },
        {
          label: 'Tamamlanan Analiz',
          value: `%${tamamlananOran}`,
          icon: CheckCircle,
          color: 'text-purple-600',
          bg: 'bg-purple-50',
        },
      ]
    : [];

  const marketTrendMap = useMemo(() => {
    const out: Record<string, MarketTrend> = {};
    for (const trend of marketTrends) {
      out[normalizeUrun(trend.urun_adi)] = trend;
    }
    return out;
  }, [marketTrends]);

  const selectedTrend = selectedFarmer
    ? marketTrendMap[normalizeUrun(selectedFarmer.Urun1_Adi)]
    : undefined;

  const handleDownloadPDF = useCallback(async () => {
    if (!selectedFarmer) return;
    const element = modalRef.current;
    if (!element) {
      showToast('PDF oluşturulamadı: modal içeriği bulunamadı.');
      return;
    }

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.8);
      const pdf = new jsPDF('p', 'mm', 'a4');

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const usableWidth = pdfWidth - margin * 2;
      const imgHeight = (canvas.height * usableWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = margin;

      pdf.addImage(imgData, 'JPEG', margin, position, usableWidth, imgHeight);
      heightLeft -= (pdfHeight - margin * 2);

      while (heightLeft > 0) {
        pdf.addPage();
        position = margin - (imgHeight - heightLeft);
        pdf.addImage(imgData, 'JPEG', margin, position, usableWidth, imgHeight);
        heightLeft -= (pdfHeight - margin * 2);
      }

      pdf.save(`Kredi_Raporu_${selectedFarmer.TCKN}.pdf`);
    } catch {
      showToast('PDF oluşturulurken bir hata oluştu.');
    }
  }, [selectedFarmer, showToast]);

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
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={handleFileUpload}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={bulkUploading}
            className="flex items-center gap-2 px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-70 disabled:cursor-wait transition-colors shadow-sm"
          >
            <UploadCloud size={15} />
            {bulkUploading ? 'Yükleniyor...' : 'Toplu Yükle (Excel/CSV)'}
          </button>
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
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
              {data.length} kayıt
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
                {data.map((row, idx) => (
                  <tr
                    key={`${row.TCKN}-${idx}`}
                    onClick={() => setSelectedFarmer(row)}
                    className="cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-6 py-4 font-mono text-xs text-slate-500 tracking-wider">
                      {row.TCKN}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-800">{row.ad_soyad}</td>
                    <td className="px-6 py-4 text-slate-600">{row.Il}</td>
                    <td className="px-6 py-4 text-slate-600 text-xs">
                      {Number(row.Urun1_Alan).toFixed(1)} ha
                    </td>
                    <td className="px-6 py-4 text-slate-600">{row.Urun1_Adi}</td>
                    <td className="px-6 py-4">
                      <ScoreBar score={Math.round((row.Tesvik_Skoru ?? 0) * 10)} />
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

      {/* Yapay Zeka Risk Karnesi Modal */}
      {selectedFarmer && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0"
            onClick={() => setSelectedFarmer(null)}
            aria-hidden
          />
          <div ref={modalRef} className="relative z-10 w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-200 bg-slate-50/80 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{selectedFarmer.ad_soyad}</h2>
                <p className="text-sm font-mono text-slate-500 mt-0.5">TCKN: {selectedFarmer.TCKN}</p>
              </div>
              <div
                className={`flex-shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold ${
                  (() => {
                    const krediSkoru = Math.round((selectedFarmer.Tesvik_Skoru ?? 0) * 10);
                    return krediSkoru > 80
                      ? 'bg-green-100 text-green-800'
                      : krediSkoru >= 60
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800';
                  })()
                }`}
              >
                {Math.round((selectedFarmer.Tesvik_Skoru ?? 0) * 10)}
              </div>
              <button
                type="button"
                onClick={() => setSelectedFarmer(null)}
                className="p-2 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors -mr-2 -mt-1"
                aria-label="Kapat"
              >
                <X size={20} />
              </button>
            </div>

            {/* Orta: 2 kolon */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
              {/* Sol: Mevcut Durum */}
              <div>
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Mevcut Durum</h3>
                <ul className="space-y-3">
                  <li className="flex items-center gap-3 text-slate-700">
                    <span className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
                      <MapPin size={18} className="text-slate-600" />
                    </span>
                    <span><strong className="text-slate-500">İl:</strong> {selectedFarmer.Il}</span>
                  </li>
                  <li className="flex items-center gap-3 text-slate-700">
                    <span className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
                      <Sprout size={18} className="text-slate-600" />
                    </span>
                    <span><strong className="text-slate-500">Mevcut Ürün:</strong> {selectedFarmer.Urun1_Adi}</span>
                  </li>
                  <li className="flex items-center gap-3 text-slate-700">
                    <span className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
                      <Layers size={18} className="text-slate-600" />
                    </span>
                    <span><strong className="text-slate-500">Alan:</strong> {Number(selectedFarmer.Urun1_Alan).toFixed(1)} ha</span>
                  </li>
                </ul>
              </div>
              {/* Sağ: Yapay Zeka Önerisi */}
              <div>
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Yapay Zeka Önerisi</h3>
                {selectedFarmer.Onerilen_Urun &&
                 selectedFarmer.Onerilen_Urun.trim() !== '' &&
                 !/öneri analiz sonrası|belirlenecek/i.test(selectedFarmer.Onerilen_Urun) ? (
                  <div className="rounded-xl bg-green-50 border border-green-200 p-4 mb-4">
                    <p className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-1">Önerilen Ürün</p>
                    <p className="text-lg font-bold text-green-800">{selectedFarmer.Onerilen_Urun}</p>
                  </div>
                ) : (
                  <div className="rounded-xl bg-green-50 border border-green-200 p-4 mb-4">
                    <p className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-1">Öneri</p>
                    <p className="text-lg font-bold text-green-800">Mevcut Üretime Devam</p>
                  </div>
                )}
                <div className="flex gap-2 text-slate-700">
                  <Brain size={18} className="flex-shrink-0 mt-0.5 text-slate-500" />
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Yapay Zeka Karar Özeti</p>
                    {selectedTrend && selectedTrend.aciklama?.trim() && selectedTrend.etki_puani !== 0 && (
                      <p className="text-sm leading-relaxed mb-2">
                        <strong>[Piyasa Etkisi: {selectedTrend.etki_puani > 0 ? `+${selectedTrend.etki_puani.toFixed(1)}` : selectedTrend.etki_puani.toFixed(1)}]</strong>{' '}
                        {selectedTrend.aciklama}
                      </p>
                    )}
                    <p className="text-sm leading-relaxed">{generateAIReasoning(selectedFarmer)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Alt: Aksiyon butonları */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/50 flex flex-wrap gap-3 justify-between items-center">
              <button
                type="button"
                onClick={handleDownloadPDF}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                PDF İndir
              </button>
              <div className="flex flex-wrap gap-3 justify-end">
              <button
                type="button"
                onClick={() => handleStatusUpdate(selectedFarmer.TCKN, 'Reddedildi')}
                className="px-4 py-2.5 rounded-xl bg-red-100 text-red-700 font-medium hover:bg-red-200 transition-colors"
              >
                Krediyi Reddet
              </button>
              <button
                type="button"
                onClick={() => handleStatusUpdate(selectedFarmer.TCKN, 'İncelemede')}
                className="px-4 py-2.5 rounded-xl bg-yellow-100 text-yellow-800 font-medium hover:bg-yellow-200 transition-colors"
              >
                Ek İnceleme İste
              </button>
              <button
                type="button"
                onClick={() => handleStatusUpdate(selectedFarmer.TCKN, 'Onaylandı')}
                className="px-4 py-2.5 rounded-xl bg-green-600 text-white font-medium hover:bg-green-700 transition-colors"
              >
                Krediyi Onayla
              </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast.visible && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-4 py-3 bg-slate-900 text-white text-sm font-medium rounded-xl shadow-lg">
          {toast.message}
        </div>
      )}

      {/* Yeni Başvuru Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => !formLoading && setShowNewModal(false)}
          />
          <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80">
              <h2 className="text-lg font-semibold text-slate-900">Yeni Başvuru — Yapay Zeka Analizi</h2>
              <button
                type="button"
                onClick={() => !formLoading && setShowNewModal(false)}
                className="p-2 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors"
                aria-label="Kapat"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleNewApplicationSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Ad Soyad</label>
                <input
                  type="text"
                  value={form.ad_soyad}
                  onChange={(e) => setForm((f) => ({ ...f, ad_soyad: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Örn: Ahmet Yılmaz"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">TCKN (11 hane)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={11}
                  value={form.TCKN}
                  onChange={(e) => setForm((f) => ({ ...f, TCKN: e.target.value.replace(/\D/g, '').slice(0, 11) }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="12345678901"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">İl</label>
                <select
                  value={form.Il}
                  onChange={(e) => setForm((f) => ({ ...f, Il: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                >
                  <option value="">İl seçin</option>
                  {ILLER.map((il) => (
                    <option key={il} value={il}>{il}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Ürün Adı</label>
                <select
                  value={form.Urun1_Adi}
                  onChange={(e) => setForm((f) => ({ ...f, Urun1_Adi: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                >
                  <option value="">Ürün seçin</option>
                  {URUNLER.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Alan (hektar)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={form.Urun1_Alan}
                  onChange={(e) => setForm((f) => ({ ...f, Urun1_Alan: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Örn: 12.5"
                  required
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => !formLoading && setShowNewModal(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-70 disabled:cursor-wait transition-colors font-medium"
                >
                  {formLoading ? 'Analiz ediliyor...' : 'Yapay Zeka ile Analiz Et'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
