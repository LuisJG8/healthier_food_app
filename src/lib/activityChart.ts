import type { ActivityDay } from "../types";

export interface ActivityChartCell {
  date: string;
  count: number;
  level: number;
  isFuture: boolean;
}

export interface ActivityChartWeek {
  startDate: string;
  monthLabel: string | null;
  days: ActivityChartCell[];
}

export interface ActivityChart {
  weeks: ActivityChartWeek[];
  currentWeek: ActivityChartCell[];
  totalPoints: number;
  currentStreak: number;
}

const CHART_WEEK_COUNT = 53;
const DAYS_PER_WEEK = 7;
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function buildActivityChart(days: ActivityDay[], today = new Date()): ActivityChart {
  const todayStart = startOfDay(today);
  const firstWeekStart = addDays(startOfWeek(todayStart), -(CHART_WEEK_COUNT - 1) * DAYS_PER_WEEK);
  const activityByDate = new Map(days.map((day) => [day.date, day.count]));
  const weeks: ActivityChartWeek[] = [];

  for (let weekIndex = 0; weekIndex < CHART_WEEK_COUNT; weekIndex += 1) {
    const weekStart = addDays(firstWeekStart, weekIndex * DAYS_PER_WEEK);
    const cells: ActivityChartCell[] = [];

    for (let dayIndex = 0; dayIndex < DAYS_PER_WEEK; dayIndex += 1) {
      const date = addDays(weekStart, dayIndex);
      const dateKey = toDateKey(date);
      const isFuture = date.getTime() > todayStart.getTime();
      const count = isFuture ? 0 : activityByDate.get(dateKey) ?? 0;

      cells.push({
        date: dateKey,
        count,
        level: activityLevel(count),
        isFuture,
      });
    }

    weeks.push({
      startDate: toDateKey(weekStart),
      monthLabel: monthLabelForWeek(weekStart, todayStart),
      days: cells,
    });
  }

  return {
    weeks,
    currentWeek: buildCurrentActivityWeek(days, todayStart),
    totalPoints: days.reduce((total, day) => total + day.count, 0),
    currentStreak: getCurrentStreak(activityByDate, todayStart),
  };
}

export function buildCurrentActivityWeek(days: ActivityDay[], today = new Date()): ActivityChartCell[] {
  const todayStart = startOfDay(today);
  const weekStart = addDays(todayStart, -((todayStart.getDay() + 6) % DAYS_PER_WEEK));
  const activityByDate = new Map(days.map((day) => [day.date, day.count]));

  return Array.from({ length: DAYS_PER_WEEK }, (_, index) => {
    const date = addDays(weekStart, index);
    const dateKey = toDateKey(date);
    const isFuture = date.getTime() > todayStart.getTime();
    const count = isFuture ? 0 : activityByDate.get(dateKey) ?? 0;

    return {
      date: dateKey,
      count,
      level: activityLevel(count),
      isFuture,
    };
  });
}

export function formatActivityWeekRange(week: ActivityChartCell[]): string {
  const startDate = week[0]?.date;
  const endDate = week[week.length - 1]?.date;

  if (!startDate || !endDate) {
    return "";
  }

  return `${formatActivityDate(startDate)} - ${formatActivityDate(endDate)}`;
}

export function activityLevel(count: number): number {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count === 3) return 3;
  return 4;
}

function formatActivityDate(dateKey: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);

  if (!match) {
    return dateKey;
  }

  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

function monthLabelForWeek(weekStart: Date, today: Date): string | null {
  for (let dayIndex = 0; dayIndex < DAYS_PER_WEEK; dayIndex += 1) {
    const date = addDays(weekStart, dayIndex);
    if (date.getTime() <= today.getTime() && date.getDate() === 1) {
      return MONTH_LABELS[date.getMonth()];
    }
  }

  return null;
}

function getCurrentStreak(activityByDate: Map<string, number>, today: Date): number {
  let streak = 0;
  let startDate = today;

  const todayKey = toDateKey(today);
  const yesterday = addDays(today, -1);
  const yesterdayKey = toDateKey(yesterday);

  if ((activityByDate.get(todayKey) ?? 0) <= 0) {
    if ((activityByDate.get(yesterdayKey) ?? 0) <= 0) {
      return 0;
    }

    startDate = yesterday;
  }

  for (let offset = 0; offset < CHART_WEEK_COUNT * DAYS_PER_WEEK; offset += 1) {
    const dateKey = toDateKey(addDays(startDate, -offset));
    if ((activityByDate.get(dateKey) ?? 0) <= 0) {
      break;
    }
    streak += 1;
  }

  return streak;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date: Date): Date {
  return addDays(date, -date.getDay());
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
