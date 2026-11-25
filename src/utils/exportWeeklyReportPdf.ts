import { jsPDF } from 'jspdf';
import type {
  ActivityLogEntry,
  DailyMetrics,
  FoodLogEntry,
  ProgressEntry,
  UserProfile,
} from '../types/fitplate';
import { evaluateWeeklyProgress } from './nutritionMath';

export interface WeeklyReportExportInput {
  profile: UserProfile;
  entries: ProgressEntry[];
  foodLogs: FoodLogEntry[];
  dailyMetricsMap: Record<string, DailyMetrics>;
  activityLogs: ActivityLogEntry[];
  referenceDate?: string;
}

export interface WeeklyReportExportResult {
  fileName: string;
  startDate: string;
  endDate: string;
}

function shiftIsoDate(baseIso: string, deltaDays: number): string {
  const [y, m, d] = baseIso.split('-').map(Number);
  if (!y || !m || !d) return baseIso;
  return new Date(Date.UTC(y, m - 1, d + deltaDays)).toISOString().slice(0, 10);
}

export function subtractThreeMonthsIso(baseIso: string): string {
  const [y, m, d] = baseIso.split('-').map(Number);
  if (!y || !m || !d) return shiftIsoDate(baseIso, -89);
  const targetMonthIdx = m - 1 - 3;
  const targetYear = y + Math.floor(targetMonthIdx / 12);
  const normMonth = ((targetMonthIdx % 12) + 12) % 12;
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, normMonth + 1, 0)).getUTCDate();
  const clampedDay = Math.min(d, lastDayOfTargetMonth);
  return new Date(Date.UTC(targetYear, normMonth, clampedDay)).toISOString().slice(0, 10);
}

function daysBetweenIso(startIso: string, endIso: string): number {
  const [sy, sm, sd] = startIso.split('-').map(Number);
  const [ey, em, ed] = endIso.split('-').map(Number);
  if (!sy || !sm || !sd || !ey || !em || !ed) return 90;
  const startMs = Date.UTC(sy, sm - 1, sd);
  const endMs = Date.UTC(ey, em - 1, ed);
  return Math.max(1, Math.round((endMs - startMs) / 86400000) + 1);
}

function getWeekdayShort(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return '';
  const dt = new Date(Date.UTC(y, m - 1, d));
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dt.getUTCDay()] || '';
}

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${names[m - 1] || m} ${y}`;
}

function toPdfSafeText(raw: string | undefined, fallback = ''): string {
  if (!raw) return fallback;
  const cleaned = raw
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || fallback;
}

function truncatePdfText(raw: string, maxLen: number): string {
  if (raw.length <= maxLen) return raw;
  return `${raw.slice(0, Math.max(1, maxLen - 3))}...`;
}

function formatGoalLabel(goalType: UserProfile['goalType']): string {
  if (goalType === 'lose') return 'Lose Weight';
  if (goalType === 'gain') return 'Gain Weight';
  return 'Maintain Weight';
}

function formatStatusLabel(status: ReturnType<typeof evaluateWeeklyProgress>['status']): string {
  if (status === 'on_track') return 'On Track';
  if (status === 'ahead') return 'Ahead of Schedule';
  if (status === 'behind') return 'Behind Schedule';
  return 'Need 2+ Weigh-ins';
}

function drawFooter(doc: jsPDF, pageNum: number, totalPages: number) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, pageH - 16, pageW - margin, pageH - 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Generated on ${new Date().toISOString().slice(0, 10)} by Fit-Plat with Karam · Local device database · General wellness summary`,
    margin,
    pageH - 10
  );
  doc.text(`Page ${pageNum} of ${totalPages}`, pageW - margin, pageH - 10, { align: 'right' });
}

