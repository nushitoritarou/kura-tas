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
            import: { root: { style: { display: 'none' } } },
            quickAdd: { root: { style: { display: 'none' }, input: { value: '', focus: vi.fn() } } }
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
                    add: vi.fn()
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
});
