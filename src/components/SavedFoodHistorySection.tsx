import React, { useMemo, useState } from 'react';
import { Calendar, FileDown, History, Search, Trash2, UtensilsCrossed } from 'lucide-react';
import type { FoodLogEntry, Language, MealType } from '../types/fitplate';
import { subtractThreeMonthsIso } from '../utils/exportWeeklyReportPdf';
import { formatLoggedEntryQty, resolveStoredUnitInfo } from '../utils/foodPortion';
import { t } from '../i18n/translations';

type HistoryRange = '7d' | '1m' | '3m' | 'all';

interface SavedFoodHistorySectionProps {
  language: Language;
  foodLogs: FoodLogEntry[];
  onDeleteLog?: (id: string) => void;
  onSelectDate?: (date: string) => void;
  onExportThreeMonthPdf?: () => void;
  defaultRange?: HistoryRange;
}

function shiftIsoDate(baseIso: string, deltaDays: number): string {
  const [y, m, d] = baseIso.split('-').map(Number);
  if (!y || !m || !d) return baseIso;
  return new Date(Date.UTC(y, m - 1, d + deltaDays)).toISOString().slice(0, 10);
}

export const SavedFoodHistorySection: React.FC<SavedFoodHistorySectionProps> = ({
  language,
  foodLogs,
  onDeleteLog,
  onSelectDate,
  onExportThreeMonthPdf,
  defaultRange = '3m',
}) => {
  const isHi = language === 'hi';
  const [range, setRange] = useState<HistoryRange>(defaultRange);
  const [mealFilter, setMealFilter] = useState<'all' | MealType>('all');
  const [searchText, setSearchText] = useState('');

  const todayIso = new Date().toISOString().slice(0, 10);
  const cutoffIso = useMemo(() => {
    if (range === '7d') return shiftIsoDate(todayIso, -6);
    if (range === '1m') return shiftIsoDate(todayIso, -29);
    if (range === '3m') return subtractThreeMonthsIso(todayIso);
    return null;
  }, [range, todayIso]);

  const filteredLogs = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return foodLogs
      .filter((item) => {
        if (cutoffIso && item.date < cutoffIso) return false;
        if (mealFilter !== 'all' && item.mealType !== mealFilter) return false;
        if (q) {
          const matchName = item.foodName.toLowerCase().includes(q);
          const matchDate = item.date.includes(q);
          if (!matchName && !matchDate) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const dCmp = b.date.localeCompare(a.date);
        if (dCmp !== 0) return dCmp;
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      });
  }, [foodLogs, cutoffIso, mealFilter, searchText]);

  const groupedByDate = useMemo(() => {
    const map = new Map<
      string,
      {
        date: string;
        items: FoodLogEntry[];
        calories: number;
        protein: number;
        carbs: number;
        fat: number;
      }
    >();

    for (const item of filteredLogs) {
      const curr = map.get(item.date) || {
        date: item.date,
        items: [],
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
      };
      curr.items.push(item);
      curr.calories += item.calories || 0;
      curr.protein += item.protein || 0;
      curr.carbs += item.carbs || 0;
      curr.fat += item.fat || 0;
      map.set(item.date, curr);
    }

    return Array.from(map.values()).map((g) => ({
      ...g,
      calories: Math.round(g.calories),
      protein: Math.round(g.protein * 10) / 10,
      carbs: Math.round(g.carbs * 10) / 10,
      fat: Math.round(g.fat * 10) / 10,
    }));
  }, [filteredLogs]);

  const summaryStats = useMemo(() => {
    const days = groupedByDate.length;
    const totalCal = filteredLogs.reduce((s, l) => s + (l.calories || 0), 0);
    const totalPro = filteredLogs.reduce((s, l) => s + (l.protein || 0), 0);
    return {
      entriesCount: filteredLogs.length,
      daysCount: days,
      avgCal: days > 0 ? Math.round(totalCal / days) : 0,
      avgPro: days > 0 ? Math.round(totalPro / days) : 0,
    };
  }, [filteredLogs, groupedByDate]);

  return (
    <section className="bg-white dark:bg-[#111a15] rounded-3xl border border-slate-200/80 dark:border-emerald-900/50 p-5 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <History className="w-4.5 h-4.5" />
          </div>
          <div>
            <h3 className="font-display font-bold text-base text-slate-900 dark:text-white">
              {isHi ? 'सहेजा गया भोजन इतिहास (डिवाइस डेटाबेस)' : 'Saved Food History'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isHi
                ? `डिवाइस पर सुरक्षित · ${foodLogs.length} कुल प्रविष्टियाँ`
                : `Stored locally on device · ${foodLogs.length} total saved entries`}
            </p>
          </div>
        </div>

        {onExportThreeMonthPdf && (
          <button
            type="button"
            onClick={onExportThreeMonthPdf}
            className="min-h-[38px] px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
          >
            <FileDown className="w-4 h-4 shrink-0" />
            <span>{isHi ? '3-माह भोजन PDF डाउनलोड' : 'Download 3-Month Food PDF'}</span>
          </button>
        )}
      </div>

      {/* Filters Row */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder={
              isHi
                ? 'भोजन का नाम या तारीख (YYYY-MM-DD) खोजें...'
                : 'Filter saved foods by name or date (YYYY-MM-DD)...'
            }
            className="w-full min-h-[40px] pl-9 pr-3 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-stone-50 dark:bg-[#090e0b] text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex p-0.5 rounded-xl bg-stone-100 dark:bg-[#090e0b] border border-slate-200/70 dark:border-emerald-900/40">
            {(
              [
                ['7d', isHi ? '7 दिन' : '7D'],
                ['1m', isHi ? '1 माह' : '1M'],
                ['3m', isHi ? '3 माह' : '3M'],
                ['all', isHi ? 'सभी' : 'All'],
              ] as [HistoryRange, string][]
            ).map(([val, lbl]) => (
              <button
                key={val}
                type="button"
                onClick={() => setRange(val)}
                className={`min-h-[32px] px-2.5 rounded-lg text-xs font-semibold transition-colors ${
                  range === val
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>

          <select
            value={mealFilter}
            onChange={(e) => setMealFilter(e.target.value as 'all' | MealType)}
            aria-label={isHi ? 'भोजन समय फ़िल्टर' : 'Filter by meal'}
            className="min-h-[36px] px-2.5 rounded-xl border border-slate-200 dark:border-emerald-900/60 bg-stone-50 dark:bg-[#090e0b] text-xs font-semibold"
          >
            <option value="all">{isHi ? 'सभी समय' : 'All Meals'}</option>
            <option value="breakfast">{t(language, 'breakfast')}</option>
            <option value="lunch">{t(language, 'lunch')}</option>
            <option value="snacks">{t(language, 'snacks')}</option>
            <option value="dinner">{t(language, 'dinner')}</option>
          </select>
        </div>
      </div>

      {/* Period Mini Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-[#090e0b] border border-slate-200/60 dark:border-emerald-900/40">
          <div className="text-[11px] text-slate-500">{isHi ? 'सहेजे गए दिन' : 'Saved Days'}</div>
          <div className="font-mono-num font-bold text-sm mt-0.5">{summaryStats.daysCount}</div>
        </div>
        <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-[#090e0b] border border-slate-200/60 dark:border-emerald-900/40">
          <div className="text-[11px] text-slate-500">{isHi ? 'भोजन प्रविष्टियाँ' : 'Food Items'}</div>
          <div className="font-mono-num font-bold text-sm mt-0.5">{summaryStats.entriesCount}</div>
        </div>
        <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-[#090e0b] border border-slate-200/60 dark:border-emerald-900/40">
          <div className="text-[11px] text-slate-500">{isHi ? 'औसत कैलोरी/दिन' : 'Avg kcal / Day'}</div>
          <div className="font-mono-num font-bold text-sm mt-0.5">{summaryStats.avgCal} kcal</div>
        </div>
        <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-[#090e0b] border border-slate-200/60 dark:border-emerald-900/40">
          <div className="text-[11px] text-slate-500">{isHi ? 'औसत प्रोटीन/दिन' : 'Avg Protein / Day'}</div>
          <div className="font-mono-num font-bold text-sm mt-0.5">{summaryStats.avgPro} g</div>
        </div>
      </div>

      {/* Chronological Saved Entries Grouped by Date */}
      {groupedByDate.length === 0 ? (
        <div className="py-8 px-4 text-center rounded-2xl border border-dashed border-slate-200 dark:border-emerald-900/50 space-y-2">
          <UtensilsCrossed className="w-6 h-6 mx-auto text-slate-400" />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {foodLogs.length === 0
              ? isHi
                ? 'अभी तक कोई भोजन लॉग सहेजा नहीं गया है। भोजन जोड़ते ही पूरा इतिहास यहाँ सुरक्षित रहेगा।'
                : 'No saved food logs yet. Every meal you log stays saved on your device here.'
              : isHi
              ? 'चयनित फ़िल्टर के लिए कोई सहेजा गया भोजन नहीं मिला।'
              : 'No saved food entries match the selected filters.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[420px] overflow-y-auto pr-0.5">
          {groupedByDate.map((group) => (
            <div
              key={group.date}
              className="rounded-2xl border border-slate-200/80 dark:border-emerald-900/50 overflow-hidden"
            >
              <div className="px-3.5 py-2 bg-stone-50 dark:bg-[#090e0b] border-b border-slate-200/70 dark:border-emerald-900/40 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="font-mono-num text-xs font-bold text-slate-900 dark:text-white">
                    {group.date}
                  </span>
                  {onSelectDate && (
                    <button
                      type="button"
                      onClick={() => onSelectDate(group.date)}
                      className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
                    >
                      {isHi ? 'इस दिन खोलें' : 'Open Day'}
                    </button>
                  )}
                </div>
                <div className="font-mono-num text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  {group.calories} kcal · P {group.protein}g · C {group.carbs}g · F {group.fat}g
                </div>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-emerald-950/60">
                {group.items.map((item) => {
                  const storedInfo = resolveStoredUnitInfo(item.servingUnit);
                  const qtyLabel = formatLoggedEntryQty(
                    item.servingQty,
                    item.servingUnit,
                    item.grams,
                    language
                  );
                  return (
                    <div
                      key={item.id}
                      className="px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-semibold shrink-0">
                            {t(language, item.mealType)}
                          </span>
                          <span className="font-semibold text-slate-900 dark:text-white truncate">
                            {item.foodName}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono-num mt-0.5">
                          {storedInfo.kind === 'gram' ? `${item.grams}g` : `${qtyLabel} (${item.grams}g)`} · P{' '}
                          {item.protein}g · C {item.carbs}g · F {item.fat}g
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono-num font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                          {item.calories} kcal
                        </span>
                        {onDeleteLog && (
                          <button
                            type="button"
                            onClick={() => onDeleteLog(item.id)}
                            aria-label="Delete saved food entry"
                            className="min-h-[32px] min-w-[32px] rounded-lg text-slate-400 hover:text-rose-500 flex items-center justify-center"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
