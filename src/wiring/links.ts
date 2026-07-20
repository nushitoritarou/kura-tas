import { el } from '@/core/el';
import * as linksLogic from '@/features/links/logic';
import * as linksRenderer from '@/features/links/renderer';
import * as globalRenderer from '@/features/global/renderer';
import { WiringContext } from './context';

export function wireLinks(ctx: WiringContext): void {
    let isAddingLink = false;
    const handleAddLink = async () => {
        if (isAddingLink) return;
        const title = el.links.inputTitle.value.trim();
        const url = el.links.inputUrl.value.trim();

        isAddingLink = true;
        await ctx.dispatchAction(async () => {
            await linksLogic.addLink(title, url, ctx.store);
            linksRenderer.clearInputs();
        });
        isAddingLink = false;
    };

    el.links.btnAdd.onclick = handleAddLink;
    el.links.inputTitle.onkeypress = (e) => { if (e.key === 'Enter') handleAddLink(); };
    el.links.inputUrl.onkeypress = (e) => { if (e.key === 'Enter') handleAddLink(); };

    el.links.list.oncontextmenu = (e) => {
        const itemEl = (e.target as HTMLElement).closest('.link-item') as HTMLElement;
        if (!itemEl) return;

        e.preventDefault();
        const id = itemEl.dataset.id;
        if (!id) return;

        globalRenderer.displayContextMenu(e.clientX, e.clientY, [
            {
                label: '削除',
                action: async () => {
                    if (globalRenderer.confirmAction('削除しますか？')) {
                        await ctx.dispatchAction(async () => {
                            await linksLogic.deleteLink(id, ctx.store);
                        });
                    }
                }
            }
        ]);
    };
}
