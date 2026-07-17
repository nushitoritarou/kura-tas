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

/** タスクの一括インポート */
export async function importTasks(
    inputText: string, 
    targetDate: string, 
    format: 'auto' | 'json' | 'text', 
    deps: TaskDeps
): Promise<void> {
    const trimmedInput = inputText.trim();
    if (!trimmedInput) return;

    if (format === 'text') {
        await importFromText(trimmedInput, targetDate, deps);
    } else if (format === 'json') {
        await importFromJson(trimmedInput, targetDate, deps);
    } else {
        const isLikelyJson = trimmedInput.startsWith('[');
        if (isLikelyJson) {
            await importFromJson(trimmedInput, targetDate, deps);
        } else {
            let data: any;
            let isJsonArray = false;
            try {
                data = JSON.parse(trimmedInput);
                isJsonArray = Array.isArray(data);
            } catch (e) {
                // パース失敗時は JSON ではないとみなす
            }

            if (isJsonArray) {
                await processJsonData(data, targetDate, deps);
            } else {
                await importFromText(trimmedInput, targetDate, deps);
            }
        }
    }
}

async function importFromJson(jsonText: string, targetDate: string, deps: TaskDeps): Promise<void> {
    let data: any;
    try {
        data = JSON.parse(jsonText);
    } catch (e) {
        throw new Error('Invalid JSON format');
    }

    if (!Array.isArray(data)) {
        throw new Error('JSON data must be an array');
    }
    await processJsonData(data, targetDate, deps);
}

async function processJsonData(data: any[], targetDate: string, deps: TaskDeps): Promise<void> {
    for (const item of data) {
        const text = typeof item === 'string' ? item : (item?.text || '');
        if (!text) continue;
        
        const task = factories.createTask(text, targetDate);
        if (typeof item === 'object' && item !== null) {
            task.deadline = item.deadline || '';
            task.delegated = !!item.delegated;
        }
        await deps.tasks.add(task);
    }
}

async function importFromText(text: string, targetDate: string, deps: TaskDeps): Promise<void> {
    const lines = text.split(/\r?\n/).map(line => line.trim());
    for (const line of lines) {
        if (!line) continue;
        const task = factories.createTask(line, targetDate);
        await deps.tasks.add(task);
    }
}

/** リスト内の次のタスクIDを取得する */
export function getNextTaskId(tasks: { id: string }[], currentId: string | null): string | null {
    if (tasks.length === 0) return null;
    if (!currentId) return tasks[0].id;
    const index = tasks.findIndex(t => t.id === currentId);
    if (index === -1) return tasks[0].id;
    if (index === tasks.length - 1) return tasks[tasks.length - 1].id; // 最後の要素で止まる
    return tasks[index + 1].id;
}

/** リスト内の前のタスクIDを取得する */
export function getPrevTaskId(tasks: { id: string }[], currentId: string | null): string | null {
    if (tasks.length === 0) return null;
    if (!currentId) return tasks[tasks.length - 1].id;
    const index = tasks.findIndex(t => t.id === currentId);
    if (index === -1) return tasks[tasks.length - 1].id;
    if (index === 0) return tasks[0].id; // 最初の要素で止まる
    return tasks[index - 1].id;
}

/** タスク削除/移動後にフォーカスすべき次のタスクIDを取得する */
export function getTaskIdAfterRemoval(tasks: { id: string }[], currentId: string): string | null {
    if (tasks.length <= 1) return null;
    const index = tasks.findIndex(t => t.id === currentId);
    if (index === -1) return null;
    // 削除対象が最後のタスクではない場合は、次のタスクを選択
    if (index < tasks.length - 1) {
        return tasks[index + 1].id;
    }
    // 削除対象が最後のタスクの場合は、前のタスクを選択
    return tasks[index - 1].id;
}


