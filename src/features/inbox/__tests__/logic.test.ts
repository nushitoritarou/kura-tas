import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as logic from '../logic';
import { StoreRegistry } from '@/core/store';
import * as factories from "@/core/engine/factories";

describe('features/inbox/logic', () => {
    let store: StoreRegistry;
    
    beforeEach(() => {
        vi.clearAllMocks();
        store = new StoreRegistry();
    });

    it('InitialLoad calls inboxItems.load', async () => {
        const spy = vi.spyOn(store.inboxItems, 'load').mockResolvedValue(undefined);
        await logic.InitialLoad(store);
        expect(spy).toHaveBeenCalled();
    });

    it('addInboxItem adds item to store if text is not empty', async () => {
        const spy = vi.spyOn(store.inboxItems, 'add').mockResolvedValue(undefined);
        
        await logic.addInboxItem('New Item', store);
        
        expect(spy).toHaveBeenCalled();
        expect(spy.mock.calls[0][0].text).toBe('New Item');
    });

    it('addInboxItem throws error if text is empty', async () => {
        const spy = vi.spyOn(store.inboxItems, 'add');
        
        await expect(logic.addInboxItem('', store)).rejects.toThrow('内容を入力してください');
        
        expect(spy).not.toHaveBeenCalled();
    });

    it('renameInboxItem updates item in store', async () => {
        const item = factories.createInboxItem('Old Text');
        vi.spyOn(store.inboxItems, 'find').mockReturnValue(item);
        const spy = vi.spyOn(store.inboxItems, 'update').mockResolvedValue(undefined);
        
        await logic.renameInboxItem(item.id, 'New Text', store);
        
        expect(spy).toHaveBeenCalledWith({ ...item, text: 'New Text' });
    });

    it('renameInboxItem throws error if text is empty', async () => {
        await expect(logic.renameInboxItem('id', '', store)).rejects.toThrow('内容を入力してください');
    });

    it('renameInboxItem throws error if item not found', async () => {
        vi.spyOn(store.inboxItems, 'find').mockReturnValue(undefined);
        await expect(logic.renameInboxItem('999', 'New Text', store)).rejects.toThrow('指定されたアイテムが見つかりません');
    });

    it('deleteInboxItem removes item from store', async () => {
        const spy = vi.spyOn(store.inboxItems, 'remove').mockResolvedValue(undefined);
        
        await logic.deleteInboxItem('test-id', store);
        
        expect(spy).toHaveBeenCalledWith('test-id');
    });

    it('sendToTask converts item to task and moves it to targetDate', async () => {
        const item = factories.createInboxItem('Test Item');
        vi.spyOn(store.inboxItems, 'find').mockReturnValue(item);
        const addSpy = vi.spyOn(store.tasks, 'add').mockResolvedValue(undefined);
        const removeSpy = vi.spyOn(store.inboxItems, 'remove').mockResolvedValue(undefined);
        
        const targetDate = '2024-06-01';
        await logic.sendToTask(item.id, targetDate, store);
        
        expect(addSpy).toHaveBeenCalled();
        expect(addSpy.mock.calls[0][0].text).toBe('Test Item');
        expect(addSpy.mock.calls[0][0].date).toBe(targetDate);
        expect(removeSpy).toHaveBeenCalledWith(item.id);
    });

    it('sendToTask throws error if item not found', async () => {
        vi.spyOn(store.inboxItems, 'find').mockReturnValue(undefined);
        await expect(logic.sendToTask('999', '2024-06-01', store)).rejects.toThrow('指定されたアイテムが見つかりません');
    });
});
