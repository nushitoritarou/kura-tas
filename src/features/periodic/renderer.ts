import { PeriodicTask } from '@/types';
import { createMasterListHtml, getFormTitle, getSubmitBtnLabel } from './ui';
import { el } from '@/core/el';
import { patch } from '@/shared/utils/dom/diff';

/** マスタ一覧を画面に反映する */
export function renderMasterList(masters: PeriodicTask[]): void {
    const html = createMasterListHtml(masters);
    patch(el.modals.periodic.list, html);
}

/** モーダルの表示状態を切り替える */
export function togglePeriodicModal(show: boolean): void {
    el.modals.periodic.root.style.display = show ? 'flex' : 'none';
}

/** フォームの状態をリセットまたは設定する */
export function setupPeriodicForm(isEdit: boolean, data?: PeriodicTask): void {
    const { title, btnSubmit, input, dayCheckboxes } = el.modals.periodic;
    
    title.textContent = getFormTitle(isEdit);
    btnSubmit.textContent = getSubmitBtnLabel(isEdit);
    
    if (data) {
        input.value = data.text;
        dayCheckboxes.forEach(cb => {
            cb.checked = data.days.includes(parseInt(cb.value));
        });
        btnSubmit.dataset.id = data.id;
    } else {
        input.value = '';
        dayCheckboxes.forEach(cb => {
            cb.checked = false;
        });
        delete btnSubmit.dataset.id;
    }
}
