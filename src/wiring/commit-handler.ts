import { logger, configureLogger } from '@/core/logger';
import * as globalRenderer from '@/features/global/renderer';
import * as inboxRenderer from '@/features/inbox/renderer';
import * as linksRenderer from '@/features/links/renderer';
import * as routineLogic from '@/features/routine/logic';
import * as routineRenderer from '@/features/routine/renderer';
import * as tasksRenderer from '@/features/tasks/renderer';
import * as notesLogic from '@/features/notes/logic';
import * as notesRenderer from '@/features/notes/renderer';
import { el } from '@/core/el';
import { Note } from '@/types';
import { WiringContext } from './context';

function renderActiveNote(ctx: WiringContext, note: Note, isEditMode: boolean) {
    let taskText: string | undefined;
    let routineId: string | undefined;
    if (note.type === 'task' && note.taskId) {
        const task = ctx.store.tasks.getState().find(t => t.id === note.taskId);
        taskText = task?.text;
        routineId = task?.routineId;
    }
    notesRenderer.renderNoteArea(note, isEditMode, taskText, routineId);
}

export async function initialRender(ctx: WiringContext) {
    const uiState = ctx.store.ui.getState();
    globalRenderer.updateDateDisplay(uiState.currentDate);
    inboxRenderer.renderInboxList(ctx.store.inboxItems.getAll());
    linksRenderer.renderLinks(ctx.store.commonLinks.getAll());
    const masters = await routineLogic.getMasters({ routine: ctx.store.routine });
    routineRenderer.renderMasterList(masters);
    const dayTasks = ctx.store.tasks.getState().filter(t => t.date === uiState.currentDate);
    tasksRenderer.renderTaskList(dayTasks, uiState.activeTaskId || undefined);
    tasksRenderer.updateCarryOverButtonVisibility(uiState.currentDate);
    const note = await notesLogic.getActiveNote({ notes: ctx.store.notes, ui: ctx.store.ui, tasks: ctx.store.tasks });
    renderActiveNote(ctx, note, uiState.isEditMode);
    globalRenderer.updateUndoRedoButtons(ctx.store.canUndo(), ctx.store.canRedo());
}

export function wireCommitHandler(ctx: WiringContext) {
    ctx.store.onCommit(async (dirty) => {
        const uiState = ctx.store.ui.getState();

        // ログ設定の変更を監視
        if (dirty.has('config')) {
            configureLogger(ctx.store.config.getState());
        }

        // デバッグログ
        if (uiState.debugMode && dirty.size > 0) {
            logger.debug(`[Commit] Dirty stores: ${Array.from(dirty).join(', ')}`);
        }

        if (!uiState.isAppReady) return;

        if (dirty.has('ui') || dirty.has('tasks') || dirty.has('notes') || dirty.has('inboxItems') || dirty.has('commonLinks')) {
            globalRenderer.updateDateDisplay(uiState.currentDate);
        }

        if (dirty.has('inboxItems')) {
            inboxRenderer.renderInboxList(ctx.store.inboxItems.getAll());
        }

        if (dirty.has('commonLinks')) {
            linksRenderer.renderLinks(ctx.store.commonLinks.getAll());
        }

        if (dirty.has('routine')) {
            const masters = await routineLogic.getMasters({ routine: ctx.store.routine });
            routineRenderer.renderMasterList(masters);
        }

        if (dirty.has('tasks') || dirty.has('ui')) {
            const dayTasks = ctx.store.tasks.getState().filter(t => t.date === uiState.currentDate);
            tasksRenderer.renderTaskList(dayTasks, uiState.activeTaskId || undefined);
            tasksRenderer.updateCarryOverButtonVisibility(uiState.currentDate);

            if (uiState.activeTaskId) {
                setTimeout(() => {
                    const activeEl = el.tasks.list.querySelector(`.task-item[data-id="${uiState.activeTaskId}"]`);
                    if (activeEl) {
                        activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                    }
                }, 0);
            }
        }

        if (dirty.has('notes') || dirty.has('ui') || dirty.has('tasks')) {
            const note = await notesLogic.getActiveNote({ notes: ctx.store.notes, ui: ctx.store.ui, tasks: ctx.store.tasks });
            renderActiveNote(ctx, note, uiState.isEditMode);
        }

        // Undo/Redoボタンの状態同期
        globalRenderer.updateUndoRedoButtons(ctx.store.canUndo(), ctx.store.canRedo());
    });
}
