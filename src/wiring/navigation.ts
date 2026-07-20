import * as globalLogic from '@/features/global/logic';
import * as routineLogic from '@/features/routine/logic';
import { el } from '@/core/el';
import { WiringContext } from './context';

export function wireNavigation(ctx: WiringContext): void {
    // 2. ナビゲーション関連
    el.nav.btnPrevDay.onclick = async () => {
        await ctx.dispatchAction(async () => {
            const nextDate = await globalLogic.shiftCurrentDate(-1, ctx.store);
            await routineLogic.generateTasksFromRoutine(nextDate, { routine: ctx.store.routine, tasks: ctx.store.tasks, config: ctx.store.config, notes: ctx.store.notes });
        }, { recordHistory: false });
        ctx.store.resetHistory();
    };

    el.nav.btnNextDay.onclick = async () => {
        await ctx.dispatchAction(async () => {
            const nextDate = await globalLogic.shiftCurrentDate(1, ctx.store);
            await routineLogic.generateTasksFromRoutine(nextDate, { routine: ctx.store.routine, tasks: ctx.store.tasks, config: ctx.store.config, notes: ctx.store.notes });
        }, { recordHistory: false });
        ctx.store.resetHistory();
    };

    el.nav.btnToday.onclick = async () => {
        await ctx.dispatchAction(async () => {
            const nextDate = await globalLogic.jumpToToday(ctx.store);
            await routineLogic.generateTasksFromRoutine(nextDate, { routine: ctx.store.routine, tasks: ctx.store.tasks, config: ctx.store.config, notes: ctx.store.notes });
        }, { recordHistory: false });
        ctx.store.resetHistory();
    };

    el.nav.btnUndo.onclick = async () => {
        await ctx.store.undo();
    };

    el.nav.btnRedo.onclick = async () => {
        await ctx.store.redo();
    };

    el.nav.dateDisplay.onclick = async () => {
        await ctx.dispatchAction(async () => {
            ctx.store.ui.update({ activeTaskId: null });
        });
    };
}
