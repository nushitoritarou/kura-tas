import * as globalLogic from '@/features/global/logic';
import * as routineLogic from '@/features/routine/logic';
import { WiringContext } from './context';

export function wireDayWatch(ctx: WiringContext): void {
    // 9. 日跨ぎ監視
    // 画面がアクティブになった時
    document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible' && ctx.store.ui.getState().isAppReady) {
            let updated = false;
            await ctx.dispatchAction(async () => {
                const updatedDate = await globalLogic.checkAndApplyDayChange(ctx.store);
                if (updatedDate) {
                    await routineLogic.generateTasksFromRoutine(updatedDate, { routine: ctx.store.routine, tasks: ctx.store.tasks, config: ctx.store.config, notes: ctx.store.notes });
                    updated = true;
                }
            }, { recordHistory: false });
            if (updated) {
                ctx.store.resetHistory();
            }
        }
    });

    // 定期チェック (1分間隔)
    setInterval(async () => {
        if (ctx.store.ui.getState().isAppReady) {
            let updated = false;
            await ctx.dispatchAction(async () => {
                const updatedDate = await globalLogic.checkAndApplyDayChange(ctx.store);
                if (updatedDate) {
                    await routineLogic.generateTasksFromRoutine(updatedDate, { routine: ctx.store.routine, tasks: ctx.store.tasks, config: ctx.store.config, notes: ctx.store.notes });
                    updated = true;
                }
            }, { recordHistory: false });
            if (updated) {
                ctx.store.resetHistory();
            }
        }
    }, 60 * 1000);
}
