/**
 * タスクに関する純粋な計算ロジック
 */

import { Task } from '@/types';

/**
 * 重複しないタスク名を生成する
 * carryOver時に使用する。
 * @param baseName 元のタスク名
 * @param dateStr 元の日付 (YYYY-MM-DD)
 * @param existingNames 既存のタスク名リスト
 * @returns ユニークなタスク名
 */
export function generateUniqueTaskName(baseName: string, dateStr: string, existingNames: string[]): string {
    if (!existingNames.includes(baseName)) {
        return baseName;
    }

    const parts = dateStr.split('-');
    const yy = parts[0].slice(-2);
    const mm = parts[1];
    const dd = parts[2];
    const suffix = `(${yy}/${mm}/${dd})`;
    let finalTitle = `${baseName} ${suffix}`;

    let counter = 2;
    while (existingNames.includes(finalTitle)) {
        finalTitle = `${baseName} (${yy}/${mm}/${dd} ${counter})`;
        counter++;
    }

    return finalTitle;
}

/**
 * タスクリストをソートする
 * 1. 完了状態 (done: false が上)
 * 2. 他者依頼 (delegated: false/undefined が上)
 * 3. タスク名 (名前の昇順)
 */
export function sortTasks(tasks: Task[]): Task[] {
    return [...tasks].sort((a, b) => {
        // 1. 完了状態の比較
        if (a.done !== b.done) {
            return a.done ? 1 : -1;
        }
        // 2. 他者依頼状態の比較
        const aDel = !!a.delegated;
        const bDel = !!b.delegated;
        if (aDel !== bDel) {
            return aDel ? 1 : -1;
        }
        // 3. タスク名の比較
        return a.text.localeCompare(b.text, 'ja');
    });
}
