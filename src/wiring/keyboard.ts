import { el } from '@/core/el';
import * as globalLogic from '@/features/global/logic';
import * as globalRenderer from '@/features/global/renderer';
import * as tasksLogic from '@/features/tasks/logic';
import * as routineLogic from '@/features/routine/logic';
import * as routineRenderer from '@/features/routine/renderer';
import * as holidaysRenderer from '@/features/holidays/renderer';
import { handleSaveNote, switchToEditMode } from './notes';
import { WiringContext } from './context';

export function wireKeyboard(ctx: WiringContext): void {
    let lastKey = '';
    let lastKeyTime = 0;

    const isNormalMode = (): boolean => {
        const active = document.activeElement;
        if (!active) return true;
        const tagName = active.tagName.toLowerCase();
        if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
            return false;
        }
        if (active.hasAttribute('contenteditable')) {
            return false;
        }
        return true;
    };

    const isAnyModalOpen = (): boolean => {
        return (
            (el.setup.overlay && el.setup.overlay.style.display !== 'none') ||
            el.modals.shortcuts.root.style.display === 'flex' ||
            el.modals.routine.root.style.display === 'flex' ||
            el.modals.holidays.root.style.display === 'flex' ||
            el.modals.import.root.style.display === 'flex' ||
            el.modals.quickAdd.root.style.display === 'flex'
        );
    };

    const getNextActiveTaskId = (activeId: string): string | null => {
        const currentDate = ctx.store.ui.getState().currentDate;
        const dayTasks = ctx.store.tasks.getState().filter(t => t.date === currentDate);
        return tasksLogic.getTaskIdAfterRemoval(dayTasks, activeId);
    };

    window.onkeydown = async (e) => {
        // インサートモード（フォーカス中）でも動作する Esc キーのハンドリング
        if (e.key === 'Escape') {
            lastKey = ''; // バッファクリア
            const active = document.activeElement;
            if (active && (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement)) {
                active.blur();
                e.preventDefault();
                return;
            }
            // ショートカットモーダルが開いていたら閉じる
            if (globalRenderer.isShortcutsModalShown()) {
                globalRenderer.toggleShortcutsModal(false);
                e.preventDefault();
            }
            // 定期タスクモーダルが開いていたら閉じる
            if (el.modals.routine.root.style.display === 'flex') {
                routineRenderer.toggleRoutineModal(false);
                e.preventDefault();
            }
            // 休日設定モーダルが開いていたら閉じる
            if (el.modals.holidays.root.style.display === 'flex') {
                holidaysRenderer.toggleHolidaysModal(false);
                e.preventDefault();
            }
            // インポートモーダルが開いていたら閉じる
            if (el.modals.import.root.style.display === 'flex') {
                el.modals.import.root.style.display = 'none';
                e.preventDefault();
            }
            // クイックタスク追加モーダルが開いていたら閉じる
            if (el.modals.quickAdd.root.style.display === 'flex') {
                el.modals.quickAdd.root.style.display = 'none';
                e.preventDefault();
            }
            return;
        }

        // 各種モーダルが開いている場合は、Escape 以外のキー入力を無効化する
        if (isAnyModalOpen()) {
            return;
        }

        // 入力中の場合は通常の入力を優先（ショートカットを無効化）
        if (!isNormalMode()) {
            lastKey = ''; // バッファクリア
            // 例外的に、インサートモードでのCtrl系ショートカットは許可する
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 's') {
                    if (document.activeElement === el.notes.editor) {
                        e.preventDefault();
                        await handleSaveNote(ctx);
                    }
                }
            }
            return;
        }

        // ここからノーマルモードのショートカット
        if (e.ctrlKey || e.metaKey) {
            lastKey = ''; // バッファクリア
            if (e.key === 's') {
                e.preventDefault();
                await handleSaveNote(ctx);

            } else if (e.key === 'z') {
                e.preventDefault();
                await ctx.store.undo();
            } else if (e.key === 'y') {
                e.preventDefault();
                await ctx.store.redo();
            }
            return;
        }

        // 単一キー
        const now = Date.now();
        const isDoubleD = lastKey === 'd' && e.key === 'd' && (now - lastKeyTime < 1000);
        const isDoubleG = lastKey === 'g' && e.key === 'g' && (now - lastKeyTime < 1000);

        // キーバッファの更新
        if (e.key === 'd' && !isDoubleD) {
            lastKey = 'd';
            lastKeyTime = now;
            return;
        }
        if (e.key === 'g' && !isDoubleG) {
            lastKey = 'g';
            lastKeyTime = now;
            return;
        }

        lastKey = ''; // リセット

        // 各種キーのハンドリング
        if (e.key === 'j' || e.key === 'ArrowDown') {
            e.preventDefault();
            const currentDate = ctx.store.ui.getState().currentDate;
            const dayTasks = ctx.store.tasks.getState().filter(t => t.date === currentDate);
            const currentId = ctx.store.ui.getState().activeTaskId;
            const nextId = tasksLogic.getNextTaskId(dayTasks, currentId);
            if (nextId) {
                await ctx.dispatchAction(async () => {
                    ctx.store.ui.update({ activeTaskId: nextId });
                }, { recordHistory: false });
            }
        } else if (e.key === 'k' || e.key === 'ArrowUp') {
            e.preventDefault();
            const currentDate = ctx.store.ui.getState().currentDate;
            const dayTasks = ctx.store.tasks.getState().filter(t => t.date === currentDate);
            const currentId = ctx.store.ui.getState().activeTaskId;
            const prevId = tasksLogic.getPrevTaskId(dayTasks, currentId);
            if (prevId) {
                await ctx.dispatchAction(async () => {
                    ctx.store.ui.update({ activeTaskId: prevId });
                }, { recordHistory: false });
            }
        } else if (isDoubleG) {
            e.preventDefault();
            const currentDate = ctx.store.ui.getState().currentDate;
            const dayTasks = ctx.store.tasks.getState().filter(t => t.date === currentDate);
            if (dayTasks.length > 0) {
                await ctx.dispatchAction(async () => {
                    ctx.store.ui.update({ activeTaskId: dayTasks[0].id });
                }, { recordHistory: false });
            }
        } else if (e.key === 'G') {
            e.preventDefault();
            const currentDate = ctx.store.ui.getState().currentDate;
            const dayTasks = ctx.store.tasks.getState().filter(t => t.date === currentDate);
            if (dayTasks.length > 0) {
                await ctx.dispatchAction(async () => {
                    ctx.store.ui.update({ activeTaskId: dayTasks[dayTasks.length - 1].id });
                }, { recordHistory: false });
            }
        } else if (e.key === 'h' || e.key === 'ArrowLeft') {
            e.preventDefault();
            await ctx.dispatchAction(async () => {
                const nextDate = await globalLogic.shiftCurrentDate(-1, ctx.store);
                await routineLogic.generateTasksFromRoutine(nextDate, { routine: ctx.store.routine, tasks: ctx.store.tasks, config: ctx.store.config, notes: ctx.store.notes });
            }, { recordHistory: false });
            ctx.store.resetHistory();
        } else if (e.key === 'l' || e.key === 'ArrowRight') {
            e.preventDefault();
            await ctx.dispatchAction(async () => {
                const nextDate = await globalLogic.shiftCurrentDate(1, ctx.store);
                await routineLogic.generateTasksFromRoutine(nextDate, { routine: ctx.store.routine, tasks: ctx.store.tasks, config: ctx.store.config, notes: ctx.store.notes });
            }, { recordHistory: false });
            ctx.store.resetHistory();
        } else if (e.key === 'Home' || e.key === '0' || e.key === '^') {
            e.preventDefault();
            await ctx.dispatchAction(async () => {
                const nextDate = await globalLogic.jumpToToday(ctx.store);
                await routineLogic.generateTasksFromRoutine(nextDate, { routine: ctx.store.routine, tasks: ctx.store.tasks, config: ctx.store.config, notes: ctx.store.notes });
            }, { recordHistory: false });
            ctx.store.resetHistory();
        } else if (e.key === 'x') {
            e.preventDefault();
            const activeId = ctx.store.ui.getState().activeTaskId;
            if (activeId) {
                await ctx.dispatchAction(async () => {
                    await tasksLogic.toggleTaskDone(activeId, ctx.store);
                });
            }
        } else if (e.key === 'w') {
            e.preventDefault();
            const activeId = ctx.store.ui.getState().activeTaskId;
            if (activeId) {
                await ctx.dispatchAction(async () => {
                    await tasksLogic.toggleTaskDelegated(activeId, ctx.store);
                });
            }
        } else if (isDoubleD) {
            e.preventDefault();
            const activeId = ctx.store.ui.getState().activeTaskId;
            if (activeId) {
                const nextActiveId = getNextActiveTaskId(activeId);
                await ctx.dispatchAction(async () => {
                    await tasksLogic.deleteTask(activeId, ctx.store);
                    ctx.store.ui.update({ activeTaskId: nextActiveId });
                }, { recordHistory: false });
            }
        } else if (e.key === 'a' || e.key === 'A') {
            e.preventDefault();
            const activeId = ctx.store.ui.getState().activeTaskId;
            if (activeId) {
                const task = ctx.store.tasks.find(activeId);
                if (task) {
                    const newText = globalRenderer.promptUser('名称編集', task.text);
                    if (newText !== null) {
                        await ctx.dispatchAction(async () => {
                            await tasksLogic.renameTask(activeId, newText.trim(), ctx.store);
                        });
                    }
                }
            }
        } else if (e.key === 'm') {
            e.preventDefault();
            const activeId = ctx.store.ui.getState().activeTaskId;
            if (activeId) {
                const nextActiveId = getNextActiveTaskId(activeId);
                await ctx.dispatchAction(async () => {
                    await tasksLogic.moveTaskToNextWorkDay(activeId, ctx.store);
                    ctx.store.ui.update({ activeTaskId: nextActiveId });
                });
            }
        } else if (e.key === 'i') {
            e.preventDefault();
            el.inbox.input.focus();
        } else if (e.key === 'e') {
            e.preventDefault();
            await switchToEditMode(ctx);
        } else if (e.key === '?' || e.key === 'Help') {
            e.preventDefault();
            // ショートカットモーダルの表示状態をトグル
            const isShown = globalRenderer.isShortcutsModalShown();
            globalRenderer.toggleShortcutsModal(!isShown);
        } else if (e.key === 'o') {
            e.preventDefault();
            el.modals.quickAdd.root.style.display = 'flex';
            el.modals.quickAdd.input.value = '';
            setTimeout(() => {
                el.modals.quickAdd.input.focus();
            }, 50);
        } else if (e.key === 'u') {
            e.preventDefault();
            await ctx.store.undo();
        }
    };
}
