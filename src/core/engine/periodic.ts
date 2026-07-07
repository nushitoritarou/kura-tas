import { PeriodicTask, Task } from "@/types";
import { createTask } from "./factories";

/** 日付ごとの不足タスク計算（純粋関数） */
export function computeMissingPeriodicTasks(masters: PeriodicTask[], existingTasks: Task[], date: string): Task[] {
    const targetDay = new Date(date).getDay();
    const mastersForDay = masters.filter(m => m.days.includes(targetDay));
    
    return mastersForDay
        .filter(m => !existingTasks.some(t => t.periodicId === m.id))
        .map(m => {
            const task = createTask(m.text, date);
            task.periodicId = m.id;
            return task;
        });
}
