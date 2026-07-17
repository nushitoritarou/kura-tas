import { el } from '@/core/el';
import * as globalRenderer from '@/features/global/renderer';
import { WiringContext } from './context';

export function wireModals(_ctx: WiringContext): void {
    el.modals.shortcuts.btnClose.onclick = () => {
        globalRenderer.toggleShortcutsModal(false);
    };

    el.nav.btnShortcuts.onclick = () => {
        globalRenderer.toggleShortcutsModal(true);
    };

    el.modals.shortcuts.root.onclick = (e) => {
        if (e.target === el.modals.shortcuts.root) {
            globalRenderer.toggleShortcutsModal(false);
        }
    };

    [el.modals.import.root, el.modals.routine.root, el.modals.holidays.root, el.modals.quickAdd.root].forEach(m => {
        m.onclick = (e) => {
            if (e.target === m) m.style.display = 'none';
        };
    });
}
