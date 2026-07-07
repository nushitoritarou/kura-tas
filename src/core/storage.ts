// core/storage.ts
/**
 * 注意: このモジュール内では logger ではなく console を直接使用しています。
 * Logger (FileTransport) がこのストレージ層に依存しているため、
 * ここで Logger を参照すると循環参照が発生するためです。
 */
let rootHandle: FileSystemDirectoryHandle | null = null;
let resolveInit: (handle: FileSystemDirectoryHandle) => void;
let isInitialized = false;

let initializedPromise = new Promise<FileSystemDirectoryHandle>((resolve) => {
    resolveInit = resolve;
});

// 同一パスへの操作を直列化するためのキュー
const queues = new Map<string, Promise<any>>();

/**
 * 初期化が完了するまで待機するガード
 */
async function ensureInitialized(): Promise<FileSystemDirectoryHandle> {
    if (rootHandle) return rootHandle;
    return initializedPromise;
}

/**
 * 指定されたパスへの操作をキューイングして直列化する
 */
async function enqueue<T>(path: string, task: () => Promise<T>): Promise<T> {
    const previous = queues.get(path) || Promise.resolve();
    
    const current = (async () => {
        try {
            await previous;
        } catch (e) {
            // 前のタスクが失敗しても次を実行する
        }
        return await task();
    })();
    
    // キューを更新
    queues.set(path, current);
    
    try {
        return await current;
    } finally {
        // メモリリーク防止: 自分が最新のPromiseであればMapから削除する
        if (queues.get(path) === current) {
            queues.delete(path);
        }
    }
}

/**
 * パスからディレクトリハンドルを取得する
 */
async function getDirHandle(root: FileSystemDirectoryHandle, path: string, options?: { create?: boolean }) {
    const parts = path.split('/').filter(p => p && p !== '.');
    let currentDir = root;

    for (const part of parts) {
        currentDir = await currentDir.getDirectoryHandle(part, { create: options?.create });
    }
    return currentDir;
}

/**
 * パスからディレクトリハンドルとファイル名を取得する（簡易的なサブディレクトリ対応）
 */
async function getHandleForPath(root: FileSystemDirectoryHandle, path: string, options?: { create?: boolean }) {
    const parts = path.split('/').filter(p => p && p !== '.');
    const fileName = parts.pop();
    if (!fileName) throw new Error(`Invalid path: ${path}`);

    const directory = await getDirHandle(root, parts.join('/'), options);
    return { directory, fileName };
}

export const storage = {
    /**
     * 初期化時にディレクトリハンドルをセットする
     */
    init: async (handle: FileSystemDirectoryHandle) => {
        if (isInitialized) {
            console.warn('Storage is already initialized. Ignoring second init.');
            return;
        }
        rootHandle = handle;
        isInitialized = true;
        resolveInit(handle);
    },

    /**
     * JSONファイルを読み込む
     */
    readJson: async <T>(path: string): Promise<T | null> => {
        const content = await storage.readText(path);
        if (content === null) return null;
        try {
            return JSON.parse(content) as T;
        } catch (e) {
            console.error(`Failed to parse JSON from ${path}`, e);
            throw e;
        }
    },

    /**
     * JSONファイルを書き込む
     */
    writeJson: async (path: string, data: any): Promise<void> => {
        await storage.writeText(path, JSON.stringify(data, null, 2));
    },

    /**
     * テキストファイルを読み込む
     */
    readText: async (path: string): Promise<string | null> => {
        const root = await ensureInitialized();
        return await enqueue(path, async () => {
            try {
                const { directory, fileName } = await getHandleForPath(root, path);
                const fileHandle = await directory.getFileHandle(fileName);
                const file = await fileHandle.getFile();
                return await file.text();
            } catch (e: any) {
                if (e.name === 'NotFoundError') {
                    return null;
                }
                throw e;
            }
        });
    },

    /**
     * テキストファイルを書き込む
     */
    writeText: async (path: string, content: string): Promise<void> => {
        const root = await ensureInitialized();
        await enqueue(path, async () => {
            const { directory, fileName } = await getHandleForPath(root, path, { create: true });
            const fileHandle = await directory.getFileHandle(fileName, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(content);
            await writable.close();
        });
    },

    /**
     * テキストファイルを追記する
     */
    appendText: async (path: string, content: string): Promise<void> => {
        const root = await ensureInitialized();
        await enqueue(path, async () => {
            const { directory, fileName } = await getHandleForPath(root, path, { create: true });
            const fileHandle = await directory.getFileHandle(fileName, { create: true });
            const file = await fileHandle.getFile();
            const writable = await fileHandle.createWritable({ keepExistingData: true });
            await writable.seek(file.size);
            await writable.write(content);
            await writable.close();
        });
    },

    /**
     * ディレクトリ内のファイル一覧とメタデータを取得する
     */
    listDirWithMeta: async (dirPath: string): Promise<{ name: string, lastModified: number }[]> => {
        const root = await ensureInitialized();
        const directory = await getDirHandle(root, dirPath, { create: false });
        const result: { name: string, lastModified: number }[] = [];
        for await (const entry of directory.values()) {
            if (entry.kind === 'file') {
                const file = await (entry as FileSystemFileHandle).getFile();
                result.push({ name: entry.name, lastModified: file.lastModified });
            }
        }
        return result;
    },

    /**
     * ディレクトリ内のファイル一覧を取得する
     */
    listDir: async (dirPath: string): Promise<string[]> => {
        const root = await ensureInitialized();
        const directory = await getDirHandle(root, dirPath, { create: false });
        const result: string[] = [];
        for await (const entry of directory.values()) {
            if (entry.kind === 'file') {
                result.push(entry.name);
            }
        }
        return result;
    },

    /**
     * ファイルを削除する
     */
    deleteFile: async (path: string): Promise<void> => {
        const root = await ensureInitialized();
        await enqueue(path, async () => {
            try {
                const { directory, fileName } = await getHandleForPath(root, path);
                await directory.removeEntry(fileName);
            } catch (e: any) {
                if (e.name === 'NotFoundError') {
                    return; // 既に存在しない場合は成功とみなす
                }
                throw e;
            }
        });
    },

    /**
     * 内部状態をリセットする（テスト用）
     */
    _reset: () => {
        rootHandle = null;
        isInitialized = false;
        initializedPromise = new Promise<FileSystemDirectoryHandle>((resolve) => {
            resolveInit = resolve;
        });
        queues.clear();
    }
};
