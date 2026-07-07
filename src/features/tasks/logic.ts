import { TaskStore } from '@/core/store/TaskStore';
import { InboxItemStore } from '@/core/store/InboxItemStore';
import * as factories from "@/core/engine/factories";
import * as converters from "@/core/engine/converters";
import * as datetime from "@/core/engine/datetime";
import * as tasksEngine from "@/core/engine/tasks";

export interface TaskDeps {
    tasks: TaskStore;
    inboxItems: InboxItemStore;
}

/** 指定日のタスクをロード */
export async function loadDayTasks(date: string, deps: TaskDeps): Promise<void> {
    await deps.tasks.getTasksFor(date);
}

/** 新規タスク追加 */
export async function addTask(text: string, date: string, deps: TaskDeps): Promise<void> {
    if (!text) throw new Error('内容を入力してください');
    const task = factories.createTask(text, date);
    await deps.tasks.add(task);
}

/** 完了状態の切り替え */
export async function toggleTaskDone(taskId: string, deps: TaskDeps): Promise<void> {
    const task = deps.tasks.find(taskId);
    if (!task) throw new Error('指定されたタスクが見つかりません');
    await deps.tasks.update({ ...task, done: !task.done });
}

/** 他者依頼状態の切り替え */
export async function toggleTaskDelegated(taskId: string, deps: TaskDeps): Promise<void> {
    const task = deps.tasks.find(taskId);
    if (!task) throw new Error('指定されたタスクが見つかりません');
    await deps.tasks.update({ ...task, delegated: task.delegated !== true });
}

/** タスク名の変更 */
export async function renameTask(taskId: string, newText: string, deps: TaskDeps): Promise<void> {
    if (!newText) throw new Error('内容を入力してください');
    const task = deps.tasks.find(taskId);
    if (!task) throw new Error('指定されたタスクが見つかりません');
    await deps.tasks.update({ ...task, text: newText });
}

/** タスクの削除 */
export async function deleteTask(taskId: string, deps: TaskDeps): Promise<void> {
    await deps.tasks.remove(taskId);
}

/** 翌営業日への移動 */
export async function moveTaskToNextWorkDay(taskId: string, deps: TaskDeps): Promise<void> {
    const task = deps.tasks.find(taskId);
    if (!task) throw new Error('指定されたタスクが見つかりません');

    const nextDay = datetime.getNextWorkDay(task.date);
    
    // SRP遵守: 日付を跨ぐ移動は remove & add で行う
    await deps.tasks.remove(taskId);
    await deps.tasks.add({ ...task, date: nextDay, done: false });
}

/** インボックスへ戻す (Tasks -> Inbox) */
export async function returnToInbox(taskId: string, deps: TaskDeps): Promise<void> {
    const task = deps.tasks.find(taskId);
    if (!task) throw new Error('指定されたタスクが見つかりません');

    const inboxItem = converters.convertTaskToInboxItem(task);
    await deps.inboxItems.add(inboxItem);
    await deps.tasks.remove(taskId);
}

/** 未完了タスクの繰り越し */
export async function carryOverTasks(targetDate: string, days: number, deps: TaskDeps): Promise<number> {
    let tasksAddedCount = 0;
    const currentTasks = await deps.tasks.getTasksFor(targetDate);
    const existingNames = currentTasks.map(t => t.text);

    for (let i = 1; i <= days; i++) {
        const prevDate = datetime.addDays(targetDate, -i);
        const oldTasks = await deps.tasks.getTasksFor(prevDate);
        const incomplete = oldTasks.filter(t => !t.done);

        if (incomplete.length > 0) {
            for (const t of incomplete) {
                const uniqueName = tasksEngine.generateUniqueTaskName(t.text, prevDate, existingNames);
                
                // 元のファイルを更新 (完了扱いにする)
                await deps.tasks.update({ 
                    ...t, 
                    done: true, 
                    text: `${t.text} (Carried Over)` 
                });

                // 新しいタスクを追加
                const newTask = factories.createTask(uniqueName, targetDate);
                newTask.originalDate = t.originalDate;
                newTask.deadline = t.deadline;
                newTask.delegated = t.delegated;
                
                await deps.tasks.add(newTask);
                existingNames.push(uniqueName);
                tasksAddedCount++;
            }
        }
    }
    return tasksAddedCount;
}

/** JSON形式からのインポート */
export async function importTasks(jsonText: string, targetDate: string, deps: TaskDeps): Promise<void> {
    try {
        const data = JSON.parse(jsonText);
        if (Array.isArray(data)) {
            for (const item of data) {
                const text = typeof item === 'string' ? item : (item.text || '');
                if (!text) continue;
                
                const task = factories.createTask(text, targetDate);
                if (typeof item === 'object') {
                    task.deadline = item.deadline || '';
                    task.delegated = !!item.delegated;
                }
                await deps.tasks.add(task);
            }
        }
    } catch (e) {
        throw new Error('Invalid JSON format');
    }
}
