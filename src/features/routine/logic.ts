import { RoutineStore } from '@/core/store/RoutineStore';
import { TaskStore } from '@/core/store/TaskStore';
import { UIStore } from '@/core/store/UIStore';
import { ConfigStore } from '@/core/store/ConfigStore';
import { NoteStore } from '@/core/store/NoteStore';
import { RoutineTask, DayOfWeekStr } from '@/types';
import { computeMissingRoutineTasks, getAdjustedDate, isNoteSafeToSync, isScheduledOn } from '@/core/engine/routine';
import { getTodayStr, parseLocalDate } from '@/core/engine/datetime';
import { createTask, createNote, getNoteId } from '@/core/engine/factories';

/** モーダルを開くためのマスタ一覧取得 */
export async function getMasters(deps: { routine: RoutineStore }): Promise<RoutineTask[]> {
    return deps.routine.getState();
}

/** 手動で定型タスクからタスクを作成 */
export async function createTaskFromRoutine(
    routineId: string, 
    date: string, 
    deps: { routine: RoutineStore; tasks: TaskStore; notes: NoteStore }
): Promise<void> {
    const { routine, tasks, notes } = deps;
    const master = routine.find(routineId);
    if (!master) throw new Error('定型タスクが見つかりません');

    // タスクを作成
    const task = createTask(master.text, date);
    task.routineId = master.id; // 互換性のために routineId をセット

    await tasks.addMany([task]);

    // テンプレートノートがある場合は生成
    if (master.noteTemplate) {
        const note = createNote({
            body: master.noteTemplate,
            title: master.text,
            date: date,
            type: 'task',
            taskId: task.id
        });
        await notes.saveNote(note);
    }
}

/** マスタ追加・更新・削除 */
export async function upsertMaster(
    data: {
        id?: string;
        text: string;
        schedule: {
            type: 'weekly' | 'interval' | 'monthly-day' | 'monthly-weekday' | 'none';
            days?: DayOfWeekStr[];
            intervalWeeks?: number;
            baseDate?: string;
            monthlyDay?: number | 'last';
            weekIndex?: number | 'last';
        };
        holiday_adjustment?: 'before' | 'after' | 'skip';
        noteTemplate?: string;
    }, 
    deps: { routine: RoutineStore; tasks: TaskStore; ui: UIStore; config: ConfigStore; notes: NoteStore }
): Promise<void> {
    const { routine, tasks, ui, config, notes } = deps;

    if (!data.text) throw new Error('タスク名を入力してください');
    if (!data.schedule) throw new Error('スケジュールを設定してください');

    const type = data.schedule.type;
    if (type === 'weekly' || type === 'interval' || type === 'monthly-weekday') {
        if (!data.schedule.days || data.schedule.days.length === 0) {
            throw new Error('曜日を選択してください');
        }
    }
    if (type === 'interval') {
        if (!data.schedule.baseDate) {
            throw new Error('基準日を指定してください');
        }
        if (data.schedule.intervalWeeks === undefined || isNaN(data.schedule.intervalWeeks) || data.schedule.intervalWeeks < 1) {
            throw new Error('間隔（週）は1以上の整数を指定してください');
        }
    }
    if (type === 'monthly-day') {
        if (data.schedule.monthlyDay === undefined) {
            throw new Error('指定日を指定してください');
        }
    }
    if (type === 'monthly-weekday') {
        if (data.schedule.weekIndex === undefined) {
            throw new Error('第N週曜日を指定してください');
        }
    }

    let oldTemplate: string | undefined;
    let master: RoutineTask;
    if (data.id) {
        const item = routine.find(data.id);
        if (!item) throw new Error('指定された定型タスクが見つかりません');
        oldTemplate = item.noteTemplate;
        master = { 
            ...item, 
            text: data.text, 
            schedule: data.schedule,
            holiday_adjustment: data.holiday_adjustment,
            noteTemplate: data.noteTemplate
        };
        await routine.update(master);
    } else {
        master = {
            id: crypto.randomUUID(),
            text: data.text,
            schedule: data.schedule,
            holiday_adjustment: data.holiday_adjustment,
            noteTemplate: data.noteTemplate
        };
        await routine.add(master);
    }

    // 既存タスクとの同期（当日・未来）
    await syncGeneratedTasks(master, { tasks, config });
    if (data.id) {
        await syncGeneratedNotes(master, oldTemplate, { tasks, notes, config });
    }

    // もし表示中の日付が対象なら、即座にタスク生成を試みる
    const currentDate = ui.getState().currentDate;
    await generateTasksFromRoutine(currentDate, { routine, tasks, config, notes });
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

                // スケジュール枠自体が廃止されたか
                const isSlotAbolished = !activeM.schedule || 
                    !isScheduledOn(activeM, parseLocalDate(originalDate));

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
    deps: { routine: RoutineStore; tasks: TaskStore; config: ConfigStore; notes: NoteStore }
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

        // テンプレートノートの自動生成
        for (const task of newTasks) {
            if (!task.routineId) continue;
            const master = masters.find(m => m.id === task.routineId);
            if (master && master.noteTemplate) {
                const note = createNote({
                    body: master.noteTemplate,
                    title: master.text,
                    date: date,
                    type: 'task',
                    taskId: task.id
                });
                await deps.notes.saveNote(note);
            }
        }
    }
}

