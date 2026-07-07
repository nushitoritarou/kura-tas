import { describe, it, expect } from 'vitest';
import { computeMissingPeriodicTasks } from '../periodic';
import { PeriodicTask, Task } from '@/types';

describe('periodicEngine', () => {
    describe('computeMissingPeriodicTasks', () => {
        const masters: PeriodicTask[] = [
            { id: '1', text: 'Daily Task', days: [0, 1, 2, 3, 4, 5, 6] },
            { id: '2', text: 'Mon Task', days: [1] },
            { id: '3', text: 'Tue Task', days: [2] },
        ];

        it('指定した日の曜日が対象のマスタからタスクを生成すること', () => {
            // 2026-06-08 is Monday (getDay() === 1)
            const date = '2026-06-08';
            const existingTasks: Task[] = [];
            const result = computeMissingPeriodicTasks(masters, existingTasks, date);
            
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
            const result = computeMissingPeriodicTasks(masters, existingTasks, date);
            
            expect(result).toHaveLength(1);
            expect(result[0].text).toBe('Mon Task');
            expect(result[0].periodicId).toBe('2');
        });
    });
});
