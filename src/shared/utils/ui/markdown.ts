/**
 * Markdownの簡易パースを行うユーティリティ (Pure)
 */
export function parseMarkdown(text: string): string {
    if (!text) return '';

    const lines = text.split('\n');
    const result: string[] = [];
    let inCodeBlock = false;
    let codeLanguage = '';
    let codeContent: string[] = [];
    let inList = false;

    // ヘルパー：インライン要素のパース
    function parseInline(str: string): string {
        return str
            .replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2" target="_blank">$1</a>')
            .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/gim, '<em>$1</em>')
            .replace(/`(.*?)`/gim, '<code>$1</code>');
    }

    // HTMLエスケープ
    function escapeHtml(str: string): string {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // コードブロックの判定
        if (line.trim().startsWith('```')) {
            if (inCodeBlock) {
                // コードブロックの終了
                const codeHtml = codeContent.map(escapeHtml).join('\n');
                const langClass = codeLanguage ? ` class="language-${codeLanguage}"` : '';
                result.push(`<pre><code${langClass}>${codeHtml}</code></pre>`);
                inCodeBlock = false;
                codeContent = [];
                codeLanguage = '';
            } else {
                // コードブロックの開始
                inCodeBlock = true;
                codeLanguage = line.trim().slice(3).trim();
            }
            continue;
        }

        if (inCodeBlock) {
            codeContent.push(line);
            continue;
        }

        // リスト（箇条書き）の判定
        const listMatch = line.match(/^\*\s+(.*)$/);
        if (listMatch) {
            if (!inList) {
                result.push('<ul>');
                inList = true;
            }
            result.push(`<li>${parseInline(listMatch[1])}</li>`);
            continue;
        } else {
            if (inList) {
                result.push('</ul>');
                inList = false;
            }
        }

        // ヘッダーの判定
        const h3Match = line.match(/^###\s+(.*)$/);
        const h2Match = line.match(/^##\s+(.*)$/);
        const h1Match = line.match(/^#\s+(.*)$/);

        if (h3Match) {
            result.push(`<h3>${parseInline(h3Match[1])}</h3>`);
        } else if (h2Match) {
            result.push(`<h2>${parseInline(h2Match[1])}</h2>`);
        } else if (h1Match) {
            result.push(`<h1>${parseInline(h1Match[1])}</h1>`);
        } else {
            // 通常の段落・行（空行も含む）
            if (line.trim() === '') {
                result.push('<br>');
            } else {
                result.push(parseInline(line) + '<br>');
            }
        }
    }

    // 最後にリストが開いたままなら閉じる
    if (inList) {
        result.push('</ul>');
    }

    // コードブロックが開いたままなら閉じる
    if (inCodeBlock) {
        const codeHtml = codeContent.map(escapeHtml).join('\n');
        const langClass = codeLanguage ? ` class="language-${codeLanguage}"` : '';
        result.push(`<pre><code${langClass}>${codeHtml}</code></pre>`);
    }

    return result.join('');
}
