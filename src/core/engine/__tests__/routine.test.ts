import { describe, it, expect } from 'vitest';
import { computeMissingRoutineTasks } from '../routine';
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
    });
});
