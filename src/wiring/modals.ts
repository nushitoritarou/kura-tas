import { el } from '@/core/el';
import * as globalRenderer from '@/features/global/renderer';
import { WiringContext } from './context';

// オーバーレイクリックでの close は各 renderer 内の registerModal (src/shared/utils/dom/modal.ts) が自動配線するため、
// ここではボタン操作の紐付けのみを行う。
export function wireModals(_ctx: WiringContext): void {
    el.modals.shortcuts.btnClose.onclick = () => {
        globalRenderer.toggleShortcutsModal(false);
    };

    el.nav.btnShortcuts.onclick = () => {
        globalRenderer.toggleShortcutsModal(true);
    };
}
