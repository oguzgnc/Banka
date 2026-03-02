/**
 * RecommendationsTable
 * --------------------
 * Gerçek başvuru verisinden ürün değişimi önerisi olan kayıtları listeler.
 */

import { useMemo } from 'react';

interface FarmerRecommendation {
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

interface Props {
  data: FarmerRecommendation[];
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 9
      ? 'bg-green-100 text-green-800'
      : score >= 7.5
      ? 'bg-blue-100 text-blue-800'
      : 'bg-yellow-100 text-yellow-800';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${color}`}>
      {score.toFixed(1)}
    </span>
  );
}

export default function RecommendationsTable({ data }: Props) {
  const rows = useMemo(
    () =>
      data.filter((row) => {
        const mevcut = row.Urun1_Adi?.trim().toLocaleLowerCase('tr-TR');
        const onerilen = row.Onerilen_Urun?.trim().toLocaleLowerCase('tr-TR');
        return Boolean(onerilen) && onerilen !== mevcut;
      }),
    [data]
  );

  return (
    <div className="bg-white shadow-sm border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Ürün Değişim Önerileri</h2>
          <p className="text-xs text-slate-500 mt-0.5">Mevcut üründen farklı AI önerisi olan gerçek başvurular</p>
        </div>
        <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-medium">
          {rows.length} öneri
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Çiftçi
              </th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                İl
              </th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Mevcut Ürün
              </th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Alan (ha)
              </th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Önerilen Ürün
              </th>
              <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Teşvik Skoru
              </th>
              <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Durum
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, idx) => (
              <tr key={`${row.TCKN}-${idx}`} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-medium text-slate-800">{row.ad_soyad}</td>
                <td className="px-6 py-4 text-slate-600">{row.Il}</td>
                <td className="px-6 py-4 text-slate-600">{row.Urun1_Adi}</td>
                <td className="px-6 py-4 text-slate-500 text-xs">{row.Urun1_Alan.toFixed(1)} ha</td>
                <td className="px-6 py-4">
                  <span className="bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-1 rounded-full">
                    {row.Onerilen_Urun}
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  <ScoreBadge score={row.Tesvik_Skoru} />
                </td>
                <td className="px-6 py-4 text-center text-xs text-slate-600">{row.Durum}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-500">
                  Ürün değişimi önerisi bulunan kayıt bulunamadı.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
