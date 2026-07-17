/**
 * kura-tas エントリポイント
 * 各機能のLogicとRendererを配線（Wiring）するオーケストレーション層。
 */

import { StoreRegistry } from '@/core/store';
import { logger, configureLogger } from '@/core/logger';
import * as globalRenderer from '@/features/global/renderer';
import { WiringContext } from '@/wiring/context';
import { wireCommitHandler, initialRender } from '@/wiring/commit-handler';
import { wireSetup } from '@/wiring/setup';
import { wireNavigation } from '@/wiring/navigation';
import { wireInbox } from '@/wiring/inbox';
import { wireLinks } from '@/wiring/links';
import { wireTasks } from '@/wiring/tasks';
import { wireNotes } from '@/wiring/notes';
import { wireRoutine } from '@/wiring/routine';
import { wireHolidays } from '@/wiring/holidays';
import { wireModals } from '@/wiring/modals';
import { wireKeyboard } from '@/wiring/keyboard';
import { wireDayWatch } from '@/wiring/day-watch';
import { wireFocusMode } from '@/wiring/focus-mode';

const store = new StoreRegistry();

async function dispatchAction(action: () => Promise<void>, options?: { recordHistory?: boolean }) {
    try {
        await store.transaction(action, options);
    } catch (e: any) {
        globalRenderer.notifyError(e.message || '予期せぬエラーが発生しました');
    }
}

const ctx: WiringContext = { store, dispatchAction };

wireCommitHandler(ctx);

async function bootstrap() {
    const uiState = store.ui.getState();

    configureLogger(store.config.getState());
    logger.info('kura-tas bootstrapping...');

    const params = new URLSearchParams(window.location.search);
    const isDebug = params.get('debug') === '1' || uiState.debugMode;
    const commitHash = typeof __COMMIT_HASH__ !== 'undefined' ? __COMMIT_HASH__ : 'unknown';
    const buildTime = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : 'unknown';
    globalRenderer.displayVersion(uiState.version, isDebug, commitHash, buildTime);

    await wireSetup(ctx, () => initialRender(ctx));
    wireNavigation(ctx);
    wireInbox(ctx);
    wireLinks(ctx);
    wireTasks(ctx);
    wireNotes(ctx);
    wireRoutine(ctx);
    wireHolidays(ctx);
    wireModals(ctx);
    wireKeyboard(ctx);
    wireDayWatch(ctx);
    wireFocusMode(ctx);
}

bootstrap().catch(err => logger.error('Bootstrap failed', err));
