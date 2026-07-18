import { el } from '@/core/el';
import * as routineLogic from '@/features/routine/logic';
import * as routineRenderer from '@/features/routine/renderer';
import * as globalRenderer from '@/features/global/renderer';
import { DAYS_MAP, RoutineTask } from '@/types';
import { WiringContext } from './context';

export function wireRoutine(ctx: WiringContext): void {
    let isProcessing = false;
    const navRoutine = document.getElementById('nav-routine');
    if (navRoutine) {
        navRoutine.onclick = async () => {
            const masters = await routineLogic.getMasters({ routine: ctx.store.routine });
            routineRenderer.renderMasterList(masters);
            routineRenderer.setupRoutineForm(false);
            routineRenderer.toggleRoutineModal(true);
        };
    }

    // スケジュールタイプ変更時の表示切り替え
    el.modals.routine.scheduleType.onchange = () => {
        const type = el.modals.routine.scheduleType.value;
        routineRenderer.updateScheduleFieldsVisibility(type);
    };

    el.modals.routine.btnSubmit.onclick = async () => {
        if (isProcessing) return;
        const text = el.modals.routine.input.value.trim();
        const type = el.modals.routine.scheduleType.value as 'weekly' | 'interval' | 'monthly-day' | 'monthly-weekday' | 'none';
        const holiday_adjustment = el.modals.routine.holidayAdjustment.value as 'before' | 'after' | 'skip';

        // 曜日を取得（weekly, interval, monthly-weekday 用）
        const days = Array.from(el.modals.routine.dayCheckboxes)
            .filter(cb => cb.checked)
            .map(cb => DAYS_MAP[parseInt(cb.value)]);

        const schedule: RoutineTask['schedule'] = { type };

        if (type === 'weekly') {
            schedule.days = days.length > 0 ? days : undefined;
        } else if (type === 'interval') {
            schedule.days = days.length > 0 ? days : undefined;
            const weeksVal = parseInt(el.modals.routine.intervalWeeks.value);
            schedule.intervalWeeks = isNaN(weeksVal) ? 2 : weeksVal;
            schedule.baseDate = el.modals.routine.baseDate.value;
        } else if (type === 'monthly-day') {
            const dayVal = el.modals.routine.monthlyDay.value;
            schedule.monthlyDay = dayVal === 'last' ? 'last' : parseInt(dayVal);
        } else if (type === 'monthly-weekday') {
            schedule.days = days.length > 0 ? days : undefined;
            const wIdxVal = el.modals.routine.weekIndex.value;
            schedule.weekIndex = wIdxVal === 'last' ? 'last' : parseInt(wIdxVal);
        }

        const id = el.modals.routine.btnSubmit.dataset.id;
        const noteTemplate = el.modals.routine.btnSubmit.dataset.noteTemplate;
        
        isProcessing = true;
        try {
            await ctx.dispatchAction(async () => {
                await routineLogic.upsertMaster({ id, text, schedule, holiday_adjustment, noteTemplate }, { routine: ctx.store.routine, tasks: ctx.store.tasks, ui: ctx.store.ui, config: ctx.store.config, notes: ctx.store.notes });
                routineRenderer.setupRoutineForm(false);
            });
        } finally {
            isProcessing = false;
        }
    };

    el.modals.routine.list.onclick = async (e) => {
        if (isProcessing) return;
        const target = e.target as HTMLElement;
        const id = target.dataset.id;
        if (!id) return;

        if (target.classList.contains('btn-edit-routine')) {
            const masters = await routineLogic.getMasters({ routine: ctx.store.routine });
            const master = masters.find(m => m.id === id);
            if (master) {
                routineRenderer.setupRoutineForm(true, master);
            }
        } else if (target.classList.contains('btn-delete-routine')) {
            if (globalRenderer.confirmAction('削除しますか？')) {
                isProcessing = true;
                try {
                    await ctx.dispatchAction(async () => {
                        await routineLogic.deleteMaster(id, { routine: ctx.store.routine, tasks: ctx.store.tasks, config: ctx.store.config });
                        routineRenderer.setupRoutineForm(false);
                    });
                } finally {
                    isProcessing = false;
                }
            }
        } else if (target.classList.contains('btn-add-task-from-routine')) {
            isProcessing = true;
            try {
                await ctx.dispatchAction(async () => {
                    const currentDate = ctx.store.ui.getState().currentDate;
                    await routineLogic.createTaskFromRoutine(id, currentDate, { routine: ctx.store.routine, tasks: ctx.store.tasks, notes: ctx.store.notes });
                });
            } finally {
                isProcessing = false;
            }
        }
    };

    el.modals.routine.btnClose.onclick = () => {
        el.modals.routine.root.style.display = 'none';
    };
}
