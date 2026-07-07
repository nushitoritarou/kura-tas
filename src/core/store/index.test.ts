import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StoreRegistry } from './index';
import { storage } from '@/core/storage';

vi.mock('@/core/storage', () => ({
    storage: {
        readJson: vi.fn().mockResolvedValue([]),
        writeJson: vi.fn().mockResolvedValue(undefined),
        deleteFile: vi.fn().mockResolvedValue(undefined),
        init: vi.fn().mockResolvedValue(undefined),
    }
}));

describe('StoreRegistry', () => {
    let registry: StoreRegistry;

    beforeEach(() => {
        registry = new StoreRegistry();
        vi.clearAllMocks();
    });

    it('トランザクションが正常に実行されること', async () => {
        let executed = false;
        await registry.transaction(async () => {
            executed = true;
        });
        expect(executed).toBe(true);
    });

    it('トランザクション内でエラーが発生した場合にロールバックすること', async () => {
        // storage.readJson を使って初期状態をセット
        vi.mocked(storage.readJson).mockResolvedValueOnce([{ id: '1', text: 'Task 1' }]);
        await registry.tasks.load();
        
        const preState = registry.tasks.getState();
        
        await expect(registry.transaction(async () => {
            await registry.tasks.add({ id: '2', text: 'Task 2', originalDate: "2024-06-01", date: '2024-06-01', done: false });
            throw new Error('fail');
        })).rejects.toThrow('fail');

        // ロールバックされて元の状態に戻っていること
        expect(registry.tasks.getState()).toEqual(preState);
    });

    it('Undo/Redo が機能すること', async () => {
        // 履歴上限を1に設定
        registry.config.update({ historyLimit: 1 });
        
        const initialTaskCount = registry.tasks.getState().length;
        
        // 1回目の変更
        await registry.transaction(async () => {
            await registry.tasks.add({ id: '1', text: 'Task 1', originalDate: "2024-06-01", date: '2024-06-01', done: false });
        });
        
        expect(registry.canUndo()).toBe(true);
        expect(registry.tasks.getState().length).toBe(initialTaskCount + 1);

        // Undo 実行
        await registry.undo();
        
        expect(registry.canUndo()).toBe(false);
        expect(registry.canRedo()).toBe(true);
        expect(registry.tasks.getState().length).toBe(initialTaskCount);

        // Redo 実行
        await registry.redo();
        expect(registry.canUndo()).toBe(true);
        expect(registry.canRedo()).toBe(false);
        expect(registry.tasks.getState().length).toBe(initialTaskCount + 1);
    });

    it('履歴上限を超えた場合に古い履歴が削除されること', async () => {
        registry.config.update({ historyLimit: 2 });
        
        // 3回変更を加える
        await registry.transaction(async () => { await registry.tasks.add({ id: '1', text: 'T1', originalDate: "2024-06-01", date: 'D', done: false }); });
        await registry.transaction(async () => { await registry.tasks.add({ id: '2', text: 'T2', originalDate: "2024-06-01", date: 'D', done: false }); });
        await registry.transaction(async () => { await registry.tasks.add({ id: '3', text: 'T3', originalDate: "2024-06-01", date: 'D', done: false }); });
        
        // @ts-ignore
        expect(registry.history.length).toBe(2);
    });

    it('onCommit がコミット時に呼ばれること', async () => {
        const listener = vi.fn();
        registry.onCommit(listener);
        
        await registry.transaction(async () => {
            await registry.tasks.add({ id: '1', text: 'T1', originalDate: "2024-06-01", date: 'D', done: false });
        });
        
        expect(listener).toHaveBeenCalled();
        const dirtySet = listener.mock.calls[0][0] as Set<string>;
        expect(dirtySet.has('tasks')).toBe(true);
    });

    it('複数のトランザクションが直列に実行されること', async () => {
        const order: number[] = [];
        const p1 = registry.transaction(async () => {
            await new Promise(r => setTimeout(r, 50));
            order.push(1);
        });
        const p2 = registry.transaction(async () => {
            order.push(2);
        });
        
        await Promise.all([p1, p2]);
        expect(order).toEqual([1, 2]);
    });
});
