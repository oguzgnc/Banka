import { useCallback, useEffect, useState } from 'react';
import { Sparkles, WifiOff, RefreshCw, HandCoins, Phone, History, ArrowLeft, Trash2, CheckCircle2 } from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000';
const STORAGE_KEY = 'ai_opportunities_contacted';
const DAILY_LIMIT = 15;

export interface AIOpportunity {
  TCKN: string;
  Il: string;
  Ilce: string;
  Urun1_Adi: string;
  Urun1_Alan: number;
  Onerilen_Urun: string;
  Tesvik_Skoru: number;
  Risk_Durumu: string;
  ad_soyad: string;
  ai_neden: string;
  Telefon?: string;
}

export interface ContactedCustomer {
  TCKN: string;
  ad_soyad: string;
  Telefon: string;
  teklifTarihi: string;
}

interface APIResponse {
  opportunities: AIOpportunity[];
}

function loadContactedFromStorage(): ContactedCustomer[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ContactedCustomer[];
    const list = Array.isArray(parsed) ? parsed : [];
    return list.slice(-DAILY_LIMIT); // Sadece son 15'i tut, fazlalıkları at
  } catch {
    return [];
  }
}

function saveContactedToStorage(list: ContactedCustomer[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

function SkeletonCard() {
  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm animate-pulse">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="h-5 w-32 bg-slate-200 rounded-lg" />
        <div className="h-6 w-16 bg-slate-100 rounded-lg" />
      </div>
      <div className="space-y-2 mb-4">
        <div className="h-3 w-24 bg-slate-100 rounded" />
        <div className="h-3 w-28 bg-slate-100 rounded" />
      </div>
      <div className="pt-4 border-t border-slate-100 space-y-2">
        <div className="h-3 w-36 bg-slate-100 rounded" />
        <div className="h-3 w-full bg-slate-50 rounded" />
      </div>
      <div className="mt-5 h-10 bg-slate-100 rounded-xl" />
    </div>
  );
}

export default function AIOpportunities() {
  const [data, setData] = useState<APIResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contactedCustomers, setContactedCustomers] = useState<ContactedCustomer[]>(loadContactedFromStorage);
  const [offeringTckn, setOfferingTckn] = useState<string | null>(null);
  
  // Mükemmel Çözüm: Sayfa görünümünü değiştiren State (Çekmece yerine tam sayfa)
  const [activeView, setActiveView] = useState<'main' | 'history'>('main');

  useEffect(() => {
    saveContactedToStorage(contactedCustomers);
  }, [contactedCustomers]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/ai-opportunities`);
      if (!res.ok) throw new Error('Sunucu beklenmedik bir hata döndürdü.');
      setData(await res.json() as APIResponse);
    } catch {
      setError('Backend\'e bağlanılamadı. API sunucusunun çalıştığını kontrol edin.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOffer = useCallback((opp: AIOpportunity) => {
    if (contactedCustomers.length >= DAILY_LIMIT) return;
    setOfferingTckn(opp.TCKN);
    setTimeout(() => {
      setContactedCustomers((prev) => {
        if (prev.length >= DAILY_LIMIT) return prev;
        const teklifTarihi = new Date().toLocaleString('tr-TR', {
          dateStyle: 'short',
          timeStyle: 'short',
        });
        return [
          ...prev,
          {
            TCKN: opp.TCKN,
            ad_soyad: opp.ad_soyad,
            Telefon: opp.Telefon ?? '—',
            teklifTarihi,
          },
        ];
      });
      setOfferingTckn(null);
    }, 1000);
  }, [contactedCustomers.length]);

  const clearHistory = () => {
    if (window.confirm('Tüm geçmiş teklif kayıtlarını silmek ve kotayı sıfırlamak istediğinize emin misiniz?')) {
      setContactedCustomers([]);
      localStorage.removeItem(STORAGE_KEY);
      setActiveView('main'); // Sildikten sonra ana sayfaya dön
    }
  };

  const contactedTckns = new Set(contactedCustomers.map((c) => c.TCKN));
  const visibleOpportunities = (data?.opportunities ?? []).filter(
    (opp) => !contactedTckns.has(opp.TCKN)
  );
  
  const quotaReached = contactedCustomers.length >= DAILY_LIMIT;
  const quotaDisplay = Math.min(contactedCustomers.length, DAILY_LIMIT);
  const allProcessed = !loading && (data?.opportunities?.length ?? 0) > 0 && visibleOpportunities.length === 0;
  const matchPct = (skor: number) => Math.min(99, Math.round(skor * 10));

  // --- EKRAN 1: GEÇMİŞ TEKLİFLER SAYFASI (Drawer İptal Edildi) ---
  if (activeView === 'history') {
    return (
      <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveView('main')}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <History size={22} className="text-slate-500" />
                Geçmiş Teklifler
              </h2>
              <p className="text-sm text-slate-500 mt-1">Daha önce teklif sunduğunuz müşteriler</p>
            </div>
          </div>
          <button
            onClick={clearHistory}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-semibold rounded-xl transition-colors cursor-pointer"
          >
            <Trash2 size={16} />
            Listeyi Temizle
          </button>
        </div>

        {contactedCustomers.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center shadow-sm">
            <History size={48} className="mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-800">Henüz teklif kaydı yok</h3>
            <p className="text-slate-500 mt-2">Teklif sunduğunuz müşteriler burada listelenir.</p>
            <button
              onClick={() => setActiveView('main')}
              className="mt-6 px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-colors cursor-pointer"
            >
              Fırsatlara Göz At
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {contactedCustomers.slice().reverse().map((c, i) => (
              <div key={`${c.TCKN}-${i}`} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-bold text-slate-800 text-lg">{c.ad_soyad}</h3>
                  <span className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg">
                    <CheckCircle2 size={16} />
                  </span>
                </div>
                <div className="space-y-2 mt-4 pt-4 border-t border-slate-100">
                  <p className="flex items-center gap-2 text-slate-600 text-sm">
                    <Phone size={16} className="text-slate-400" />
                    <span className="font-medium">{c.Telefon}</span>
                  </p>
                  <p className="flex items-center gap-2 text-slate-500 text-sm">
                    <History size={16} className="text-slate-400" />
                    {c.teklifTarihi}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // --- EKRAN 2: ANA FIRSATLAR SAYFASI ---
  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10">
              <Sparkles size={20} className="text-amber-600" />
            </span>
            Yapay Zeka Fırsatları
          </h1>
          <p className="text-slate-500 text-sm mt-1.5">
            En düşük riskli, yüksek karlılık potansiyelli çiftçiler — AI ile önceliklendirildi
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 shadow-sm text-slate-700 text-sm font-medium">
            Günlük Kota
            <span className={`font-bold px-2 py-0.5 rounded-md ${quotaReached ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-900'}`}>
              {quotaDisplay} / {DAILY_LIMIT}
            </span>
          </span>
          <button
            onClick={() => setActiveView('history')}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
          >
            <History size={16} />
            Geçmiş Teklifler
            {contactedCustomers.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-md bg-slate-800 text-white text-xs font-bold">
                {contactedCustomers.length}
              </span>
            )}
          </button>
          {!loading && !quotaReached && (
            <button
              onClick={fetchData}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-800 rounded-xl hover:bg-slate-700 transition-colors shadow-sm cursor-pointer"
            >
              <RefreshCw size={16} />
              Yenile
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/80 px-5 py-4 text-red-700">
          <WifiOff size={18} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold">Bağlantı hatası</p>
            <p className="text-sm mt-0.5 text-red-600">{error}</p>
          </div>
          <button onClick={fetchData} className="ml-auto text-xs font-semibold underline hover:text-red-800 cursor-pointer">
            Tekrar dene
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : quotaReached ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 bg-white rounded-3xl border border-slate-200 shadow-sm mt-6">
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mb-6">
            <CheckCircle2 size={40} className="text-emerald-600" />
          </div>
          <h2 className="text-3xl font-bold text-slate-900 mb-3">Harika İş Çıkardınız!</h2>
          <p className="text-slate-500 text-lg text-center max-w-md">
            Bugünkü VIP müşteri arama kotanızı ({DAILY_LIMIT}/{DAILY_LIMIT}) başarıyla doldurdunuz. 
          </p>
          <button
            onClick={() => setActiveView('history')}
            className="mt-8 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-xl transition-colors cursor-pointer"
          >
            Geçmiş Teklifleri İncele
          </button>
        </div>
      ) : allProcessed ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-16 text-center mt-6 shadow-sm">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mb-5">
            <Sparkles size={32} className="text-amber-600" />
          </div>
          <p className="text-xl font-bold text-slate-800">Bu setteki fırsatlar değerlendirildi</p>
          <p className="text-slate-500 mt-2">Yeni potansiyel müşteriler için verileri tazeleyin.</p>
          <button
            onClick={fetchData}
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium transition-colors cursor-pointer"
          >
            <RefreshCw size={18} />
            Yeni Fırsatları Getir
          </button>
        </div>
      ) : data?.opportunities?.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-16 text-center mt-6 shadow-sm">
          <Sparkles size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-lg font-medium text-slate-700">Bu kriterlere uygun fırsat bulunamadı.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          {visibleOpportunities.map((opp, idx) => {
            const isOffering = offeringTckn === opp.TCKN;
            return (
              <div key={`${opp.TCKN}-${idx}`} className="group bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex flex-col">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <h3 className="text-lg font-bold text-slate-900 truncate flex-1">{opp.ad_soyad}</h3>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-sm font-bold shrink-0">
                    <Sparkles size={14} /> %{matchPct(opp.Tesvik_Skoru)}
                  </span>
                </div>
                <p className="text-sm text-slate-600 mb-2 flex items-center gap-2">
                  <Phone size={14} className="text-slate-400" />
                  <span className="font-semibold text-slate-700">{opp.Telefon ?? '—'}</span>
                </p>
                <p className="text-sm text-slate-500 mb-4 pb-4 border-b border-slate-100">
                  {opp.Il} / {opp.Ilce} · {opp.Urun1_Adi} ({opp.Urun1_Alan} ha)
                </p>
                <div className="flex-1">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Yapay Zeka Analizi</h4>
                  <p className="text-sm text-slate-600 leading-relaxed">{opp.ai_neden}</p>
                </div>
                <button
                  onClick={() => handleOffer(opp)}
                  disabled={isOffering || quotaReached}
                  className="mt-6 w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-bold transition-colors cursor-pointer"
                >
                  {isOffering ? 'İşleniyor...' : <><HandCoins size={18} /> Teklifi Kaydet</>}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}