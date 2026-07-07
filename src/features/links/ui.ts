
import { CommonLink } from '@/types';
import { escapeHTML } from '@/shared/utils/ui/strings';

export function generateLinkHtml(link: CommonLink): string {
    // javascript: プロトコルなどを排除するためのサニタイズ
    let safeUrl = link.url;
    try {
        const parsed = new URL(link.url);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            safeUrl = '#';
        }
    } catch (e) {
        safeUrl = '#';
    }

    return `
        <a href="${escapeHTML(safeUrl)}" target="_blank" class="link-item" data-id="${link.id}">
            ${escapeHTML(link.title)}
        </a>
    `.trim();
}

export function generateLinksHtml(links: CommonLink[]): string {
    return links.map(generateLinkHtml).join('');
}
