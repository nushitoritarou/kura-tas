import { RoutineTask, Task, DAYS_MAP } from "@/types";
import { createTask } from "./factories";

export type DayOfWeekStr = 'Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat';

/** 日付ごとの不足タスク計算（純粋関数） */
export function computeMissingRoutineTasks(masters: RoutineTask[], existingTasks: Task[], date: string): Task[] {
    const targetDayNum = new Date(date).getDay();
    const targetDayStr = DAYS_MAP[targetDayNum];
    
    // スケジュール設定があり、かつ指定の曜日が含まれているマスタをフィルタ
    const mastersForDay = masters.filter(m => 
        m.schedule && 
        m.schedule.type === 'weekly' && 
        m.schedule.days && 
        m.schedule.days.includes(targetDayStr)
    );
    
    return mastersForDay
        .filter(m => !existingTasks.some(t => t.periodicId === m.id))
        .map(m => {
            const task = createTask(m.text, date);
            task.periodicId = m.id;
            return task;
        });
}
