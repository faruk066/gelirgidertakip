import { Link } from 'react-router-dom';
import EmptyState from '../components/EmptyState';
import TransactionList from '../components/TransactionList';
import { monthRange, todayISO, weekRange } from '../lib/dateUtils';
import { calcTotals } from '../lib/excel';
import { formatMoney } from '../lib/format';
import { useStore } from '../store';

export default function Home() {
  const { transactions, categories, settings, deleteTransaction } = useStore();
  const today = todayISO();
  const week = weekRange(today);
  const month = monthRange(today);

  const inDay = transactions.filter((t) => t.date === today);
  const inWeek = transactions.filter((t) => t.date >= week.start && t.date <= week.end);
  const inMonth = transactions.filter((t) => t.date >= month.start && t.date <= month.end);

  const dayTotals = calcTotals(inDay);
  const weekTotals = calcTotals(inWeek);
  const monthTotals = calcTotals(inMonth);
  const recent = transactions.slice(0, 8);

  const cards = [
    { label: 'Bugünkü Net', ...dayTotals },
    { label: 'Bu Hafta Net', ...weekTotals },
    { label: 'Bu Ay Net', ...monthTotals },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl bg-white p-3 shadow-sm dark:bg-slate-900">
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{c.label}</p>
            <p
              className={`mt-1 truncate text-base font-extrabold tabular-nums ${
                c.net >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}
            >
              {formatMoney(c.net, settings.currency)}
            </p>
            <p className="mt-1 truncate text-[11px] tabular-nums text-slate-400">
              <span className="text-green-600 dark:text-green-400">+{formatMoney(c.income, settings.currency)}</span>
              {' / '}
              <span className="text-red-500">−{formatMoney(c.expense, settings.currency)}</span>
            </p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <h2 className="font-bold text-slate-800 dark:text-slate-100">Son İşlemler</h2>
        <Link to="/islemler" className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
          Tümü →
        </Link>
      </div>

      {recent.length === 0 ? (
        <EmptyState
          icon="🧾"
          title="Henüz işlem yok"
          hint="Sağ alttaki + butonuyla ilk gelir veya giderini ekle."
        />
      ) : (
        <TransactionList
          transactions={recent}
          categories={categories}
          currency={settings.currency}
          onEdit={() => undefined}
          onDelete={(t) => {
            if (window.confirm('Bu işlem silinsin mi?')) deleteTransaction(t.id);
          }}
        />
      )}
    </div>
  );
}
