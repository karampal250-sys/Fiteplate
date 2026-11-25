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

function getWeekdayShort(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return '';
  const dt = new Date(Date.UTC(y, m - 1, d));
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dt.getUTCDay()] || '';
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
