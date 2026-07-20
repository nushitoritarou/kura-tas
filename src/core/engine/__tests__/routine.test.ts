import { describe, it, expect } from 'vitest';
import { computeMissingRoutineTasks, isNoteSafeToSync } from '../routine';
import { RoutineTask, Task } from '@/types';

describe('routineEngine', () => {
    describe('computeMissingRoutineTasks', () => {
        const masters: RoutineTask[] = [
            { id: '1', text: 'Daily Task', schedule: { type: 'weekly', days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] } },
            { id: '2', text: 'Mon Task', schedule: { type: 'weekly', days: ['Mon'] } },
            { id: '3', text: 'Tue Task', schedule: { type: 'weekly', days: ['Tue'] } },
            { id: '4', text: 'Manual Task', schedule: { type: 'none' } }, // 手動タスク（スケジュールなし）は自動生成の対象外
        ];

        it('指定した日の曜日が対象のマスタからタスクを生成すること', () => {
            // 2026-06-08 is Monday (getDay() === 1)
            const date = '2026-06-08';
            const existingTasks: Task[] = [];
            const result = computeMissingRoutineTasks(masters, existingTasks, date);
            
            expect(result).toHaveLength(2);
            expect(result[0].text).toBe('Daily Task');
            expect(result[0].routineId).toBe('1');
            expect(result[1].text).toBe('Mon Task');
            expect(result[1].routineId).toBe('2');
        });

        it('既にタスクが存在する場合は生成しないこと', () => {
            const date = '2026-06-08';
            const existingTasks: Task[] = [
                { id: 'a', text: 'Daily Task', done: false, originalDate: date, date, routineId: '1' }
            ];
            const result = computeMissingRoutineTasks(masters, existingTasks, date);
            
            expect(result).toHaveLength(1);
            expect(result[0].text).toBe('Mon Task');
            expect(result[0].routineId).toBe('2');
        });

        it('祝日かつスキップルールの場合は生成しないこと', () => {
            const date = '2026-06-08'; // Monday
            const testMasters: RoutineTask[] = [
                { id: '1', text: 'Mon Task', schedule: { type: 'weekly', days: ['Mon'] }, holiday_adjustment: 'skip' }
            ];
            // 2026-06-08 を祝日に指定
            const result = computeMissingRoutineTasks(testMasters, [], date, [1, 2, 3, 4, 5], ['2026-06-08']);
            expect(result).toHaveLength(0);
        });

        it('祝日かつ後営業日移動の場合、翌営業日にタスクが移動して生成されること', () => {
            const testMasters: RoutineTask[] = [
                { id: '1', text: 'Mon Task', schedule: { type: 'weekly', days: ['Mon'] }, holiday_adjustment: 'after' }
            ];
            const workDays = [1, 2, 3, 4, 5];
            const holidays = ['2026-06-08']; // 6/8(月)は祝日

            // 6/8(月祝)の判定 -> 生成されない
            const resultOnHoliday = computeMissingRoutineTasks(testMasters, [], '2026-06-08', workDays, holidays);
            expect(resultOnHoliday).toHaveLength(0);

            // 6/9(火)の判定 -> 月曜のタスクが移動して火曜に生成される
            const resultOnNextDay = computeMissingRoutineTasks(testMasters, [], '2026-06-09', workDays, holidays);
            expect(resultOnNextDay).toHaveLength(1);
            expect(resultOnNextDay[0].text).toBe('Mon Task');
            expect(resultOnNextDay[0].date).toBe('2026-06-09');
            expect(resultOnNextDay[0].originalDate).toBe('2026-06-08'); // 本来の予定日がoriginalDateにセットされていること
        });

        it('祝日かつ前営業日移動の場合、前営業日にタスクが前倒しされて生成されること', () => {
            const testMasters: RoutineTask[] = [
                { id: '1', text: 'Mon Task', schedule: { type: 'weekly', days: ['Mon'] }, holiday_adjustment: 'before' }
            ];
            const workDays = [1, 2, 3, 4, 5];
            const holidays = ['2026-06-08']; // 6/8(月)は祝日

            // 6/5(金)の判定 -> 月曜のタスクが前倒しされて金曜に生成される
            const resultOnPrevDay = computeMissingRoutineTasks(testMasters, [], '2026-06-05', workDays, holidays);
            expect(resultOnPrevDay).toHaveLength(1);
            expect(resultOnPrevDay[0].text).toBe('Mon Task');
            expect(resultOnPrevDay[0].date).toBe('2026-06-05');
            expect(resultOnPrevDay[0].originalDate).toBe('2026-06-08'); // 本来の予定日がoriginalDateにセットされていること

            // 6/8(月祝)の判定 -> 生成されない
            const resultOnHoliday = computeMissingRoutineTasks(testMasters, [], '2026-06-08', workDays, holidays);
            expect(resultOnHoliday).toHaveLength(0);
        });

        it('週おき (interval) 指定の定型タスクが正しく生成されること', () => {
            const testMasters: RoutineTask[] = [
                {
                    id: '1',
                    text: 'Bi-weekly Task',
                    schedule: {
                        type: 'interval',
                        days: ['Mon'],
                        intervalWeeks: 2,
                        baseDate: '2026-06-08' // 月曜日
                    }
                }
            ];
            // 基準週 (2026-06-08) -> 生成される
            const resBase = computeMissingRoutineTasks(testMasters, [], '2026-06-08');
            expect(resBase).toHaveLength(1);

            // 1週後 (2026-06-15) -> 生成されない
            const res1w = computeMissingRoutineTasks(testMasters, [], '2026-06-15');
            expect(res1w).toHaveLength(0);

            // 2週後 (2026-06-22) -> 生成される
            const res2w = computeMissingRoutineTasks(testMasters, [], '2026-06-22');
            expect(res2w).toHaveLength(1);
        });

        it('毎月日付 (monthly-day) 指定の定型タスクが正しく生成されること', () => {
            const testMasters: RoutineTask[] = [
                { id: '1', text: 'Day 25 Task', schedule: { type: 'monthly-day', monthlyDay: 25 } },
                { id: '2', text: 'End of Month Task', schedule: { type: 'monthly-day', monthlyDay: 'last' } },
                { id: '3', text: 'Day 31 Task', schedule: { type: 'monthly-day', monthlyDay: 31 } }
            ];

            // 6月25日 -> Day 25 が生成される
            const res25 = computeMissingRoutineTasks(testMasters, [], '2026-06-25');
            expect(res25).toHaveLength(1);
            expect(res25[0].text).toBe('Day 25 Task');

            // 6月30日 (6月の最終日) -> End of Month と Day 31 が生成される (6月は30日までなので31日が前倒し)
            const res30 = computeMissingRoutineTasks(testMasters, [], '2026-06-30');
            expect(res30).toHaveLength(2);
            expect(res30.map(t => t.text)).toContain('End of Month Task');
            expect(res30.map(t => t.text)).toContain('Day 31 Task');

            // 7月31日 -> End of Month と Day 31 が生成される (7月は31日までなので予定通り)
            const res31 = computeMissingRoutineTasks(testMasters, [], '2026-07-31');
            expect(res31).toHaveLength(2);
            expect(res31.map(t => t.text)).toContain('End of Month Task');
            expect(res31.map(t => t.text)).toContain('Day 31 Task');
        });

        it('毎月第N曜日 (monthly-weekday) 指定の定型タスクが正しく生成されること', () => {
            const testMasters: RoutineTask[] = [
                { id: '1', text: '2nd Tuesday Task', schedule: { type: 'monthly-weekday', days: ['Tue'], weekIndex: 2 } },
                { id: '2', text: 'Last Monday Task', schedule: { type: 'monthly-weekday', days: ['Mon'], weekIndex: 'last' } }
            ];

            // 2026-06-02 is 1st Tuesday -> 生成されない
            expect(computeMissingRoutineTasks(testMasters, [], '2026-06-02')).toHaveLength(0);

            // 2026-06-09 is 2nd Tuesday -> 生成される
            const res2ndTue = computeMissingRoutineTasks(testMasters, [], '2026-06-09');
            expect(res2ndTue).toHaveLength(1);
            expect(res2ndTue[0].text).toBe('2nd Tuesday Task');

            // 2026-06-22 is 4th Monday (but not last since 6/29 is also Mon) -> 生成されない
            expect(computeMissingRoutineTasks(testMasters, [], '2026-06-22')).toHaveLength(0);

            // 2026-06-29 is last Monday -> 生成される
            const resLastMon = computeMissingRoutineTasks(testMasters, [], '2026-06-29');
            expect(resLastMon).toHaveLength(1);
            expect(resLastMon[0].text).toBe('Last Monday Task');
        });

        it('2月の月末（うるう年/平年）において毎月日付 (monthly-day) 31日指定が正しく最終日に生成されること', () => {
            const testMasters: RoutineTask[] = [
                { id: '1', text: 'Day 31 Task', schedule: { type: 'monthly-day', monthlyDay: 31 } }
            ];

            // 2024年はうるう年（2月29日）
            // 2/28 -> 生成されない
            expect(computeMissingRoutineTasks(testMasters, [], '2024-02-28')).toHaveLength(0);
            // 2/29 -> 生成される
            const res2024 = computeMissingRoutineTasks(testMasters, [], '2024-02-29');
            expect(res2024).toHaveLength(1);
            expect(res2024[0].text).toBe('Day 31 Task');

            // 2025年は平年（2月28日、金曜日）
            // 2/27 -> 生成されない
            expect(computeMissingRoutineTasks(testMasters, [], '2025-02-27')).toHaveLength(0);
            // 2/28 -> 生成される
            const res2025 = computeMissingRoutineTasks(testMasters, [], '2025-02-28');
            expect(res2025).toHaveLength(1);
            expect(res2025[0].text).toBe('Day 31 Task');
        });

        it('毎月日付指定と休日調整ルールの組み合わせが正しく機能すること', () => {
            const testMastersBefore: RoutineTask[] = [
                { id: '1', text: 'End of Month Task', schedule: { type: 'monthly-day', monthlyDay: 31 }, holiday_adjustment: 'before' }
            ];
            const testMastersAfter: RoutineTask[] = [
                { id: '1', text: 'End of Month Task', schedule: { type: 'monthly-day', monthlyDay: 31 }, holiday_adjustment: 'after' }
            ];

            const workDays = [1, 2, 3, 4, 5]; // 土日休み
            const holidays: string[] = [];

            // 2026年5月31日は日曜日（休日）
            // before の場合、前営業日（5月29日金曜日）に生成されること
            const resBefore = computeMissingRoutineTasks(testMastersBefore, [], '2026-05-29', workDays, holidays);
            expect(resBefore).toHaveLength(1);
            expect(resBefore[0].date).toBe('2026-05-29');
            expect(resBefore[0].originalDate).toBe('2026-05-31');

            // 5月31日当日には生成されないこと
            expect(computeMissingRoutineTasks(testMastersBefore, [], '2026-05-31', workDays, holidays)).toHaveLength(0);

            // after の場合、翌営業日（6月1日月曜日）に生成されること
            const resAfter = computeMissingRoutineTasks(testMastersAfter, [], '2026-06-01', workDays, holidays);
            expect(resAfter).toHaveLength(1);
            expect(resAfter[0].date).toBe('2026-06-01');
            expect(resAfter[0].originalDate).toBe('2026-05-31');
        });
    });

    describe('isNoteSafeToSync', () => {
        it('ノート本文が空の場合は true を返すこと', () => {
            expect(isNoteSafeToSync('')).toBe(true);
            expect(isNoteSafeToSync('   \n  ')).toBe(true);
        });

        it('本文が古いテンプレートと完全に一致する場合は true を返すこと', () => {
            expect(isNoteSafeToSync('Same content', 'Same content')).toBe(true);
        });

        it('本文が異なる場合、かつ空でもない場合は false を返すこと', () => {
            expect(isNoteSafeToSync('User content', 'Template content')).toBe(false);
            expect(isNoteSafeToSync('User content', undefined)).toBe(false);
        });
    });
});
