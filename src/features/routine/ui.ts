import { RoutineTask, DAYS_MAP } from '@/types';

/** マスタリストのHTML文字列を生成する (Pure) */
export function createMasterListHtml(masters: RoutineTask[]): string {
    if (masters.length === 0) return '<p data-id="empty-periodic" style="font-size:12px; color:var(--muted-foreground); padding:10px;">マスタが登録されていません</p>';
    
    const dayLabels = ['日', '月', '火', '水', '木', '金', '土'];
    
    return masters.map(m => {
        const isWeekly = m.schedule.type === 'weekly' && m.schedule.days && m.schedule.days.length > 0;
        const scheduleText = isWeekly
            ? m.schedule.days!.map(d => dayLabels[DAYS_MAP.indexOf(d)]).join(', ')
            : '手動 (スケジュールなし)';

        return `
        <div class="periodic-item" data-id="${m.id}" style="display:flex; align-items:center; gap:8px; padding:8px; border-bottom:1px solid var(--border); font-size:13px;">
            <div style="flex:1;">
                <div style="font-weight:bold;">${m.text}</div>
                <div style="font-size:10px; color:var(--muted-foreground);">
                    ${scheduleText}
                </div>
            </div>
            <button class="btn btn-add-task-from-routine" data-id="${m.id}" style="font-size:10px; padding:2px 5px; background:var(--primary); color:white; border:none;">追加</button>
            <button class="btn btn-edit-periodic" data-id="${m.id}" style="font-size:10px; padding:2px 5px;">編集</button>
            <button class="btn btn-delete-periodic" data-id="${m.id}" style="font-size:10px; padding:2px 5px; background:var(--destructive); color:white; border:none;">削除</button>
        </div>
        `;
    }).join('');
}

/** フォームのタイトル（"新規登録" または "マスターを編集"）を生成して返す (Pure) */
export function getFormTitle(isEdit: boolean): string {
    return isEdit ? 'マスターを編集' : '新規登録';
}

/** フォーム送信ボタンのラベル（"登録する" または "更新する"）を生成して返す (Pure) */
export function getSubmitBtnLabel(isEdit: boolean): string {
    return isEdit ? '更新する' : '登録する';
}
