export interface Note {
  id: string;      // ファイル名（プレフィックス付き）
  title: string;   // フロントマターの title
  body: string;    // フロントマターを除いた本文
  date: string;    // 関連する日付
  type: 'task' | 'daily';
  taskId?: string; // タスクノートの場合のみ
}

export interface NoteMetadata {
  id: string;
  title: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  text: string;
  done: boolean;
  delegated?: boolean;
  deadline?: string;
  noteId?: string;
  routineId?: string;
  originalDate: string; // 生成時の日付（手動移動の判定に使用）
  date: string; // タスクが属する日付（例: "2024-06-01"）
}

export interface InboxItem {
  id: string;
  text: string;
}

export interface CommonLink {
  id: string;
  title: string;
  url: string;
}

export interface UIState {
  isAppReady: boolean;    // セットアップが完了し、メイン画面を表示すべきか
  lastDirName: string | null; // 再開用に表示するディレクトリ名
  currentDate: string;    // 表示中の日付 (YYYY-MM-DD)
  lastKnownToday: string; // 最後に確認した「今日」の日付 (YYYY-MM-DD)
  activeTaskId: string | null; // 選択中のタスクID
  isEditMode: boolean;    // ノートの編集/プレビュー切り替え
  version: string;
  debugMode: boolean;
}

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface Config {
  carryOverDays?: number;
  historyLimit?: number;
  logLevel?: LogLevel;
  enableFileLog?: boolean;
  logFilePath?: string;
  workDays?: number[]; // 営業日の曜日配列 (0:日, 1:月, ... 6:土)
  holidays?: string[]; // 特定の祝日・休日の日付配列 ("YYYY-MM-DD"形式)
}

export type DayOfWeekStr = 'Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat';
export const DAYS_MAP: DayOfWeekStr[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface RoutineTask {
  id: string;
  text: string;
  schedule: {
    type: 'weekly' | 'interval' | 'monthly-day' | 'monthly-weekday' | 'none';
    days?: DayOfWeekStr[];         // 'weekly', 'interval', 'monthly-weekday' 用
    intervalWeeks?: number;        // 'interval' 用
    baseDate?: string;             // 'interval' 用
    monthlyDay?: number | 'last';  // 'monthly-day' 用
    weekIndex?: number | 'last';   // 'monthly-weekday' 用
  };
  lastGenerated?: string;
  holiday_adjustment?: 'before' | 'after' | 'skip'; // 休日調整ルール
  noteTemplate?: string;
}

declare global {
  const __APP_VERSION__: string;
  const __COMMIT_HASH__: string;
  const __BUILD_TIME__: string;
  const __DEBUG_MODE__: boolean;
}
