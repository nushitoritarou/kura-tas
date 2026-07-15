import { RoutineTask, Task, DAYS_MAP } from "@/types";
import { createTask } from "./factories";
import { isWorkDay, getPrevWorkDay, getNextWorkDay, formatDate } from "./datetime";

export type DayOfWeekStr = 'Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat';

/** 日付ごとの不足タスク計算（純粋関数） */
export function computeMissingRoutineTasks(
    masters: RoutineTask[], 
    existingTasks: Task[], 
    date: string,
    workDays: number[] = [1, 2, 3, 4, 5],
    holidays: string[] = []
): Task[] {
    const targetDate = new Date(date);
    if (!isWorkDay(targetDate, workDays, holidays)) {
        return [];
    }

    const newTasks: Task[] = [];

    for (const m of masters) {
        if (!m.schedule || m.schedule.type !== 'weekly' || !m.schedule.days || m.schedule.days.length === 0) {
            continue;
        }

        // すでに existingTasks に routineId === m.id があるかチェック
        if (existingTasks.some(t => t.routineId === m.id)) {
            continue;
        }

        const adjustment = m.holiday_adjustment || 'skip';

        // 1. 本来の日付で営業日の場合
        const targetDayNum = targetDate.getDay();
        const targetDayStr = DAYS_MAP[targetDayNum];
        const isScheduledToday = m.schedule.days.includes(targetDayStr);

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

                // この期間の各日付について、mのスケジュール曜日が含まれるか判定
                for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                    const dayStr = DAYS_MAP[d.getDay()];
                    if (m.schedule.days.includes(dayStr)) {
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

                // この期間の各日付について、mのスケジュール曜日が含まれるか判定
                for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                    const dayStr = DAYS_MAP[d.getDay()];
                    if (m.schedule.days.includes(dayStr)) {
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
    const originalDate = new Date(originalDateStr);
    
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
