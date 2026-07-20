import { storage } from '@/core/storage';
import { logger, configureLogger } from '@/core/logger';
import * as globalLogic from '@/features/global/logic';
import * as globalRenderer from '@/features/global/renderer';
import * as routineLogic from '@/features/routine/logic';
import { el } from '@/core/el';
import { WiringContext } from './context';

export async function wireSetup(ctx: WiringContext, onReady: () => Promise<void>): Promise<void> {
    // 保存されたハンドルの確認
    const savedHandle = await globalLogic.checkSavedHandle(ctx.store);
    if (savedHandle) {
        globalRenderer.showResumeContainer(savedHandle.name);
    }

    el.setup.btnSetup.onclick = async () => {
        try {
            const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
            if (handle) {
                await storage.init(handle);
                await ctx.dispatchAction(async () => {
                    await globalLogic.setupStorage(handle, ctx.store);
                    // ストレージ初期化後に設定がロードされるため、再度Loggerを構成
                    configureLogger(ctx.store.config.getState());
                    await routineLogic.generateTasksFromRoutine(ctx.store.ui.getState().currentDate, { routine: ctx.store.routine, tasks: ctx.store.tasks, config: ctx.store.config, notes: ctx.store.notes });
                }, { recordHistory: false });
                ctx.store.resetHistory(); // 起動直後の状態を「原点」にする
                globalRenderer.showAppContainer();
                await onReady();
            }
        } catch (e) {
            logger.warn('Directory picker cancelled or failed', e);
        }
    };

    el.setup.btnResume.onclick = async () => {
        const handle = await globalLogic.checkSavedHandle(ctx.store);
        if (handle) {
            try {
                const permission = await handle.requestPermission({ mode: 'readwrite' });
                if (permission === 'granted') {
                    await storage.init(handle);
                    await ctx.dispatchAction(async () => {
                        await globalLogic.setupStorage(handle, ctx.store);
                        // ストレージ初期化後に設定がロードされるため、再度Loggerを構成
                        configureLogger(ctx.store.config.getState());
                        await routineLogic.generateTasksFromRoutine(ctx.store.ui.getState().currentDate, { routine: ctx.store.routine, tasks: ctx.store.tasks, config: ctx.store.config, notes: ctx.store.notes });
                    }, { recordHistory: false });
                    ctx.store.resetHistory(); // 起動直後の状態を「原点」にする
                    globalRenderer.showAppContainer();
                    await onReady();
                }
            } catch (e) {
                logger.error('Permission request failed', e);
                globalRenderer.notifyError('ディレクトリへのアクセス権限が必要です。');
            }
        }
    };
}
