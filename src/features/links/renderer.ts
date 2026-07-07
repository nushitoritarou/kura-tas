
import { el } from '@/core/el';
import { CommonLink } from '@/types';
import * as ui from './ui';
import { patch } from '@/shared/utils/dom/diff';

export function renderLinks(links: CommonLink[]) {
    const html = ui.generateLinksHtml(links);
    patch(el.links.list, html);
}

export function clearInputs() {
    el.links.inputTitle.value = '';
    el.links.inputUrl.value = '';
}
