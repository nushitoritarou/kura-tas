
import { describe, it, expect } from 'vitest';
import * as factories from '../factories';

describe('factories', () => {
    it('createInboxItem が正しい構造で生成されること', () => {
        const item = factories.createInboxItem('test item');
        expect(item.id).toBeDefined();
        expect(item.text).toBe('test item');
    });

    it('createTask が正しい構造で生成されること', () => {
        const task = factories.createTask('test task', '2024-06-01');
        expect(task.id).toBeDefined();
        expect(task.text).toBe('test task');
        expect(task.date).toBe('2024-06-01');
        expect(task.done).toBe(false);
    });

    it('createCommonLink が正しい構造で生成されること', () => {
        const link = factories.createCommonLink('Google', 'https://google.com');
        expect(link.id).toBeDefined();
        expect(link.title).toBe('Google');
        expect(link.url).toBe('https://google.com');
    });

    it('getNoteId が正しいIDを生成すること', () => {
        expect(factories.getNoteId('task', '123')).toBe('task-123');
        expect(factories.getNoteId('daily', '2024-06-01')).toBe('daily-2024-06-01');
    });

    it('createNote が正しい構造で生成されること', () => {
        const note = factories.createNote({
            body: 'test body',
            title: 'test title',
            date: '2024-06-01',
            type: 'daily'
        });
        expect(note.id).toBe('daily-2024-06-01');
        expect(note.body).toBe('test body');
        expect(note.type).toBe('daily');
    });
});
