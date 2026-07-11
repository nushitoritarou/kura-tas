import { ConfigStore } from '@/core/store/ConfigStore';
import { TaskStore } from '@/core/store/TaskStore';
import { InboxItemStore } from './InboxItemStore';
import { NoteStore } from './NoteStore';
import { CommonLinkStore } from './CommonLinkStore';
import { RoutineStore } from './RoutineStore';
import { UIStore } from './UIStore';
import { HandleStore } from './HandleStore';
import { logger } from '@/core/logger';

/**
 * 履歴管理（Undo/Redo）の対象となるストアのキー
 */
export type UndoableStoreKey = 'tasks' | 'inboxItems' | 'notes' | 'commonLinks' | 'periodic';

/**
 * アプリケーション全体のドメイン状態のスナップショット
 */
export interface AppSnapshot {
    tasks: any;
    inboxItems: any;
    notes: any;
    commonLinks: any;
    periodic: any;
}

export class StoreRegistry {
    readonly tasks = new TaskStore();
    readonly inboxItems = new InboxItemStore();
    readonly config = new ConfigStore();
    readonly notes = new NoteStore();
    readonly commonLinks = new CommonLinkStore();
    readonly periodic = new RoutineStore();
    readonly ui = new UIStore();
    readonly handle = new HandleStore();

    private history: AppSnapshot[] = [];
    private redoStack: AppSnapshot[] = [];
    private isTransactionActive = false;
    private dirtyStores = new Set<keyof StoreRegistry>();
    private commitListeners: ((dirtyStores: Set<keyof StoreRegistry>) => void)[] = [];
    private transactionQueue: Promise<void> = Promise.resolve();

    constructor() {
        // 変更検知の自動セットアップ
        const keys: (keyof StoreRegistry)[] = [
            'tasks', 'inboxItems', 'config', 'notes', 'commonLinks', 'periodic', 'ui', 'handle'
        ];
        for (const key of keys) {
            const s = this[key];
            if (s && typeof (s as any).setMutationObserver === 'function') {
                (s as any).setMutationObserver(() => this.markDirty(key));
            }
        }
    }

    /**
     * トランザクションを実行する（直列化を保証）
     * @param action 実行する非同期処理
     * @param options.recordHistory 履歴（Undoスタック）に積むかどうか（デフォルト: true）
     */
    async transaction(action: () => Promise<void>, options: { recordHistory?: boolean } = {}) {
        const recordHistory = options.recordHistory !== false;

        // ネストされたトランザクションの場合はそのまま実行
        if (this.isTransactionActive) {
            return await action();
        }

        const next = (async () => {
            await this.transactionQueue;

            const preSnapshot = recordHistory ? this.takeAppSnapshot() : null;
            this.isTransactionActive = true;
            this.dirtyStores.clear();

            try {
                await action();
                
                // ドメインストアに変更があり、かつ履歴記録が有効な場合のみ履歴を積む
                if (recordHistory && preSnapshot) {
                    const undoableKeys: UndoableStoreKey[] = ['tasks', 'inboxItems', 'notes', 'commonLinks', 'periodic'];
                    const hasDomainChange = undoableKeys.some(k => this.dirtyStores.has(k));

                    if (hasDomainChange) {
                        this.history.push(preSnapshot);
                        // Configから上限を取得（未指定時は30、最大100件に制限）
                        const limit = Math.min(this.config.getState().historyLimit ?? 30, 100);
                        while (this.history.length > limit) {
                            this.history.shift();
                        }
                        this.redoStack = [];
                    }
                }
                
                this.notifyCommit();
            } catch (e) {
                logger.error('[StoreRegistry] Transaction failed, rolling back...', e);
                if (recordHistory && preSnapshot) {
                    await this.restoreAppSnapshot(preSnapshot);
                }
                // ロールバック後は全て変更されたとみなして通知（不整合防止）
                this.dirtyStores = new Set<keyof StoreRegistry>(['tasks', 'inboxItems', 'notes', 'commonLinks', 'periodic']);
                this.notifyCommit();
                throw e;
            } finally {
                this.isTransactionActive = false;
            }
        })();

        this.transactionQueue = next.catch(() => {});
        return next;
    }

