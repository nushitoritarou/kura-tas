import { describe, it, expect } from 'vitest';
import * as ui from '../ui';
import { Task } from '@/types';

describe('tasks ui', () => {
    it('generateTaskListHtml が空の時にメッセージを返すこと', () => {
        const html = ui.generateTaskListHtml([]);
        expect(html).toContain('タスクはありません');
    });

    it('generateTaskListHtml がタスクリストを生成すること', () => {
        const tasks: Task[] = [
            { id: '1', text: 'task 1', originalDate: "2024-06-01", date: '2024-06-01', done: false },
            { id: '2', text: 'task 2', originalDate: "2024-06-01", date: '2024-06-01', done: true }
        ];
        const html = ui.generateTaskListHtml(tasks);
        expect(html).toContain('task 1');
        expect(html).toContain('task 2');
        expect(html).toContain('task-item');
        expect(html).toContain('done');
    });

    it('activeTaskId が指定された時に active クラスを付与すること', () => {
        const tasks: Task[] = [
            { id: '1', text: 'task 1', originalDate: "2024-06-01", date: '2024-06-01', done: false }
        ];
        const html = ui.generateTaskListHtml(tasks, '1');
        expect(html).toContain('active');
    });
});
