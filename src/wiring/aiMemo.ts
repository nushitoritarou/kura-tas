import { el } from '@/core/el';
import * as aiMemoLogic from '@/features/aiMemo/logic';
import * as aiMemoRenderer from '@/features/aiMemo/renderer';
import { writeAiContextFile } from '@/core/store/aiContext';
import { WiringContext } from './context';

export function wireAiMemo(ctx: WiringContext): void {
    if (!el.nav.btnAiMemo) return;

    el.nav.btnAiMemo.onclick = () => {
        const { aiMemo } = ctx.store.config.getState();
        aiMemoRenderer.renderAiMemo(aiMemo || '');
        aiMemoRenderer.toggleAiMemoModal(true);
    };

    el.modals.aiMemo.btnClose.onclick = () => {
        aiMemoRenderer.toggleAiMemoModal(false);
    };

    el.modals.aiMemo.btnSave.onclick = async () => {
        const memo = el.modals.aiMemo.input.value;
        await ctx.dispatchAction(async () => {
            await aiMemoLogic.saveAiMemo(memo, { config: ctx.store.config });
            await writeAiContextFile(ctx.store.ui.getState().version, ctx.store.config.getState());
        });
        aiMemoRenderer.toggleAiMemoModal(false);
    };
}
