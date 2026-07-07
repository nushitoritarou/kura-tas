import { BaseStore } from './BaseStore';
import * as handleUtil from '@/core/handle';

/**
 * FileSystemDirectoryHandleの永続化状態を管理するストア
 */
export class HandleStore extends BaseStore<FileSystemDirectoryHandle | null> {
    constructor() {
        super(null);
    }

    /**
     * IndexedDBから保存されたハンドルをロードする
     */
    async load(): Promise<void> {
        const handle = await handleUtil.getSavedHandle();
        this.state = handle;
    }

    /**
     * ハンドルを保存し、状態を更新する
     */
    async save(handle: FileSystemDirectoryHandle): Promise<void> {
        await handleUtil.saveHandle(handle);
        this.state = handle;
    }

    /**
     * 現在のハンドルを取得（同期）
     */
    getHandle(): FileSystemDirectoryHandle | null {
        return this.state;
    }

    async restoreSnapshot(snapshot: FileSystemDirectoryHandle | null): Promise<void> {
        if (snapshot) {
            await handleUtil.saveHandle(snapshot);
        }
        this.state = snapshot;
        this.notifyMutation();
    }
}
