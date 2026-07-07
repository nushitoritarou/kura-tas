import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as logic from '../logic';
import { TaskStore } from '@/core/store/TaskStore';
import { InboxItemStore } from '@/core/store/InboxItemStore';
import { Task } from '@/types';

vi.mock('@/core/store/TaskStore');
vi.mock('@/core/store/InboxItemStore');
vi.mock('@/core/storage');

describe('tasks logic', () => {
    let tasksStore: TaskStore;
    let inboxStore: InboxItemStore;
    let deps: logic.TaskDeps;

    beforeEach(() => {
        tasksStore = new TaskStore() as any;
        inboxStore = new InboxItemStore() as any;
        deps = { tasks: tasksStore, inboxItems: inboxStore };
        vi.clearAllMocks();
    });

    it('loadDayTasks がストアの getTasksFor を呼ぶこと', async () => {
        await logic.loadDayTasks('2024-06-01', deps);
        expect(tasksStore.getTasksFor).toHaveBeenCalledWith('2024-06-01');
    });

    it('addTask がタスクを追加すること', async () => {
        await logic.addTask('new task', '2024-06-01', deps);
        expect(tasksStore.add).toHaveBeenCalledWith(expect.objectContaining({
            text: 'new task',
            originalDate: "2024-06-01", date: '2024-06-01',
            done: false
        }));
    });

    it('addTask が内容空の場合にエラーを投げること', async () => {
        await expect(logic.addTask('', '2024-06-01', deps)).rejects.toThrow('内容を入力してください');
    });

    it('toggleTaskDone がタスクの状態を反転させること', async () => {
        const mockTask: Task = { id: '1', text: 'test', originalDate: "2024-06-01", date: '2024-06-01', done: false };
        vi.mocked(tasksStore.find).mockReturnValue(mockTask);

        await logic.toggleTaskDone('1', deps);
        expect(tasksStore.update).toHaveBeenCalledWith(expect.objectContaining({
            id: '1',
            done: true
        }));
    });

    it('toggleTaskDelegated がタスクの他者依頼状態を反転させること', async () => {
        // false -> true
        const mockTask1: Task = { id: '1', text: 'test', originalDate: "2024-06-01", date: '2024-06-01', done: false, delegated: false };
        vi.mocked(tasksStore.find).mockReturnValueOnce(mockTask1);
        await logic.toggleTaskDelegated('1', deps);
        expect(tasksStore.update).toHaveBeenCalledWith(expect.objectContaining({ id: '1', delegated: true }));

        // true -> false
        const mockTask2: Task = { id: '2', text: 'test', originalDate: "2024-06-01", date: '2024-06-01', done: false, delegated: true };
        vi.mocked(tasksStore.find).mockReturnValueOnce(mockTask2);
        await logic.toggleTaskDelegated('2', deps);
        expect(tasksStore.update).toHaveBeenCalledWith(expect.objectContaining({ id: '2', delegated: false }));

        // undefined -> true
        const mockTask3: Task = { id: '3', text: 'test', originalDate: "2024-06-01", date: '2024-06-01', done: false };
        vi.mocked(tasksStore.find).mockReturnValueOnce(mockTask3);
        await logic.toggleTaskDelegated('3', deps);
        expect(tasksStore.update).toHaveBeenCalledWith(expect.objectContaining({ id: '3', delegated: true }));
    });

    it('toggleTaskDelegated が存在しないタスクIDの場合にエラーを投げること', async () => {
        vi.mocked(tasksStore.find).mockReturnValue(undefined);
        await expect(logic.toggleTaskDelegated('999', deps)).rejects.toThrow('指定されたタスクが見つかりません');
    });

    it('renameTask がタスク名を変更すること', async () => {
        const mockTask: Task = { id: '1', text: 'old', originalDate: "2024-06-01", date: '2024-06-01', done: false };
        vi.mocked(tasksStore.find).mockReturnValue(mockTask);

        await logic.renameTask('1', 'new name', deps);
        expect(tasksStore.update).toHaveBeenCalledWith(expect.objectContaining({
            id: '1',
            text: 'new name'
        }));
    });

    it('renameTask が内容空の場合にエラーを投げること', async () => {
        await expect(logic.renameTask('1', '', deps)).rejects.toThrow('内容を入力してください');
    });

    it('renameTask が存在しないタスクIDの場合にエラーを投げること', async () => {
        vi.mocked(tasksStore.find).mockReturnValue(undefined);
        await expect(logic.renameTask('999', 'new', deps)).rejects.toThrow('指定されたタスクが見つかりません');
    });

    it('deleteTask がタスクを削除すること', async () => {
        await logic.deleteTask('1', deps);
        expect(tasksStore.remove).toHaveBeenCalledWith('1');
    });

    it('moveTaskToNextWorkDay が翌営業日にタスクを移動（remove & add）すること', async () => {
        const mockTask: Task = { id: '1', text: 'test', originalDate: "2024-06-01", date: '2024-05-31', done: false }; // 金曜日
        vi.mocked(tasksStore.find).mockReturnValue(mockTask);

        await logic.moveTaskToNextWorkDay('1', deps);
        
        expect(tasksStore.remove).toHaveBeenCalledWith('1');
        expect(tasksStore.add).toHaveBeenCalledWith(expect.objectContaining({
            text: 'test',
            originalDate: "2024-06-01", date: '2024-06-03', // 月曜日
            done: false
        }));
    });

    it('returnToInbox がタスクを削除し、インボックスに追加すること', async () => {
        const mockTask: Task = { id: '1', text: 'test', originalDate: "2024-06-01", date: '2024-06-01', done: false };
        vi.mocked(tasksStore.find).mockReturnValue(mockTask);

        await logic.returnToInbox('1', deps);
        expect(inboxStore.add).toHaveBeenCalledWith(expect.objectContaining({
            text: 'test'
        }));
        expect(tasksStore.remove).toHaveBeenCalledWith('1');
    });

    it('carryOverTasks が未完了タスクを翌日に繰り越すこと', async () => {
        const targetDate = '2024-06-03'; // 月曜
        const prevDate = '2024-06-02'; // 日曜 (addDays(-1)で計算される想定)
        
        const oldTask: Task = { id: 'old-1', text: 'incomplete', originalDate: "2024-06-01", date: prevDate, done: false };
        
        vi.mocked(tasksStore.getTasksFor).mockImplementation(async (date) => {
            if (date === targetDate) return [];
            if (date === prevDate) return [oldTask];
            return [];
        });

        const addedCount = await logic.carryOverTasks(targetDate, 1, deps);
        
        expect(addedCount).toBe(1);
        // 元のタスクを完了扱いに
        expect(tasksStore.update).toHaveBeenCalledWith(expect.objectContaining({
            id: 'old-1',
            done: true,
            text: 'incomplete (Carried Over)'
        }));
        // 新しいタスクを追加
        expect(tasksStore.add).toHaveBeenCalledWith(expect.objectContaining({
            text: 'incomplete',
            originalDate: "2024-06-01", date: targetDate,
            done: false
        }));
    });

    describe('importTasks', () => {
        it('配列からタスクをインポートすること', async () => {
            const json = JSON.stringify([
                'task1',
                { text: 'task2', deadline: '2024-06-10', delegated: true }
            ]);
            await logic.importTasks(json, '2024-06-01', deps);
            expect(tasksStore.add).toHaveBeenCalledTimes(2);
            expect(tasksStore.add).toHaveBeenNthCalledWith(1, expect.objectContaining({ text: 'task1', originalDate: "2024-06-01", date: '2024-06-01' }));
            expect(tasksStore.add).toHaveBeenNthCalledWith(2, expect.objectContaining({ text: 'task2', deadline: '2024-06-10', delegated: true }));
        });

        it('不正なJSONの場合にエラーを投げること', async () => {
            await expect(logic.importTasks('invalid json', '2024-06-01', deps)).rejects.toThrow('Invalid JSON format');
        });
    });
});
