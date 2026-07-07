import { storage } from '@/core/storage';
import { logger } from '@/core/logger';

export abstract class BaseStore<T, S = T> {
    protected state: T;
    private queue: Promise<any> = Promise.resolve();
    private onMutation?: () => void;

    constructor(initialState: T) {
        this.state = initialState;
    }

    protected async enqueue<R>(task: (currentState: T) => Promise<{ nextState: T, result: R, onSuccess?: () => void }>): Promise<R> {
        const next = (async () => {
            try {
                await this.queue;
            } catch (e) {
                logger.warn(`[BaseStore] Previous operation in queue failed. Proceeding with next task.`, e);
            }

            try {
                const { nextState, result, onSuccess } = await task(this.state);
                const hasChanged = this.state !== nextState;
                this.state = nextState;
                if (onSuccess) onSuccess();
                if (hasChanged && this.onMutation) this.onMutation();
                return result;
            } catch (e) {
                logger.error(`[BaseStore] Operation failed:`, e);
                throw e;
            }
        })();

        this.queue = next;
        return next;
    }

    getState(): T {
        return this.state;
    }

    getSnapshot(): S {
        return structuredClone(this.state) as unknown as S;
    }

    abstract restoreSnapshot(snapshot: S): Promise<void>;

    abstract load(): Promise<void>;

    setMutationObserver(observer: () => void) {
        this.onMutation = observer;
    }

    protected notifyMutation() {
        if (this.onMutation) this.onMutation();
    }
}

export abstract class JsonObjectStore<T extends object> extends BaseStore<T> {
    protected abstract fileName: string;

    async load() {
        const loaded = await storage.readJson<T>(this.fileName);
        if (loaded) {
            this.state = loaded;
        }
    }

    async update(patch: Partial<T>) {
        await this.enqueue(async (currentState) => {
            const nextState = { ...currentState, ...patch };
            await storage.writeJson(this.fileName, nextState);
            return { nextState, result: undefined };
        });
    }

    async restoreSnapshot(snapshot: T): Promise<void> {
        await this.enqueue(async () => {
            await storage.writeJson(this.fileName, snapshot);
            return { nextState: snapshot, result: undefined };
        });
    }
}

export abstract class JsonListStore<T extends { id: string }> extends BaseStore<T[]> {
    protected abstract fileName: string;

    async load() {
        const loaded = await storage.readJson<T[]>(this.fileName) || [];
        this.state = loaded;
    }

    getAll(): T[] {
        return this.state;
    }

    async add(item: T) {
        await this.enqueue(async (currentState) => {
            const nextState = [...currentState, item];
            await storage.writeJson(this.fileName, nextState);
            return { nextState, result: undefined };
        });
    }

    async remove(id: string) {
        await this.enqueue(async (currentState) => {
            const nextState = currentState.filter(i => i.id !== id);
            await storage.writeJson(this.fileName, nextState);
            return { nextState, result: undefined };
        });
    }

    async update(item: T) {
        await this.enqueue(async (currentState) => {
            const nextState = currentState.map(i => i.id === item.id ? item : i);
            await storage.writeJson(this.fileName, nextState);
            return { nextState, result: undefined };
        });
    }

    async restoreSnapshot(snapshot: T[]): Promise<void> {
        await this.enqueue(async () => {
            await storage.writeJson(this.fileName, snapshot);
            return { nextState: snapshot, result: undefined };
        });
    }

    hasId(id: string): boolean {
        return this.state.some(i => i.id === id);
    }

    find(id: string): T | undefined {
        return this.state.find(i => i.id === id);
    }
}

export abstract class DirectoryStore<T, S = T> extends BaseStore<T, S> {
    protected abstract dirName: string;
    async load() {}
}