export function exportWeeklyReportPdf(input: WeeklyReportExportInput): WeeklyReportExportResult {
  const { profile, entries, foodLogs, dailyMetricsMap, activityLogs } = input;
  const endDate = input.referenceDate || new Date().toISOString().slice(0, 10);
  const startDate = shiftIsoDate(endDate, -6);

  const sortedEntries = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const latestWeight =
    sortedEntries.length > 0 ? sortedEntries[sortedEntries.length - 1].weightKg : profile.currentWeightKg;

  const weeklyEntries = sortedEntries.filter((e) => e.date >= startDate && e.date <= endDate);
  const priorOrStartEntries = sortedEntries.filter((e) => e.date < startDate);
  const weekStartWeight =
    weeklyEntries.length > 0
      ? priorOrStartEntries.length > 0
        ? priorOrStartEntries[priorOrStartEntries.length - 1].weightKg
        : weeklyEntries[0].weightKg
      : latestWeight;
  const weekEndWeight = weeklyEntries.length > 0 ? weeklyEntries[weeklyEntries.length - 1].weightKg : latestWeight;
  const weekWeightDelta = Math.round((weekEndWeight - weekStartWeight) * 10) / 10;

  const progressAnalysis = evaluateWeeklyProgress(
    entries,
    profile.goalType,
    profile.currentWeightKg,
    profile.targetWeightKg,
    profile.timelineWeeks,
    profile.dailyCalorieTarget,
    profile.gender
  );

  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    days.push(shiftIsoDate(startDate, i));
  }

  const foodByDate = new Map<
    string,
    { calories: number; protein: number; carbs: number; fat: number; fiber: number; count: number }
  >();
  for (const log of foodLogs) {
    if (log.date < startDate || log.date > endDate) continue;
    const prev = foodByDate.get(log.date) || {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      count: 0,
    };
    prev.calories += log.calories || 0;
    prev.protein += log.protein || 0;
    prev.carbs += log.carbs || 0;
    prev.fat += log.fat || 0;
    prev.fiber += log.fiber || 0;
    prev.count += 1;
    foodByDate.set(log.date, prev);
  }

  const activityBurnByDate = new Map<string, number>();
  for (const act of activityLogs) {
    if (act.date < startDate || act.date > endDate) continue;
    activityBurnByDate.set(act.date, (activityBurnByDate.get(act.date) || 0) + (act.caloriesBurned || 0));
  }

  const weightByDate = new Map<string, ProgressEntry>();
  for (const entry of weeklyEntries) {
    weightByDate.set(entry.date, entry);
  }

  const dailyRows = days.map((dateIso) => {
    const f = foodByDate.get(dateIso);
    const m = dailyMetricsMap[dateIso];
    const actBurn = activityBurnByDate.get(dateIso) || 0;
    const metricBurn = m?.exerciseCalories || 0;
    const burnedKcal = Math.max(actBurn, metricBurn);
    const waterMl = m?.waterMl || 0;
    const w = weightByDate.get(dateIso);
    return {
      date: dateIso,
      day: getWeekdayShort(dateIso),
      calories: f ? Math.round(f.calories) : 0,
      protein: f ? Math.round(f.protein) : 0,
      carbs: f ? Math.round(f.carbs) : 0,
      fat: f ? Math.round(f.fat) : 0,
      fiber: f ? Math.round(f.fiber) : 0,
      mealsCount: f?.count || 0,
      waterMl,
      burnedKcal: Math.round(burnedKcal),
      weightKg: w?.weightKg,
    };
  });

  const loggedFoodDays = dailyRows.filter((r) => r.mealsCount > 0 || r.calories > 0);
  const trackedDaysCount = loggedFoodDays.length;
  const totalCal = dailyRows.reduce((s, r) => s + r.calories, 0);
  const totalPro = dailyRows.reduce((s, r) => s + r.protein, 0);
  const totalCarbs = dailyRows.reduce((s, r) => s + r.carbs, 0);
  const totalFat = dailyRows.reduce((s, r) => s + r.fat, 0);
  const totalFiber = dailyRows.reduce((s, r) => s + r.fiber, 0);
  const totalBurned = dailyRows.reduce((s, r) => s + r.burnedKcal, 0);

  const divisor = Math.max(1, trackedDaysCount);
  const avgCal = trackedDaysCount > 0 ? Math.round(totalCal / divisor) : 0;
  const avgPro = trackedDaysCount > 0 ? Math.round(totalPro / divisor) : 0;
  const avgCarbs = trackedDaysCount > 0 ? Math.round(totalCarbs / divisor) : 0;
  const avgFat = trackedDaysCount > 0 ? Math.round(totalFat / divisor) : 0;
  const avgFiber = trackedDaysCount > 0 ? Math.round(totalFiber / divisor) : 0;

  const waterDays = dailyRows.filter((r) => r.waterMl > 0);
  const avgWaterMl =
    waterDays.length > 0 ? Math.round(waterDays.reduce((s, r) => s + r.waterMl, 0) / waterDays.length) : 0;

  const proteinGoalDays = loggedFoodDays.filter(
    (r) => profile.proteinTargetG > 0 && r.protein >= profile.proteinTargetG * 0.9
  ).length;
  const calorieGoalDays = loggedFoodDays.filter(
    (r) =>
      profile.dailyCalorieTarget > 0 &&
      r.calories >= profile.dailyCalorieTarget * 0.85 &&
      r.calories <= profile.dailyCalorieTarget * 1.15
  ).length;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageW - margin * 2;

  doc.setFillColor(5, 150, 105);
  doc.rect(0, 0, pageW, 32, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Fit-Plat with Karam', margin, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Weekly Nutritional Intake & Weight Progress Report', margin, 20);

  doc.setFontSize(9);
  doc.text(`Period: ${startDate} to ${endDate}`, margin, 26);

  const memberName = toPdfSafeText(profile.name, 'Member');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(memberName, pageW - margin, 13, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Goal: ${formatGoalLabel(profile.goalType)}`, pageW - margin, 20, { align: 'right' });
  doc.text(`Status: ${formatStatusLabel(progressAnalysis.status)}`, pageW - margin, 26, { align: 'right' });

  let y = 40;

  const cardGap = 6;
  const halfW = (contentW - cardGap) / 2;
  const boxH = 38;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, halfW, boxH, 3, 3, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Weight Progress (7-Day Window)', margin + 4, y + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  const deltaSign = weekWeightDelta > 0 ? '+' : '';
  const remainingKg = Math.round((profile.targetWeightKg - latestWeight) * 10) / 10;
  const remainingText =
    Math.abs(remainingKg) < 0.2
      ? 'At Goal'
      : `${remainingKg > 0 ? '+' : ''}${remainingKg} kg to target`;

  doc.text(`Current Weight: ${latestWeight} kg`, margin + 4, y + 14);
  doc.text(`Goal Weight: ${profile.targetWeightKg} kg (${remainingText})`, margin + 4, y + 20);
  doc.text(`7-Day Change: ${deltaSign}${weekWeightDelta} kg (${weeklyEntries.length} weigh-ins)`, margin + 4, y + 26);
  doc.text(
    `Overall Weekly Rate: ${progressAnalysis.actualWeeklyChangeKg > 0 ? '+' : ''}${progressAnalysis.actualWeeklyChangeKg} kg/wk`,
    margin + 4,
    y + 32
  );

  const rightX = margin + halfW + cardGap;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(rightX, y, halfW, boxH, 3, 3, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Daily Nutrition Targets', rightX + 4, y + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text(`Calories: ${profile.dailyCalorieTarget} kcal/day`, rightX + 4, y + 14);
  doc.text(
    `Macros: P ${profile.proteinTargetG}g | C ${profile.carbsTargetG}g | F ${profile.fatTargetG}g`,
    rightX + 4,
    y + 20
  );
  doc.text(`Fiber Target: ${profile.fiberTargetG}g/day`, rightX + 4, y + 26);

  const latestMeasEntry = [...sortedEntries]
    .reverse()
    .find((e) => e.waistCm || e.chestCm || e.hipsCm || e.armsCm);
  const measParts: string[] = [];
  if (latestMeasEntry?.waistCm) measParts.push(`Waist ${latestMeasEntry.waistCm}cm`);
  if (latestMeasEntry?.chestCm) measParts.push(`Chest ${latestMeasEntry.chestCm}cm`);
  if (latestMeasEntry?.hipsCm) measParts.push(`Hips ${latestMeasEntry.hipsCm}cm`);
  if (latestMeasEntry?.armsCm) measParts.push(`Arms ${latestMeasEntry.armsCm}cm`);
  doc.text(
    measParts.length > 0 ? `Latest Body: ${measParts.join(', ')}` : `BMI: ${profile.bmi} | BMR: ${profile.bmr} kcal`,
    rightX + 4,
    y + 32
  );

  y += boxH + 8;

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Weekly Nutritional Intake Summary', margin, y);
  y += 4;

  const kpiGap = 4;
  const kpiW = (contentW - kpiGap * 3) / 4;
  const kpiH = 22;
  const kpis = [
    {
      label: 'Days Logged',
      value: `${trackedDaysCount} / 7 days`,
      sub: `${calorieGoalDays} cal goal days`,
    },
    {
      label: 'Avg Daily Calories',
      value: `${avgCal} kcal`,
      sub: `Target ${profile.dailyCalorieTarget} kcal`,
    },
    {
      label: 'Avg Daily Protein',
      value: `${avgPro} g`,
      sub: `${proteinGoalDays} protein goal days`,
    },
    {
      label: 'Hydration & Burn',
      value: `${(avgWaterMl / 1000).toFixed(1)} L/day`,
      sub: `${totalBurned} kcal burned`,
    },
  ];

  kpis.forEach((kpi, idx) => {
    const kx = margin + idx * (kpiW + kpiGap);
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(167, 243, 208);
    doc.roundedRect(kx, y, kpiW, kpiH, 2.5, 2.5, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(kpi.label, kx + 3, y + 6);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(5, 122, 85);
    doc.text(kpi.value, kx + 3, y + 13);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(kpi.sub, kx + 3, y + 18.5);
  });

  y += kpiH + 5;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentW, 9, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text(
    `Daily Average Macros (Tracked Days):   Protein ${avgPro}g   |   Carbs ${avgCarbs}g   |   Fat ${avgFat}g   |   Fiber ${avgFiber}g`,
    margin + 4,
    y + 6
  );

  y += 15;

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Day-by-Day Weekly Breakdown', margin, y);
  y += 4;

  const colWidths = [25, 12, 21, 18, 17, 16, 16, 18, 19, 20];
  const headers = ['Date', 'Day', 'Calories', 'Protein', 'Carbs', 'Fat', 'Fiber', 'Water', 'Burned', 'Weight'];
  const colRightAlign = [false, false, true, true, true, true, true, true, true, true];

  const drawRow = (
    cells: string[],
    rowY: number,
    options: { header?: boolean; alt?: boolean; total?: boolean } = {}
  ) => {
    const rowH = options.header ? 8 : 7.5;
    if (options.header) {
      doc.setFillColor(15, 23, 42);
      doc.rect(margin, rowY, contentW, rowH, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
    } else if (options.total) {
      doc.setFillColor(236, 253, 245);
      doc.setDrawColor(167, 243, 208);
      doc.rect(margin, rowY, contentW, rowH, 'FD');
      doc.setTextColor(6, 95, 70);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
    } else {
      if (options.alt) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, rowY, contentW, rowH, 'F');
      }
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, rowY + rowH, margin + contentW, rowY + rowH);
      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
    }

    let cx = margin;
    cells.forEach((cell, idx) => {
      const w = colWidths[idx];
      const textY = rowY + (options.header ? 5.3 : 5);
      if (colRightAlign[idx]) {
        doc.text(cell, cx + w - 2.5, textY, { align: 'right' });
      } else {
        doc.text(cell, cx + 2.5, textY);
      }
      cx += w;
    });
    return rowY + rowH;
  };

  y = drawRow(headers, y, { header: true });

  dailyRows.forEach((row, idx) => {
    const hasFood = row.mealsCount > 0 || row.calories > 0;
    y = drawRow(
      [
        row.date,
        row.day,
        hasFood ? `${row.calories} kcal` : '-',
        hasFood ? `${row.protein} g` : '-',
        hasFood ? `${row.carbs} g` : '-',
        hasFood ? `${row.fat} g` : '-',
        hasFood ? `${row.fiber} g` : '-',
        row.waterMl > 0 ? `${(row.waterMl / 1000).toFixed(1)} L` : '-',
        row.burnedKcal > 0 ? `${row.burnedKcal} kcal` : '-',
        row.weightKg !== undefined ? `${row.weightKg} kg` : '-',
      ],
      y,
      { alt: idx % 2 === 1 }
    );
  });

  y = drawRow(
    [
      'Weekly Avg',
      `${trackedDaysCount}d`,
      `${avgCal} kcal`,
      `${avgPro} g`,
      `${avgCarbs} g`,
      `${avgFat} g`,
      `${avgFiber} g`,
      `${(avgWaterMl / 1000).toFixed(1)} L`,
      `${totalBurned} tot`,
      `${latestWeight} kg`,
    ],
    y,
    { total: true }
  );

  y += 10;

  const recentCheckIns = [...sortedEntries].reverse().slice(0, 5);
  if (recentCheckIns.length > 0 && y < pageH - 42) {
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Recent Weight Check-Ins', margin, y);
    y += 5;

    recentCheckIns.forEach((entry) => {
      if (y > pageH - 22) return;
      const parts: string[] = [`${entry.date}: ${entry.weightKg} kg`];
      const bodyParts: string[] = [];
      if (entry.waistCm) bodyParts.push(`Waist ${entry.waistCm}cm`);
      if (entry.chestCm) bodyParts.push(`Chest ${entry.chestCm}cm`);
      if (entry.hipsCm) bodyParts.push(`Hips ${entry.hipsCm}cm`);
      if (entry.armsCm) bodyParts.push(`Arms ${entry.armsCm}cm`);
      if (bodyParts.length > 0) parts.push(`(${bodyParts.join(', ')})`);
      const safeNote = toPdfSafeText(entry.note);
      if (safeNote) parts.push(`- ${safeNote.slice(0, 75)}`);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85);
      doc.text(`• ${parts.join(' ')}`, margin + 2, y);
      y += 5.2;
    });
  }

  drawFooter(doc, 1, 1);

  const fileName = `Fit-Plat-Weekly-Report-${endDate}.pdf`;
  doc.save(fileName);

  return { fileName, startDate, endDate };
}

export function exportThreeMonthReportPdf(input: WeeklyReportExportInput): WeeklyReportExportResult {
  const { profile, entries, foodLogs, dailyMetricsMap, activityLogs } = input;
  const endDate = input.referenceDate || new Date().toISOString().slice(0, 10);
  const startDate = subtractThreeMonthsIso(endDate);
  const totalWindowDays = daysBetweenIso(startDate, endDate);

  const sortedEntries = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const latestWeight =
    sortedEntries.length > 0 ? sortedEntries[sortedEntries.length - 1].weightKg : profile.currentWeightKg;

  const periodEntries = sortedEntries.filter((e) => e.date >= startDate && e.date <= endDate);
  const priorEntries = sortedEntries.filter((e) => e.date < startDate);
  const periodStartWeight =
    periodEntries.length > 0
      ? priorEntries.length > 0
        ? priorEntries[priorEntries.length - 1].weightKg
        : periodEntries[0].weightKg
      : latestWeight;
  const periodEndWeight = periodEntries.length > 0 ? periodEntries[periodEntries.length - 1].weightKg : latestWeight;
  const periodWeightDelta = Math.round((periodEndWeight - periodStartWeight) * 10) / 10;

  const progressAnalysis = evaluateWeeklyProgress(
    entries,
    profile.goalType,
    profile.currentWeightKg,
    profile.targetWeightKg,
    profile.timelineWeeks,
    profile.dailyCalorieTarget,
    profile.gender
  );

  // Filter saved food logs within the last 3 months
  const periodFoodLogs = foodLogs
    .filter((l) => l.date >= startDate && l.date <= endDate)
    .sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date);
      if (dateCmp !== 0) return dateCmp;
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });

  const foodByDate = new Map<
    string,
    { calories: number; protein: number; carbs: number; fat: number; fiber: number; count: number }
  >();
  for (const log of periodFoodLogs) {
    const prev = foodByDate.get(log.date) || {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      count: 0,
    };
    prev.calories += log.calories || 0;
    prev.protein += log.protein || 0;
    prev.carbs += log.carbs || 0;
    prev.fat += log.fat || 0;
    prev.fiber += log.fiber || 0;
    prev.count += 1;
    foodByDate.set(log.date, prev);
  }

  const activityBurnByDate = new Map<string, number>();
  for (const act of activityLogs) {
    if (act.date < startDate || act.date > endDate) continue;
    activityBurnByDate.set(act.date, (activityBurnByDate.get(act.date) || 0) + (act.caloriesBurned || 0));
  }

  const weightByDate = new Map<string, ProgressEntry>();
  for (const entry of periodEntries) {
    weightByDate.set(entry.date, entry);
  }

  const activeDatesSet = new Set<string>([
    ...foodByDate.keys(),
    ...Object.values(dailyMetricsMap)
      .filter((m) => m.date >= startDate && m.date <= endDate && (m.waterMl > 0 || m.exerciseCalories > 0))
      .map((m) => m.date),
    ...periodEntries.map((e) => e.date),
  ]);

  const activeDailyRows = Array.from(activeDatesSet)
    .sort((a, b) => b.localeCompare(a))
    .map((dateIso) => {
      const f = foodByDate.get(dateIso);
      const m = dailyMetricsMap[dateIso];
      const actBurn = activityBurnByDate.get(dateIso) || 0;
      const metricBurn = m?.exerciseCalories || 0;
      const burnedKcal = Math.max(actBurn, metricBurn);
      return {
        date: dateIso,
        day: getWeekdayShort(dateIso),
        calories: f ? Math.round(f.calories) : 0,
        protein: f ? Math.round(f.protein) : 0,
        carbs: f ? Math.round(f.carbs) : 0,
        fat: f ? Math.round(f.fat) : 0,
        fiber: f ? Math.round(f.fiber) : 0,
        mealsCount: f?.count || 0,
        waterMl: m?.waterMl || 0,
        burnedKcal: Math.round(burnedKcal),
        weightKg: weightByDate.get(dateIso)?.weightKg,
      };
    });

  const loggedFoodDays = Array.from(foodByDate.entries());
  const trackedDaysCount = loggedFoodDays.length;
  const totalMealsCount = periodFoodLogs.length;

  let totalCal = 0;
  let totalPro = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  let totalFiber = 0;
  let proteinGoalDays = 0;
  let calorieGoalDays = 0;

  for (const [, d] of loggedFoodDays) {
    totalCal += d.calories;
    totalPro += d.protein;
    totalCarbs += d.carbs;
    totalFat += d.fat;
    totalFiber += d.fiber;
    if (profile.proteinTargetG > 0 && d.protein >= profile.proteinTargetG * 0.9) {
      proteinGoalDays++;
    }
    if (
      profile.dailyCalorieTarget > 0 &&
      d.calories >= profile.dailyCalorieTarget * 0.85 &&
      d.calories <= profile.dailyCalorieTarget * 1.15
    ) {
      calorieGoalDays++;
    }
  }

  const divisor = Math.max(1, trackedDaysCount);
  const avgCal = trackedDaysCount > 0 ? Math.round(totalCal / divisor) : 0;
  const avgPro = trackedDaysCount > 0 ? Math.round(totalPro / divisor) : 0;
  const avgCarbs = trackedDaysCount > 0 ? Math.round(totalCarbs / divisor) : 0;
  const avgFat = trackedDaysCount > 0 ? Math.round(totalFat / divisor) : 0;
  const avgFiber = trackedDaysCount > 0 ? Math.round(totalFiber / divisor) : 0;

  const waterDays = activeDailyRows.filter((r) => r.waterMl > 0);
  const avgWaterMl =
    waterDays.length > 0 ? Math.round(waterDays.reduce((s, r) => s + r.waterMl, 0) / waterDays.length) : 0;
  const totalBurned = activeDailyRows.reduce((s, r) => s + r.burnedKcal, 0);

  // Build Month-by-Month aggregation for the 3-month window
  const monthBuckets = new Map<
    string,
    {
      days: Set<string>;
      meals: number;
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      fiber: number;
      latestWeight?: number;
    }
  >();

  for (const [dateIso, f] of loggedFoodDays) {
    const ym = dateIso.slice(0, 7);
    const b = monthBuckets.get(ym) || {
      days: new Set<string>(),
      meals: 0,
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
    };
    b.days.add(dateIso);
    b.meals += f.count;
    b.calories += f.calories;
    b.protein += f.protein;
    b.carbs += f.carbs;
    b.fat += f.fat;
    b.fiber += f.fiber;
    monthBuckets.set(ym, b);
  }
  for (const w of periodEntries) {
    const ym = w.date.slice(0, 7);
    const b = monthBuckets.get(ym) || {
      days: new Set<string>(),
      meals: 0,
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
    };
    b.latestWeight = w.weightKg;
    monthBuckets.set(ym, b);
  }

  const monthlyRows = Array.from(monthBuckets.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([ym, b]) => {
      const dCount = b.days.size;
      const div = Math.max(1, dCount);
      return {
        label: formatMonthLabel(ym),
        daysLogged: dCount,
        meals: b.meals,
        avgCal: dCount > 0 ? Math.round(b.calories / div) : 0,
        avgPro: dCount > 0 ? Math.round(b.protein / div) : 0,
        avgCarbs: dCount > 0 ? Math.round(b.carbs / div) : 0,
        avgFat: dCount > 0 ? Math.round(b.fat / div) : 0,
        avgFiber: dCount > 0 ? Math.round(b.fiber / div) : 0,
        latestWeight: b.latestWeight,
      };
    });

  // Build Multi-Page A4 PDF
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageW - margin * 2;
  const bottomLimit = pageH - 22;

  let y = 0;

  const startContinuationPage = (sectionTitle?: string) => {
    doc.addPage();
    doc.setFillColor(5, 150, 105);
    doc.rect(0, 0, pageW, 16, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Fit-Plat with Karam · 3-Month Food & Nutrition Report', margin, 10.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(`${startDate} to ${endDate}`, pageW - margin, 10.5, { align: 'right' });
    y = 24;
    if (sectionTitle) {
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.text(sectionTitle, margin, y);
      y += 4.5;
    }
  };

  const ensureSpace = (neededMm: number, continuationTitle?: string, onNewPageHeader?: () => void) => {
    if (y + neededMm <= bottomLimit) return false;
    startContinuationPage(continuationTitle);
    if (onNewPageHeader) onNewPageHeader();
    return true;
  };

  // Page 1 Hero Header
  doc.setFillColor(5, 150, 105);
  doc.rect(0, 0, pageW, 32, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Fit-Plat with Karam', margin, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('3-Month Food, Nutrition & Weight Progress Report', margin, 20);

  doc.setFontSize(9);
  doc.text(`Period: ${startDate} to ${endDate} (${totalWindowDays} days)`, margin, 26);

  const memberName = toPdfSafeText(profile.name, 'Member');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(memberName, pageW - margin, 13, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Goal: ${formatGoalLabel(profile.goalType)}`, pageW - margin, 20, { align: 'right' });
  doc.text(`Status: ${formatStatusLabel(progressAnalysis.status)}`, pageW - margin, 26, { align: 'right' });

  y = 40;

  // Profile / Weight & Daily Target Summary Cards
  const cardGap = 6;
  const halfW = (contentW - cardGap) / 2;
  const boxH = 38;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, halfW, boxH, 3, 3, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Weight Progress (Last 3 Months)', margin + 4, y + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  const deltaSign = periodWeightDelta > 0 ? '+' : '';
  const remainingKg = Math.round((profile.targetWeightKg - latestWeight) * 10) / 10;
  const remainingText =
    Math.abs(remainingKg) < 0.2
      ? 'At Goal'
      : `${remainingKg > 0 ? '+' : ''}${remainingKg} kg to target`;

  doc.text(`Current Weight: ${latestWeight} kg`, margin + 4, y + 14);
  doc.text(`Goal Weight: ${profile.targetWeightKg} kg (${remainingText})`, margin + 4, y + 20);
  doc.text(
    `3-Month Change: ${deltaSign}${periodWeightDelta} kg (${periodEntries.length} weigh-ins)`,
    margin + 4,
    y + 26
  );
  doc.text(
    `Weekly Pace: ${progressAnalysis.actualWeeklyChangeKg > 0 ? '+' : ''}${progressAnalysis.actualWeeklyChangeKg} kg/wk`,
    margin + 4,
    y + 32
  );

  const rightX = margin + halfW + cardGap;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(rightX, y, halfW, boxH, 3, 3, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Daily Nutrition Targets', rightX + 4, y + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text(`Calories: ${profile.dailyCalorieTarget} kcal/day`, rightX + 4, y + 14);
  doc.text(
    `Macros: P ${profile.proteinTargetG}g | C ${profile.carbsTargetG}g | F ${profile.fatTargetG}g`,
    rightX + 4,
    y + 20
  );
  doc.text(`Fiber Target: ${profile.fiberTargetG}g/day`, rightX + 4, y + 26);
  doc.text(`Saved Food Entries (3M): ${totalMealsCount} items`, rightX + 4, y + 32);

  y += boxH + 8;

  // 3-Month KPIs
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('3-Month Nutritional Intake Summary', margin, y);
  y += 4;

  const kpiGap = 4;
  const kpiW = (contentW - kpiGap * 3) / 4;
  const kpiH = 22;
  const kpis = [
    {
      label: 'Days Logged',
      value: `${trackedDaysCount} / ${totalWindowDays} d`,
      sub: `${calorieGoalDays} cal goal days`,
    },
    {
      label: 'Avg Daily Calories',
      value: `${avgCal} kcal`,
      sub: `Total ${Math.round(totalCal).toLocaleString()} kcal`,
    },
    {
      label: 'Avg Daily Protein',
      value: `${avgPro} g`,
      sub: `${proteinGoalDays} protein goal days`,
    },
    {
      label: 'Hydration & Burn',
      value: `${(avgWaterMl / 1000).toFixed(1)} L/day`,
      sub: `${totalBurned} kcal burned`,
    },
  ];

  kpis.forEach((kpi, idx) => {
    const kx = margin + idx * (kpiW + kpiGap);
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(167, 243, 208);
    doc.roundedRect(kx, y, kpiW, kpiH, 2.5, 2.5, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(kpi.label, kx + 3, y + 6);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(5, 122, 85);
    doc.text(kpi.value, kx + 3, y + 13);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(kpi.sub, kx + 3, y + 18.5);
  });

  y += kpiH + 5;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentW, 9, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text(
    `3-Month Daily Avg Macros:   Protein ${avgPro}g   |   Carbs ${avgCarbs}g   |   Fat ${avgFat}g   |   Fiber ${avgFiber}g`,
    margin + 4,
    y + 6
  );

  y += 14;

  // Generic table drawer helper
  const drawTableRow = (
    cells: string[],
    widths: number[],
    rightAlign: boolean[],
    rowY: number,
    options: { header?: boolean; alt?: boolean; total?: boolean } = {}
  ) => {
    const rowH = options.header ? 7.5 : 6.8;
    if (options.header) {
      doc.setFillColor(15, 23, 42);
      doc.rect(margin, rowY, contentW, rowH, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.8);
    } else if (options.total) {
      doc.setFillColor(236, 253, 245);
      doc.setDrawColor(167, 243, 208);
      doc.rect(margin, rowY, contentW, rowH, 'FD');
      doc.setTextColor(6, 95, 70);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.8);
    } else {
      if (options.alt) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, rowY, contentW, rowH, 'F');
      }
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, rowY + rowH, margin + contentW, rowY + rowH);
      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.6);
    }

    let cx = margin;
    cells.forEach((cell, idx) => {
      const w = widths[idx];
      const textY = rowY + (options.header ? 5 : 4.7);
      if (rightAlign[idx]) {
        doc.text(cell, cx + w - 2, textY, { align: 'right' });
      } else {
        doc.text(cell, cx + 2, textY);
      }
      cx += w;
    });
    return rowY + rowH;
  };

  // Section: Month-by-Month Breakdown
  if (monthlyRows.length > 0) {
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Month-by-Month Breakdown', margin, y);
    y += 4;

    const mWidths = [30, 20, 20, 24, 22, 20, 16, 15, 15]; // 182
    const mHeaders = ['Month', 'Days', 'Meals', 'Avg Cal', 'Avg Pro', 'Avg Carb', 'Fat', 'Fib', 'Weight'];
    const mRight = [false, true, true, true, true, true, true, true, true];
    y = drawTableRow(mHeaders, mWidths, mRight, y, { header: true });

    monthlyRows.forEach((m, idx) => {
      y = drawTableRow(
        [
          m.label,
          `${m.daysLogged}`,
          `${m.meals}`,
          m.daysLogged > 0 ? `${m.avgCal} kcal` : '-',
          m.daysLogged > 0 ? `${m.avgPro} g` : '-',
          m.daysLogged > 0 ? `${m.avgCarbs} g` : '-',
          m.daysLogged > 0 ? `${m.avgFat} g` : '-',
          m.daysLogged > 0 ? `${m.avgFiber} g` : '-',
          m.latestWeight !== undefined ? `${m.latestWeight} kg` : '-',
        ],
        mWidths,
        mRight,
        y,
        { alt: idx % 2 === 1 }
      );
    });
    y += 9;
  }

  // Section: Daily Nutrition Summary (Active Logged Days)
  const dWidths = [25, 12, 21, 18, 17, 16, 16, 18, 19, 20]; // 182
  const dHeaders = ['Date', 'Day', 'Calories', 'Protein', 'Carbs', 'Fat', 'Fiber', 'Water', 'Burned', 'Weight'];
  const dRight = [false, false, true, true, true, true, true, true, true, true];

  if (activeDailyRows.length > 0) {
    ensureSpace(22, 'Daily Nutrition Breakdown (Last 3 Months)');
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`Daily Nutrition Breakdown (${activeDailyRows.length} active days)`, margin, y);
    y += 4;
    y = drawTableRow(dHeaders, dWidths, dRight, y, { header: true });

    activeDailyRows.forEach((row, idx) => {
      ensureSpace(8, 'Daily Nutrition Breakdown (Continued)', () => {
        y = drawTableRow(dHeaders, dWidths, dRight, y, { header: true });
      });
      const hasFood = row.mealsCount > 0 || row.calories > 0;
      y = drawTableRow(
        [
          row.date,
          row.day,
          hasFood ? `${row.calories} kcal` : '-',
          hasFood ? `${row.protein} g` : '-',
          hasFood ? `${row.carbs} g` : '-',
          hasFood ? `${row.fat} g` : '-',
          hasFood ? `${row.fiber} g` : '-',
          row.waterMl > 0 ? `${(row.waterMl / 1000).toFixed(1)} L` : '-',
          row.burnedKcal > 0 ? `${row.burnedKcal} kcal` : '-',
          row.weightKg !== undefined ? `${row.weightKg} kg` : '-',
        ],
        dWidths,
        dRight,
        y,
        { alt: idx % 2 === 1 }
      );
    });

    y += 9;
  }

  // Section: Complete Saved Food Intake History (Last 3 Months)
  const fWidths = [22, 19, 63, 24, 19, 12, 12, 11]; // 182
  const fHeaders = ['Date', 'Meal', 'Food Item', 'Portion', 'Calories', 'Pro', 'Carb', 'Fat'];
  const fRight = [false, false, false, false, true, true, true, true];

  ensureSpace(24, 'Saved Food Intake History (Last 3 Months)');
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`Saved Food Intake History (${periodFoodLogs.length} entries)`, margin, y);
  y += 4;

  if (periodFoodLogs.length === 0) {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, y, contentW, 14, 2, 2, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(
      `No food entries were saved between ${startDate} and ${endDate}. Log meals to include them here.`,
      margin + 4,
      y + 8.5
    );
    y += 18;
  } else {
    y = drawTableRow(fHeaders, fWidths, fRight, y, { header: true });

    periodFoodLogs.forEach((log, idx) => {
      ensureSpace(8, 'Saved Food Intake History (Continued)', () => {
        y = drawTableRow(fHeaders, fWidths, fRight, y, { header: true });
      });
      const mealLabel =
        log.mealType === 'breakfast'
          ? 'Breakfast'
          : log.mealType === 'lunch'
          ? 'Lunch'
          : log.mealType === 'snacks'
          ? 'Snacks'
          : 'Dinner';
      const safeName = truncatePdfText(toPdfSafeText(log.foodName, 'Food item'), 36);
      const portionText = truncatePdfText(
        toPdfSafeText(`${log.servingQty} ${log.servingUnit} (${Math.round(log.grams)}g)`, `${Math.round(log.grams)}g`),
        14
      );
      y = drawTableRow(
        [
          log.date,
          mealLabel,
          safeName,
          portionText,
          `${Math.round(log.calories)} kcal`,
          `${Math.round(log.protein)}g`,
          `${Math.round(log.carbs)}g`,
          `${Math.round(log.fat)}g`,
        ],
        fWidths,
        fRight,
        y,
        { alt: idx % 2 === 1 }
      );
    });
  }

  // Add consistent page footer across all generated pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawFooter(doc, p, totalPages);
  }

  const fileName = `Fit-Plat-3-Month-Report-${endDate}.pdf`;
  doc.save(fileName);

  return { fileName, startDate, endDate };
}
