import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskStore } from './TaskStore';
import { storage } from '@/core/storage';
import { Task } from '@/types';
import * as datetime from '@/core/engine/datetime';

vi.mock('@/core/storage', () => ({
    storage: {
        readJson: vi.fn(),
        writeJson: vi.fn(),
        listDir: vi.fn(),
        deleteFile: vi.fn()
    }
}));

describe('TaskStore', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('load() で今日のタスクをロードすること', async () => {
        const store = new TaskStore([]);
        const today = datetime.getTodayStr();
        
        vi.mocked(storage.readJson).mockResolvedValue([{ id: '1', text: 'today task', originalDate: "2024-06-01", date: today, done: false }]);

        await store.load();

        expect(storage.readJson).toHaveBeenCalledWith(`tasks/${today}.json`);
        expect(store.getState().length).toBe(1);
        expect(store.getState()[0].id).toBe('1');
    });

    it('getTasksFor() でキャッシュにない日付のタスクをロードしてマージすること', async () => {
        const store = new TaskStore([]);
        const targetDate = '2024-01-01';
        
        vi.mocked(storage.listDir).mockResolvedValue([`${targetDate}.json`]);
        vi.mocked(storage.readJson).mockResolvedValue([{ id: '2', text: 'past task', originalDate: "2024-06-01", date: targetDate, done: true }]);

        await store.load(); // 1. スキャン
        const tasks = await store.getTasksFor(targetDate); // 2. 個別ロード

        expect(tasks.length).toBe(1);
        expect(tasks[0].id).toBe('2');
        expect(store.getState()).toContainEqual(tasks[0]);
    });

    it('add() でタスクを追加し、該当する日付のファイルに書き込むこと', async () => {
        const store = new TaskStore([]);
        const newTask: Task = { id: '3', text: 'new', originalDate: "2024-06-01", date: '2024-05-24', done: false };
        
        vi.mocked(storage.readJson).mockResolvedValue([]); // 空のファイルと想定
        await store.add(newTask);

        expect(store.getState()).toContainEqual(newTask);
        expect(storage.writeJson).toHaveBeenCalledWith('tasks/2024-05-24.json', [newTask]);
    });

    it('addMany() で複数日のタスクを一括追加し、既存データが消失しないこと', async () => {
        const store = new TaskStore([]);
        const today = datetime.getTodayStr();
        
        // 1日目（今日）に既存タスクがある
        const task1: Task = { id: 't1', originalDate: "2024-06-01", date: today, text: 'existing', done: false };
        vi.mocked(storage.readJson).mockImplementation(async (path) => {
            if (path === `tasks/${today}.json`) return [task1];
            return [];
        });
        
        await store.load();

        // 35日分のタスクを一括追加（Evictionが発生する量）
        const newTasks: Task[] = [];
        for (let i = 1; i <= 35; i++) {
            newTasks.push({ 
                id: `new-${i}`, 
                originalDate: "2024-06-01", date: `2030-01-${i.toString().padStart(2, '0')}`, 
                text: 'new', 
                done: false 
            });
        }
        // today への追加も混ぜる
        newTasks.push({ id: 'new-today', originalDate: "2024-06-01", date: today, text: 'new today', done: false });

        await store.addMany(newTasks);

        // 1日目（今日）の書き込み内容を確認。既存の task1 が含まれている必要がある
        const writeCall = vi.mocked(storage.writeJson).mock.calls.find(call => call[0] === `tasks/${today}.json`);
        expect(writeCall).toBeDefined();
        expect(writeCall![1]).toContainEqual(task1);
        expect(writeCall![1]).toContainEqual(expect.objectContaining({ id: 'new-today' }));
    });

    it('ロード済みのタスク（既存ID）を add() しようとするとエラーを投げること', async () => {
        const store = new TaskStore([]);
        const today = datetime.getTodayStr();
        const existingTask: Task = { id: 'existing-123', text: 'already in file', originalDate: "2024-06-01", date: today, done: false };

        vi.mocked(storage.readJson).mockResolvedValue([existingTask]);
        await store.load();

        const dupTask: Task = { id: 'existing-123', text: 'new text but same ID', originalDate: "2024-06-01", date: today, done: false };
        await expect(store.add(dupTask)).rejects.toThrow('Duplicate Task ID');
    });

    it('update() で既存タスクを更新し、ファイルに書き込むこと', async () => {
        const today = datetime.getTodayStr();
        const task: Task = { id: '1', text: 'old', originalDate: "2024-06-01", date: today, done: false };
        const store = new TaskStore([task]);
        
        vi.mocked(storage.readJson).mockResolvedValue([task]); // ファイルの現状

        const updatedTask = { ...task, text: 'new', done: true };
        await store.update(updatedTask);

        expect(store.getState()[0].text).toBe('new');
        expect(store.getState()[0].done).toBe(true);
        expect(storage.writeJson).toHaveBeenCalledWith(`tasks/${today}.json`, [updatedTask]);
    });

    it('update() で日付が変更された場合、エラーを投げること (SRP遵守)', async () => {
        const oldDate = '2024-05-01';
        const newDate = '2024-05-02';
        const task: Task = { id: '1', text: 'move', originalDate: "2024-06-01", date: oldDate, done: false };
        const store = new TaskStore([task]);

        const updatedTask = { ...task, originalDate: "2024-06-01", date: newDate };
        await expect(store.update(updatedTask)).rejects.toThrow('Date change is not supported');
    });

    it('getTasksFor() が同じ日付で2回目以降はファイルアクセスしないこと', async () => {
        const store = new TaskStore([]);
        const targetDate = '2024-01-01';
        
        vi.mocked(storage.readJson).mockResolvedValue([{ id: '2', text: 'past task', originalDate: "2024-06-01", date: targetDate, done: true }]);

        await store.getTasksFor(targetDate); // 1回目
        await store.getTasksFor(targetDate); // 2回目

        expect(storage.readJson).toHaveBeenCalledTimes(1);
    });

    it('remove() でタスクを削除し、ファイルに書き込むこと', async () => {
        const today = datetime.getTodayStr();
        const task: Task = { id: '1', text: 'to be removed', originalDate: "2024-06-01", date: today, done: false };
        const store = new TaskStore([task]);
        
        vi.mocked(storage.readJson).mockResolvedValue([task]);

        await store.remove('1');

        expect(store.getState()).toEqual([]);
        expect(store.hasId('1')).toBe(false);
        expect(storage.deleteFile).toHaveBeenCalledWith(`tasks/${today}.json`);
    });

    it('add() 時、未ロードの日付の既存データが消失しないこと (Read-Modify-Write)', async () => {
        const store = new TaskStore([]);
        const targetDate = '2024-12-31';
        const existingTask: Task = { id: 'ext-1', text: 'exist', originalDate: "2024-06-01", date: targetDate, done: false };
        const newTask: Task = { id: 'new-1', text: 'new', originalDate: "2024-06-01", date: targetDate, done: false };

        // ファイルには既にデータがあるが、Storeはそれをまだロードしていない
        vi.mocked(storage.readJson).mockResolvedValue([existingTask]);

        await store.add(newTask);

        // ファイルへの書き込み内容に、既存データが含まれている必要がある
        expect(storage.writeJson).toHaveBeenCalledWith(`tasks/${targetDate}.json`, expect.arrayContaining([existingTask, newTask]));
    });

    it('書き込みに失敗した場合、メモリ上の状態が追加されていてはならないこと', async () => {
        const store = new TaskStore([]);
        const task: Task = { id: 'fail-id', text: 'fail', originalDate: "2024-06-01", date: '2024-01-01', done: false };
        
        vi.mocked(storage.writeJson).mockRejectedValueOnce(new Error('IO Error'));

        await expect(store.add(task)).rejects.toThrow('IO Error');

        // 失敗したので state に追加されていてはならない
        expect(store.hasId('fail-id')).toBe(false);
    });

    it('restoreSnapshot() でメモリとファイルの状態がスナップショット通りに復元されること', async () => {
        const date1 = '2024-06-01';
        const date2 = '2024-06-02';
        const task1: Task = { id: 't1', text: 'task 1', originalDate: "2024-06-01", date: date1, done: false };
        const task2: Task = { id: 't2', text: 'task 2', originalDate: "2024-06-01", date: date2, done: false };
        
        // 現在の状態（ロード済み）
        const store = new TaskStore([task1, task2]);
        
        // スナップショット（task1の内容が変更され、task2が削除されている状態を想定）
        const task1Restored = { ...task1, text: 'task 1 restored', done: true };
        const snapshot = [task1Restored];
        
        await store.restoreSnapshot(snapshot);
        
        // メモリの確認
        expect(store.getState()).toEqual([task1Restored]);
        
        // ファイルアクセスの確認
        // date1 は更新される
        expect(storage.writeJson).toHaveBeenCalledWith(`tasks/${date1}.json`, [task1Restored]);
        // date2 はスナップショットにないので削除される
        expect(storage.deleteFile).toHaveBeenCalledWith(`tasks/${date2}.json`);
    });
});
