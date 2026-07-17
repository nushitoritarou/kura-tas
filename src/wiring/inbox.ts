import { el } from '@/core/el';
import * as inboxLogic from '@/features/inbox/logic';
import * as inboxRenderer from '@/features/inbox/renderer';
import * as globalRenderer from '@/features/global/renderer';
import { WiringContext } from './context';

export function wireInbox(ctx: WiringContext): void {
    let isAdding = false;
    const handleAddInbox = async () => {
        if (isAdding) return;
        const text = el.inbox.input.value.trim();
        if (!text) return; // 空文字の場合は何もしない（通知ループ防止）

        isAdding = true;
        try {
            await ctx.dispatchAction(async () => {
                await inboxLogic.addInboxItem(text, ctx.store);
                inboxRenderer.clearInput();
            });
        } finally {
            isAdding = false;
        }
    };

    el.inbox.input.onkeypress = (e) => {
        if (e.key === 'Enter') handleAddInbox();
    };
    el.inbox.input.onblur = handleAddInbox;

    el.inbox.list.onclick = async (e) => {
        const itemEl = (e.target as HTMLElement).closest('.inbox-item') as HTMLElement;
        if (!itemEl) return;

        const id = itemEl.dataset.id;
        if (id) {
            await ctx.dispatchAction(async () => {
                await inboxLogic.sendToTask(id, ctx.store.ui.getState().currentDate, ctx.store);
            });
        }
    };

    el.inbox.list.onauxclick = async (e) => {
        if (e.button === 1) { // Middle click
            const itemEl = (e.target as HTMLElement).closest('.inbox-item') as HTMLElement;
            if (!itemEl) return;

            e.preventDefault();
            const id = itemEl.dataset.id;
            if (id) {
                await ctx.dispatchAction(async () => {
                    await inboxLogic.deleteInboxItem(id, ctx.store);
                });
            }
        }
    };

    el.inbox.list.oncontextmenu = (e) => {
        const itemEl = (e.target as HTMLElement).closest('.inbox-item') as HTMLElement;
        if (!itemEl) return;

        e.preventDefault();
        const id = itemEl.dataset.id;
        if (!id) return;

        const item = ctx.store.inboxItems.find(id);
        if (!item) return;

        globalRenderer.displayContextMenu(e.clientX, e.clientY, [
            {
                label: '名称編集',
                action: async () => {
                    const newText = globalRenderer.promptUser('名称変更', item.text);
                    if (newText !== null) {
                        await ctx.dispatchAction(async () => {
                            await inboxLogic.renameInboxItem(id, newText.trim(), ctx.store);
                        });
                    }
                }
            },
            {
                label: '削除',
                action: async () => {
                    if (globalRenderer.confirmAction('削除しますか？')) {
                        await ctx.dispatchAction(async () => {
                            await inboxLogic.deleteInboxItem(id, ctx.store);
                        });
                    }
                }
            }
        ]);
    };
}
