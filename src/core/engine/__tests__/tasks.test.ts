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
});
