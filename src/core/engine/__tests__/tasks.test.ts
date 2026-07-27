import { describe, it, expect } from 'vitest';
import * as tasksEngine from '../tasks';

describe('tasksEngine', () => {
    describe('generateUniqueTaskName', () => {
        it('重複がない場合はそのまま返すこと', () => {
            const result = tasksEngine.generateUniqueTaskName('task', '2024-06-01', ['other']);
            expect(result).toBe('task');
        });

        it('重複がある場合は日付付きの名称を返すこと', () => {
            const result = tasksEngine.generateUniqueTaskName('task', '2024-06-01', ['task']);
            expect(result).toBe('task (24/06/01)');
        });

        it('日付付きでも重複する場合は連番を付けること', () => {
            const result = tasksEngine.generateUniqueTaskName('task', '2024-06-01', ['task', 'task (24/06/01)']);
            expect(result).toBe('task (24/06/01 2)');
        });
    });

    describe('sortTasks', () => {
        it('完了状態、他者依頼状態、タスク名順に正しくソートされること', () => {
            const tasks = [
                { id: '1', text: 'C_task', done: true, delegated: false, originalDate: '2024-06-01', date: '2024-06-01' },
                { id: '2', text: 'B_task', done: false, delegated: true, originalDate: '2024-06-01', date: '2024-06-01' },
                { id: '3', text: 'A_task', done: false, delegated: false, originalDate: '2024-06-01', date: '2024-06-01' },
                { id: '4', text: 'D_task', done: false, delegated: false, originalDate: '2024-06-01', date: '2024-06-01' },
                { id: '5', text: 'E_task', done: true, delegated: true, originalDate: '2024-06-01', date: '2024-06-01' }
            ];

            const sorted = tasksEngine.sortTasks(tasks);

            // 期待する順番:
            // 1. 未完了 & 自分でやる: 'A_task' (3), 'D_task' (4)
            // 2. 未完了 & 他者依頼: 'B_task' (2)
            // 3. 完了済 & 自分でやる: 'C_task' (1)
            // 4. 完了済 & 他者依頼: 'E_task' (5)
            expect(sorted.map(t => t.id)).toEqual(['3', '4', '2', '1', '5']);
        });
    });
});
