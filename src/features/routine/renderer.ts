import { RoutineTask, DAYS_MAP } from '@/types';
import { createMasterListHtml, getFormTitle, getSubmitBtnLabel } from './ui';
import { el } from '@/core/el';
import { patch } from '@/shared/utils/dom/diff';

/** マスタ一覧を画面に反映する */
export function renderMasterList(masters: RoutineTask[]): void {
    const html = createMasterListHtml(masters);
    patch(el.modals.periodic.list, html);
}

/** モーダルの表示状態を切り替える */
export function togglePeriodicModal(show: boolean): void {
    el.modals.periodic.root.style.display = show ? 'flex' : 'none';
}

/** フォームの状態をリセットまたは設定する */
export function setupPeriodicForm(isEdit: boolean, data?: RoutineTask): void {
    const { title, btnSubmit, input, dayCheckboxes, holidayAdjustment } = el.modals.periodic;
    
    title.textContent = getFormTitle(isEdit);
    btnSubmit.textContent = getSubmitBtnLabel(isEdit);
    
    if (data) {
        input.value = data.text;
        dayCheckboxes.forEach(cb => {
            const dayStr = DAYS_MAP[parseInt(cb.value)];
            cb.checked = data.schedule && 
                         data.schedule.type === 'weekly' && 
                         data.schedule.days && 
                         data.schedule.days.includes(dayStr) ? true : false;
        });
        holidayAdjustment.value = data.holiday_adjustment || 'skip';
        btnSubmit.dataset.id = data.id;
    } else {
        input.value = '';
        dayCheckboxes.forEach(cb => {
            cb.checked = false;
        });
        holidayAdjustment.value = 'skip';
        delete btnSubmit.dataset.id;
    }
}
