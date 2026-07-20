/**
 * タスクの表示操作（副作用あり）
 */
import { el } from '@/core/el';
import { Task } from '@/types';
import * as ui from './ui';
import { getTodayStr } from '@/core/engine/datetime';
import { patch } from '@/shared/utils/dom/diff';

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
    const btnCarryOver = document.getElementById('btn-carry-over');
    if (btnCarryOver) {
        btnCarryOver.style.display = currentDate === getTodayStr() ? 'inline-block' : 'none';
    }
}
