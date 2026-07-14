import { ConfigStore } from '@/core/store/ConfigStore';

/**
 * 休日設定（営業日、特定の休日一覧）を保存する
 */
export async function saveHolidays(
    workDays: number[],
    holidays: string[],
    deps: { config: ConfigStore }
): Promise<void> {
    const sortedHolidays = [...holidays].sort();
    
    // 設定を更新して保存
    await deps.config.update({
        workDays,
        holidays: sortedHolidays
    });
}
