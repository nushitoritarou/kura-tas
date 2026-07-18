import { el } from '@/core/el';
import * as notesLogic from '@/features/notes/logic';
import * as notesRenderer from '@/features/notes/renderer';
import * as routineLogic from '@/features/routine/logic';
import * as globalRenderer from '@/features/global/renderer';
import { WiringContext } from './context';

export async function handleSaveNote(ctx: WiringContext): Promise<void> {
    try {
        const note = await notesLogic.getActiveNote({ notes: ctx.store.notes, ui: ctx.store.ui, tasks: ctx.store.tasks });
        if (note.body === el.notes.editor.value) {
            return;
        }
        await ctx.dispatchAction(async () => {
            const activeNote = await notesLogic.getActiveNote({ notes: ctx.store.notes, ui: ctx.store.ui, tasks: ctx.store.tasks });
            activeNote.body = el.notes.editor.value;
            await notesLogic.saveNote(activeNote, { notes: ctx.store.notes });
            notesRenderer.showSaveStatus('Saved');
        });
    } catch (e: any) {
        globalRenderer.notifyError(e.message || 'ノートの保存中にエラーが発生しました');
    }
}

export function wireNotes(ctx: WiringContext): void {
    el.notes.btnSave.onclick = async () => {
        await handleSaveNote(ctx);
    };

    el.notes.editor.onblur = async () => {
        await handleSaveNote(ctx);
    };

    el.notes.btnToggleView.onclick = async () => {
        const uiState = ctx.store.ui.getState();
        if (uiState.isEditMode) {
            await handleSaveNote(ctx);
        }
        await ctx.dispatchAction(async () => {
            ctx.store.ui.update({ isEditMode: !uiState.isEditMode });
        });
    };

    const handlePromoteNote = async () => {
        const btnPromote = el.notes.btnPromote;
        const routineId = btnPromote?.dataset.routineId;
        if (!routineId) return;

        if (globalRenderer.confirmAction('このノートを定期タスクのテンプレートとして登録/更新しますか？\n（当日・未来の未編集のタスクノートにも反映されます）')) {
            await ctx.dispatchAction(async () => {
                const note = await notesLogic.getActiveNote({ notes: ctx.store.notes, ui: ctx.store.ui, tasks: ctx.store.tasks });
                note.body = el.notes.editor.value;
                
                // まず現在のノートを保存
                await notesLogic.saveNote(note, { notes: ctx.store.notes });

                // テンプレートに昇格
                await routineLogic.promoteNoteToTemplate(
                    routineId,
                    note.body,
                    { routine: ctx.store.routine, tasks: ctx.store.tasks, notes: ctx.store.notes, config: ctx.store.config }
                );
                
                notesRenderer.showSaveStatus('Promoted & Synced');
            });
        }
    };

    if (el.notes.btnPromote) {
        el.notes.btnPromote.onclick = handlePromoteNote;
    }
}
