/**
 * タスクに関する純粋な計算ロジック
 */

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
