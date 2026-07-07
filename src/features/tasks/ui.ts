import { Task } from '@/types';
import { escapeHTML } from '@/shared/utils/ui/strings';

/**
 * タスクリストのHTMLを生成する
 */
export function generateTaskListHtml(tasks: Task[], activeTaskId?: string): string {
    if (tasks.length === 0) {
        return '<div class="muted-foreground" data-id="empty-tasks" style="padding:20px; text-align:center;">タスクはありません</div>';
    }

    return tasks.map(t => generateTaskItemHtml(t, t.id === activeTaskId)).join('');
}

/**
 * 単一タスク項目のHTMLを生成する
 */
export function generateTaskItemHtml(task: Task, isActive: boolean): string {
    const classes = [
        'task-item',
        task.done ? 'done' : '',
        task.delegated ? 'delegated' : '',
        isActive ? 'active' : ''
    ].filter(Boolean).join(' ');

    return `
        <div class="${classes}" data-id="${task.id}">
            <input type="checkbox" ${task.done ? 'checked' : ''}>
            <span class="task-text">${escapeHTML(task.text)}</span>
            ${task.deadline ? `<span class="deadline">📅 ${task.deadline}</span>` : ''}
        </div>
    `;
}
