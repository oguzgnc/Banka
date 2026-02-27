import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

export interface CropTrendEntry {
  year: string;
  Mısır: number;
  Buğday: number;
  Arpa: number;
  Ayçiçeği: number;
  Pamuk: number;
}

interface Props {
  data: CropTrendEntry[];
}

const COLORS: Record<keyof Omit<CropTrendEntry, 'year'>, string> = {
  Mısır: '#16a34a',
  Buğday: '#f59e0b',
  Arpa: '#3b82f6',
  Ayçiçeği: '#f97316',
  Pamuk: '#8b5cf6',
};

const CROPS = Object.keys(COLORS) as (keyof typeof COLORS)[];

const formatTooltip = (value: number | undefined) =>
  value !== undefined ? `${value.toLocaleString('tr-TR')} ton` : '';

export default function CropTrendsChart({ data }: Props) {
  return (
    <div className="bg-white shadow-sm border border-slate-200 rounded-lg p-6 flex flex-col h-full">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-800">Ürün Ekim Trendleri</h2>
        <p className="text-xs text-slate-500 mt-0.5">Yıllara göre üretim miktarı (bin ton)</p>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barSize={10}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="year"
            tick={{ fontSize: 12, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip
            formatter={formatTooltip}
            contentStyle={{
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              fontSize: '12px',
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
            iconType="circle"
            iconSize={8}
          />
          {CROPS.map((crop) => (
            <Bar key={crop} dataKey={crop} fill={COLORS[crop]} radius={[3, 3, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
