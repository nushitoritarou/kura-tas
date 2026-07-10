/**
 * kura-tas エントリポイント
 * 各機能のLogicとRendererを配線（Wiring）するオーケストレーション層。
 */

import { Note } from '@/types';
import { StoreRegistry } from '@/core/store';
import { el } from '@/core/el';
import { storage } from '@/core/storage';
import { logger, configureLogger } from '@/core/logger';
import * as globalLogic from '@/features/global/logic';
import * as globalRenderer from '@/features/global/renderer';
import * as inboxLogic from '@/features/inbox/logic';
import * as inboxRenderer from '@/features/inbox/renderer';
import * as linksLogic from '@/features/links/logic';
import * as linksRenderer from '@/features/links/renderer';
import * as tasksLogic from '@/features/tasks/logic';
import * as tasksRenderer from '@/features/tasks/renderer';
import * as notesLogic from '@/features/notes/logic';
import * as notesRenderer from '@/features/notes/renderer';
import * as periodicLogic from '@/features/periodic/logic';
import * as periodicRenderer from '@/features/periodic/renderer';

// 1. 全ストアの初期化 (Single Source of Truth)
const store = new StoreRegistry();

/**
 * トランザクションを実行し、エラーが発生した場合は通知する
 */
async function dispatchAction(action: () => Promise<void>, options?: { recordHistory?: boolean }) {
    try {
        await store.transaction(action, options);
    } catch (e: any) {
        globalRenderer.notifyError(e.message || '予期せぬエラーが発生しました');
    }
}

/**
 * 局所再描画の定義
 * StoreRegistry が自動的に変更を検知して通知する。
 */
store.onCommit(async (dirty) => {
    const uiState = store.ui.getState();

    // ログ設定の変更を監視
    if (dirty.has('config')) {
        configureLogger(store.config.getState());
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
        inboxRenderer.renderInboxList(store.inboxItems.getAll());
    }

    if (dirty.has('commonLinks')) {
        linksRenderer.renderLinks(store.commonLinks.getAll());
    }

    if (dirty.has('periodic')) {
        const masters = await periodicLogic.getMasters({ periodic: store.periodic });
        periodicRenderer.renderMasterList(masters);
    }

    if (dirty.has('tasks') || dirty.has('ui')) {
        const dayTasks = store.tasks.getState().filter(t => t.date === uiState.currentDate);
        tasksRenderer.renderTaskList(dayTasks, uiState.activeTaskId || undefined);
        tasksRenderer.updateCarryOverButtonVisibility(uiState.currentDate);
    }

    if (dirty.has('notes') || dirty.has('ui') || dirty.has('tasks')) {
        const note = await notesLogic.getActiveNote({ notes: store.notes, ui: store.ui, tasks: store.tasks });
        renderActiveNote(note, uiState.isEditMode);
    }

    // Undo/Redoボタンの状態同期
    globalRenderer.updateUndoRedoButtons(store.canUndo(), store.canRedo());
});

/**
 * 初回表示（全描画）
 */
async function initialRender() {
    const uiState = store.ui.getState();
    globalRenderer.updateDateDisplay(uiState.currentDate);
    inboxRenderer.renderInboxList(store.inboxItems.getAll());
    linksRenderer.renderLinks(store.commonLinks.getAll());
    const masters = await periodicLogic.getMasters({ periodic: store.periodic });
    periodicRenderer.renderMasterList(masters);
    const dayTasks = store.tasks.getState().filter(t => t.date === uiState.currentDate);
    tasksRenderer.renderTaskList(dayTasks, uiState.activeTaskId || undefined);
    tasksRenderer.updateCarryOverButtonVisibility(uiState.currentDate);
    const note = await notesLogic.getActiveNote({ notes: store.notes, ui: store.ui, tasks: store.tasks });
    renderActiveNote(note, uiState.isEditMode);
    globalRenderer.updateUndoRedoButtons(store.canUndo(), store.canRedo());
}

/**
 * アクティブノートとその関連データをレンダラーに送るヘルパー
 */
