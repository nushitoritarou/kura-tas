import type { ConfigStore } from '@/core/store/ConfigStore';
import type { CommonLinkStore } from '@/core/store/CommonLinkStore';
import type { InboxItemStore } from '@/core/store/InboxItemStore';
import type { RoutineStore } from '@/core/store/RoutineStore';
import type { UIStore } from '@/core/store/UIStore';
import type { HandleStore } from '@/core/store/HandleStore';
import type { TaskStore } from '@/core/store/TaskStore';
import type { NoteStore } from '@/core/store/NoteStore';
import type { UIState } from '@/types';
import * as datetime from '@/core/engine/datetime';

/**
 * Global機能が依存するストアの型定義
 */
export interface GlobalDeps {
    config: ConfigStore;
    commonLinks: CommonLinkStore;
    inboxItems: InboxItemStore;
    periodic: RoutineStore;
    ui: UIStore;
    handle: HandleStore;
    tasks: TaskStore;
    notes: NoteStore;
}

/**
 * 起動時に保存されたハンドルがあるか確認し、UI状態を更新する
 */
export async function checkSavedHandle(deps: GlobalDeps): Promise<FileSystemDirectoryHandle | null> {
    await deps.handle.load();
    const handle = deps.handle.getState();
    if (handle) {
        deps.ui.update({ lastDirName: handle.name });
    }
    return handle;
}

/**
 * 取得したハンドルをアプリに紐付け、初期化を完遂する手順
 */
export async function setupStorage(handle: FileSystemDirectoryHandle, deps: GlobalDeps): Promise<void> {
    // 1. ハンドルの永続化 (Store経由)
    await deps.handle.save(handle);

    // 2. 全ストアのロード（並列実行）
    await Promise.all([
        deps.config.load(),
        deps.commonLinks.load(),
        deps.inboxItems.load(),
        deps.periodic.load(),
        deps.tasks.load(),
        deps.notes.load(),
        deps.ui.load()
    ]);
    
    // 3. UI状態を「準備完了」に切り替え、初期日付をセット
    const today = datetime.getTodayStr();
    deps.ui.update({ 
        isAppReady: true,
        currentDate: today,
        lastKnownToday: today
    });

    // 4. 初回日付のタスクをロード (TaskStore.load() で今日はロードされているが明示的に呼ぶことも可能)
    await deps.tasks.getTasksFor(today);
}

/**
 * 現在の日付を相対的に移動させる手順
 */
export async function shiftCurrentDate(offset: number, deps: GlobalDeps): Promise<string> {
    const { currentDate } = deps.ui.getState();
    const nextDate = datetime.addDays(currentDate, offset);
    
    await deps.tasks.getTasksFor(nextDate);
    deps.ui.update({ currentDate: nextDate, activeTaskId: null });
    
    return nextDate;
}

/**
 * 今日へジャンプする手順
 */
export async function jumpToToday(deps: GlobalDeps): Promise<string> {
    const today = datetime.getTodayStr();
    
    await deps.tasks.getTasksFor(today);
    deps.ui.update({ currentDate: today, activeTaskId: null });
    
    return today;
}

/**
 * 日跨ぎを検知し、必要に応じてUIの状態を更新する
 * @returns 追従更新が発生した場合は新しい日付、そうでない場合は null
 */
export async function checkAndApplyDayChange(deps: GlobalDeps): Promise<string | null> {
    const { lastKnownToday, currentDate, isEditMode } = deps.ui.getState();

    // 編集モード中はデータ消失を防ぐため、日跨ぎチェック全体を保留する
    if (isEditMode) {
        return null;
    }

    const realToday = datetime.getTodayStr();
    if (realToday === lastKnownToday) {
        return null; // 日付は変わっていない
    }

    // 日跨ぎが発生した
    const patch: Partial<UIState> = {
        lastKnownToday: realToday
    };

    let updatedDate: string | null = null;

    // ユーザーが「旧・今日」を表示していた場合は、新しい「今日」に追従する
    if (currentDate === lastKnownToday) {
        patch.currentDate = realToday;
        await deps.tasks.getTasksFor(realToday);
        updatedDate = realToday;
    }

    deps.ui.update(patch);
    return updatedDate;
}
