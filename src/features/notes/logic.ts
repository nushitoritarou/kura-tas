import { NoteStore } from '@/core/store/NoteStore';
import { UIStore } from '@/core/store/UIStore';
import { TaskStore } from '@/core/store/TaskStore';
import { Note } from '@/types';
import { getNoteId } from '@/core/engine/factories';

/** 現在のコンテキストに最適な Note オブジェクトを取得する (Storeから取得) */
export async function getActiveNote(deps: { notes: NoteStore; ui: UIStore; tasks: TaskStore }): Promise<Note> {
    const { notes, ui, tasks } = deps;
    const date = ui.getState().currentDate;
    const activeTaskId = ui.getState().activeTaskId;
    
    if (activeTaskId) {
        const task = tasks.getState().find(t => t.id === activeTaskId);
        if (task) {
            const noteId = task.noteId || getNoteId('task', task.id);
            return await notes.getNote(noteId, { date, taskId: task.id });
        }
    }
    
    const noteId = getNoteId('daily', date);
    return await notes.getNote(noteId, { date });
}

/** Note オブジェクトを保存する (Storeへそのまま渡す) */
export async function saveNote(note: Note, deps: { notes: NoteStore }): Promise<void> {
    await deps.notes.saveNote(note);
}

/** 特定のタスクに紐づく Note オブジェクトを取得する */
export async function getNoteForTask(
    taskId: string,
    date: string,
    deps: { notes: NoteStore; tasks: TaskStore }
): Promise<Note> {
    const { notes, tasks } = deps;
    const task = tasks.getState().find(t => t.id === taskId);
    if (!task) throw new Error('指定されたタスクが見つかりません');
    
    const noteId = task.noteId || getNoteId('task', task.id);
    return await notes.getNote(noteId, { date, taskId: task.id });
}
