import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  FileSearch,
  MapPin,
  CreditCard,
  Bell,
  Search,
  Wheat,
  CircleUserRound,
} from 'lucide-react';

const navItems = [
  { to: '/', label: 'Gösterge Paneli', icon: LayoutDashboard, end: true },
  { to: '/cks-analizleri', label: 'ÇKS Analizleri', icon: FileSearch, end: false },
  { to: '/risk-haritasi', label: 'Risk Haritası', icon: MapPin, end: false },
  { to: '/kredi-basvurulari', label: 'Kredi Başvuruları', icon: CreditCard, end: false },
];

export default function Layout() {
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-[#0f172a] flex flex-col">
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-700">
          <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
            <Wheat size={18} className="text-white" />
          </div>
          <div>
            <p className="text-white text-sm font-bold leading-tight">TarımKredi</p>
            <p className="text-slate-400 text-xs leading-tight">Karar Destek Sistemi</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-6 space-y-1">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-green-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-slate-700">
          <p className="text-slate-500 text-xs text-center">v1.0.0 — Şubat 2026</p>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 flex-shrink-0 bg-white border-b border-slate-200 flex items-center px-8 gap-4">
          {/* Search */}
          <div className="flex-1 max-w-sm relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Çiftçi, il veya başvuru ara..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent placeholder:text-slate-400"
            />
          </div>

          <div className="flex items-center gap-3 ml-auto">
            {/* Notification Bell */}
            <button className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors">
              <Bell size={20} className="text-slate-600" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
            </button>

            {/* User Profile */}
            <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <CircleUserRound size={20} className="text-green-700" />
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-semibold text-slate-800 leading-tight">Ahmet Kaya</p>
                <p className="text-xs text-slate-500 leading-tight">Kredi Yöneticisi</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
