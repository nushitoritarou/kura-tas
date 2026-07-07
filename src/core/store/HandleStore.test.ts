import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HandleStore } from './HandleStore';
import * as handleUtil from '@/core/handle';

vi.mock('@/core/handle', () => ({
    getSavedHandle: vi.fn(),
    saveHandle: vi.fn(),
}));

describe('HandleStore', () => {
    let store: HandleStore;

    beforeEach(() => {
        store = new HandleStore();
        vi.clearAllMocks();
    });

    it('初期状態は null であること', () => {
        expect(store.getHandle()).toBeNull();
    });

    it('load が保存されたハンドルをロードすること', async () => {
        const mockHandle = { name: 'test' } as any;
        vi.mocked(handleUtil.getSavedHandle).mockResolvedValue(mockHandle);
        
        await store.load();
        
        expect(handleUtil.getSavedHandle).toHaveBeenCalled();
        expect(store.getHandle()).toBe(mockHandle);
    });

    it('save がハンドルを保存し状態を更新すること', async () => {
        const mockHandle = { name: 'test' } as any;
        
        await store.save(mockHandle);
        
        expect(handleUtil.saveHandle).toHaveBeenCalledWith(mockHandle);
        expect(store.getHandle()).toBe(mockHandle);
    });

    it('restoreSnapshot がスナップショットを復元すること', async () => {
        const mockHandle = { name: 'snapshot' } as any;
        
        await store.restoreSnapshot(mockHandle);
        
        expect(handleUtil.saveHandle).toHaveBeenCalledWith(mockHandle);
        expect(store.getHandle()).toBe(mockHandle);
    });

    it('restoreSnapshot(null) の場合は saveHandle を呼ばないこと', async () => {
        await store.restoreSnapshot(null);
        expect(handleUtil.saveHandle).not.toHaveBeenCalled();
        expect(store.getHandle()).toBeNull();
    });
});
