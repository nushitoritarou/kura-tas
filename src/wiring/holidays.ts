import { el } from '@/core/el';
import * as holidaysLogic from '@/features/holidays/logic';
import * as holidaysRenderer from '@/features/holidays/renderer';
import * as routineLogic from '@/features/routine/logic';
import * as globalRenderer from '@/features/global/renderer';
import { WiringContext } from './context';

export function wireHolidays(ctx: WiringContext): void {
    let isProcessing = false;
    if (el.nav.btnHolidays) {
        el.nav.btnHolidays.onclick = () => {
            const config = ctx.store.config.getState();
            const workDays = config.workDays || [1, 2, 3, 4, 5];
            const holidays = config.holidays || [];
            holidaysRenderer.renderHolidaysSetup(workDays, holidays);
            holidaysRenderer.toggleHolidaysModal(true);
        };
    }

    el.modals.holidays.btnClose.onclick = () => {
        holidaysRenderer.toggleHolidaysModal(false);
    };

    const workdayContainer = document.getElementById('holiday-workdays-container');
    if (workdayContainer) {
        workdayContainer.onchange = async () => {
            if (isProcessing) return;
            const workdayCheckboxes = Array.from(el.modals.holidays.workdayCheckboxes);
            const workDays = workdayCheckboxes
                .filter(cb => cb.checked)
                .map(cb => parseInt(cb.value));

            const config = ctx.store.config.getState();
            const holidays = config.holidays || [];

            isProcessing = true;
            try {
                await ctx.dispatchAction(async () => {
                    await holidaysLogic.saveHolidays(workDays, holidays, {
                        config: ctx.store.config
                    });
                    await routineLogic.generateTasksFromRoutine(ctx.store.ui.getState().currentDate, {
                        routine: ctx.store.routine,
                        tasks: ctx.store.tasks,
                        config: ctx.store.config,
                        notes: ctx.store.notes
                    });
                });
            } finally {
                isProcessing = false;
            }
        };
    }

    el.modals.holidays.btnAddDate.onclick = async () => {
        if (isProcessing) return;
        const dateVal = el.modals.holidays.dateInput.value;
        if (!dateVal) return;

        const config = ctx.store.config.getState();
        const holidays = config.holidays || [];
        const workDays = config.workDays || [1, 2, 3, 4, 5];
        
        // 重複チェック
        if (holidays.includes(dateVal)) {
            globalRenderer.notifyError('すでに登録されている日付です。');
            return;
        }

        const nextHolidays = [...holidays, dateVal];

        isProcessing = true;
        try {
            await ctx.dispatchAction(async () => {
                await holidaysLogic.saveHolidays(workDays, nextHolidays, {
                    config: ctx.store.config
                });
                await routineLogic.generateTasksFromRoutine(ctx.store.ui.getState().currentDate, {
                    routine: ctx.store.routine,
                    tasks: ctx.store.tasks,
                    config: ctx.store.config,
                    notes: ctx.store.notes
                });
                holidaysRenderer.renderHolidayList(nextHolidays);
            });
        } finally {
            isProcessing = false;
        }
    };

    el.modals.holidays.dateList.onclick = async (e) => {
        if (isProcessing) return;
        const target = e.target as HTMLElement;
        if (target.classList.contains('btn-delete-holiday')) {
            const dateToDelete = target.dataset.date;
            if (dateToDelete) {
                const config = ctx.store.config.getState();
                const holidays = config.holidays || [];
                const workDays = config.workDays || [1, 2, 3, 4, 5];

                const nextHolidays = holidays.filter(h => h !== dateToDelete);

                isProcessing = true;
                try {
                    await ctx.dispatchAction(async () => {
                        await holidaysLogic.saveHolidays(workDays, nextHolidays, {
                            config: ctx.store.config
                        });
                        await routineLogic.generateTasksFromRoutine(ctx.store.ui.getState().currentDate, {
                            routine: ctx.store.routine,
                            tasks: ctx.store.tasks,
                            config: ctx.store.config,
                            notes: ctx.store.notes
                        });
                        holidaysRenderer.renderHolidayList(nextHolidays);
                    });
                } finally {
                    isProcessing = false;
                }
            }
        }
    };
}
