import { RoutineStore } from '@/core/store/RoutineStore';
import { TaskStore } from '@/core/store/TaskStore';
import { UIStore } from '@/core/store/UIStore';
import { ConfigStore } from '@/core/store/ConfigStore';
import { RoutineTask, DayOfWeekStr, DAYS_MAP } from '@/types';
import { computeMissingRoutineTasks, getAdjustedDate } from '@/core/engine/routine';
import { getTodayStr, getDayOfWeek } from '@/core/engine/datetime';
import { createTask } from '@/core/engine/factories';

/** モーダルを開くためのマスタ一覧取得 */
export async function getMasters(deps: { routine: RoutineStore }): Promise<RoutineTask[]> {
    return deps.routine.getState();
}

/** 手動で定型タスクからタスクを作成 */
export async function createTaskFromRoutine(
    routineId: string, 
    date: string, 
    deps: { routine: RoutineStore; tasks: TaskStore }
): Promise<void> {
    const { routine, tasks } = deps;
    const master = routine.find(routineId);
    if (!master) throw new Error('定型タスクが見つかりません');

    // タスクを作成
    const task = createTask(master.text, date);
    task.routineId = master.id; // 互換性のために routineId をセット

    await tasks.addMany([task]);
}

/** マスタ追加・更新・削除 */
export async function upsertMaster(
    data: { id?: string; text: string; days: DayOfWeekStr[]; holiday_adjustment?: 'before' | 'after' | 'skip' }, 
    deps: { routine: RoutineStore; tasks: TaskStore; ui: UIStore; config: ConfigStore }
): Promise<void> {
    const { routine, tasks, ui, config } = deps;

    if (!data.text) throw new Error('タスク名を入力してください');

    const scheduleType = data.days.length > 0 ? 'weekly' : 'none';
    const scheduleDays = data.days.length > 0 ? data.days : undefined;

    let master: RoutineTask;
    if (data.id) {
        const item = routine.find(data.id);
        if (!item) throw new Error('指定された定型タスクが見つかりません');
        master = { 
            ...item, 
            text: data.text, 
            schedule: {
                type: scheduleType,
                days: scheduleDays
            },
            holiday_adjustment: data.holiday_adjustment
        };
        await routine.update(master);
    } else {
        master = {
            id: crypto.randomUUID(),
            text: data.text,
            schedule: {
                type: scheduleType,
                days: scheduleDays
            },
            holiday_adjustment: data.holiday_adjustment
        };
        await routine.add(master);
    }

    // 既存タスクとの同期（当日・未来）
    await syncGeneratedTasks(master, { tasks, config });

    // もし表示中の日付が対象なら、即座にタスク生成を試みる
    const currentDate = ui.getState().currentDate;
    await generateTasksFromRoutine(currentDate, { routine, tasks, config });
}

export async function deleteMaster(
    id: string, 
    deps: { routine: RoutineStore; tasks: TaskStore; config: ConfigStore }
): Promise<void> {
    const master = deps.routine.getState().find(m => m.id === id);
    // 既存タスクの削除（当日・未来）
    await syncGeneratedTasks({ id, deleted: true, master }, { tasks: deps.tasks, config: deps.config });
    await deps.routine.remove(id);
}

/** 既に生成済みのタスクをマスタの変更に合わせて同期する（当日・未来のみ） */
export async function syncGeneratedTasks(
    master: RoutineTask | { id: string; deleted: true; master?: RoutineTask },
    deps: { tasks: TaskStore; config?: ConfigStore }
): Promise<void> {
    const today = getTodayStr();
    const availableDates = deps.tasks.getAvailableDates().filter(d => d >= today);

    const config = deps.config?.getState() || {};
    const workDays = config.workDays || [1, 2, 3, 4, 5];
    const holidays = config.holidays || [];

    for (const date of availableDates) {
        const dayTasks = await deps.tasks.getTasksFor(date);
        const matchingTasks = dayTasks.filter(t => t.routineId === master.id);

        if (matchingTasks.length === 0) continue;

        const isDeleted = 'deleted' in master;
        const m = isDeleted ? (master as { master?: RoutineTask }).master : (master as RoutineTask);

        for (const task of matchingTasks) {
            // 完了済みタスクは実績として保護する
            if (task.done) continue;

            const originalDate = task.originalDate || task.date;

            // 祝日調整に基づく本来の期待日付を計算する
            let expectedDate: string | null = originalDate;
            if (m) {
                expectedDate = getAdjustedDate(
                    originalDate,
                    m.holiday_adjustment || 'skip',
                    workDays,
                    holidays
                );
            }

            // ユーザーが動かさず、本来の自動生成枠（祝日調整後）に居るか
            const isStillInOriginalSlot = expectedDate === task.date;

            if (isDeleted) {
                // マスタ削除時は、元の枠（調整後の枠含む）に居る未完了タスクのみ削除（手動移動されたタスクは保護）
                if (isStillInOriginalSlot) {
                    await deps.tasks.remove(task.id);
                }
            } else {
                const activeM = m as RoutineTask;
                // 生成時の日付（originalDate）に基づいて、本来のスケジュール枠が廃止されたか判定
                const originalDayNum = getDayOfWeek(originalDate);
                const originalDayStr = DAYS_MAP[originalDayNum];

                // その曜日の枠自体が廃止されたか
                const isSlotAbolished = !activeM.schedule || 
                    activeM.schedule.type !== 'weekly' || 
                    !activeM.schedule.days || 
                    !activeM.schedule.days.includes(originalDayStr);

                if (isSlotAbolished && isStillInOriginalSlot) {
                    // 枠自体が廃止され、かつユーザーが動かした形跡もない場合は、不要なタスクとして削除
                    await deps.tasks.remove(task.id);
                } else {
                    // それ以外（枠が存続している、あるいはユーザーが手動で場所を変えた場合）は、
                    // ユーザーの意思を尊重して削除はせず、内容（テキスト）の更新のみ行う
                    if (task.text !== activeM.text) {
                        await deps.tasks.update({ ...task, text: activeM.text });
                    }
                }
            }
        }
    }
}

/** 指定された日付の定期タスクをマスタから生成する */
export async function generateTasksFromRoutine(
    date: string, 
    deps: { routine: RoutineStore; tasks: TaskStore; config: ConfigStore }
): Promise<void> {
    // 過去日には自動生成しない
    const today = getTodayStr();
    if (date < today) return;

    const masters = deps.routine.getState();
    const existingTasks = deps.tasks.getState().filter(t => t.date === date);

    const config = deps.config.getState();
    const workDays = config.workDays || [1, 2, 3, 4, 5];
    const holidays = config.holidays || [];

    const newTasks = computeMissingRoutineTasks(masters, existingTasks, date, workDays, holidays);

    if (newTasks.length > 0) {
        await deps.tasks.addMany(newTasks);
    }
}
