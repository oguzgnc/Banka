/**
 * TurkeyMap — 81 il interaktif Türkiye haritası
 * ---------------------------------------------
 * DB'den gelen çiftçi verisine göre il bazlı durum dağılımı gösterir.
 * Tooltip konumu useRef ile güncellenir — mousemove'da setState yok, kasma önlenir.
 */

import { useMemo, useRef, useState } from 'react';
// @ts-expect-error - react-simple-maps has no types
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';

const TOOLTIP_OFFSET = 12;

type RiskLabel = 'Onaylı' | 'İncelemede' | 'Riskli' | 'Veri Yok';

const RISK_BADGE: Record<RiskLabel, string> = {
  Onaylı: 'bg-green-500',
  İncelemede: 'bg-yellow-500',
  Riskli: 'bg-red-500',
  'Veri Yok': 'bg-slate-400',
};

interface FarmerMapRecord {
  Il: string;
  Durum: string;
}

interface Props {
  data: FarmerMapRecord[];
}

/** Türkçe karakterleri İngilizce karşılıklarına çevirip küçük harf yapar; API–GeoJSON eşleştirmesi için. */
function normalizeName(name: string): string {
  const trToEn: Record<string, string> = {
    ğ: 'g', Ğ: 'g', ü: 'u', Ü: 'u', ş: 's', Ş: 's', ı: 'i', I: 'i', İ: 'i',
    ö: 'o', Ö: 'o', ç: 'c', Ç: 'c',
  };
  return name
    .split('')
    .map((c) => trToEn[c] ?? c)
    .join('')
    .toLowerCase();
}

/** GeoJSON'daki bazı özel yazımlar → normalize edilmiş lookup key. */
const GEO_ALIAS: Record<string, string> = {
  'k. maras': normalizeName('Kahramanmaraş'),   // kahramanmaras
  kinkkale:   normalizeName('Kırıkkale'),      // kirikkale
  zinguldak:  normalizeName('Zonguldak'),      // zonguldak
};

const RISK_FILL: Record<'Onaylı' | 'İncelemede' | 'Riskli', string> = {
  Onaylı: '#22c55e',
  İncelemede: '#eab308',
  Riskli: '#ef4444',
};

const UNMONITORED_FILL = '#e2e8f0';

const GEO_URL = '/turkey-provinces.json';

function lookupKey(geoName: string): string {
  const n = normalizeName(geoName);
  return GEO_ALIAS[n] ?? n;
}

function normalizeDurum(durum: string): 'Onaylı' | 'İncelemede' | 'Riskli' | null {
  if (durum === 'Onaylı' || durum === 'Onaylandı') return 'Onaylı';
  if (durum === 'İncelemede') return 'İncelemede';
  if (durum === 'Riskli' || durum === 'Reddedildi') return 'Riskli';
  return null;
}

function getDominantDurum(counts: { onayli: number; incelemede: number; riskli: number }): 'Onaylı' | 'İncelemede' | 'Riskli' {
  if (counts.riskli >= counts.incelemede && counts.riskli >= counts.onayli) return 'Riskli';
  if (counts.incelemede >= counts.onayli) return 'İncelemede';
  return 'Onaylı';
}

