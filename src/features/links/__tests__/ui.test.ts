
import { describe, it, expect } from 'vitest';
import * as ui from '../ui';
import { CommonLink } from '@/types';

describe('links ui', () => {
    it('generateLinkHtml が 正しいHTML文字列を生成すること', () => {
        const link: CommonLink = { id: '1', title: 'Google', url: 'https://google.com' };
        const html = ui.generateLinkHtml(link);

        expect(html).toContain('href="https:&#x2F;&#x2F;google.com"');
        expect(html).toContain('target="_blank"');
        expect(html).toContain('class="link-item"');
        expect(html).toContain('data-id="1"');
        expect(html).toContain('Google');
    });

    it('generateLinkHtml が HTMLをエスケープすること', () => {
        const link: CommonLink = { id: '2', title: '<script>alert(1)</script>', url: 'https://example.com' };
        const html = ui.generateLinkHtml(link);

        expect(html).not.toContain('<script>');
        expect(html).toContain('&lt;script&gt;');
    });

    it('generateLinkHtml が 不正なプロトコル (javascript:) を遮断すること', () => {
        const link: CommonLink = { id: '3', title: 'XSS', url: 'javascript:alert(1)' };
        const html = ui.generateLinkHtml(link);

        expect(html).toContain('href="#"');
    });

    it('generateLinkHtml が http/https 以外のプロトコルを遮断すること', () => {
        const link: CommonLink = { id: '4', title: 'FTP', url: 'ftp://example.com' };
        const html = ui.generateLinkHtml(link);

        expect(html).toContain('href="#"');
    });

    it('generateLinksHtml が 複数のリンクHTMLを結合すること', () => {
        const links: CommonLink[] = [
            { id: '1', title: 'Link 1', url: 'url1' },
            { id: '2', title: 'Link 2', url: 'url2' }
        ];
        const html = ui.generateLinksHtml(links);

        expect(html).toContain('Link 1');
        expect(html).toContain('Link 2');
    });
});
