/**
 * タスクの表示操作（副作用あり）
 */
import { el } from '@/core/el';
import { Task } from '@/types';
import * as ui from './ui';
import { getTodayStr } from '@/core/engine/datetime';
import { patch } from '@/shared/utils/dom/diff';
import { registerModal } from '@/shared/utils/dom/modal';

/**
 * タスクリストをレンダリングする
 */
export function renderTaskList(tasks: Task[], activeTaskId?: string): void {
    const html = ui.generateTaskListHtml(tasks, activeTaskId);
    patch(el.tasks.list, html);
}

/**
 * 繰り越しボタンの表示状態を更新する
 */
export function updateCarryOverButtonVisibility(currentDate: string): void {
    const btnCarryOver = el.tasks.btnCarryOver;
    if (btnCarryOver) {
        btnCarryOver.style.display = currentDate === getTodayStr() ? 'inline-block' : 'none';
    }
}

const importModal = registerModal(el.modals.import.root);

/** インポートモーダルの表示状態を切り替える */
export function toggleImportModal(show: boolean): void {
    if (show) importModal.open(); else importModal.close();
}

const quickAddModal = registerModal(el.modals.quickAdd.root);

/** クイックタスク追加モーダルの表示状態を切り替える */
export function toggleQuickAddModal(show: boolean): void {
    if (show) quickAddModal.open(); else quickAddModal.close();
}