export default function TurkeyMap({ data }: Props) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{
    show: boolean;
    ilAd: string;
    riskDurumu: RiskLabel;
    ciftciSayisi: number;
    x: number;
    y: number;
  }>({ show: false, ilAd: '', riskDurumu: 'Veri Yok', ciftciSayisi: 0, x: 0, y: 0 });

  const { riskByNorm, displayByNorm, countByNorm } = useMemo(() => {
    const riskByNorm: Record<string, 'Onaylı' | 'İncelemede' | 'Riskli'> = {};
    const displayByNorm: Record<string, string> = {};
    const countByNorm: Record<string, number> = {};
    const accum: Record<string, { onayli: number; incelemede: number; riskli: number }> = {};

    for (const row of data) {
      const city = row.Il?.trim();
      if (!city) continue;

      const key = normalizeName(city);
      const normalizedDurum = normalizeDurum(row.Durum);
      if (!normalizedDurum) continue;

      if (!accum[key]) {
        accum[key] = { onayli: 0, incelemede: 0, riskli: 0 };
        displayByNorm[key] = city;
      }

      if (normalizedDurum === 'Onaylı') accum[key].onayli += 1;
      if (normalizedDurum === 'İncelemede') accum[key].incelemede += 1;
      if (normalizedDurum === 'Riskli') accum[key].riskli += 1;
    }

    for (const [key, counts] of Object.entries(accum)) {
      riskByNorm[key] = getDominantDurum(counts);
      countByNorm[key] = counts.onayli + counts.incelemede + counts.riskli;
    }

    return { riskByNorm, displayByNorm, countByNorm };
  }, [data]);

  const getFill = (geoName: string): string => {
    const key = lookupKey(geoName);
    const risk = riskByNorm[key];
    if (!risk) return UNMONITORED_FILL;
    return RISK_FILL[risk] ?? UNMONITORED_FILL;
  };

  const getDisplayName = (geoName: string): string =>
    displayByNorm[lookupKey(geoName)] ?? geoName;

  const getRiskForGeo = (geoName: string): RiskLabel => {
    const risk = riskByNorm[lookupKey(geoName)];
    return (risk ?? 'Veri Yok') as RiskLabel;
  };

  const getCountForGeo = (geoName: string): number => countByNorm[lookupKey(geoName)] ?? 0;

  const handleMouseEnter = (geoName: string, e: React.MouseEvent) => {
    setTooltip({
      show: true,
      ilAd: getDisplayName(geoName),
      riskDurumu: getRiskForGeo(geoName),
      ciftciSayisi: getCountForGeo(geoName),
      x: e.clientX + TOOLTIP_OFFSET,
      y: e.clientY + TOOLTIP_OFFSET,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (tooltipRef.current) {
      tooltipRef.current.style.left = `${e.clientX + TOOLTIP_OFFSET}px`;
      tooltipRef.current.style.top = `${e.clientY + TOOLTIP_OFFSET}px`;
    }
  };

  const handleMouseLeave = () => {
    setTooltip((prev) => ({ ...prev, show: false }));
  };

  const memoizedGeographies = useMemo(
    () => (
      <Geographies geography={GEO_URL}>
        {({ geographies }: { geographies: Array<{ rsmKey: string; properties?: { NAME_1?: string; name?: string }; [k: string]: unknown }> }) =>
          geographies.map((geo: { rsmKey: string; properties?: { NAME_1?: string; name?: string } }) => {
            const name = geo.properties?.NAME_1 ?? geo.properties?.name ?? '';
            const fill = getFill(name);
            return (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill={fill}
                stroke="#94a3b8"
                strokeWidth={0.5}
                onMouseEnter={(e: React.MouseEvent) => handleMouseEnter(name, e)}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                style={{
                  default: { outline: 'none' },
                  hover: {
                    fill: fill === UNMONITORED_FILL ? '#cbd5e1' : fill,
                    outline: 'none',
                    cursor: 'pointer',
                  },
                  pressed: { outline: 'none' },
                }}
              />
            );
          })
        }
      </Geographies>
    ),
    [data]
  );

  return (
    <div className="bg-white shadow-sm border border-slate-200 rounded-lg p-6 flex flex-col h-full">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-800">Risk Dağılım Haritası</h2>
        <p className="text-xs text-slate-500 mt-0.5">İl bazında baskın başvuru durumu gösterilir; veri olmayan iller gri</p>
      </div>

      <div className="flex-1 min-h-[320px] w-full transform-gpu will-change-transform">
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{
            center: [35.5, 39],
            scale: 2200,
          }}
          width={800}
          height={500}
          className="w-full"
          style={{ width: '100%', height: 'auto', maxHeight: 420 }}
          shapeRendering="geometricPrecision"
        >
          {memoizedGeographies}
        </ComposableMap>
      </div>

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-slate-200 flex flex-wrap items-center gap-4 text-xs text-slate-600">
        <span className="font-medium text-slate-500">Açıklama:</span>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: RISK_FILL['Onaylı'] }} />
          <span>Onaylı</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: RISK_FILL['İncelemede'] }} />
          <span>İncelemede</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: RISK_FILL['Riskli'] }} />
          <span>Riskli</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-400">
          <span className="w-3 h-3 rounded-sm bg-slate-200" />
          <span>Veri Yok</span>
        </div>
      </div>

      {/* Tooltip — konum mousemove'da ref ile güncellenir (re-render yok) */}
      {tooltip.show && (
        <div
          ref={tooltipRef}
          className="fixed z-50 pointer-events-none bg-white/95 backdrop-blur shadow-xl border border-slate-200 rounded-lg p-3 text-sm transition-opacity duration-150"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${RISK_BADGE[tooltip.riskDurumu]}`}
              aria-hidden
            />
            <div>
              <p className="font-semibold text-slate-800">{tooltip.ilAd}</p>
              <p className="text-xs text-slate-500 mt-0.5">Durum: {tooltip.riskDurumu}</p>
              <p className="text-xs text-slate-500">Çiftçi Sayısı: {tooltip.ciftciSayisi}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
