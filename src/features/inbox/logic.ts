
import { InboxItemStore } from '@/core/store/InboxItemStore';
import * as factories from "@/core/engine/factories";
import * as converters from "@/core/engine/converters";
import { TaskStore } from '@/core/store/TaskStore';

interface InboxDeps {
    inboxItems: InboxItemStore;
    tasks: TaskStore;
}

export async function InitialLoad(deps: InboxDeps) {
    await deps.inboxItems.load();
}

export async function addInboxItem(text: string, deps: InboxDeps) {
    if (!text) throw new Error('内容を入力してください');
    await deps.inboxItems.add(factories.createInboxItem(text));
}

export async function sendToTask(inboxItemId: string, targetDate: string, deps: InboxDeps) {
    const item = deps.inboxItems.find(inboxItemId);
    if (!item) throw new Error('指定されたアイテムが見つかりません');

    const task = converters.convertInboxItemToTask(item, targetDate);

    await deps.tasks.add(task);
    await deps.inboxItems.remove(inboxItemId);
}

export async function renameInboxItem(inboxItemId: string, newText: string, deps: InboxDeps) {
    if (!newText) throw new Error('内容を入力してください');
    const item = deps.inboxItems.find(inboxItemId);
    if (!item) throw new Error('指定されたアイテムが見つかりません');

    await deps.inboxItems.update({ ...item, text: newText });
}

export async function deleteInboxItem(inboxItemId: string, deps: InboxDeps) {
    await deps.inboxItems.remove(inboxItemId);
}
