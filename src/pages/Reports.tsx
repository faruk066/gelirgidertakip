import { useMemo, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import EmptyState from '../components/EmptyState';
import { useRangeSummary } from '../hooks/useRangeSummary';
import { formatDateTr, monthRange, todayISO, weekRange, yearRange, type DateRange } from '../lib/dateUtils';
import { downloadExcelReport } from '../lib/excel';
import { formatMoney } from '../lib/format';
import { useStore } from '../store';
import type { TransactionType } from '../types';

type Tab = 'today' | 'week' | 'month' | 'year' | 'custom';

const TABS: { id: Tab; label: string }[] = [
  { id: 'today', label: 'Bugün' },
  { id: 'week', label: 'Hafta' },
  { id: 'month', label: 'Ay' },
  { id: 'year', label: 'Yıl' },
  { id: 'custom', label: 'Özel' },
];

const TYPE_COLORS: Record<TransactionType, string> = { income: '#22c55e', expense: '#ef4444' };

export default function Reports() {
  const { transactions, categories, settings } = useStore();
  const today = todayISO();
  const [tab, setTab] = useState<Tab>('month');
  const [chartType, setChartType] = useState<TransactionType>('expense');
  const [customStart, setCustomStart] = useState(today);
  const [customEnd, setCustomEnd] = useState(today);

  const range: DateRange = useMemo(() => {
    switch (tab) {
      case 'today':
        return { start: today, end: today };
      case 'week':
        return weekRange(today);
      case 'month':
        return monthRange(today);
      case 'year':
        return yearRange(today);
      case 'custom':
        return customStart <= customEnd
          ? { start: customStart, end: customEnd }
          : { start: customEnd, end: customStart };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, today, customStart, customEnd]);

  const { totals, slices, totalForType } = useRangeSummary(transactions, categories, range, chartType);
  const chartData = slices.map((s) => ({ name: s.category.name, value: s.total, color: s.category.color }));

  return (
    <div className="space-y-4">
      {/* Zaman aralığı sekmeleri */}
      <div className="grid grid-cols-5 gap-1 rounded-2xl bg-white p-1.5 shadow-sm dark:bg-slate-900">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-xl px-2 py-2 text-xs font-bold sm:text-sm ${
              tab === t.id ? 'bg-emerald-600 text-white' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'custom' && (
        <div className="flex items-center gap-2 rounded-2xl bg-white p-3 shadow-sm dark:bg-slate-900">
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <span className="text-slate-400">—</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
      )}

      <p className="text-center text-sm font-medium text-slate-500 dark:text-slate-400">
        {formatDateTr(range.start)} — {formatDateTr(range.end)}
      </p>

      {/* Özet kartları */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-white p-3 text-center shadow-sm dark:bg-slate-900">
          <p className="text-[11px] font-semibold text-slate-500">Gelir</p>
          <p className="mt-1 truncate text-sm font-extrabold tabular-nums text-green-600 dark:text-green-400">
            {formatMoney(totals.income, settings.currency)}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-3 text-center shadow-sm dark:bg-slate-900">
          <p className="text-[11px] font-semibold text-slate-500">Gider</p>
          <p className="mt-1 truncate text-sm font-extrabold tabular-nums text-red-600 dark:text-red-400">
            {formatMoney(totals.expense, settings.currency)}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-3 text-center shadow-sm dark:bg-slate-900">
          <p className="text-[11px] font-semibold text-slate-500">Net</p>
          <p
            className={`mt-1 truncate text-sm font-extrabold tabular-nums ${
              totals.net >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            }`}
          >
            {formatMoney(totals.net, settings.currency)}
          </p>
        </div>
      </div>

      {/* Gelir/Gider grafik seçimi */}
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-white p-1.5 shadow-sm dark:bg-slate-900">
        {(['expense', 'income'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setChartType(t)}
            className={`rounded-xl px-3 py-2 text-sm font-bold ${
              chartType === t
                ? t === 'income'
                  ? 'bg-green-600 text-white'
                  : 'bg-red-600 text-white'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {t === 'income' ? 'Gelir Dağılımı' : 'Gider Dağılımı'}
          </button>
        ))}
      </div>

      {/* Donut grafik */}
      <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
        <h3 className="font-bold text-slate-800 dark:text-slate-100">Kategori Dağılımı</h3>
        {totalForType === 0 ? (
          <div className="py-4">
            <EmptyState icon="📊" title="Bu aralıkta veri yok" hint="Farklı bir aralık seçin." />
          </div>
        ) : (
          <div className="relative h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="62%"
                  outerRadius="90%"
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {chartData.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[11px] font-semibold text-slate-500">
                Toplam {chartType === 'income' ? 'Gelir' : 'Gider'}
              </span>
              <span
                className="text-lg font-extrabold tabular-nums"
                style={{ color: TYPE_COLORS[chartType] }}
              >
                {formatMoney(totalForType, settings.currency)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Kategori listesi */}
      {slices.length > 0 && (
        <div className="space-y-2 rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
          {slices.map((s) => (
            <div key={s.category.id}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  {s.category.icon} {s.category.name}
                </span>
                <span className="tabular-nums text-slate-500 dark:text-slate-400">
                  {formatMoney(s.total, settings.currency)} • %{s.percent.toFixed(1)}
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${s.percent}%`, backgroundColor: s.category.color }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Excel indir */}
      <button
        type="button"
        onClick={() =>
          downloadExcelReport(
            transactions.filter((t) => t.date >= range.start && t.date <= range.end),
            categories,
            range.start,
            range.end,
            settings.currency,
          )
        }
        className="w-full rounded-2xl bg-emerald-600 px-4 py-3.5 font-bold text-white shadow-sm"
      >
        📥 Excel Olarak İndir (.xlsx)
      </button>
    </div>
  );
}
