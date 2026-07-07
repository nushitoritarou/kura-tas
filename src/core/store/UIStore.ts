import { BaseStore } from './BaseStore';
import { UIState } from '@/types';

/**
 * 永続化しない、UIの実行時状態を管理するストア。
 * アプリをリロードすると初期状態に戻る。
 */
export class UIStore extends BaseStore<UIState> {
    constructor() {
        super({
            isAppReady: false,
            lastDirName: null,
            currentDate: '',
            lastKnownToday: '',
            activeTaskId: null,
            isEditMode: true,
            version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0',
            debugMode: typeof __DEBUG_MODE__ !== 'undefined' ? __DEBUG_MODE__ : false
        });
    }

    /**
     * 初期ロード（UIStoreはメモリ上のみなので何もしない）
     */
    async load(): Promise<void> {
        return Promise.resolve();
    }

    /**
     * 状態の一部を更新する
     * 永続化がないため、BaseStore.enqueue は使わずに即時反映する
     */
    update(patch: Partial<UIState>): void {
        this.state = { ...this.state, ...patch };
        this.notifyMutation();
    }

    async restoreSnapshot(snapshot: UIState): Promise<void> {
        this.state = snapshot;
        this.notifyMutation();
    }
}
