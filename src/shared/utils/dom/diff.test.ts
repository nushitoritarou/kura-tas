/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { patch } from './diff';

describe('patch utility', () => {
    let container: HTMLElement;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    it('should insert new nodes from HTML', () => {
        const html = '<div data-id="1">Item 1</div><div data-id="2">Item 2</div>';
        patch(container, html);

        expect(container.children.length).toBe(2);
        expect(container.children[0].textContent).toBe('Item 1');
        expect(container.children[1].textContent).toBe('Item 2');
    });

    it('should reuse existing nodes with the same data-id', () => {
        const html1 = '<div data-id="1">Item 1</div>';
        patch(container, html1);
        const firstNode = container.children[0];

        const html2 = '<div data-id="1" class="updated">Item 1 Updated</div>';
        patch(container, html2);

        expect(container.children.length).toBe(1);
        expect(container.children[0]).toBe(firstNode); // Node reference should be the same
        expect(container.children[0].className).toBe('updated');
        expect(container.children[0].textContent).toBe('Item 1 Updated');
    });

    it('should remove nodes that are not in the new HTML', () => {
        patch(container, '<div data-id="1">1</div><div data-id="2">2</div>');
        expect(container.children.length).toBe(2);

        patch(container, '<div data-id="1">1</div>');
        expect(container.children.length).toBe(1);
        expect(container.children[0].getAttribute('data-id')).toBe('1');
    });

    it('should reorder nodes according to new HTML', () => {
        patch(container, '<div data-id="1">1</div><div data-id="2">2</div>');
        const node1 = container.children[0];
        const node2 = container.children[1];

        patch(container, '<div data-id="2">2</div><div data-id="1">1</div>');
        expect(container.children[0]).toBe(node2);
        expect(container.children[1]).toBe(node1);
    });

    it('should preserve checkbox state', () => {
        patch(container, '<div data-id="1"><input type="checkbox"></div>');
        const checkbox = container.querySelector('input') as HTMLInputElement;
        checkbox.checked = true;

        // Re-patch with same HTML (done state might be different in HTML, but patch should sync it)
        patch(container, '<div data-id="1"><input type="checkbox"></div>');
        expect(checkbox.checked).toBe(false); // In this case, HTML didn't have 'checked', so it syncs back to false

        checkbox.checked = true;
        patch(container, '<div data-id="1"><input type="checkbox" checked></div>');
        expect(checkbox.checked).toBe(true);
    });

    it('should preserve focus on elements within a keyed parent', () => {
        patch(container, '<div data-id="1"><input type="text" class="target"></div>');
        const input = container.querySelector('input') as HTMLInputElement;
        input.focus();
        expect(document.activeElement).toBe(input);

        patch(container, '<div data-id="1" class="active"><input type="text" class="target"></div>');
        
        // JSDOM might need a little help or the syncNode might replace innerHTML
        // If syncNode replaces innerHTML, it should restore focus.
        expect(document.activeElement).toBe(container.querySelector('input'));
    });
});
