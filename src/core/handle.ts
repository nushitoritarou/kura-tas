/**
 * FileSystemHandle を IndexedDB に保存・取得するためのユーティリティ
 */

export async function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open('kuratas_db', 1);
        req.onupgradeneeded = () => {
            if (!req.result.objectStoreNames.contains('handles')) {
                req.result.createObjectStore('handles');
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

/**
 * ハンドルを IndexedDB に保存する
 */
export async function saveHandle(h: FileSystemHandle): Promise<void> {
    const db = await openDB();
    const tx = db.transaction('handles', 'readwrite');
    return new Promise((resolve, reject) => {
        const req = tx.objectStore('handles').put(h, 'last_dir');
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

/**
 * 保存されたディレクトリハンドルを取得する
 */
export async function getSavedHandle(): Promise<FileSystemDirectoryHandle | null> {
    const db = await openDB();
    const tx = db.transaction('handles', 'readonly');
    return new Promise((resolve) => {
        const req = tx.objectStore('handles').get('last_dir');
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
    });
}