    /**
     * 手動でストアの変更をマークする（通常は自動だが、UIStoreなど明示的に呼びたい場合に使用）
     */
    markDirty(storeKey: keyof StoreRegistry) {
        this.dirtyStores.add(storeKey);
        // トランザクション外での単発更新の場合も即座に通知を試める（必要なら）
        if (!this.isTransactionActive) {
            // 単発更新の通知ロジックを入れる場合はここ
            // 現状は全ての重要操作を transaction で包む方針
        }
    }

    /**
     * 履歴スタックを空にする（起動直後などの状態を「原点」にする際に使用）
     */
    resetHistory() {
        this.history = [];
        this.redoStack = [];
        logger.info('[StoreRegistry] History reset');
    }

    canUndo(): boolean {
        return this.history.length > 0;
    }

    canRedo(): boolean {
        return this.redoStack.length > 0;
    }

    async undo() {
        const next = (async () => {
            await this.transactionQueue;
            if (this.history.length === 0) {
                logger.info('[StoreRegistry] No history to undo');
                return;
            }
            
            const currentSnapshot = this.takeAppSnapshot();
            const previousSnapshot = this.history.pop()!;
            
            this.redoStack.push(currentSnapshot);
            await this.restoreAppSnapshot(previousSnapshot);
            
            this.dirtyStores = new Set<keyof StoreRegistry>(['tasks', 'inboxItems', 'notes', 'commonLinks', 'periodic']);
            logger.info(`[StoreRegistry] Undo executed. Remaining history: ${this.history.length}`);
            this.notifyCommit();
        })();

        this.transactionQueue = next.catch(() => {});
        return next;
    }

    async redo() {
        const next = (async () => {
            await this.transactionQueue;
            if (this.redoStack.length === 0) {
                logger.info('[StoreRegistry] No redo stack to redo');
                return;
            }
            
            const currentSnapshot = this.takeAppSnapshot();
            const nextSnapshot = this.redoStack.pop()!;
            
            this.history.push(currentSnapshot);
            await this.restoreAppSnapshot(nextSnapshot);
            
            this.dirtyStores = new Set<keyof StoreRegistry>(['tasks', 'inboxItems', 'notes', 'commonLinks', 'periodic']);
            logger.info(`[StoreRegistry] Redo executed. Remaining redo: ${this.redoStack.length}`);
            this.notifyCommit();
        })();

        this.transactionQueue = next.catch(() => {});
        return next;
    }

    onCommit(listener: (dirtyStores: Set<keyof StoreRegistry>) => void) {
        this.commitListeners.push(listener);
    }

    private notifyCommit() {
        if (this.dirtyStores.size === 0) return;
        for (const listener of this.commitListeners) {
            listener(new Set(this.dirtyStores));
        }
        this.dirtyStores.clear();
    }

    private takeAppSnapshot(): AppSnapshot {
        return {
            tasks: this.tasks.getSnapshot(),
            inboxItems: this.inboxItems.getSnapshot(),
            notes: this.notes.getSnapshot(),
            commonLinks: this.commonLinks.getSnapshot(),
            periodic: this.periodic.getSnapshot(),
        };
    }

    private async restoreAppSnapshot(snapshot: AppSnapshot) {
        await Promise.all([
            this.tasks.restoreSnapshot(snapshot.tasks),
            this.inboxItems.restoreSnapshot(snapshot.inboxItems),
            this.notes.restoreSnapshot(snapshot.notes),
            this.commonLinks.restoreSnapshot(snapshot.commonLinks),
            this.periodic.restoreSnapshot(snapshot.periodic),
        ]);
    }
}