/** 既に生成済みのタスクノートをマスタのテンプレート変更に合わせて同期する（当日・未来のみ、未編集または空のみ） */
export async function syncGeneratedNotes(
    master: RoutineTask,
    oldTemplate: string | undefined,
    deps: { tasks: TaskStore; notes: NoteStore; config: ConfigStore }
): Promise<void> {
    const today = getTodayStr();
    const availableDates = deps.tasks.getAvailableDates().filter(d => d >= today);

    const config = deps.config.getState();
    const workDays = config.workDays || [1, 2, 3, 4, 5];
    const holidays = config.holidays || [];

    for (const date of availableDates) {
        const dayTasks = await deps.tasks.getTasksFor(date);
        const matchingTasks = dayTasks.filter(t => t.routineId === master.id);

        for (const task of matchingTasks) {
            if (task.done) continue;

            const originalDate = task.originalDate || task.date;
            const expectedDate = getAdjustedDate(
                originalDate,
                master.holiday_adjustment || 'skip',
                workDays,
                holidays
            );

            // ユーザーが手動で別日付に移動したタスクは同期対象外
            if (expectedDate !== task.date) continue;

            const noteId = task.noteId || getNoteId('task', task.id);
            const note = await deps.notes.getNote(noteId, { date, taskId: task.id });

            // 安全な同期の判定（ドメインルール）
            const isUnmodified = isNoteSafeToSync(note.body, oldTemplate);

            if (isUnmodified) {
                note.body = master.noteTemplate || '';
                note.title = master.text; // タイトルもマスタの最新名に合わせる
                await deps.notes.saveNote(note);
            }
        }
    }
}

/** 特定のタスクノートをその定期タスクマスタのテンプレートへ「昇格」する */
export async function promoteNoteToTemplate(
    routineId: string,
    noteBody: string,
    deps: { routine: RoutineStore; tasks: TaskStore; notes: NoteStore; config: ConfigStore }
): Promise<void> {
    const { routine, tasks, notes, config } = deps;
    const master = routine.find(routineId);
    if (!master) throw new Error('指定された定型タスクが見つかりません');

    const oldTemplate = master.noteTemplate;
    
    // マスタのテンプレートを更新
    const updatedMaster = {
        ...master,
        noteTemplate: noteBody
    };
    await routine.update(updatedMaster);

    // 既存タスクノートとの同期（当日・未来、安全な同期）
    await syncGeneratedNotes(updatedMaster, oldTemplate, { tasks, notes, config });
}
