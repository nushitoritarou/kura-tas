import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigStore } from './ConfigStore';
import { storage } from '@/core/storage';

vi.mock('@/core/storage', () => ({
    storage: {
        readJson: vi.fn(),
        writeJson: vi.fn()
    }
}));

describe('ConfigStore', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('load() で config.json からデータを読み込むこと', async () => {
        const store = new ConfigStore();
        vi.mocked(storage.readJson).mockResolvedValue({ carryOverDays: 7 });

        await store.load();

        expect(storage.readJson).toHaveBeenCalledWith('config.json');
        expect(store.getState()).toEqual({ carryOverDays: 7 });
    });

    it('update() で設定を更新し保存すること', async () => {
        const store = new ConfigStore({ carryOverDays: 10 });
        await store.update({ carryOverDays: 5 });

        expect(store.getState().carryOverDays).toBe(5);
        expect(storage.writeJson).toHaveBeenCalledWith('config.json', { carryOverDays: 5 });
    });
});
