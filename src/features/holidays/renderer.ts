import { el } from '@/core/el';
import { createHolidayListHtml } from './ui';
import { patch } from '@/shared/utils/dom/diff';

/**
 * 休日設定モーダルの表示状態を切り替える
 */
export function toggleHolidaysModal(show: boolean): void {
    el.modals.holidays.root.style.display = show ? 'flex' : 'none';
}

/**
 * 休日設定のデータをUIに反映する
 */
export function renderHolidaysSetup(workDays: number[], holidays: string[]): void {
    // 営業日チェックボックスの初期化
    el.modals.holidays.workdayCheckboxes.forEach(cb => {
        const val = parseInt(cb.value);
        cb.checked = workDays.includes(val);
    });

    renderHolidayList(holidays);
}

/**
 * 祝日リスト部分のみを差分描画する
 */
export function renderHolidayList(holidays: string[]): void {
    const html = createHolidayListHtml(holidays);
    patch(el.modals.holidays.dateList, html);
    
    // 入力欄をクリア
    el.modals.holidays.dateInput.value = '';
}
