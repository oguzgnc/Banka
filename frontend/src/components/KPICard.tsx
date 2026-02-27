import { TrendingUp, TrendingDown, type LucideIcon } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string;
  change: number;
  changeLabel: string;
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
}

export default function KPICard({
  title,
  value,
  change,
  changeLabel,
  icon: Icon,
  iconColor,
  iconBg,
}: KPICardProps) {
  const isPositive = change > 0;

  return (
    <div className="bg-white shadow-sm border border-slate-200 rounded-lg p-6 flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}>
          <Icon size={22} className={iconColor} />
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {isPositive ? (
          <TrendingUp size={15} className="text-green-600 flex-shrink-0" />
        ) : (
          <TrendingDown size={15} className="text-red-500 flex-shrink-0" />
        )}
        <span
          className={`text-sm font-semibold ${
            isPositive ? 'text-green-600' : 'text-red-500'
          }`}
        >
          %{Math.abs(change)}
        </span>
        <span className="text-sm text-slate-500">{changeLabel}</span>
      </div>
    </div>
  );
}
