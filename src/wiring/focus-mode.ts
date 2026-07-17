import { WiringContext } from './context';

export function wireFocusMode(_ctx: WiringContext): void {
    // 10. モード切り替え用のフォーカス監視
    const updateModeClass = () => {
        const active = document.activeElement;
        const isInput = active && (
            active.tagName.toLowerCase() === 'input' ||
            active.tagName.toLowerCase() === 'textarea' ||
            active.tagName.toLowerCase() === 'select' ||
            active.hasAttribute('contenteditable')
        );
        if (isInput) {
            document.body.classList.add('insert-mode');
        } else {
            document.body.classList.remove('insert-mode');
        }
    };
    window.addEventListener('focusin', updateModeClass);
    window.addEventListener('focusout', () => {
        setTimeout(updateModeClass, 10);
    });
}
