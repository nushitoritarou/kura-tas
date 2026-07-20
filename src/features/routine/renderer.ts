import { RoutineTask, DAYS_MAP } from '@/types';
import { createMasterListHtml, getFormTitle, getSubmitBtnLabel } from './ui';
import { el } from '@/core/el';
import { patch } from '@/shared/utils/dom/diff';

/** マスタ一覧を画面に反映する */
export function renderMasterList(masters: RoutineTask[]): void {
    const html = createMasterListHtml(masters);
    patch(el.modals.routine.list, html);
}

/** モーダルの表示状態を切り替える */
export function toggleRoutineModal(show: boolean): void {
    el.modals.routine.root.style.display = show ? 'flex' : 'none';
}

/** スケジュールタイプに応じてフォームフィールドの表示/非表示を切り替える */
export function updateScheduleFieldsVisibility(type: string): void {
    const { daysContainer, intervalContainer, monthlyDayContainer, monthlyWeekdayContainer } = el.modals.routine;
    
    daysContainer.style.display = 'none';
    intervalContainer.style.display = 'none';
    monthlyDayContainer.style.display = 'none';
    monthlyWeekdayContainer.style.display = 'none';
    
    if (type === 'weekly') {
        daysContainer.style.display = 'flex';
    } else if (type === 'interval') {
        daysContainer.style.display = 'flex';
        intervalContainer.style.display = 'flex';
    } else if (type === 'monthly-day') {
        monthlyDayContainer.style.display = 'flex';
    } else if (type === 'monthly-weekday') {
        daysContainer.style.display = 'flex';
        monthlyWeekdayContainer.style.display = 'flex';
    }
}

/** フォームの状態をリセットまたは設定する */
export function setupRoutineForm(isEdit: boolean, data?: Partial<RoutineTask>): void {
    const { 
        title, btnSubmit, input, dayCheckboxes, holidayAdjustment,
        scheduleType, intervalWeeks, baseDate, monthlyDay, weekIndex
    } = el.modals.routine;
    
    title.textContent = getFormTitle(isEdit);
    btnSubmit.textContent = getSubmitBtnLabel(isEdit);
    
    // 今日の日付を取得（デフォルト値用）
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const localNow = new Date(now.getTime() - (offset * 60 * 1000));
    const todayStr = localNow.toISOString().split('T')[0];
    
    if (isEdit && data) {
        input.value = data.text || '';
        const sType = data.schedule ? data.schedule.type : 'none';
        scheduleType.value = sType;
        
        dayCheckboxes.forEach(cb => {
            const dayStr = DAYS_MAP[parseInt(cb.value)];
            cb.checked = data.schedule && 
                         data.schedule.days && 
                         data.schedule.days.includes(dayStr) ? true : false;
        });
        
        intervalWeeks.value = data.schedule && data.schedule.intervalWeeks !== undefined 
            ? String(data.schedule.intervalWeeks) 
            : '2';
        baseDate.value = data.schedule && data.schedule.baseDate 
            ? data.schedule.baseDate 
            : todayStr;
        monthlyDay.value = data.schedule && data.schedule.monthlyDay !== undefined 
            ? String(data.schedule.monthlyDay) 
            : '1';
        weekIndex.value = data.schedule && data.schedule.weekIndex !== undefined 
            ? String(data.schedule.weekIndex) 
            : '1';
            
        holidayAdjustment.value = data.holiday_adjustment || 'skip';
        if (data.noteTemplate) {
            btnSubmit.dataset.noteTemplate = data.noteTemplate;
        } else {
            delete btnSubmit.dataset.noteTemplate;
        }
        btnSubmit.dataset.id = data.id;
        
        updateScheduleFieldsVisibility(sType);
    } else {
        input.value = data?.text || '';
        scheduleType.value = 'weekly';
        dayCheckboxes.forEach(cb => {
            cb.checked = false;
        });
        intervalWeeks.value = '2';
        baseDate.value = todayStr;
        monthlyDay.value = '1';
        weekIndex.value = '1';
        holidayAdjustment.value = 'skip';
        if (data?.noteTemplate) {
            btnSubmit.dataset.noteTemplate = data.noteTemplate;
        } else {
            delete btnSubmit.dataset.noteTemplate;
        }
        delete btnSubmit.dataset.id;
        
        updateScheduleFieldsVisibility('weekly');
    }
}
