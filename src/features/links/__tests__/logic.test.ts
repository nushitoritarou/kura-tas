
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as logic from '../logic';
import { CommonLinkStore } from '@/core/store/CommonLinkStore';

describe('links logic', () => {
    let store: CommonLinkStore;

    beforeEach(() => {
        store = new CommonLinkStore();
        vi.spyOn(store, 'add').mockResolvedValue(undefined);
        vi.spyOn(store, 'remove').mockResolvedValue(undefined);
    });

    it('addLink が呼ばれたとき Store に追加されること', async () => {
        await logic.addLink('Google', 'https://google.com', { commonLinks: store });
        expect(store.add).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Google',
            url: 'https://google.com'
        }));
    });

    it('不正な形式の URL の場合は addLink が例外を投げること', async () => {
        await expect(logic.addLink('Invalid', 'not-a-url', { commonLinks: store }))
            .rejects.toThrow('不正なURL形式です');
        expect(store.add).not.toHaveBeenCalled();
    });

    it('空文字の場合は addLink が例外を投げること', async () => {
        await expect(logic.addLink('', 'https://google.com', { commonLinks: store }))
            .rejects.toThrow('タイトルを入力してください');
        expect(store.add).not.toHaveBeenCalled();

        await expect(logic.addLink('Google', '', { commonLinks: store }))
            .rejects.toThrow('URLを入力してください');
        expect(store.add).not.toHaveBeenCalled();
    });

    it('deleteLink が呼ばれたとき Store から削除されること', async () => {
        await logic.deleteLink('id-123', { commonLinks: store });
        expect(store.remove).toHaveBeenCalledWith('id-123');
    });
});
