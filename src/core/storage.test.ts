import { describe, it, expect, vi, beforeEach } from 'vitest';
import { storage } from './storage';

// FileSystem API のモック
const createMockFileHandle = (name: string, initialContent: string = '{}') => {
    let content = initialContent;
    const writeMock = vi.fn().mockImplementation(async (data) => {
        content = data.toString();
    });
    const closeMock = vi.fn().mockResolvedValue(undefined);
    
    return {
        kind: 'file' as const,
        name,
        getFile: vi.fn().mockImplementation(async () => ({
            text: vi.fn().mockResolvedValue(content)
        })),
        createWritable: vi.fn().mockImplementation(async () => ({
            write: writeMock,
            close: closeMock
        }))
    };
};

const createMockDirectoryHandle = (files: Record<string, string> = {}) => {
    const fileHandles = new Map<string, any>();
    const dirHandles = new Map<string, any>();

    Object.entries(files).forEach(([name, content]) => {
        fileHandles.set(name, createMockFileHandle(name, content));
    });

    const handle: any = {
        kind: 'directory' as const,
        getFileHandle: vi.fn().mockImplementation(async (name, options) => {
            if (fileHandles.has(name)) {
                return fileHandles.get(name);
            }
            if (options?.create) {
                const newHandle = createMockFileHandle(name);
                fileHandles.set(name, newHandle);
                return newHandle;
            }
            const error = new Error('File not found');
            error.name = 'NotFoundError';
            throw error;
        }),
        getDirectoryHandle: vi.fn().mockImplementation(async (name, options) => {
            if (dirHandles.has(name)) {
                return dirHandles.get(name);
            }
            if (options?.create) {
                const newDir = createMockDirectoryHandle();
                dirHandles.set(name, newDir);
                return newDir;
            }
            const error = new Error('Directory not found');
            error.name = 'NotFoundError';
            throw error;
        }),
        values: vi.fn().mockImplementation(async function* () {
            for (const h of fileHandles.values()) yield h;
            for (const h of dirHandles.values()) yield h;
        })
    };
    return handle;
};

describe('storage', () => {
    beforeEach(() => {
        // @ts-ignore
        storage._reset();
    });

    it('init() 前の呼び出しが待機され、init() 後に実行されること', async () => {
        const mockHandle = createMockDirectoryHandle({ 'test.json': '{"a": 1}' });
        const readPromise = storage.readJson<{a: number}>('test.json');
        
        let resolved = false;
        readPromise.then(() => { resolved = true; });
        
        await new Promise(r => setTimeout(r, 10));
        expect(resolved).toBe(false);
        
        await storage.init(mockHandle);
        const result = await readPromise;
        expect(result).toEqual({ a: 1 });
        expect(resolved).toBe(true);
    });

    it('同一ファイルへの書き込みが直列化されること', async () => {
        const mockHandle = createMockDirectoryHandle();
        await storage.init(mockHandle);
        
        const fileHandle = await mockHandle.getFileHandle('serial.json', { create: true });
        const writable = await fileHandle.createWritable();
        
        let writeCount = 0;
        const activeWrites: string[] = [];
        
        // すべての createWritable が同じ writeMock を返すようになったので、
        // 以下の mockImplementation は storage 内部の呼び出しにも適用される。
        vi.mocked(writable.write).mockImplementation(async (data) => {
            activeWrites.push(data.toString());
            await new Promise(r => setTimeout(r, 50));
            expect(activeWrites.length).toBe(1);
            activeWrites.pop();
            writeCount++;
        });

        const p1 = storage.writeJson('serial.json', { id: 1 });
        const p2 = storage.writeJson('serial.json', { id: 2 });
        const p3 = storage.writeJson('serial.json', { id: 3 });

        await Promise.all([p1, p2, p3]);
        expect(writeCount).toBe(3);
    });

    it('存在しないファイルを読み込んだ場合に null を返すこと', async () => {
        const mockHandle = createMockDirectoryHandle();
        await storage.init(mockHandle);
        const result = await storage.readJson('non-existent.json');
        expect(result).toBe(null);
    });

    it('ファイル一覧を取得できること', async () => {
        const mockHandle = createMockDirectoryHandle({ 'test.json': '{}', 'serial.json': '{}' });
        await storage.init(mockHandle);
        const list = await storage.listDir('.');
        expect(list).toContain('test.json');
        expect(list).toContain('serial.json');
    });

    it('サブディレクトリ内のファイルを読み書きできること', async () => {
        const mockHandle = createMockDirectoryHandle();
        await storage.init(mockHandle);

        await storage.writeText('notes/123.md', 'hello');
        const content = await storage.readText('notes/123.md');
        expect(content).toBe('hello');

        const list = await storage.listDir('notes');
        expect(list).toContain('123.md');
    });

    it('listDirWithMeta がメタデータ付きでファイル一覧を取得すること', async () => {
        const mockHandle = createMockDirectoryHandle();
        await storage.init(mockHandle);
        const fileHandle = await mockHandle.getFileHandle('test.txt', { create: true });
        vi.mocked(fileHandle.getFile).mockResolvedValue({ lastModified: 12345 } as any);

        const list = await storage.listDirWithMeta('.');
        expect(list).toEqual([{ name: 'test.txt', lastModified: 12345 }]);
    });

    it('二度 init() しても無視されること', async () => {
        const mockHandle1 = createMockDirectoryHandle();
        const mockHandle2 = createMockDirectoryHandle();
        const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        
        await storage.init(mockHandle1);
        await storage.init(mockHandle2);
        
        expect(spy).toHaveBeenCalledWith('Storage is already initialized. Ignoring second init.');
        spy.mockRestore();
    });

    it('readJson が不正なJSONの場合にエラーを投げること', async () => {
        const mockHandle = createMockDirectoryHandle({ 'invalid.json': '{ invalid }' });
        await storage.init(mockHandle);
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        
        await expect(storage.readJson('invalid.json')).rejects.toThrow();
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });

    it('deleteFile がファイルを削除すること', async () => {
        const mockHandle = createMockDirectoryHandle({ 'delete.me': 'xxx' });
        await storage.init(mockHandle);
        
        mockHandle.removeEntry = vi.fn().mockResolvedValue(undefined);
        await storage.deleteFile('delete.me');
        expect(mockHandle.removeEntry).toHaveBeenCalledWith('delete.me');
    });

    it('deleteFile が存在しないファイルの場合もエラーにならないこと', async () => {
        const mockHandle = createMockDirectoryHandle();
        await storage.init(mockHandle);
        
        const error = new Error('Not found');
        error.name = 'NotFoundError';
        mockHandle.removeEntry = vi.fn().mockRejectedValue(error);
        
        await expect(storage.deleteFile('non-existent')).resolves.toBeUndefined();
    });
});
