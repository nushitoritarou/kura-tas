/**
 * 日付・時刻に関する純粋な計算ロジック
 */

/**
 * Dateオブジェクトを YYYY-MM-DD 形式の文字列に変換する（ローカルタイム準拠）
 */
export function formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * 今日の日付を YYYY-MM-DD 形式で返す
 */
export function getTodayStr(): string {
    return formatDate(new Date());
}

/**
 * 日付文字列から曜日番号（0:日, 1:月, ...）を取得する
 */
export function getDayOfWeek(dateStr: string): number {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (isNaN(date.getTime())) {
        throw new Error(`Invalid date string: ${dateStr}`);
    }
    return date.getDay();
}

/**
 * 営業日かどうかを判定する
 */
export function isWorkDay(date: Date, workDays: number[] = [1, 2, 3, 4, 5], holidays: string[] = []): boolean {
    const day = date.getDay();
    if (!workDays.includes(day)) {
        return false;
    }
    const dateStr = formatDate(date);
    if (holidays.includes(dateStr)) {
        return false;
    }
    return true;
}

/**
 * 指定日の翌営業日を YYYY-MM-DD 形式で返す
 */
export function getNextWorkDay(dateStr: string, workDays: number[] = [1, 2, 3, 4, 5], holidays: string[] = []): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    let date = new Date(y, m - 1, d);
    do {
        date.setDate(date.getDate() + 1);
    } while (!isWorkDay(date, workDays, holidays));
    
    return formatDate(date);
}

/**
 * 指定日の前営業日を YYYY-MM-DD 形式で返す
 */
export function getPrevWorkDay(dateStr: string, workDays: number[] = [1, 2, 3, 4, 5], holidays: string[] = []): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    let date = new Date(y, m - 1, d);
    do {
        date.setDate(date.getDate() - 1);
    } while (!isWorkDay(date, workDays, holidays));
    
    return formatDate(date);
}

/**
 * 日付文字列にオフセットを加算した新しい日付を返す
 * @param dateStr YYYY-MM-DD 形式の日付
 * @param offset 加減算する日数
 * @returns YYYY-MM-DD 形式の日付
 */
export function addDays(dateStr: string, offset: number): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (isNaN(date.getTime())) {
        throw new Error(`Invalid date string: ${dateStr}`);
    }
    date.setDate(date.getDate() + offset);
    
    return formatDate(date);
}
