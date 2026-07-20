import { RoutineTask, DAYS_MAP } from '@/types';

/** マスタリストのHTML文字列を生成する (Pure) */
export function createMasterListHtml(masters: RoutineTask[]): string {
    if (masters.length === 0) return '<p data-id="empty-routine" style="font-size:12px; color:var(--muted-foreground); padding:10px;">マスタが登録されていません</p>';
    
    const dayLabels = ['日', '月', '火', '水', '木', '金', '土'];
    
    return masters.map(m => {
        const adjustmentText = m.holiday_adjustment === 'before' ? ' (前移動)' 
            : m.holiday_adjustment === 'after' ? ' (後移動)' 
            : m.holiday_adjustment === 'skip' ? ' (スキップ)'
            : ' (スキップ)';

        let scheduleText = '';
        if (m.schedule) {
            switch (m.schedule.type) {
                case 'weekly': {
                    const days = m.schedule.days || [];
                    scheduleText = days.length > 0
                        ? days.map(d => dayLabels[DAYS_MAP.indexOf(d)]).join(', ') + adjustmentText
                        : '毎週 (曜日未指定)' + adjustmentText;
                    break;
                }
                case 'interval': {
                    const days = m.schedule.days || [];
                    const interval = m.schedule.intervalWeeks || 1;
                    const base = m.schedule.baseDate || '';
                    const daysStr = days.map(d => dayLabels[DAYS_MAP.indexOf(d)]).join(', ');
                    scheduleText = `${base}から${interval}週おきの${daysStr}` + adjustmentText;
                    break;
                }
                case 'monthly-day': {
                    const day = m.schedule.monthlyDay;
                    const dayStr = day === 'last' ? '月末' : `${day}日`;
                    scheduleText = `毎月${dayStr}` + adjustmentText;
                    break;
                }
                case 'monthly-weekday': {
                    const days = m.schedule.days || [];
                    const weekIdx = m.schedule.weekIndex;
                    const weekIdxStr = weekIdx === 'last' ? '最終' : `第${weekIdx}`;
                    const daysStr = days.map(d => dayLabels[DAYS_MAP.indexOf(d)]).join(', ');
                    scheduleText = `毎月${weekIdxStr}${daysStr}` + adjustmentText;
                    break;
                }
                case 'none':
                default:
                    scheduleText = '手動 (スケジュールなし)';
                    break;
            }
        } else {
            scheduleText = '手動 (スケジュールなし)';
        }

        const noteIndicator = m.noteTemplate ? ' <span title="ノートテンプレートあり" style="cursor:help;">📝</span>' : '';

        return `
        <div class="routine-item" data-id="${m.id}" style="display:flex; align-items:center; gap:8px; padding:8px; border-bottom:1px solid var(--border); font-size:13px;">
            <div style="flex:1;">
                <div style="font-weight:bold;">${m.text}${noteIndicator}</div>
                <div style="font-size:10px; color:var(--muted-foreground);">
                    ${scheduleText}
                </div>
            </div>
            <button class="btn btn-add-task-from-routine" data-id="${m.id}" style="font-size:10px; padding:2px 5px; background:var(--primary); color:white; border:none;">追加</button>
            <button class="btn btn-edit-routine" data-id="${m.id}" style="font-size:10px; padding:2px 5px;">編集</button>
            <button class="btn btn-delete-routine" data-id="${m.id}" style="font-size:10px; padding:2px 5px; background:var(--destructive); color:white; border:none;">削除</button>
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
