import { Note } from '@/types';
import { getToggleBtnLabel, createPanelTitle, parseToHtml, getDisplayTitle } from './ui';
import { el } from '@/core/el';

/** Note オブジェクトを画面に反映する */
export function renderNoteArea(note: Note, isEditMode: boolean, taskText?: string, routineId?: string): void {
    const { editor, preview, panelTitle, btnToggleView, btnPromote } = el.notes;

    editor.value = note.body;
    preview.innerHTML = parseToHtml(note.body);
    
    const displayTitle = getDisplayTitle(note.type, taskText, note.date);
    panelTitle.textContent = createPanelTitle(displayTitle, note.type);
    btnToggleView.textContent = getToggleBtnLabel(isEditMode);

    if (btnPromote) {
        if (routineId) {
            btnPromote.style.display = 'inline-block';
            btnPromote.dataset.routineId = routineId;
        } else {
            btnPromote.style.display = 'none';
            delete btnPromote.dataset.routineId;
        }
    }

    editor.style.display = isEditMode ? 'block' : 'none';
    if (isEditMode) {
        preview.classList.remove('active');
    } else {
        preview.classList.add('active');
    }
}

/** 保存ステータスの表示 */
export function showSaveStatus(message: string): void {
    const { status } = el.notes;
    status.textContent = message;
    setTimeout(() => {
        status.textContent = '';
    }, 2000);
}
