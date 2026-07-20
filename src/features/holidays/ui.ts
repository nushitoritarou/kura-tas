/**
 * 休日・営業日設定に関連する純粋な設計図（副作用なし）
 */

/**
 * 休日日付リストのHTMLを生成する (Pure)
 */
export function createHolidayListHtml(holidays: string[]): string {
    if (holidays.length === 0) {
        return '<p data-id="empty-holidays" style="font-size:12px; color:var(--muted-foreground); margin:5px; padding: 5px;">登録されている休日・祝日はありません</p>';
    }
    return holidays
        .map(h => `
            <div class="holiday-list-item" data-id="${h}" style="display:flex; justify-content:space-between; align-items:center; padding:5px; border-bottom:1px solid var(--border); font-size:12px;">
                <span>${h}</span>
                <button class="btn btn-delete-holiday" data-date="${h}" style="font-size:10px; padding:1px 5px; background:var(--destructive); color:white; border:none; cursor:pointer;">削除</button>
            </div>
        `)
        .join('');
}
