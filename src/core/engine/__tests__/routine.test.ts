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
            expect(result[0].periodicId).toBe('1');
            expect(result[1].text).toBe('Mon Task');
            expect(result[1].periodicId).toBe('2');
        });

        it('既にタスクが存在する場合は生成しないこと', () => {
            const date = '2026-06-08';
            const existingTasks: Task[] = [
                { id: 'a', text: 'Daily Task', done: false, originalDate: date, date, periodicId: '1' }
            ];
            const result = computeMissingRoutineTasks(masters, existingTasks, date);
            
            expect(result).toHaveLength(1);
            expect(result[0].text).toBe('Mon Task');
            expect(result[0].periodicId).toBe('2');
        });
    });
});
