import { describe, it, expect, vi, beforeEach } from 'vitest';
import { upsertMaster, generateTasksFromRoutine, getMasters, deleteMaster, createTaskFromRoutine } from '../logic';
import { RoutineStore } from '@/core/store/RoutineStore';
import { TaskStore } from '@/core/store/TaskStore';
import { UIStore } from '@/core/store/UIStore';

// Mock getTodayStr
vi.mock('@/core/engine/datetime', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/core/engine/datetime')>();
    return {
        ...actual,
        getTodayStr: vi.fn().mockReturnValue('2026-06-08'),
        getDayOfWeek: vi.fn().mockImplementation((dateStr: string) => {
            const [y, m, d] = dateStr.split('-').map(Number);
            return new Date(y, m - 1, d).getDay();
        }),
    };
});

describe('routine logic', () => {
    let periodic: RoutineStore;
    let tasks: TaskStore;
    let ui: UIStore;
    let config: any;

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
        config = {
            getState: vi.fn().mockReturnValue({ workDays: [1, 2, 3, 4, 5], holidays: [] }),
            update: vi.fn(),
        } as any;
        vi.clearAllMocks();
    });

    describe('getMasters', () => {
        it('マスタ一覧を返すこと', async () => {
            const mockData = [{ id: '1', text: 'T1', schedule: { type: 'weekly' as const, days: ['Mon' as const] } }];
            periodic.getState = vi.fn().mockReturnValue(mockData);
            const result = await getMasters({ periodic });
            expect(result).toBe(mockData);
        });
    });

    describe('upsertMaster', () => {
        it('IDがない場合、かつ曜日がある場合、weeklyスケジュールで新規追加すること', async () => {
            await upsertMaster({ text: 'New', days: ['Mon'] }, { periodic, tasks, ui, config });
            expect(periodic.add).toHaveBeenCalled();
            const saved = (periodic.add as any).mock.calls[0][0];
            expect(saved.text).toBe('New');
            expect(saved.schedule).toEqual({ type: 'weekly', days: ['Mon'] });
        });

        it('曜日が指定されていない場合、noneスケジュールで新規追加すること', async () => {
            await upsertMaster({ text: 'New', days: [] }, { periodic, tasks, ui, config });
            expect(periodic.add).toHaveBeenCalled();
            const saved = (periodic.add as any).mock.calls[0][0];
            expect(saved.text).toBe('New');
            expect(saved.schedule).toEqual({ type: 'none', days: undefined });
        });

        it('IDがある場合、更新すること', async () => {
            const oldItem = { id: '1', text: 'Old', schedule: { type: 'weekly' as const, days: ['Mon' as const] } };
            periodic.find = vi.fn().mockReturnValue(oldItem);
            await upsertMaster({ id: '1', text: 'New', days: ['Tue'] }, { periodic, tasks, ui, config });
            expect(periodic.update).toHaveBeenCalledWith({
                id: '1',
                text: 'New',
                schedule: { type: 'weekly', days: ['Tue'] }
            });
        });

        it('マスタ更新時、当日および未来日の既存タスクが更新されること', async () => {
            const masterId = 'm1';
            const oldMaster = { id: masterId, text: 'Old Text', schedule: { type: 'weekly' as const, days: ['Mon' as const, 'Tue' as const] } };
            const newMasterData = { id: masterId, text: 'New Text', days: ['Mon' as const, 'Tue' as const] };
            
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

            await upsertMaster(newMasterData, { periodic, tasks, ui, config });

            expect(tasks.update).toHaveBeenCalledWith(expect.objectContaining({ id: 't1', text: 'New Text' }));
            expect(tasks.update).toHaveBeenCalledWith(expect.objectContaining({ id: 't2', text: 'New Text' }));
            expect(tasks.update).not.toHaveBeenCalledWith(expect.objectContaining({ id: 't0' }));
        });

        it('スケジュール変更時、本来の場所に居るタスクは削除され、手動移動したタスクは保護（更新のみ）されること', async () => {
            const masterId = 'm1';
            const oldMaster = { id: masterId, text: 'Old Text', schedule: { type: 'weekly' as const, days: ['Mon' as const, 'Tue' as const] } };
            const newMasterData = { id: masterId, text: 'New Text', days: ['Mon' as const] }; // Tue removed
            
            periodic.find = vi.fn().mockReturnValue(oldMaster);
            tasks.getAvailableDates = vi.fn().mockReturnValue(['2026-06-08', '2026-06-09', '2026-06-10']);
            // 06-08 is Mon, 06-09 is Tue, 06-10 is Wed

            const taskMon = { id: 't1', text: 'Old Text', date: '2026-06-08', originalDate: '2026-06-08', periodicId: masterId, done: false };
            const taskTue = { id: 't2', text: 'Old Text', date: '2026-06-09', originalDate: '2026-06-09', periodicId: masterId, done: false };
            const taskMoved = { id: 't3', text: 'Old Text', date: '2026-06-10', originalDate: '2026-06-08', periodicId: masterId, done: false }; // Mon -> Wed へ移動済み

            tasks.getTasksFor = vi.fn().mockImplementation((date) => {
                if (date === '2026-06-08') return Promise.resolve([taskMon]);
                if (date === '2026-06-09') return Promise.resolve([taskTue]);
                if (date === '2026-06-10') return Promise.resolve([taskMoved]);
                return Promise.resolve([]);
            });

            await upsertMaster(newMasterData, { periodic, tasks, ui, config });

            // 月曜はスケジュール継続：テキスト更新
            expect(tasks.update).toHaveBeenCalledWith(expect.objectContaining({ id: 't1', text: 'New Text' }));
            // 火曜はスケジュール廃止：削除
            expect(tasks.remove).toHaveBeenCalledWith('t2');
            // 移動済みは元が月曜＝スケジュール継続なのでテキスト更新（削除されない）
            expect(tasks.update).toHaveBeenCalledWith(expect.objectContaining({ id: 't3', text: 'New Text' }));
        });

        it('タスク名がない場合にエラーを投げること', async () => {
            await expect(upsertMaster({ text: '', days: ['Mon'] }, { periodic, tasks, ui, config })).rejects.toThrow('タスク名を入力してください');
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

            await deleteMaster(masterId, { periodic, tasks, config });

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

            await deleteMaster(masterId, { periodic, tasks, config });

            expect(periodic.remove).toHaveBeenCalledWith(masterId);
            expect(tasks.remove).not.toHaveBeenCalled();
        });

        it('手動移動された未完了タスクは削除しないこと', async () => {
            const masterId = 'm1';
            tasks.getAvailableDates = vi.fn().mockReturnValue(['2026-06-09']);
            
            // 本来は2026-06-08予定だが、2026-06-09に移動されたタスク
            const taskMoved = { id: 't1', text: 'Text', date: '2026-06-09', originalDate: '2026-06-08', periodicId: masterId, done: false };

            tasks.getTasksFor = vi.fn().mockImplementation((date) => {
                if (date === '2026-06-09') return Promise.resolve([taskMoved]);
                return Promise.resolve([]);
            });

            await deleteMaster(masterId, { periodic, tasks, config });

            expect(periodic.remove).toHaveBeenCalledWith(masterId);
            expect(tasks.remove).not.toHaveBeenCalled();
        });

        it('祝日調整で自動スライドされたが手動移動はされていない未完了タスクは削除すること', async () => {
            const masterId = 'm1';
            tasks.getAvailableDates = vi.fn().mockReturnValue(['2026-06-09']);
            
            // 2026-06-08 (Mon) が祝日、after 調整により 2026-06-09 (Tue) に自動生成されたタスク
            const taskAdjusted = { id: 't1', text: 'Text', date: '2026-06-09', originalDate: '2026-06-08', periodicId: masterId, done: false };

            tasks.getTasksFor = vi.fn().mockImplementation((date) => {
                if (date === '2026-06-09') return Promise.resolve([taskAdjusted]);
                return Promise.resolve([]);
            });

            config.getState = vi.fn().mockReturnValue({
                workDays: [1, 2, 3, 4, 5],
                holidays: ['2026-06-08']
                // デフォルトは空
            });

            periodic.getState = vi.fn().mockReturnValue([{
                id: masterId,
                text: 'Text',
                schedule: { type: 'weekly', days: ['Mon'] },
                holiday_adjustment: 'after'
            }]);

            await deleteMaster(masterId, { periodic, tasks, config });

            expect(periodic.remove).toHaveBeenCalledWith(masterId);
            expect(tasks.remove).toHaveBeenCalledWith('t1');
        });
    });

    describe('generateTasksFromRoutine', () => {
        it('マスタに基づいてタスクを生成すること', async () => {
            periodic.getState = vi.fn().mockReturnValue([{ id: '1', text: 'Periodic', schedule: { type: 'weekly', days: ['Mon'] } }]);
            // 2026-06-08 is Monday
            await generateTasksFromRoutine('2026-06-08', { periodic, tasks, config });
            expect(tasks.addMany).toHaveBeenCalled();
            const saved = (tasks.addMany as any).mock.calls[0][0];
            expect(saved).toHaveLength(1);
            expect(saved[0].text).toBe('Periodic');
            expect(saved[0].periodicId).toBe('1');
            expect(saved[0].originalDate).toBe('2026-06-08');
        });

        it('過去日の場合は生成しないこと', async () => {
            await generateTasksFromRoutine('2026-06-07', { periodic, tasks, config });
            expect(tasks.addMany).not.toHaveBeenCalled();
        });
    });

    describe('createTaskFromRoutine', () => {
        it('指定した定型マスタから直接タスクを生成し、TaskStore に追加すること', async () => {
            const master = { id: 'm-1', text: 'Routine Item', schedule: { type: 'none' as const } };
            periodic.find = vi.fn().mockReturnValue(master);

            await createTaskFromRoutine('m-1', '2026-06-08', { periodic, tasks });

            expect(periodic.find).toHaveBeenCalledWith('m-1');
            expect(tasks.addMany).toHaveBeenCalled();
            const added = (tasks.addMany as any).mock.calls[0][0];
            expect(added).toHaveLength(1);
            expect(added[0].text).toBe('Routine Item');
            expect(added[0].periodicId).toBe('m-1');
            expect(added[0].date).toBe('2026-06-08');
        });
    });
});
