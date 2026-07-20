import { PeriodicStore } from '@/core/store/PeriodicStore';
import { TaskStore } from '@/core/store/TaskStore';
import { UIStore } from '@/core/store/UIStore';
import { PeriodicTask } from '@/types';
import { computeMissingPeriodicTasks } from '@/core/engine/periodic';
import { getTodayStr, getDayOfWeek } from '@/core/engine/datetime';

/** モーダルを開くためのマスタ一覧取得 */
export async function getMasters(deps: { periodic: PeriodicStore }): Promise<PeriodicTask[]> {
    return deps.periodic.getState();
}

/** マスタ追加・更新・削除 */
export async function upsertMaster(data: { id?: string; text: string; days: number[] }, deps: { periodic: PeriodicStore; tasks: TaskStore; ui: UIStore }): Promise<void> {
    const { periodic, tasks, ui } = deps;

    if (!data.text) throw new Error('タスク名を入力してください');
    if (!data.days || data.days.length === 0) throw new Error('曜日を選択してください');

    let master: PeriodicTask;
    if (data.id) {
        const item = periodic.find(data.id);
        if (!item) throw new Error('指定された定期タスクが見つかりません');
        master = { ...item, text: data.text, days: data.days };
        await periodic.update(master);
    } else {
        master = {
            id: crypto.randomUUID(),
            text: data.text,
            days: data.days
        };
        await periodic.add(master);
    }

    // 既存タスクとの同期（当日・未来）
    await syncGeneratedTasks(master, { tasks });

    // もし表示中の日付が対象なら、即座にタスク生成を試みる
    const currentDate = ui.getState().currentDate;
    await generateTasksFromPeriodic(currentDate, { periodic, tasks });
}

export async function deleteMaster(id: string, deps: { periodic: PeriodicStore; tasks: TaskStore }): Promise<void> {
    await deps.periodic.remove(id);
    // 既存タスクの削除（当日・未来）
    await syncGeneratedTasks({ id, deleted: true }, { tasks: deps.tasks });
}

/** 既に生成済みのタスクをマスタの変更に合わせて同期する（当日・未来のみ） */
export async function syncGeneratedTasks(
    master: PeriodicTask | { id: string; deleted: true },
    deps: { tasks: TaskStore }
): Promise<void> {
    const today = getTodayStr();
    const availableDates = deps.tasks.getAvailableDates().filter(d => d >= today);

    for (const date of availableDates) {
        // getTasksFor は内部的にキャッシュがあればそれを使い、なければロードする
        const dayTasks = await deps.tasks.getTasksFor(date);
        const matchingTasks = dayTasks.filter(t => t.periodicId === master.id);

        if (matchingTasks.length === 0) continue;

        const isDeleted = 'deleted' in master;

        for (const task of matchingTasks) {
            // 完了済みタスクは実績として保護する
            if (task.done) continue;

            if (isDeleted) {
                // マスタ削除時は、未完了タスクを削除
                await deps.tasks.remove(task.id);
            } else {
                const m = master as PeriodicTask;
                // 生成時の日付（originalDate）に基づいて、本来のスケジュール枠が廃止されたか判定
                const originalDate = task.originalDate || task.date;
                const originalDay = getDayOfWeek(originalDate);

                const isSlotAbolished = !m.days.includes(originalDay); // その曜日の枠自体が廃止されたか
                const isStillInOriginalSlot = originalDate === task.date; // ユーザーが動かさず、元の枠に居るか

                if (isSlotAbolished && isStillInOriginalSlot) {
                    // 枠自体が廃止され、かつユーザーが動かした形跡もない場合は、不要なタスクとして削除
                    await deps.tasks.remove(task.id);
                } else {
                    // それ以外（枠が存続している、あるいはユーザーが手動で場所を変えた場合）は、
                    // ユーザーの意思を尊重して削除はせず、内容（テキスト）の更新のみ行う
                    if (task.text !== m.text) {
                        await deps.tasks.update({ ...task, text: m.text });
                    }
                }

            }
        }
    }
}

/** 指定された日付の定期タスクをマスタから生成する */
export async function generateTasksFromPeriodic(date: string, deps: { periodic: PeriodicStore; tasks: TaskStore }): Promise<void> {
    // 過去日には自動生成しない
    const today = getTodayStr();
    if (date < today) return;

    const masters = deps.periodic.getState();
    const existingTasks = deps.tasks.getState().filter(t => t.date === date);

    const newTasks = computeMissingPeriodicTasks(masters, existingTasks, date);

    if (newTasks.length > 0) {
        await deps.tasks.addMany(newTasks);
    }
}
