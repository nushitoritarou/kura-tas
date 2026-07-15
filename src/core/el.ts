/**
 * kura-tas DOM要素の参照地図
 * 画面上のインプット取得や、レンダラーからの反映先として使用する。
 */
export const el = {
  // セットアップ
  setup: {
    overlay: document.getElementById('setup-overlay') as HTMLElement,
    lastDirName: document.getElementById('last-dir-name') as HTMLElement,
    resumeContainer: document.getElementById('resume-container') as HTMLElement,
    btnResume: document.getElementById('btn-resume') as HTMLElement,
    btnSetup: document.getElementById('btn-setup') as HTMLElement,
  },

  // アプリ全体
  app: {
    container: document.getElementById('app-container') as HTMLElement,
    version: document.querySelectorAll('.app-version') as NodeListOf<HTMLElement>,
  },

  // ナビゲーション
  nav: {
    dateDisplay: document.getElementById('current-date-display') as HTMLElement,
    btnPrevDay: document.getElementById('btn-prev-day') as HTMLElement,
    btnNextDay: document.getElementById('btn-next-day') as HTMLElement,
    btnToday: document.getElementById('nav-today') as HTMLElement,
    btnUndo: document.getElementById('btn-undo') as HTMLButtonElement,
    btnRedo: document.getElementById('btn-redo') as HTMLButtonElement,
    btnHolidays: document.getElementById('nav-holidays') as HTMLElement,
  },

  // 共通UI
  common: {
    contextMenu: document.getElementById('context-menu') as HTMLElement,
  },

  // 各Feature用の要素（今後拡張）
  inbox: {
    list: document.getElementById('inbox-list') as HTMLElement,
    input: document.getElementById('inbox-input') as HTMLInputElement,
  },

  links: {
    list: document.getElementById('global-links') as HTMLElement,
    inputTitle: document.getElementById('link-add-title') as HTMLInputElement,
    inputUrl: document.getElementById('link-add-url') as HTMLInputElement,
    btnAdd: document.getElementById('btn-add-link') as HTMLElement,
  },

  // タスク
  tasks: {
    list: document.getElementById('task-list') as HTMLElement,
  },

  notes: {
    panelTitle: document.getElementById('panel-title') as HTMLElement,
    btnToggleView: document.getElementById('btn-toggle-view') as HTMLElement,
    btnSave: document.getElementById('btn-save-note') as HTMLElement,
    btnPromote: document.getElementById('btn-promote-note') as HTMLElement,
    status: document.getElementById('save-status') as HTMLElement,
    editor: document.getElementById('editor') as HTMLTextAreaElement,
    preview: document.getElementById('preview') as HTMLElement,
  },

  // モーダル
  modals: {
    import: {
      root: document.getElementById('modal-import') as HTMLElement,
      area: document.getElementById('import-area') as HTMLTextAreaElement,
      btnDoImport: document.getElementById('btn-do-import') as HTMLElement,
      btnCopySample: document.getElementById('btn-copy-sample') as HTMLElement,
      btnClose: document.getElementById('btn-close-import') as HTMLElement,
    },
    routine: {
      root: document.getElementById('modal-routine') as HTMLElement,
      list: document.getElementById('routine-list') as HTMLElement,
      input: document.getElementById('routine-new-text') as HTMLInputElement,
      btnSubmit: document.getElementById('btn-add-routine') as HTMLElement,
      btnClose: document.getElementById('btn-close-routine') as HTMLElement,
      title: document.getElementById('routine-modal-title') as HTMLElement,
      dayCheckboxes: document.querySelectorAll('.day-checkbox') as NodeListOf<HTMLInputElement>,
      holidayAdjustment: document.getElementById('routine-holiday-adjustment') as HTMLSelectElement,
      scheduleType: document.getElementById('routine-schedule-type') as HTMLSelectElement,
      daysContainer: document.getElementById('routine-days-container') as HTMLElement,
      intervalContainer: document.getElementById('routine-interval-container') as HTMLElement,
      intervalWeeks: document.getElementById('routine-interval-weeks') as HTMLInputElement,
      baseDate: document.getElementById('routine-base-date') as HTMLInputElement,
      monthlyDayContainer: document.getElementById('routine-monthly-day-container') as HTMLElement,
      monthlyDay: document.getElementById('routine-monthly-day') as HTMLSelectElement,
      monthlyWeekdayContainer: document.getElementById('routine-monthly-weekday-container') as HTMLElement,
      weekIndex: document.getElementById('routine-week-index') as HTMLSelectElement,
    },
    holidays: {
      root: document.getElementById('modal-holidays') as HTMLElement,
      workdayCheckboxes: document.querySelectorAll('.workday-checkbox') as NodeListOf<HTMLInputElement>,
      dateInput: document.getElementById('holiday-date-input') as HTMLInputElement,
      btnAddDate: document.getElementById('btn-add-holiday-date') as HTMLElement,
      dateList: document.getElementById('holiday-list') as HTMLElement,
      btnClose: document.getElementById('btn-close-holidays') as HTMLElement,
    }
  }
};
