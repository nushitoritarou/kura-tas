import { el } from '@/core/el';
import * as tasksLogic from '@/features/tasks/logic';
import * as notesLogic from '@/features/notes/logic';
import * as routineLogic from '@/features/routine/logic';
import * as routineRenderer from '@/features/routine/renderer';
import * as globalRenderer from '@/features/global/renderer';
import { WiringContext } from './context';

export function wireTasks(ctx: WiringContext): void {
    let isProcessing = false;
    // 5. Tasks関連
    el.tasks.list.onclick = async (e) => {
        const target = e.target as HTMLElement;
        const itemEl = target.closest('.task-item') as HTMLElement;
        if (!itemEl) return;

        const id = itemEl.dataset.id;
        if (!id) return;

        if (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'checkbox') {
            await ctx.dispatchAction(async () => {
                await tasksLogic.toggleTaskDone(id, ctx.store);
            });
        } else {
            await ctx.dispatchAction(async () => {
                ctx.store.ui.update({ activeTaskId: id });
            });
        }
    };

    el.tasks.list.onauxclick = async (e) => {
        if (e.button === 1) { // Middle click
            const itemEl = (e.target as HTMLElement).closest('.task-item') as HTMLElement;
            if (!itemEl) return;

            e.preventDefault();
            const id = itemEl.dataset.id;
            if (id) {
                await ctx.dispatchAction(async () => {
                    await tasksLogic.toggleTaskDone(id, ctx.store);
                });
            }
        }
    };

    el.tasks.list.oncontextmenu = (e) => {
        const itemEl = (e.target as HTMLElement).closest('.task-item') as HTMLElement;
        if (!itemEl) return;

        e.preventDefault();
        const id = itemEl.dataset.id;
        if (!id) return;

        const task = ctx.store.tasks.find(id);
        if (!task) return;

        globalRenderer.displayContextMenu(e.clientX, e.clientY, [
            {
                label: task.delegated ? '他者依頼を解除' : '他者依頼を設定',
                action: async () => {
                    await ctx.dispatchAction(async () => {
                        await tasksLogic.toggleTaskDelegated(id, ctx.store);
                    });
                }
            },
            {
                label: '明日へ移動',
                action: async () => {
                    await ctx.dispatchAction(async () => {
                        await tasksLogic.moveTaskToNextWorkDay(id, ctx.store);
                    });
                }
            },
            {
                label: 'Inboxへ戻す',
                action: async () => {
                    await ctx.dispatchAction(async () => {
                        await tasksLogic.returnToInbox(id, ctx.store);
                    });
                }
            },
            {
                label: '名称編集',
                action: async () => {
                    const newText = globalRenderer.promptUser('名称編集', task.text);
                    if (newText !== null) {
                        await ctx.dispatchAction(async () => {
                            await tasksLogic.renameTask(id, newText.trim(), ctx.store);
                        });
                    }
                }
            },
            {
                label: '定期タスクに登録',
                action: async () => {
                    try {
                        const note = await notesLogic.getNoteForTask(task.id, task.date, { notes: ctx.store.notes, tasks: ctx.store.tasks });
                        const noteBody = note ? note.body : '';

                        const masters = await routineLogic.getMasters({ routine: ctx.store.routine });
                        routineRenderer.renderMasterList(masters);
                        routineRenderer.setupRoutineForm(false, { text: task.text, noteTemplate: noteBody });
                        routineRenderer.toggleRoutineModal(true);
                    } catch (e: any) {
                        globalRenderer.notifyError(e.message || '定期タスク登録の初期化に失敗しました');
                    }
                }
            },
            {
                label: '削除',
                action: async () => {
                    if (globalRenderer.confirmAction('削除しますか？')) {
                        await ctx.dispatchAction(async () => {
                            await tasksLogic.deleteTask(id, ctx.store);
                        });
                    }
                }
            }
        ]);
    };

    // 繰り越し
    const btnCarryOver = el.tasks.btnCarryOver;
    if (btnCarryOver) {
        btnCarryOver.onclick = async () => {
            if (isProcessing) return;
            const uiState = ctx.store.ui.getState();
            const config = ctx.store.config.getState();
            isProcessing = true;
            try {
                // 1. トランザクションの外側であらかじめ対象のノートをキャッシュに載せる
                await tasksLogic.preloadCarryOverNotes(uiState.currentDate, config.carryOverDays ?? 10, ctx.store);
                
                // 2. トランザクション内で繰り越し処理を実行
                await ctx.dispatchAction(async () => {
                    await tasksLogic.carryOverTasks(uiState.currentDate, config.carryOverDays ?? 10, ctx.store);
                });
            } catch (e: any) {
                globalRenderer.notifyError(e.message || '繰り越し処理に失敗しました');
            } finally {
                isProcessing = false;
            }
        };
    }

    // インポート
    const updateImportSample = () => {
        const format = el.modals.import.format.value;
        if (format === 'text') {
            el.modals.import.samplePre.textContent = `要件定義の確認\nAPI設計のレビュー`;
        } else {
            el.modals.import.samplePre.textContent = `[\n  {"text": "要件定義の確認", "deadline": "2026-05-10"},\n  {"text": "API設計のレビュー", "delegated": true}\n]`;
        }
    };

    const btnNavImport = el.nav.btnImport;
    if (btnNavImport) {
        btnNavImport.onclick = () => {
            el.modals.import.root.style.display = 'flex';
            el.modals.import.sampleContainer.style.display = 'none';
            el.modals.import.btnToggleSample.classList.remove('btn-primary');
            el.modals.import.format.value = 'auto';
            updateImportSample();
        };
    }

    el.modals.import.format.onchange = () => {
        updateImportSample();
    };

    el.modals.import.btnToggleSample.onclick = () => {
        const isHidden = el.modals.import.sampleContainer.style.display === 'none';
        el.modals.import.sampleContainer.style.display = isHidden ? 'block' : 'none';
        el.modals.import.btnToggleSample.classList.toggle('btn-primary', isHidden);
    };

    el.modals.import.btnDoImport.onclick = async () => {
        if (isProcessing) return;
        const jsonText = el.modals.import.area.value;
        const format = el.modals.import.format.value as 'auto' | 'json' | 'text';
        const targetDate = ctx.store.ui.getState().currentDate;
        isProcessing = true;
        try {
            await ctx.dispatchAction(async () => {
                await tasksLogic.importTasks(jsonText, targetDate, format, ctx.store);
                el.modals.import.area.value = '';
                el.modals.import.root.style.display = 'none';
            });
        } finally {
            isProcessing = false;
        }
    };

    el.modals.import.btnCopySample.onclick = () => {
        const sample = el.modals.import.samplePre.textContent || '';
        navigator.clipboard.writeText(sample);
    };

    el.modals.import.btnClose.onclick = () => {
        el.modals.import.root.style.display = 'none';
    };

    // Quick Add
    el.modals.quickAdd.btnClose.onclick = () => {
        el.modals.quickAdd.root.style.display = 'none';
    };

    const handleDoQuickAdd = async () => {
        if (isProcessing) return;
        const text = el.modals.quickAdd.input.value.trim();
        if (!text) {
            globalRenderer.notifyError('内容を入力してください');
            return;
        }

        const currentDate = ctx.store.ui.getState().currentDate;
        isProcessing = true;
        try {
            await ctx.dispatchAction(async () => {
                const newTask = await tasksLogic.addTask(text, currentDate, ctx.store);
                ctx.store.ui.update({ activeTaskId: newTask.id });
                el.modals.quickAdd.root.style.display = 'none';
                el.modals.quickAdd.input.value = '';
            });
        } finally {
            isProcessing = false;
        }
    };

    el.modals.quickAdd.btnSubmit.onclick = handleDoQuickAdd;
    el.modals.quickAdd.input.onkeypress = (e) => {
        if (e.key === 'Enter') {
            handleDoQuickAdd();
        }
    };
}
