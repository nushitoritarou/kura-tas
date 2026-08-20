/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { wireKeyboard } from '../keyboard';
import { WiringContext } from '../context';

// el モジュールのモック
vi.mock('@/core/el', () => ({
    el: {
        setup: { overlay: null },
        modals: {
            shortcuts: { root: { style: { display: 'none' } } },
            routine: { root: { style: { display: 'none' } } },
            holidays: { root: { style: { display: 'none' } } },
            aiMemo: { root: { style: { display: 'none' } } },
            import: { root: { style: { display: 'none' } } },
            quickAdd: { root: { style: { display: 'none' }, input: { value: '', focus: vi.fn() } } },
            editTask: { root: { style: { display: 'none' }, input: { value: '', focus: vi.fn(), setSelectionRange: vi.fn(), select: vi.fn() }, btnSubmit: {}, btnClose: {} } }
        },
        inbox: { input: { focus: vi.fn() } },
        notes: { editor: null }
    }
}));

describe('wireKeyboard double-trigger guard', () => {
    let mockCtx: WiringContext;
    let dispatchActionCalls: number;

    beforeEach(() => {
        dispatchActionCalls = 0;
        mockCtx = {
            store: {
                ui: {
                    getState: () => ({ currentDate: '2026-08-09', activeTaskId: 'task-1' }),
                    update: vi.fn()
                },
                tasks: {
                    getState: () => [{ id: 'task-1', text: 'Task 1', date: '2026-08-09', done: false }],
                    find: () => ({ id: 'task-1', text: 'Task 1', date: '2026-08-09', done: false }),
                    remove: vi.fn(),
                    add: vi.fn(),
                    update: vi.fn()
                },
                routine: {} as any,
                config: { getState: () => ({ workDays: [1, 2, 3, 4, 5], holidays: [] }) } as any,
                notes: {} as any,
                undo: vi.fn(),
                redo: vi.fn(),
                resetHistory: vi.fn()
            } as any,
            dispatchAction: vi.fn(async (action: () => Promise<void>) => {
                dispatchActionCalls++;
                await action();
            })
        };
    });

    it('非同期処理の実行中に連続して発火したキーイベントがガード（スキップ）されること', async () => {
        let resolveAction: () => void = () => {};
        const actionPromise = new Promise<void>((resolve) => {
            resolveAction = resolve;
        });

        // dispatchAction が制御用 Promise を待つようにモック設定
        (mockCtx.dispatchAction as any).mockImplementation(async (action: () => Promise<void>) => {
            dispatchActionCalls++;
            await actionPromise;
            await action();
        });

        wireKeyboard(mockCtx);

        const createEvent = (key: string) => {
            const event = new KeyboardEvent('keydown', { key });
            vi.spyOn(event, 'preventDefault');
            return event;
        };

        const event1 = createEvent('m');
        const event2 = createEvent('m');

        // 1回目のキー押下（非同期処理を開始し、完結させずに止める）
        const p1 = window.onkeydown!(event1);
        expect(dispatchActionCalls).toBe(1);

        // 1回目の処理中に2回目のキー押下が発生
        const p2 = window.onkeydown!(event2);
        expect(event2.preventDefault).toHaveBeenCalled();
        // 2回目はガードされるため dispatchAction は呼ばれない
        expect(dispatchActionCalls).toBe(1);

        // 1回目の非同期処理を完了させる
        resolveAction();
        await p1;
        await p2;

        // 処理完了後、3回目のキー押下は正常に受け付けられる
        const event3 = createEvent('m');
        await window.onkeydown!(event3);
        expect(dispatchActionCalls).toBe(2);
    });

    it('セットアップ画面（overlay）が表示中の場合、ショートカットキーが無視されること', async () => {
        const setupOverlay = document.createElement('div');
        setupOverlay.style.display = 'flex';
        const { el } = await import('@/core/el');
        (el as any).setup = { overlay: setupOverlay };

        wireKeyboard(mockCtx);

        const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
        await window.onkeydown!(event);

        expect(dispatchActionCalls).toBe(0);

        // モックをリセット
        (el as any).setup = { overlay: null };
    });

    it('currentDate が空（セットアップ未完了）の場合、左右キー等のショートカットが無視されること', async () => {
        mockCtx.store.ui.getState = () => ({ currentDate: '', activeTaskId: null }) as any;

        wireKeyboard(mockCtx);

        const eventLeft = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
        await window.onkeydown!(eventLeft);
        expect(dispatchActionCalls).toBe(0);

        const eventRight = new KeyboardEvent('keydown', { key: 'ArrowRight' });
        await window.onkeydown!(eventRight);
        expect(dispatchActionCalls).toBe(0);
    });

    it('タスク未選択時に i を押すと Inbox にフォーカスすること', async () => {
        mockCtx.store.ui.getState = () => ({ currentDate: '2026-08-09', activeTaskId: null }) as any;
        const { el } = await import('@/core/el');
        el.inbox.input.focus = vi.fn();

        wireKeyboard(mockCtx);

        const event = new KeyboardEvent('keydown', { key: 'i' });
        await window.onkeydown!(event);

        expect(el.inbox.input.focus).toHaveBeenCalled();
    });

    it('ノーマルモードで Esc を押すとタスク選択状態が解除されること', async () => {
        wireKeyboard(mockCtx);

        const event = new KeyboardEvent('keydown', { key: 'Escape' });
        await window.onkeydown!(event);

        expect(mockCtx.store.ui.update).toHaveBeenCalledWith({ activeTaskId: null });
    });

    it('AIメモモーダルが開いている場合、Esc を押すと閉じること', async () => {
        const { el } = await import('@/core/el');
        (el.modals as any).aiMemo.root.style.display = 'flex';

        wireKeyboard(mockCtx);

        const event = new KeyboardEvent('keydown', { key: 'Escape' });
        await window.onkeydown!(event);

        expect((el.modals as any).aiMemo.root.style.display).toBe('none');

        // 状態を元に戻す
        (el.modals as any).aiMemo.root.style.display = 'none';
    });

    it('タスク選択時に S キーを押すとソート処理が実行されること', async () => {
        const { sortTasksForDate } = await import('@/features/tasks/logic');
        vi.mock('@/features/tasks/logic', async (importOriginal) => {
            const actual = await importOriginal<typeof import('@/features/tasks/logic')>();
            return {
                ...actual,
                sortTasksForDate: vi.fn()
            };
        });

        wireKeyboard(mockCtx);

        const event = new KeyboardEvent('keydown', { key: 'S' });
        await window.onkeydown!(event);

        expect(sortTasksForDate).toHaveBeenCalledWith('2026-08-09', mockCtx.store);
    });

    it('タスク選択時に a, i, c キーを押すと編集モーダルが適切なモードで呼び出されること', async () => {
        const globalRenderer = await import('@/features/global/renderer');
        const showTaskEditModalSpy = vi.spyOn(globalRenderer, 'showTaskEditModal').mockResolvedValue('Updated Task');

        wireKeyboard(mockCtx);

        // a キー
        const eventA = new KeyboardEvent('keydown', { key: 'a' });
        await window.onkeydown!(eventA);
        expect(showTaskEditModalSpy).toHaveBeenCalledWith('Task 1', 'a');

        // i キー (選択中)
        const eventI = new KeyboardEvent('keydown', { key: 'i' });
        await window.onkeydown!(eventI);
        expect(showTaskEditModalSpy).toHaveBeenCalledWith('Task 1', 'i');

        // c キー
        const eventC = new KeyboardEvent('keydown', { key: 'c' });
        await window.onkeydown!(eventC);
        expect(showTaskEditModalSpy).toHaveBeenCalledWith('Task 1', 'c');
    });
});



