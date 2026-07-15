import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getActiveNote, saveNote, getNoteForTask } from '../logic';
import { NoteStore } from '@/core/store/NoteStore';
import { UIStore } from '@/core/store/UIStore';
import { TaskStore } from '@/core/store/TaskStore';

describe('notes logic', () => {
    let notes: NoteStore;
    let ui: UIStore;
    let tasks: TaskStore;

    beforeEach(() => {
        notes = {
            getNote: vi.fn(),
            saveNote: vi.fn(),
        } as any;
        ui = {
            getState: vi.fn().mockReturnValue({ currentDate: '2026-06-07', activeTaskId: null }),
        } as any;
        tasks = {
            getState: vi.fn().mockReturnValue([]),
        } as any;
    });

    describe('getActiveNote', () => {
        it('アクティブなタスクがない場合、日次ノートを返すこと', async () => {
            await getActiveNote({ notes, ui, tasks });
            expect(notes.getNote).toHaveBeenCalledWith('daily-2026-06-07', { date: '2026-06-07' });
        });

        it('アクティブなタスクがある場合、タスクノートを返すこと', async () => {
            ui.getState = vi.fn().mockReturnValue({ currentDate: '2026-06-07', activeTaskId: '1' });
            tasks.getState = vi.fn().mockReturnValue([{ id: '1', text: 'Test Task' }]);
            
            await getActiveNote({ notes, ui, tasks });
            expect(notes.getNote).toHaveBeenCalledWith('task-1', { date: '2026-06-07', taskId: '1' });
        });
    });

    describe('saveNote', () => {
        it('notes storeのsaveNoteを呼び出すこと', async () => {
            const note = { id: 'test', title: 'test', body: 'body', date: '2026-06-07', type: 'daily' } as any;
            await saveNote(note, { notes });
            expect(notes.saveNote).toHaveBeenCalledWith(note);
        });
    });

    describe('getNoteForTask', () => {
        it('指定されたタスクに紐づくノートを返すこと', async () => {
            tasks.getState = vi.fn().mockReturnValue([{ id: 'task-123', text: 'Test Task', date: '2026-06-07' }]);
            await getNoteForTask('task-123', '2026-06-07', { notes, tasks });
            expect(notes.getNote).toHaveBeenCalledWith('task-task-123', { date: '2026-06-07', taskId: 'task-123' });
        });

        it('タスクが存在しない場合エラーになること', async () => {
            tasks.getState = vi.fn().mockReturnValue([]);
            await expect(getNoteForTask('task-123', '2026-06-07', { notes, tasks }))
                .rejects.toThrow('指定されたタスクが見つかりません');
        });
    });
});
