import { describe, it, expect } from 'vitest';
import { parseMarkdown, parseMarkdownKeepSource } from './markdown';

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

describe('parseMarkdownKeepSource', () => {
    const unescapeHtml = (str: string) => str
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');

    const getPlainText = (html: string) => {
        // buttonタグとその中身を除外
        const htmlWithoutButtons = html.replace(/<button[^>]*>.*?<\/button>/g, '');
        // タグをすべて除去
        const tagsRemoved = htmlWithoutButtons.replace(/<[^>]*>/g, '');
        // HTMLエスケープを元に戻す
        return unescapeHtml(tagsRemoved);
    };

    it('変換後のプレーンテキストが元のテキストと完全に一致すること（文字数・改行位置の維持）', () => {
        const inputs = [
            '# Title\nSome text with **bold** and `code`',
            '* Item 1\n* Item 2\n- Item 3',
            '```js\nconsole.log("hello");\n```\nNormal text\n[Google](https://google.com)',
            'Multiple\n\n\nNewlines',
            '# heading\n## h2\n### h3\n* list\n- list2\n**bold**\n*italic*\n`inline`\n[link](http://url)'
        ];

        for (const input of inputs) {
            const output = parseMarkdownKeepSource(input);
            expect(getPlainText(output)).toBe(input);
        }
    });

    it('Markdown要素が正しくspan等のタグで囲まれること', () => {
        // 見出し
        expect(parseMarkdownKeepSource('# Heading')).toContain('<span class="md-h1"># Heading</span>');
        expect(parseMarkdownKeepSource('## H2')).toContain('<span class="md-h2">## H2</span>');

        // 太字とインラインコード
        expect(parseMarkdownKeepSource('**bold**')).toContain('<span class="md-bold">**bold**</span>');
        expect(parseMarkdownKeepSource('`code`')).toContain('<span class="md-inline-code">`code`</span>');

        // リンク
        const linkOutput = parseMarkdownKeepSource('[Google](https://google.com)');
        expect(linkOutput).toContain('<span class="md-link-bracket">[</span>');
        expect(linkOutput).toContain('<span class="md-link-text">Google</span>');
        expect(linkOutput).toContain('<a href="https://google.com" target="_blank" class="md-link-url">https://google.com</a>');

        // コードブロック
        const codeOutput = parseMarkdownKeepSource('```js\nconsole.log(1);\n```');
        expect(codeOutput).toContain('<div class="md-codeblock-container">');
        expect(codeOutput).toContain('<button class="btn-copy-code"');
        expect(codeOutput).toContain('<span class="md-code-fence">```js</span>');
        expect(codeOutput).toContain('<span class="md-code-body">');
        expect(codeOutput).toContain('<span class="md-code-fence">```</span></div>');
    });

    it('生のURLが正しくリンクに変換されること', () => {
        const input = '生のURL: https://github.com です。';
        const output = parseMarkdownKeepSource(input);
        expect(output).toContain('<a href="https://github.com" target="_blank" class="md-link-url">https://github.com</a>');
        expect(getPlainText(output)).toBe(input);
    });
});
