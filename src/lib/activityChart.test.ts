import { describe, expect, it } from "vitest";
import { activityLevel, buildActivityChart, buildCurrentActivityWeek, formatActivityWeekRange } from "./activityChart";
import type { ActivityDay } from "../types";

describe("activity chart helpers", () => {
  it("generates a 53 week chart with today in the final week", () => {
    const chart = buildActivityChart([], new Date(2026, 4, 31));

    expect(chart.weeks).toHaveLength(53);
    expect(chart.weeks.every((week) => week.days.length === 7)).toBe(true);
    expect(chart.weeks.at(-1)?.days.some((day) => day.date === "2026-05-31")).toBe(true);
  });

  it("labels only weeks that contain the first day of a month", () => {
    const chart = buildActivityChart([], new Date(2026, 4, 31));
    const labeledWeeks = chart.weeks.filter((week) => week.monthLabel);

    expect(labeledWeeks.map((week) => week.monthLabel)).toContain("May");
    expect(
      labeledWeeks.every((week) =>
        week.days.some((day) => {
          const date = new Date(`${day.date}T00:00:00`);
          return date.getDate() === 1;
        }),
      ),
    ).toBe(true);
  });

  it("calculates point totals, current streak, and visual levels", () => {
    const days: ActivityDay[] = [
      { date: "2026-05-28", count: 4, events: { barcode_scan: 4 } },
      { date: "2026-05-29", count: 3, events: { barcode_scan: 3 } },
      { date: "2026-05-30", count: 2, events: { login: 1, profile_view: 1 } },
      { date: "2026-05-31", count: 1, events: { login: 1 } },
    ];
    const chart = buildActivityChart(days, new Date(2026, 4, 31));

    expect(chart.totalPoints).toBe(10);
    expect(chart.currentStreak).toBe(4);
    expect(activityLevel(0)).toBe(0);
    expect(activityLevel(1)).toBe(1);
    expect(activityLevel(2)).toBe(2);
    expect(activityLevel(3)).toBe(3);
    expect(activityLevel(4)).toBe(4);
  });

  it("keeps the streak alive if there is no activity today but there was yesterday", () => {
    const days: ActivityDay[] = [
      { date: "2026-05-29", count: 3, events: { barcode_scan: 3 } },
      { date: "2026-05-30", count: 2, events: { login: 1, profile_view: 1 } },
    ];
    const chart = buildActivityChart(days, new Date(2026, 4, 31));

    expect(chart.currentStreak).toBe(2);
  });

  it("builds the compact current week from Monday to Sunday", () => {
    const week = buildCurrentActivityWeek(
      [
        { date: "2026-05-25", count: 1, events: { login: 1 } },
        { date: "2026-05-29", count: 3, events: { barcode_scan: 3 } },
      ],
      new Date(2026, 4, 30),
    );

    expect(week.map((day) => day.date)).toEqual([
      "2026-05-25",
      "2026-05-26",
      "2026-05-27",
      "2026-05-28",
      "2026-05-29",
      "2026-05-30",
      "2026-05-31",
    ]);
    expect(week[0]?.count).toBe(1);
    expect(week[4]?.level).toBe(3);
    expect(week[6]?.isFuture).toBe(true);
  });

  it("formats the current week range as DD/MM/YYYY", () => {
    const week = buildCurrentActivityWeek([], new Date(2026, 5, 11));

    expect(formatActivityWeekRange(week)).toBe("08/06/2026 - 14/06/2026");
    expect(formatActivityWeekRange([])).toBe("");
  });
});
