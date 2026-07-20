import { RoutineTask, Task, DAYS_MAP } from "@/types";
import { createTask } from "./factories";
import { isWorkDay, getPrevWorkDay, getNextWorkDay, formatDate, parseLocalDate } from "./datetime";

export type DayOfWeekStr = 'Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat';

/** 特定の日付が定型タスクのスケジュールに合致するか判定する */
export function isScheduledOn(m: RoutineTask, date: Date): boolean {
    const schedule = m.schedule;
    if (!schedule) return false;

    switch (schedule.type) {
        case 'weekly': {
            if (!schedule.days || schedule.days.length === 0) return false;
            const dayStr = DAYS_MAP[date.getDay()];
            return schedule.days.includes(dayStr);
        }
        case 'interval': {
            if (!schedule.days || schedule.days.length === 0) return false;
            const intervalWeeks = schedule.intervalWeeks || 1;
            const baseDateStr = schedule.baseDate;
            if (!baseDateStr) return false;

            const dayStr = DAYS_MAP[date.getDay()];
            if (!schedule.days.includes(dayStr)) return false;

            // 週の開始日は日曜として計算。
            // 基準日 baseDate が属する週から、date が属する週までの経過週数 W が W % intervalWeeks === 0
            const getStartOfWeek = (d: Date) => {
                const result = new Date(d);
                const day = result.getDay();
                result.setDate(result.getDate() - day);
                result.setHours(0, 0, 0, 0);
                return result;
            };

            const baseDate = parseLocalDate(baseDateStr);
            const baseDateClean = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
            const dateClean = new Date(date.getFullYear(), date.getMonth(), date.getDate());

            const baseSunday = getStartOfWeek(baseDateClean);
            const targetSunday = getStartOfWeek(dateClean);

            const diffTime = targetSunday.getTime() - baseSunday.getTime();
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
            const diffWeeks = Math.floor(diffDays / 7);

            if (diffWeeks < 0) return false;
            return diffWeeks % intervalWeeks === 0;
        }
        case 'monthly-day': {
            const monthlyDay = schedule.monthlyDay;
            if (monthlyDay === undefined) return false;

            const targetDay = date.getDate();
            const targetMonth = date.getMonth();
            const targetYear = date.getFullYear();

            // その月の最終日を取得
            const lastDateOfCurrentMonth = new Date(targetYear, targetMonth + 1, 0);
            const maxDays = lastDateOfCurrentMonth.getDate();

            if (monthlyDay === 'last') {
                return targetDay === maxDays;
            } else if (typeof monthlyDay === 'number') {
                if (monthlyDay >= 1 && monthlyDay <= 31) {
                    if (monthlyDay === targetDay) {
                        return true;
                    }
                    if (monthlyDay > maxDays && targetDay === maxDays) {
                        return true;
                    }
                }
            }
            return false;
        }
        case 'monthly-weekday': {
            if (!schedule.days || schedule.days.length === 0) return false;
            const weekIndex = schedule.weekIndex;
            if (weekIndex === undefined) return false;

            const dayStr = DAYS_MAP[date.getDay()];
            if (!schedule.days.includes(dayStr)) return false;

            if (typeof weekIndex === 'number' && weekIndex >= 1 && weekIndex <= 5) {
                const occurrence = Math.floor((date.getDate() - 1) / 7) + 1;
                return occurrence === weekIndex;
            } else if (weekIndex === 'last') {
                const nextWeekDate = new Date(date);
                nextWeekDate.setDate(date.getDate() + 7);
                return nextWeekDate.getMonth() !== date.getMonth();
            }
            return false;
        }
        default:
            return false;
    }
}

/** 日付ごとの不足タスク計算（純粋関数） */
export function computeMissingRoutineTasks(
    masters: RoutineTask[], 
    existingTasks: Task[], 
    date: string,
    workDays: number[] = [1, 2, 3, 4, 5],
    holidays: string[] = []
): Task[] {
    const targetDate = parseLocalDate(date);
    if (!isWorkDay(targetDate, workDays, holidays)) {
        return [];
    }

    const newTasks: Task[] = [];

    for (const m of masters) {
        if (!m.schedule || m.schedule.type === 'none') {
            continue;
        }

        // すでに existingTasks に routineId === m.id があるかチェック
        if (existingTasks.some(t => t.routineId === m.id)) {
            continue;
        }

        const adjustment = m.holiday_adjustment || 'skip';

        // 1. 本来の日付で営業日の場合
        const isScheduledToday = isScheduledOn(m, targetDate);

        let shouldGenerate = false;
        let originalDateStr = date;

        if (isScheduledToday) {
            // 本来の予定日であり、かつ今日が営業日なので無条件で生成
            shouldGenerate = true;
        } else {
            // 2. 休日調整による移動の判定
            if (adjustment === 'after') {
                // 直前営業日を取得
                const prevWd = getPrevWorkDay(date, workDays, holidays);
                // 直前営業日の翌日から今日の前日までの期間
                const start = new Date(prevWd);
                start.setDate(start.getDate() + 1);
                const end = new Date(date);
                end.setDate(end.getDate() - 1);

                // この期間の各日付について、mのスケジュール予定日が含まれるか判定
                for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                    if (isScheduledOn(m, d)) {
                        shouldGenerate = true;
                        originalDateStr = formatDate(d);
                        break;
                    }
                }
            } else if (adjustment === 'before') {
                // 直後営業日を取得
                const nextWd = getNextWorkDay(date, workDays, holidays);
                // 今日の翌日から直後営業日の前日までの期間
                const start = new Date(date);
                start.setDate(start.getDate() + 1);
                const end = new Date(nextWd);
                end.setDate(end.getDate() - 1);

                // この期間の各日付について、mのスケジュール予定日が含まれるか判定
                for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                    if (isScheduledOn(m, d)) {
                        shouldGenerate = true;
                        originalDateStr = formatDate(d);
                        break;
                    }
                }
            }
        }

        if (shouldGenerate) {
            const task = createTask(m.text, date);
            task.routineId = m.id;
            task.originalDate = originalDateStr; // 本来の予定日を設定
            newTasks.push(task);
        }
    }

    return newTasks;
}

/** 本来予定されていた日付 (originalDate) に対する休日調整後の実際の生成日を計算する */
export function getAdjustedDate(
    originalDateStr: string,
    adjustment: 'before' | 'after' | 'skip',
    workDays: number[] = [1, 2, 3, 4, 5],
    holidays: string[] = []
): string | null {
    const originalDate = parseLocalDate(originalDateStr);
    
    // 本来の日付が営業日なら、調整の必要なくその日が生成日
    if (isWorkDay(originalDate, workDays, holidays)) {
        return originalDateStr;
    }
    
    // 本来の日付が休日の場合、調整ルールに従う
    if (adjustment === 'skip') {
        return null; // 生成されない
    }
    
    if (adjustment === 'after') {
        // 翌営業日を取得
        return getNextWorkDay(originalDateStr, workDays, holidays);
    }
    
    if (adjustment === 'before') {
        // 前営業日を取得
        return getPrevWorkDay(originalDateStr, workDays, holidays);
    }
    
    return null;
}

/**
 * タスクノートが安全に同期（テンプレートで上書き）可能かを判定する（ドメインルール）
 * @param noteBody 現在のノート本文
 * @param oldTemplate 更新前のテンプレート本文
 */
export function isNoteSafeToSync(noteBody: string, oldTemplate?: string): boolean {
    return noteBody.trim() === '' || (oldTemplate !== undefined && noteBody === oldTemplate);
}
