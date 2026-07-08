import { describe, it, expect } from 'vitest';
import { parseMarkdown } from './markdown';

describe('parseMarkdown', () => {
    it('インライン要素が正しくパースされること', () => {
        // 強調
        expect(parseMarkdown('**bold**')).toBe('<strong>bold</strong><br>');
        expect(parseMarkdown('*italic*')).toBe('<em>italic</em><br>');
        expect(parseMarkdown('`code`')).toBe('<code>code</code><br>');
        // リンク
        expect(parseMarkdown('[Google](https://google.com)')).toBe('<a href="https://google.com" target="_blank">Google</a><br>');
    });

    it('ヘッダーが正しくパースされること', () => {
        expect(parseMarkdown('# Heading 1')).toBe('<h1>Heading 1</h1>');
        expect(parseMarkdown('## Heading 2')).toBe('<h2>Heading 2</h2>');
        expect(parseMarkdown('### Heading 3')).toBe('<h3>Heading 3</h3>');
    });

    it('通常の改行が <br> に変換されること', () => {
        const input = 'line1\nline2\n\nline3';
        // line1<br>line2<br><br>line3<br> のような構造になる
        expect(parseMarkdown(input)).toBe('line1<br>line2<br><br>line3<br>');
    });

    it('箇条書き（ul/li）の間に不要な <br> が挿入されないこと (#030)', () => {
        const input = '* か\n* じ\n* よ\n* う';
        const expected = '<ul><li>か</li><li>じ</li><li>よ</li><li>う</li></ul>';
        expect(parseMarkdown(input)).toBe(expected);
    });

    it('コードブロック（```）が正しくパースされ、内部の改行が保持されること (#031)', () => {
        const input = '```python\nprint("hello")\nquit()\n```';
        const expected = '<pre><code class="language-python">print(&quot;hello&quot;)\nquit()</code></pre>';
        expect(parseMarkdown(input)).toBe(expected);
    });

    it('コードブロックと通常テキスト、リストが混在していても正しくパースされること', () => {
        const input = '# Title\nSome text\n\n* Item 1\n* Item 2\n\n```js\nconsole.log(1);\n```\nEnd text';
        const expected = 
            '<h1>Title</h1>' +
            'Some text<br>' +
            '<br>' +
            '<ul><li>Item 1</li><li>Item 2</li></ul>' +
            '<br>' +
            '<pre><code class="language-js">console.log(1);</code></pre>' +
            'End text<br>';
        expect(parseMarkdown(input)).toBe(expected);
    });
});
