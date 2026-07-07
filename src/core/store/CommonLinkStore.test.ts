import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommonLinkStore } from './CommonLinkStore';
import { storage } from '@/core/storage';

vi.mock('@/core/storage', () => ({
    storage: {
        readJson: vi.fn(),
        writeJson: vi.fn()
    }
}));

describe('CommonLinkStore', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('load() で common-links.json からデータを読み込むこと', async () => {
        const store = new CommonLinkStore();
        vi.mocked(storage.readJson).mockResolvedValue([{ id: '1', title: 'Google', url: 'https://google.com' }]);

        await store.load();

        expect(storage.readJson).toHaveBeenCalledWith('links.json');
        expect(store.getState()).toEqual([{ id: '1', title: 'Google', url: 'https://google.com' }]);
    });
});
