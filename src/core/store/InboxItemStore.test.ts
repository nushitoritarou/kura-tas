import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InboxItemStore } from './InboxItemStore';
import { storage } from '@/core/storage';

vi.mock('@/core/storage', () => ({
    storage: {
        readJson: vi.fn(),
        writeJson: vi.fn()
    }
}));

describe('InboxItemStore', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('load() で inbox.json からデータを読み込むこと', async () => {
        const store = new InboxItemStore();
        vi.mocked(storage.readJson).mockResolvedValue([{ id: '1', text: 'test' }]);

        await store.load();

        expect(storage.readJson).toHaveBeenCalledWith('inbox.json');
        expect(store.getState()).toEqual([{ id: '1', text: 'test' }]);
    });

    it('add() で要素を追加し保存すること', async () => {
        const store = new InboxItemStore();
        await store.add({ id: '2', text: 'new' });

        expect(store.getState()).toEqual([{ id: '2', text: 'new' }]);
        expect(storage.writeJson).toHaveBeenCalledWith('inbox.json', [{ id: '2', text: 'new' }]);
    });
});
