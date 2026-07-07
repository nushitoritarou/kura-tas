import { describe, it, expect, beforeEach } from 'vitest';
import { UIStore } from './UIStore';

describe('UIStore', () => {
    let store: UIStore;

    beforeEach(() => {
        store = new UIStore();
    });

    it('初期状態が正しく設定されていること', () => {
        const state = store.getState();
        expect(state.isAppReady).toBe(false);
        expect(state.currentDate).toBe('');
        expect(state.isEditMode).toBe(true);
    });

    it('load が何もしないこと', async () => {
        await expect(store.load()).resolves.toBeUndefined();
    });

    it('update が状態を更新すること', () => {
        store.update({ currentDate: '2024-06-01', isAppReady: true });
        const state = store.getState();
        expect(state.currentDate).toBe('2024-06-01');
        expect(state.isAppReady).toBe(true);
        expect(state.isEditMode).toBe(true); // unchanged
    });

    it('restoreSnapshot が状態を上書きすること', async () => {
        const snapshot = {
            isAppReady: true,
            lastDirName: 'test',
            currentDate: '2024-06-01',
            lastKnownToday: '2024-06-01',
            activeTaskId: '1',
            isEditMode: false,
            version: '1.0.0',
            debugMode: true
        };
        await store.restoreSnapshot(snapshot);
        expect(store.getState()).toEqual(snapshot);
    });
});