function renderActiveNote(note: Note, isEditMode: boolean) {
    let taskText: string | undefined;
    if (note.type === 'task' && note.taskId) {
        taskText = store.tasks.getState().find(t => t.id === note.taskId)?.text;
    }
    notesRenderer.renderNoteArea(note, isEditMode, taskText);
}

/**
 * アプリの起動（エントリポイント）
 */
async function bootstrap() {
    const uiState = store.ui.getState();

    // Loggerの初期構成
    configureLogger(store.config.getState());
    logger.info('kura-tas bootstrapping...');

    // デバッグモードの判定 (URL引数優先)
    const params = new URLSearchParams(window.location.search);
    const isDebug = params.get('debug') === '1' || uiState.debugMode;
    globalRenderer.displayVersion(uiState.version, isDebug);

    // 保存されたハンドルの確認
    const savedHandle = await globalLogic.checkSavedHandle(store);
    if (savedHandle) {
        globalRenderer.showResumeContainer(savedHandle.name);
    }

    // イベントリスナーの登録 (Wiring)

    // 1. セットアップ関連
    el.setup.btnSetup.onclick = async () => {
        try {
            const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
            if (handle) {
                await storage.init(handle);
                await dispatchAction(async () => {
                    await globalLogic.setupStorage(handle, store);
                    // ストレージ初期化後に設定がロードされるため、再度Loggerを構成
                    configureLogger(store.config.getState());
                    await periodicLogic.generateTasksFromPeriodic(store.ui.getState().currentDate, { periodic: store.periodic, tasks: store.tasks });
                }, { recordHistory: false });
                store.resetHistory(); // 起動直後の状態を「原点」にする
                globalRenderer.showAppContainer();
                await initialRender();
            }
        } catch (e) {
            logger.warn('Directory picker cancelled or failed', e);
        }
    };

    el.setup.btnResume.onclick = async () => {
        const handle = await globalLogic.checkSavedHandle(store);
        if (handle) {
            try {
                const permission = await handle.requestPermission({ mode: 'readwrite' });
                if (permission === 'granted') {
                    await storage.init(handle);
                    await dispatchAction(async () => {
                        await globalLogic.setupStorage(handle, store);
                        // ストレージ初期化後に設定がロードされるため、再度Loggerを構成
                        configureLogger(store.config.getState());
                        await periodicLogic.generateTasksFromPeriodic(store.ui.getState().currentDate, { periodic: store.periodic, tasks: store.tasks });
                    }, { recordHistory: false });
                    store.resetHistory(); // 起動直後の状態を「原点」にする
                    globalRenderer.showAppContainer();
                    await initialRender();
                }
            } catch (e) {
                logger.error('Permission request failed', e);
                globalRenderer.notifyError('ディレクトリへのアクセス権限が必要です。');
            }
        }
    };

    // 2. ナビゲーション関連
    el.nav.btnPrevDay.onclick = async () => {
        await dispatchAction(async () => {
            const nextDate = await globalLogic.shiftCurrentDate(-1, store);
            await periodicLogic.generateTasksFromPeriodic(nextDate, { periodic: store.periodic, tasks: store.tasks });
        }, { recordHistory: false });
        store.resetHistory();
    };

    el.nav.btnNextDay.onclick = async () => {
        await dispatchAction(async () => {
            const nextDate = await globalLogic.shiftCurrentDate(1, store);
            await periodicLogic.generateTasksFromPeriodic(nextDate, { periodic: store.periodic, tasks: store.tasks });
        }, { recordHistory: false });
        store.resetHistory();
    };

    el.nav.btnToday.onclick = async () => {
        await dispatchAction(async () => {
            const nextDate = await globalLogic.jumpToToday(store);
            await periodicLogic.generateTasksFromPeriodic(nextDate, { periodic: store.periodic, tasks: store.tasks });
        }, { recordHistory: false });
        store.resetHistory();
    };

    el.nav.btnUndo.onclick = async () => {
        await store.undo();
    };

    el.nav.btnRedo.onclick = async () => {
        await store.redo();
    };

    // 3. Inbox関連
    let isAdding = false;
    const handleAddInbox = async () => {
        if (isAdding) return;
        const text = el.inbox.input.value.trim();
        if (!text) return; // 空文字の場合は何もしない（通知ループ防止）

        isAdding = true;
        try {
            await dispatchAction(async () => {
                await inboxLogic.addInboxItem(text, store);
                inboxRenderer.clearInput();
            });
        } finally {
            isAdding = false;
        }
    };

    el.inbox.input.onkeypress = (e) => {
        if (e.key === 'Enter') handleAddInbox();
    };
    el.inbox.input.onblur = handleAddInbox;

    el.inbox.list.onclick = async (e) => {
        const itemEl = (e.target as HTMLElement).closest('.inbox-item') as HTMLElement;
        if (!itemEl) return;

        const id = itemEl.dataset.id;
        if (id) {
            await dispatchAction(async () => {
                await inboxLogic.sendToTask(id, store.ui.getState().currentDate, store);
            });
        }
    };

    el.inbox.list.onauxclick = async (e) => {
        if (e.button === 1) { // Middle click
            const itemEl = (e.target as HTMLElement).closest('.inbox-item') as HTMLElement;
            if (!itemEl) return;

            e.preventDefault();
            const id = itemEl.dataset.id;
            if (id) {
                await dispatchAction(async () => {
                    await inboxLogic.deleteInboxItem(id, store);
                });
            }
        }
    };

    el.inbox.list.oncontextmenu = (e) => {
        const itemEl = (e.target as HTMLElement).closest('.inbox-item') as HTMLElement;
        if (!itemEl) return;

        e.preventDefault();
        const id = itemEl.dataset.id;
        if (!id) return;

        const item = store.inboxItems.find(id);
        if (!item) return;

        globalRenderer.displayContextMenu(e.clientX, e.clientY, [
            {
                label: '名称編集',
                action: async () => {
                    const newText = globalRenderer.promptUser('名称変更', item.text);
                    if (newText !== null) {
                        await dispatchAction(async () => {
                            await inboxLogic.renameInboxItem(id, newText.trim(), store);
                        });
                    }
                }
            },
            {
                label: '削除',
                action: async () => {
                    if (globalRenderer.confirmAction('削除しますか？')) {
                        await dispatchAction(async () => {
                            await inboxLogic.deleteInboxItem(id, store);
                        });
                    }
                }
            }
        ]);
    };

    // 4. Links関連
    let isAddingLink = false;
    const handleAddLink = async () => {
        if (isAddingLink) return;
        const title = el.links.inputTitle.value.trim();
        const url = el.links.inputUrl.value.trim();

        isAddingLink = true;
        await dispatchAction(async () => {
            await linksLogic.addLink(title, url, store);
            linksRenderer.clearInputs();
        });
        isAddingLink = false;
    };

    el.links.btnAdd.onclick = handleAddLink;
    el.links.inputTitle.onkeypress = (e) => { if (e.key === 'Enter') handleAddLink(); };
    el.links.inputUrl.onkeypress = (e) => { if (e.key === 'Enter') handleAddLink(); };

    el.links.list.oncontextmenu = (e) => {
        const itemEl = (e.target as HTMLElement).closest('.link-item') as HTMLElement;
        if (!itemEl) return;

        e.preventDefault();
        const id = itemEl.dataset.id;
        if (!id) return;

        globalRenderer.displayContextMenu(e.clientX, e.clientY, [
            {
                label: '削除',
                action: async () => {
                    if (globalRenderer.confirmAction('削除しますか？')) {
                        await dispatchAction(async () => {
                            await linksLogic.deleteLink(id, store);
                        });
                    }
                }
            }
        ]);
    };

    // 5. Tasks関連
    el.tasks.list.onclick = async (e) => {
        const target = e.target as HTMLElement;
        const itemEl = target.closest('.task-item') as HTMLElement;
        if (!itemEl) return;

        const id = itemEl.dataset.id;
        if (!id) return;

        if (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'checkbox') {
            await dispatchAction(async () => {
                await tasksLogic.toggleTaskDone(id, store);
            });
        } else {
            await dispatchAction(async () => {
                store.ui.update({ activeTaskId: id });
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
                await dispatchAction(async () => {
                    await tasksLogic.toggleTaskDone(id, store);
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

        const task = store.tasks.find(id);
        if (!task) return;

        globalRenderer.displayContextMenu(e.clientX, e.clientY, [
            {
                label: task.delegated ? '他者依頼を解除' : '他者依頼を設定',
                action: async () => {
                    await dispatchAction(async () => {
                        await tasksLogic.toggleTaskDelegated(id, store);
                    });
                }
            },
            {
                label: '明日へ移動',
                action: async () => {
                    await dispatchAction(async () => {
                        await tasksLogic.moveTaskToNextWorkDay(id, store);
                    });
                }
            },
            {
                label: 'Inboxへ戻す',
                action: async () => {
                    await dispatchAction(async () => {
                        await tasksLogic.returnToInbox(id, store);
                    });
                }
            },
            {
                label: '名称編集',
                action: async () => {
                    const newText = globalRenderer.promptUser('名称編集', task.text);
                    if (newText !== null) {
                        await dispatchAction(async () => {
                            await tasksLogic.renameTask(id, newText.trim(), store);
                        });
                    }
                }
            },
            {
                label: '削除',
                action: async () => {
                    if (globalRenderer.confirmAction('削除しますか？')) {
                        await dispatchAction(async () => {
                            await tasksLogic.deleteTask(id, store);
                        });
                    }
                }
            }
        ]);
    };

    // 繰り越し
    const btnCarryOver = document.getElementById('btn-carry-over');
    if (btnCarryOver) {
        btnCarryOver.onclick = async () => {
            await dispatchAction(async () => {
                const uiState = store.ui.getState();
                const config = store.config.getState();
                await tasksLogic.carryOverTasks(uiState.currentDate, config.carryOverDays ?? 10, store);
            });
        };
    }

    // インポート
    const btnNavImport = document.getElementById('nav-import');
    if (btnNavImport) {
        btnNavImport.onclick = () => {
            el.modals.import.root.style.display = 'flex';
        };
    }

    el.modals.import.btnDoImport.onclick = async () => {
        const jsonText = el.modals.import.area.value;
        const targetDate = store.ui.getState().currentDate;
        await dispatchAction(async () => {
            await tasksLogic.importTasks(jsonText, targetDate, store);
            el.modals.import.area.value = '';
            el.modals.import.root.style.display = 'none';
        });
    };

    // 6. Notes関連
    const handleSaveNote = async () => {
        await dispatchAction(async () => {
            const note = await notesLogic.getActiveNote({ notes: store.notes, ui: store.ui, tasks: store.tasks });
            note.body = el.notes.editor.value;
            await notesLogic.saveNote(note, { notes: store.notes });
            notesRenderer.showSaveStatus('Saved');
        });
    };

    el.notes.btnSave.onclick = handleSaveNote;

    el.notes.btnToggleView.onclick = async () => {
        await dispatchAction(async () => {
            const uiState = store.ui.getState();
            if (uiState.isEditMode) {
                const note = await notesLogic.getActiveNote({ notes: store.notes, ui: store.ui, tasks: store.tasks });
                note.body = el.notes.editor.value;
                await notesLogic.saveNote(note, { notes: store.notes });
                notesRenderer.showSaveStatus('Saved');
            }
            store.ui.update({ isEditMode: !uiState.isEditMode });
        });
    };

    // 7. Periodic関連
    const navPeriodic = document.getElementById('nav-periodic');
    if (navPeriodic) {
        navPeriodic.onclick = async () => {
            const masters = await periodicLogic.getMasters({ periodic: store.periodic });
            periodicRenderer.renderMasterList(masters);
            periodicRenderer.setupPeriodicForm(false);
            periodicRenderer.togglePeriodicModal(true);
        };
    }

    el.modals.periodic.btnSubmit.onclick = async () => {
        const text = el.modals.periodic.input.value.trim();
        const days = Array.from(el.modals.periodic.dayCheckboxes)
            .filter(cb => cb.checked)
            .map(cb => parseInt(cb.value));

        const id = el.modals.periodic.btnSubmit.dataset.id;
        await dispatchAction(async () => {
            await periodicLogic.upsertMaster({ id, text, days }, { periodic: store.periodic, tasks: store.tasks, ui: store.ui });
            periodicRenderer.setupPeriodicForm(false);
        });
    };

    el.modals.periodic.list.onclick = async (e) => {
        const target = e.target as HTMLElement;
        const id = target.dataset.id;
        if (!id) return;

        if (target.classList.contains('btn-edit-periodic')) {
            const masters = await periodicLogic.getMasters({ periodic: store.periodic });
            const master = masters.find(m => m.id === id);
            if (master) {
                periodicRenderer.setupPeriodicForm(true, master);
            }
        } else if (target.classList.contains('btn-delete-periodic')) {
            if (globalRenderer.confirmAction('削除しますか？')) {
                await dispatchAction(async () => {
                    await periodicLogic.deleteMaster(id, { periodic: store.periodic, tasks: store.tasks });
                    periodicRenderer.setupPeriodicForm(false);
                });
            }
        }
    };

    // 8. Shortcuts
    window.onkeydown = async (e) => {
        if (e.ctrlKey || e.metaKey) {
            if (e.key === 's') {
                e.preventDefault();
                await handleSaveNote();
            } else if (e.key === 'p') {
                e.preventDefault();
                el.notes.btnToggleView.click();
            } else if (e.key === 'z') {
                e.preventDefault();
                await store.undo();
            } else if (e.key === 'y') {
                e.preventDefault();
                await store.redo();
            }
        }
    };

    // その他 UI 部品の設定
    el.modals.import.btnCopySample.onclick = () => {
        const sample = (document.getElementById('import-sample') as HTMLElement).textContent || '';
        navigator.clipboard.writeText(sample);
    };

    el.modals.import.btnClose.onclick = () => {
        el.modals.import.root.style.display = 'none';
    };

    el.modals.periodic.btnClose.onclick = () => {
        el.modals.periodic.root.style.display = 'none';
    };

    [el.modals.import.root, el.modals.periodic.root].forEach(m => {
        m.onclick = (e) => {
            if (e.target === m) m.style.display = 'none';
        };
    });

    el.nav.dateDisplay.onclick = async () => {
        await store.transaction(async () => {
            store.ui.update({ activeTaskId: null });
        });
    };

    // 9. 日跨ぎ監視
    // 画面がアクティブになった時
    document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible' && store.ui.getState().isAppReady) {
            let updated = false;
            await dispatchAction(async () => {
                const updatedDate = await globalLogic.checkAndApplyDayChange(store);
                if (updatedDate) {
                    await periodicLogic.generateTasksFromPeriodic(updatedDate, { periodic: store.periodic, tasks: store.tasks });
                    updated = true;
                }
            }, { recordHistory: false });
            if (updated) {
                store.resetHistory();
            }
        }
    });

    // 定期チェック (1分間隔)
    setInterval(async () => {
        if (store.ui.getState().isAppReady) {
            let updated = false;
            await dispatchAction(async () => {
                const updatedDate = await globalLogic.checkAndApplyDayChange(store);
                if (updatedDate) {
                    await periodicLogic.generateTasksFromPeriodic(updatedDate, { periodic: store.periodic, tasks: store.tasks });
                    updated = true;
                }
            }, { recordHistory: false });
            if (updated) {
                store.resetHistory();
            }
        }
    }, 60 * 1000);
}

// 起動
bootstrap().catch(err => logger.error('Bootstrap failed', err));
