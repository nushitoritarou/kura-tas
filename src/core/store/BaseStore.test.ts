import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JsonObjectStore, JsonListStore, DirectoryStore, BaseStore } from './BaseStore';
import { storage } from '@/core/storage';

vi.mock('@/core/storage', () => ({
    storage: {
        readJson: vi.fn(),
        writeJson: vi.fn()
    }
}));

describe('JsonObjectStore', () => {
    class TestObjStore extends JsonObjectStore<{ val: number; text: string }> {
        protected fileName = "test-obj.json";
    }

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('load() でストレージからデータを読み込み state を更新すること', async () => {
        const store = new TestObjStore({ val: 0, text: "init" });
        vi.mocked(storage.readJson).mockResolvedValue({ val: 100, text: "loaded" });

        await store.load();

        expect(storage.readJson).toHaveBeenCalledWith('test-obj.json');
        expect(store.getState()).toEqual({ val: 100, text: "loaded" });
    });

    it('update() で state を部分更新し、ストレージに保存すること', async () => {
        const store = new TestObjStore({ val: 1, text: "old" });
        await store.update({ text: "new" });

        expect(store.getState()).toEqual({ val: 1, text: "new" });
        expect(storage.writeJson).toHaveBeenCalledWith('test-obj.json', { val: 1, text: "new" });
    });

    it('getSnapshot() で状態のディープコピーが取得できること', () => {
        const initial = { val: 1, text: "a" };
        const store = new TestObjStore(initial);
        const snapshot = store.getSnapshot();
        
        expect(snapshot).toEqual(initial);
        expect(snapshot).not.toBe(store.getState()); // 参照が異なること
    });

    it('restoreSnapshot() で状態が復元され、ストレージに保存されること', async () => {
        const store = new TestObjStore({ val: 1, text: "old" });
        const snapshot = { val: 2, text: "restored" };
        
        await store.restoreSnapshot(snapshot);
        
        expect(store.getState()).toEqual(snapshot);
        expect(storage.writeJson).toHaveBeenCalledWith('test-obj.json', snapshot);
    });
});

describe('JsonListStore', () => {
    interface Item { id: string; name: string }
    class TestListStore extends JsonListStore<Item> {
        protected fileName = "test-list.json";
    }

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('load() で配列を読み込み、空の場合は空配列をセットすること', async () => {
        const store = new TestListStore([]);
        vi.mocked(storage.readJson).mockResolvedValue(null);

        await store.load();

        expect(store.getState()).toEqual([]);
    });

    it('add() で要素を追加し、保存すること', async () => {
        const store = new TestListStore([{ id: "1", name: "one" }]);
        await store.add({ id: "2", name: "two" });

        expect(store.getState()).toHaveLength(2);
        expect(store.getState()[1]).toEqual({ id: "2", name: "two" });
        expect(storage.writeJson).toHaveBeenCalledWith('test-list.json', expect.arrayContaining([{ id: "1", name: "one" }, { id: "2", name: "two" }]));
    });

    it('remove() でID指定して削除し、保存すること', async () => {
        const store = new TestListStore([{ id: "1", name: "one" }, { id: "2", name: "two" }]);
        await store.remove("1");

        expect(store.getState()).toEqual([{ id: "2", name: "two" }]);
        expect(storage.writeJson).toHaveBeenCalledWith('test-list.json', [{ id: "2", name: "two" }]);
    });

    it('update() でID一致する要素を置換し、保存すること', async () => {
        const store = new TestListStore([{ id: "1", name: "old" }]);
        await store.update({ id: "1", name: "new" });

        expect(store.find("1")?.name).toBe("new");
        expect(storage.writeJson).toHaveBeenCalledWith('test-list.json', [{ id: "1", name: "new" }]);
    });

    it('hasId() と find() が正しく動作すること', () => {
        const store = new TestListStore([{ id: "1", name: "one" }]);
        expect(store.hasId("1")).toBe(true);
        expect(store.hasId("2")).toBe(false);
        expect(store.find("1")).toEqual({ id: "1", name: "one" });
    });
});

describe('DirectoryStore', () => {
    class TestDirStore extends DirectoryStore<string[]> {
        protected dirName = "test-dir";
        constructor() { super([]); }
        async restoreSnapshot(_snapshot: string[]) {}
    }

    it('load() が定義されており、呼び出し可能なこと（現状は空実装）', async () => {
        const store = new TestDirStore();
        await expect(store.load()).resolves.toBeUndefined();
    });

    it('enqueue() が直列に実行され、例外時は state が更新されないこと', async () => {
        class TestStore extends BaseStore<number> {
            constructor() { super(0); }
            async load() {}
            async restoreSnapshot(snapshot: number) {
                this.state = snapshot;
            }
            async increment() {
                return this.enqueue(async (s) => ({ nextState: s + 1, result: s + 1 }));
            }
            async fail() {
                return this.enqueue(async () => {
                    throw new Error('fail');
                });
            }
        }
        const store = new TestStore();
        
        // 連続実行
        const p1 = store.increment();
        const p2 = store.increment();
        await Promise.all([p1, p2]);
        expect(store.getState()).toBe(2);

        // 失敗時
        await expect(store.fail()).rejects.toThrow('fail');
        expect(store.getState()).toBe(2); // 失敗しても前の状態が維持される
    });
});
