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
import * as routineLogic from '@/features/routine/logic';
import * as routineRenderer from '@/features/routine/renderer';
import * as holidaysLogic from '@/features/holidays/logic';
import * as holidaysRenderer from '@/features/holidays/renderer';
import { DAYS_MAP, RoutineTask } from '@/types';

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

    if (dirty.has('routine')) {
        const masters = await routineLogic.getMasters({ routine: store.routine });
        routineRenderer.renderMasterList(masters);
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
    const masters = await routineLogic.getMasters({ routine: store.routine });
    routineRenderer.renderMasterList(masters);
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
    let routineId: string | undefined;
    if (note.type === 'task' && note.taskId) {
        const task = store.tasks.getState().find(t => t.id === note.taskId);
        taskText = task?.text;
        routineId = task?.routineId;
    }
    notesRenderer.renderNoteArea(note, isEditMode, taskText, routineId);
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
    const commitHash = typeof __COMMIT_HASH__ !== 'undefined' ? __COMMIT_HASH__ : 'unknown';
    const buildTime = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : 'unknown';
    globalRenderer.displayVersion(uiState.version, isDebug, commitHash, buildTime);

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
                    await routineLogic.generateTasksFromRoutine(store.ui.getState().currentDate, { routine: store.routine, tasks: store.tasks, config: store.config, notes: store.notes });
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
                        await routineLogic.generateTasksFromRoutine(store.ui.getState().currentDate, { routine: store.routine, tasks: store.tasks, config: store.config, notes: store.notes });
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
            await routineLogic.generateTasksFromRoutine(nextDate, { routine: store.routine, tasks: store.tasks, config: store.config, notes: store.notes });
        }, { recordHistory: false });
        store.resetHistory();
    };

    el.nav.btnNextDay.onclick = async () => {
        await dispatchAction(async () => {
            const nextDate = await globalLogic.shiftCurrentDate(1, store);
            await routineLogic.generateTasksFromRoutine(nextDate, { routine: store.routine, tasks: store.tasks, config: store.config, notes: store.notes });
        }, { recordHistory: false });
        store.resetHistory();
    };

    el.nav.btnToday.onclick = async () => {
        await dispatchAction(async () => {
            const nextDate = await globalLogic.jumpToToday(store);
            await routineLogic.generateTasksFromRoutine(nextDate, { routine: store.routine, tasks: store.tasks, config: store.config, notes: store.notes });
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
                label: '定期タスクに登録',
                action: async () => {
                    try {
                        const note = await notesLogic.getNoteForTask(task.id, task.date, { notes: store.notes, tasks: store.tasks });
                        const noteBody = note ? note.body : '';

                        const masters = await routineLogic.getMasters({ routine: store.routine });
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
    const updateImportSample = () => {
        const format = el.modals.import.format.value;
        if (format === 'text') {
            el.modals.import.samplePre.textContent = `要件定義の確認\nAPI設計のレビュー`;
        } else {
            el.modals.import.samplePre.textContent = `[\n  {"text": "要件定義の確認", "deadline": "2026-05-10"},\n  {"text": "API設計のレビュー", "delegated": true}\n]`;
        }
    };

    const btnNavImport = document.getElementById('nav-import');
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
        const jsonText = el.modals.import.area.value;
        const format = el.modals.import.format.value as 'auto' | 'json' | 'text';
        const targetDate = store.ui.getState().currentDate;
        await dispatchAction(async () => {
            await tasksLogic.importTasks(jsonText, targetDate, format, store);
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

    const handlePromoteNote = async () => {
        const btnPromote = el.notes.btnPromote;
        const routineId = btnPromote?.dataset.routineId;
        if (!routineId) return;

        if (globalRenderer.confirmAction('このノートを定期タスクのテンプレートとして登録/更新しますか？\n（当日・未来の未編集のタスクノートにも反映されます）')) {
            await dispatchAction(async () => {
                const note = await notesLogic.getActiveNote({ notes: store.notes, ui: store.ui, tasks: store.tasks });
                note.body = el.notes.editor.value;
                
                // まず現在のノートを保存
                await notesLogic.saveNote(note, { notes: store.notes });

                // テンプレートに昇格
                await routineLogic.promoteNoteToTemplate(
                    routineId,
                    note.body,
                    { routine: store.routine, tasks: store.tasks, notes: store.notes, config: store.config }
                );
                
                notesRenderer.showSaveStatus('Promoted & Synced');
            });
        }
    };

    if (el.notes.btnPromote) {
        el.notes.btnPromote.onclick = handlePromoteNote;
    }

    // 7. Routine関連
    const navRoutine = document.getElementById('nav-routine');
    if (navRoutine) {
        navRoutine.onclick = async () => {
            const masters = await routineLogic.getMasters({ routine: store.routine });
            routineRenderer.renderMasterList(masters);
            routineRenderer.setupRoutineForm(false);
            routineRenderer.toggleRoutineModal(true);
        };
    }

    // スケジュールタイプ変更時の表示切り替え
    el.modals.routine.scheduleType.onchange = () => {
        const type = el.modals.routine.scheduleType.value;
        routineRenderer.updateScheduleFieldsVisibility(type);
    };

    el.modals.routine.btnSubmit.onclick = async () => {
        const text = el.modals.routine.input.value.trim();
        const type = el.modals.routine.scheduleType.value as 'weekly' | 'interval' | 'monthly-day' | 'monthly-weekday' | 'none';
        const holiday_adjustment = el.modals.routine.holidayAdjustment.value as 'before' | 'after' | 'skip';

        // 曜日を取得（weekly, interval, monthly-weekday 用）
        const days = Array.from(el.modals.routine.dayCheckboxes)
            .filter(cb => cb.checked)
            .map(cb => DAYS_MAP[parseInt(cb.value)]);

        const schedule: RoutineTask['schedule'] = { type };

        if (type === 'weekly') {
            schedule.days = days.length > 0 ? days : undefined;
        } else if (type === 'interval') {
            schedule.days = days.length > 0 ? days : undefined;
            const weeksVal = parseInt(el.modals.routine.intervalWeeks.value);
            schedule.intervalWeeks = isNaN(weeksVal) ? 2 : weeksVal;
            schedule.baseDate = el.modals.routine.baseDate.value;
        } else if (type === 'monthly-day') {
            const dayVal = el.modals.routine.monthlyDay.value;
            schedule.monthlyDay = dayVal === 'last' ? 'last' : parseInt(dayVal);
        } else if (type === 'monthly-weekday') {
            schedule.days = days.length > 0 ? days : undefined;
            const wIdxVal = el.modals.routine.weekIndex.value;
            schedule.weekIndex = wIdxVal === 'last' ? 'last' : parseInt(wIdxVal);
        }

        const id = el.modals.routine.btnSubmit.dataset.id;
        const noteTemplate = el.modals.routine.btnSubmit.dataset.noteTemplate;
        await dispatchAction(async () => {
            await routineLogic.upsertMaster({ id, text, schedule, holiday_adjustment, noteTemplate }, { routine: store.routine, tasks: store.tasks, ui: store.ui, config: store.config, notes: store.notes });
            routineRenderer.setupRoutineForm(false);
        });
    };

    el.modals.routine.list.onclick = async (e) => {
        const target = e.target as HTMLElement;
        const id = target.dataset.id;
        if (!id) return;

        if (target.classList.contains('btn-edit-routine')) {
            const masters = await routineLogic.getMasters({ routine: store.routine });
            const master = masters.find(m => m.id === id);
            if (master) {
                routineRenderer.setupRoutineForm(true, master);
            }
        } else if (target.classList.contains('btn-delete-routine')) {
            if (globalRenderer.confirmAction('削除しますか？')) {
                await dispatchAction(async () => {
                    await routineLogic.deleteMaster(id, { routine: store.routine, tasks: store.tasks, config: store.config });
                    routineRenderer.setupRoutineForm(false);
                });
            }
        } else if (target.classList.contains('btn-add-task-from-routine')) {
            await dispatchAction(async () => {
                const currentDate = store.ui.getState().currentDate;
                await routineLogic.createTaskFromRoutine(id, currentDate, { routine: store.routine, tasks: store.tasks, notes: store.notes });
            });
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
        const sample = el.modals.import.samplePre.textContent || '';
        navigator.clipboard.writeText(sample);
    };

    el.modals.import.btnClose.onclick = () => {
        el.modals.import.root.style.display = 'none';
    };

    el.modals.routine.btnClose.onclick = () => {
        el.modals.routine.root.style.display = 'none';
    };

    if (el.nav.btnHolidays) {
        el.nav.btnHolidays.onclick = () => {
            const config = store.config.getState();
            const workDays = config.workDays || [1, 2, 3, 4, 5];
            const holidays = config.holidays || [];
            holidaysRenderer.renderHolidaysSetup(workDays, holidays);
            holidaysRenderer.toggleHolidaysModal(true);
        };
    }

    el.modals.holidays.btnClose.onclick = () => {
        holidaysRenderer.toggleHolidaysModal(false);
    };

    const workdayContainer = document.getElementById('holiday-workdays-container');
    if (workdayContainer) {
        workdayContainer.onchange = async () => {
            const workdayCheckboxes = Array.from(el.modals.holidays.workdayCheckboxes);
            const workDays = workdayCheckboxes
                .filter(cb => cb.checked)
                .map(cb => parseInt(cb.value));

            const config = store.config.getState();
            const holidays = config.holidays || [];

            await dispatchAction(async () => {
                await holidaysLogic.saveHolidays(workDays, holidays, {
                    config: store.config
                });
                await routineLogic.generateTasksFromRoutine(store.ui.getState().currentDate, {
                    routine: store.routine,
                    tasks: store.tasks,
                    config: store.config,
                    notes: store.notes
                });
            });
        };
    }

    el.modals.holidays.btnAddDate.onclick = async () => {
        const dateVal = el.modals.holidays.dateInput.value;
        if (!dateVal) return;

        const config = store.config.getState();
        const holidays = config.holidays || [];
        const workDays = config.workDays || [1, 2, 3, 4, 5];
        
        // 重複チェック
        if (holidays.includes(dateVal)) {
            globalRenderer.notifyError('すでに登録されている日付です。');
            return;
        }

        const nextHolidays = [...holidays, dateVal];

        await dispatchAction(async () => {
            await holidaysLogic.saveHolidays(workDays, nextHolidays, {
                config: store.config
            });
            await routineLogic.generateTasksFromRoutine(store.ui.getState().currentDate, {
                routine: store.routine,
                tasks: store.tasks,
                config: store.config,
                notes: store.notes
            });
            holidaysRenderer.renderHolidayList(nextHolidays);
        });
    };

    el.modals.holidays.dateList.onclick = async (e) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains('btn-delete-holiday')) {
            const dateToDelete = target.dataset.date;
            if (dateToDelete) {
                const config = store.config.getState();
                const holidays = config.holidays || [];
                const workDays = config.workDays || [1, 2, 3, 4, 5];

                const nextHolidays = holidays.filter(h => h !== dateToDelete);

                await dispatchAction(async () => {
                    await holidaysLogic.saveHolidays(workDays, nextHolidays, {
                        config: store.config
                    });
                    await routineLogic.generateTasksFromRoutine(store.ui.getState().currentDate, {
                        routine: store.routine,
                        tasks: store.tasks,
                        config: store.config,
                        notes: store.notes
                    });
                    holidaysRenderer.renderHolidayList(nextHolidays);
                });
            }
        }
    };

    [el.modals.import.root, el.modals.routine.root, el.modals.holidays.root].forEach(m => {
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
                    await routineLogic.generateTasksFromRoutine(updatedDate, { routine: store.routine, tasks: store.tasks, config: store.config, notes: store.notes });
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
                    await routineLogic.generateTasksFromRoutine(updatedDate, { routine: store.routine, tasks: store.tasks, config: store.config, notes: store.notes });
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
