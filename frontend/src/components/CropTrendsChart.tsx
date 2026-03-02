import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useMemo } from 'react';

interface FarmerCropRecord {
  Urun1_Adi: string;
  Urun1_Alan: number;
}

interface Props {
  data: FarmerCropRecord[];
}

interface ChartRow {
  urun: string;
  toplamAlan: number;
  ciftciSayisi: number;
}

export default function CropTrendsChart({ data }: Props) {
  const chartData = useMemo<ChartRow[]>(() => {
    const byCrop = new Map<string, { toplamAlan: number; ciftciSayisi: number }>();

    for (const row of data) {
      const crop = row.Urun1_Adi?.trim();
      if (!crop) continue;

      const alan = Number(row.Urun1_Alan);
      const current = byCrop.get(crop) ?? { toplamAlan: 0, ciftciSayisi: 0 };
      byCrop.set(crop, {
        toplamAlan: current.toplamAlan + (Number.isFinite(alan) ? alan : 0),
        ciftciSayisi: current.ciftciSayisi + 1,
      });
    }

    return Array.from(byCrop.entries())
      .map(([urun, values]) => ({
        urun,
        toplamAlan: Number(values.toplamAlan.toFixed(2)),
        ciftciSayisi: values.ciftciSayisi,
      }))
      .sort((a, b) => b.toplamAlan - a.toplamAlan)
      .slice(0, 10);
  }, [data]);

  return (
    <div className="bg-white shadow-sm border border-slate-200 rounded-lg p-6 flex flex-col h-full">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-800">Ürün Ekim Trendleri</h2>
        <p className="text-xs text-slate-500 mt-0.5">Gerçek başvurulardan ürün bazlı toplam ekim alanı (ha)</p>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barSize={18}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="urun"
            tick={{ fontSize: 12, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}`}
          />
          <Tooltip
            formatter={(value: number, _name: string, payload: { payload?: ChartRow }) => {
              const ciftciSayisi = payload?.payload?.ciftciSayisi ?? 0;
              return [`${value.toLocaleString('tr-TR')} ha`, `Toplam Alan (${ciftciSayisi} çiftçi)`];
            }}
            contentStyle={{
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              fontSize: '12px',
            }}
          />
          <Bar dataKey="toplamAlan" fill="#16a34a" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
