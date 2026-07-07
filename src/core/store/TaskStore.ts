import { DirectoryStore } from '@/core/store/BaseStore';
import { Task } from '@/types';
import { storage } from '@/core/storage';
import { logger } from '@/core/logger';
import * as datetime from '@/core/engine/datetime';

export class TaskStore extends DirectoryStore<Task[]> {
    protected dirName = "tasks";

    private loadedDates = new Set<string>();
    private availableDates = new Set<string>();
    private loadOrder: string[] = [];

    private readonly MAX_LOADED_DAYS = 30;

    constructor(initialState: Task[] = []) {
        super(initialState);
        initialState.forEach(t => {
            if (t.date) {
                this.availableDates.add(t.date);
                if (!this.loadedDates.has(t.date)) {
                    this.loadedDates.add(t.date);
                    this.loadOrder.push(t.date);
                }
            }
        });
    }

    async load() {
        try {
            const files = await storage.listDir(this.dirName);
            this.availableDates = new Set(
                files.filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''))
            );
        } catch (e) {
            logger.warn(`[TaskStore] Directory ${this.dirName} not found.`);
        }
        await this.getTasksFor(datetime.getTodayStr());
    }

    async getTasksFor(date: string): Promise<Task[]> {
        return await this.enqueue(async (currentState) => {
            if (this.loadedDates.has(date)) {
                return { nextState: currentState, result: currentState.filter(t => t.date === date) };
            }

            const loaded = await storage.readJson<Task[]>(`${this.dirName}/${date}.json`) || [];
            
            // 重複排除とマージ
            const otherTasks = currentState.filter(t => t.date !== date);
            let nextState = [...otherTasks, ...loaded];

            // メモリ節約：古いキャッシュを捨てる
            const nextLoadedDates = new Set(this.loadedDates);
            nextLoadedDates.add(date);
            let nextLoadOrder = this.loadOrder.filter(d => d !== date);
            nextLoadOrder.push(date);

            if (nextLoadedDates.size > this.MAX_LOADED_DAYS) {
                const today = datetime.getTodayStr();
                const toEvict = nextLoadOrder.find(d => d !== today);
                if (toEvict) {
                    nextState = nextState.filter(t => t.date !== toEvict);
                    nextLoadedDates.delete(toEvict);
                    nextLoadOrder = nextLoadOrder.filter(d => d !== toEvict);
                }
            }

            return {
                nextState,
                result: loaded,
                onSuccess: () => {
                    this.loadedDates = nextLoadedDates;
                    this.loadOrder = nextLoadOrder;
                    if (loaded.length > 0) this.availableDates.add(date);
                    else this.availableDates.delete(date);
                }
            };
        });
    }

    async add(task: Task) {
        await this.getTasksFor(task.date);
        return await this.enqueue(async (currentState) => {
            if (currentState.some(t => t.id === task.id)) {
                throw new Error(`Duplicate Task ID: ${task.id}`);
            }

            const nextState = [...currentState, task];
            const dayTasks = nextState.filter(t => t.date === task.date);
            await storage.writeJson(`${this.dirName}/${task.date}.json`, dayTasks);

            return {
                nextState,
                result: undefined,
                onSuccess: () => {
                    this.availableDates.add(task.date);
                }
            };
        });
    }

    async addMany(tasks: Task[]) {
        if (tasks.length === 0) return;
        const dates = Array.from(new Set(tasks.map(t => t.date)));
        for (const date of dates) await this.getTasksFor(date);

        return await this.enqueue(async (currentState) => {
            const nextState = [...currentState];
            for (const task of tasks) {
                if (nextState.some(t => t.id === task.id)) continue;
                nextState.push(task);
            }

            for (const date of dates) {
                const dayTasks = nextState.filter(t => t.date === date);
                await storage.writeJson(`${this.dirName}/${date}.json`, dayTasks);
            }

            return {
                nextState,
                result: undefined,
                onSuccess: () => {
                    dates.forEach(d => this.availableDates.add(d));
                }
            };
        });
    }

    async remove(id: string) {
        const task = this.state.find(t => t.id === id);
        if (!task) return;
        const date = task.date;

        return await this.enqueue(async (currentState) => {
            const nextState = currentState.filter(t => t.id !== id);
            const dayTasks = nextState.filter(t => t.date === date);

            if (dayTasks.length === 0) {
                await storage.deleteFile(`${this.dirName}/${date}.json`);
            } else {
                await storage.writeJson(`${this.dirName}/${date}.json`, dayTasks);
            }

            return {
                nextState,
                result: undefined,
                onSuccess: () => {
                    if (dayTasks.length === 0) this.availableDates.delete(date);
                }
            };
        });
    }

    async update(task: Task) {
        const existing = this.state.find(t => t.id === task.id);
        if (existing && existing.date !== task.date) {
            throw new Error('Date change is not supported');
        }

        await this.getTasksFor(task.date);
        return await this.enqueue(async (currentState) => {
            const index = currentState.findIndex(t => t.id === task.id);
            if (index === -1) throw new Error(`Task ${task.id} not found.`);

            const nextState = [...currentState];
            nextState[index] = task;

            const dayTasks = nextState.filter(t => t.date === task.date);
            await storage.writeJson(`${this.dirName}/${task.date}.json`, dayTasks);

            return { nextState, result: undefined };
        });
    }

    getAvailableDates(): string[] {
        return Array.from(this.availableDates).sort();
    }

    hasId(id: string): boolean {
        return this.state.some(t => t.id === id);
    }

    find(id: string): Task | undefined {
        return this.state.find(t => t.id === id);
    }

    async restoreSnapshot(snapshotTasks: Task[]): Promise<void> {
        await this.enqueue(async (currentState) => {
            const snapshotDates = new Set(snapshotTasks.map(t => t.date));
            const currentDates = new Set(currentState.map(t => t.date));
            const allAffectedDates = new Set([...snapshotDates, ...currentDates]);

            // 差分がある日付だけを特定して同期
            for (const date of allAffectedDates) {
                const snapshotDayTasks = snapshotTasks.filter(t => t.date === date);
                const currentDayTasks = currentState.filter(t => t.date === date);

                // 内容が異なる場合のみファイルシステムを操作
                if (JSON.stringify(snapshotDayTasks) !== JSON.stringify(currentDayTasks)) {
                    if (snapshotDayTasks.length > 0) {
                        await storage.writeJson(`${this.dirName}/${date}.json`, snapshotDayTasks);
                    } else {
                        await storage.deleteFile(`${this.dirName}/${date}.json`);
                    }
                }
            }

            return {
                nextState: snapshotTasks,
                result: undefined,
                onSuccess: () => {
                    this.loadedDates = new Set(snapshotDates);
                    this.availableDates = new Set([...this.availableDates, ...snapshotDates]);
                    allAffectedDates.forEach(d => {
                        if (!snapshotDates.has(d)) this.availableDates.delete(d);
                    });
                    this.loadOrder = Array.from(snapshotDates);
                }
            };
        });
    }
}
