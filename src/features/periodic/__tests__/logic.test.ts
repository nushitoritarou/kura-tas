import { describe, it, expect, vi, beforeEach } from 'vitest';
import { upsertMaster, generateTasksFromPeriodic, getMasters, deleteMaster } from '../logic';
import { PeriodicStore } from '@/core/store/PeriodicStore';
import { TaskStore } from '@/core/store/TaskStore';
import { UIStore } from '@/core/store/UIStore';

// Mock getTodayStr
vi.mock('@/core/engine/datetime', () => ({
    getTodayStr: vi.fn().mockReturnValue('2026-06-08'),
    getDayOfWeek: vi.fn().mockImplementation((dateStr: string) => {
        const [y, m, d] = dateStr.split('-').map(Number);
        return new Date(y, m - 1, d).getDay();
    }),
}));

describe('periodic logic', () => {
    let periodic: PeriodicStore;
    let tasks: TaskStore;
    let ui: UIStore;

    beforeEach(() => {
        periodic = {
            getState: vi.fn().mockReturnValue([]),
            find: vi.fn(),
            add: vi.fn(),
            update: vi.fn(),
            remove: vi.fn(),
        } as any;
        tasks = {
            getState: vi.fn().mockReturnValue([]),
            getAvailableDates: vi.fn().mockReturnValue([]),
            getTasksFor: vi.fn().mockReturnValue([]),
            addMany: vi.fn(),
            update: vi.fn(),
            remove: vi.fn(),
        } as any;
        ui = {
            getState: vi.fn().mockReturnValue({ currentDate: '2026-06-08' }),
        } as any;
        vi.clearAllMocks();
    });

    describe('getMasters', () => {
        it('マスタ一覧を返すこと', async () => {
            const mockData = [{ id: '1', text: 'T1', days: [1] }];
            periodic.getState = vi.fn().mockReturnValue(mockData);
            const result = await getMasters({ periodic });
            expect(result).toBe(mockData);
        });
    });

    describe('upsertMaster', () => {
        it('IDがない場合、新規追加すること', async () => {
            await upsertMaster({ text: 'New', days: [1] }, { periodic, tasks, ui });
            expect(periodic.add).toHaveBeenCalled();
            const saved = (periodic.add as any).mock.calls[0][0];
            expect(saved.text).toBe('New');
            expect(saved.days).toEqual([1]);
        });

        it('IDがある場合、更新すること', async () => {
            const oldItem = { id: '1', text: 'Old', days: [1] };
            periodic.find = vi.fn().mockReturnValue(oldItem);
            await upsertMaster({ id: '1', text: 'New', days: [2] }, { periodic, tasks, ui });
            expect(periodic.update).toHaveBeenCalledWith({ id: '1', text: 'New', days: [2] });
        });

        it('マスタ更新時、当日および未来日の既存タスクが更新されること', async () => {
            const masterId = 'm1';
            const oldMaster = { id: masterId, text: 'Old Text', days: [1, 2] };
            const newMasterData = { id: masterId, text: 'New Text', days: [1, 2] };
            
            periodic.find = vi.fn().mockReturnValue(oldMaster);
            tasks.getAvailableDates = vi.fn().mockReturnValue(['2026-06-08', '2026-06-09', '2026-06-07']);
            
            const taskToday = { id: 't1', text: 'Old Text', date: '2026-06-08', originalDate: '2026-06-08', periodicId: masterId, done: false };
            const taskFuture = { id: 't2', text: 'Old Text', date: '2026-06-09', originalDate: '2026-06-09', periodicId: masterId, done: false };
            const taskPast = { id: 't0', text: 'Old Text', date: '2026-06-07', originalDate: '2026-06-07', periodicId: masterId, done: false };

            tasks.getTasksFor = vi.fn().mockImplementation((date) => {
                if (date === '2026-06-08') return Promise.resolve([taskToday]);
                if (date === '2026-06-09') return Promise.resolve([taskFuture]);
                if (date === '2026-06-07') return Promise.resolve([taskPast]);
                return Promise.resolve([]);
            });

            await upsertMaster(newMasterData, { periodic, tasks, ui });

            expect(tasks.update).toHaveBeenCalledWith(expect.objectContaining({ id: 't1', text: 'New Text' }));
            expect(tasks.update).toHaveBeenCalledWith(expect.objectContaining({ id: 't2', text: 'New Text' }));
            expect(tasks.update).not.toHaveBeenCalledWith(expect.objectContaining({ id: 't0' }));
        });

        it('スケジュール変更時、本来の場所に居るタスクは削除され、手動移動したタスクは保護（更新のみ）されること', async () => {
            const masterId = 'm1';
            const oldMaster = { id: masterId, text: 'Old Text', days: [1, 2] };
            const newMasterData = { id: masterId, text: 'New Text', days: [1] }; // Tue(2) removed
            
            periodic.find = vi.fn().mockReturnValue(oldMaster);
            tasks.getAvailableDates = vi.fn().mockReturnValue(['2026-06-08', '2026-06-09', '2026-06-10']);
            // 06-08 is Mon(1), 06-09 is Tue(2), 06-10 is Wed(3)

            const taskMon = { id: 't1', text: 'Old Text', date: '2026-06-08', originalDate: '2026-06-08', periodicId: masterId, done: false };
            const taskTue = { id: 't2', text: 'Old Text', date: '2026-06-09', originalDate: '2026-06-09', periodicId: masterId, done: false };
            const taskMoved = { id: 't3', text: 'Old Text', date: '2026-06-10', originalDate: '2026-06-08', periodicId: masterId, done: false }; // Mon -> Wed へ移動済み

            tasks.getTasksFor = vi.fn().mockImplementation((date) => {
                if (date === '2026-06-08') return Promise.resolve([taskMon]);
                if (date === '2026-06-09') return Promise.resolve([taskTue]);
                if (date === '2026-06-10') return Promise.resolve([taskMoved]);
                return Promise.resolve([]);
            });

            await upsertMaster(newMasterData, { periodic, tasks, ui });

            // 月曜(1)はスケジュール継続：テキスト更新
            expect(tasks.update).toHaveBeenCalledWith(expect.objectContaining({ id: 't1', text: 'New Text' }));
            // 火曜(2)はスケジュール廃止：削除
            expect(tasks.remove).toHaveBeenCalledWith('t2');
            // 移動済み(t3)は、元が月曜(1)＝スケジュール継続なのでテキスト更新のみ（削除されない）
            expect(tasks.update).toHaveBeenCalledWith(expect.objectContaining({ id: 't3', text: 'New Text' }));
        });

        it('タスク名がない場合にエラーを投げること', async () => {
            await expect(upsertMaster({ text: '', days: [1] }, { periodic, tasks, ui })).rejects.toThrow('タスク名を入力してください');
        });

        it('曜日がない場合にエラーを投げること', async () => {
            await expect(upsertMaster({ text: 'Task', days: [] }, { periodic, tasks, ui })).rejects.toThrow('曜日を選択してください');
        });
    });

    describe('deleteMaster', () => {
        it('マスタを削除し、当日および未来日の未完了タスクも削除すること', async () => {
            const masterId = 'm1';
            tasks.getAvailableDates = vi.fn().mockReturnValue(['2026-06-08', '2026-06-09']);
            
            const taskToday = { id: 't1', text: 'Text', date: '2026-06-08', originalDate: '2026-06-08', periodicId: masterId, done: false };
            const taskFuture = { id: 't2', text: 'Text', date: '2026-06-09', originalDate: '2026-06-09', periodicId: masterId, done: false };

            tasks.getTasksFor = vi.fn().mockImplementation((date) => {
                if (date === '2026-06-08') return Promise.resolve([taskToday]);
                if (date === '2026-06-09') return Promise.resolve([taskFuture]);
                return Promise.resolve([]);
            });

            await deleteMaster(masterId, { periodic, tasks });

            expect(periodic.remove).toHaveBeenCalledWith(masterId);
            expect(tasks.remove).toHaveBeenCalledWith('t1');
            expect(tasks.remove).toHaveBeenCalledWith('t2');
        });

        it('完了済みのタスクは削除しないこと', async () => {
            const masterId = 'm1';
            tasks.getAvailableDates = vi.fn().mockReturnValue(['2026-06-08']);
            
            const taskDone = { id: 't1', text: 'Text', date: '2026-06-08', originalDate: '2026-06-08', periodicId: masterId, done: true };

            tasks.getTasksFor = vi.fn().mockImplementation((date) => {
                if (date === '2026-06-08') return Promise.resolve([taskDone]);
                return Promise.resolve([]);
            });

            await deleteMaster(masterId, { periodic, tasks });

            expect(periodic.remove).toHaveBeenCalledWith(masterId);
            expect(tasks.remove).not.toHaveBeenCalled();
        });
    });

    describe('generateTasksFromPeriodic', () => {
        it('マスタに基づいてタスクを生成すること', async () => {
            periodic.getState = vi.fn().mockReturnValue([{ id: '1', text: 'Periodic', days: [1] }]);
            // 2026-06-08 is Monday (1)
            await generateTasksFromPeriodic('2026-06-08', { periodic, tasks });
            expect(tasks.addMany).toHaveBeenCalled();
            const saved = (tasks.addMany as any).mock.calls[0][0];
            expect(saved).toHaveLength(1);
            expect(saved[0].text).toBe('Periodic');
            expect(saved[0].periodicId).toBe('1');
            expect(saved[0].originalDate).toBe('2026-06-08');
        });

        it('過去日の場合は生成しないこと', async () => {
            await generateTasksFromPeriodic('2026-06-07', { periodic, tasks });
            expect(tasks.addMany).not.toHaveBeenCalled();
        });
    });
});
