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

/**
 * 元のMarkdownテキストの文字数や文字順序、改行位置を一切変えずに、
 * プレビュー用の装飾HTML（spanやaタグ等）で囲むだけのパースを行う。
 */
export function parseMarkdownKeepSource(text: string): string {
    if (!text) return '';

    // HTMLエスケープ（タグが意図せずレンダリングされるのを防ぐ）
    const escapeHtml = (str: string) => str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    const lines = text.split('\n');
    const processedLines: string[] = [];
    let inCodeBlock = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const escapedLine = escapeHtml(line);

        // --- 1. コードブロック of 処理 ---
        if (escapedLine.trim().startsWith('```')) {
            if (inCodeBlock) {
                inCodeBlock = false;
                processedLines.push(`</span><span class="md-code-fence">${escapedLine}</span></div>`);
            } else {
                inCodeBlock = true;
                processedLines.push(`<div class="md-codeblock-container">` +
                                   `<button class="btn-copy-code">Copy</button>` +
                                   `<span class="md-code-fence">${escapedLine}</span>` +
                                   `<span class="md-code-body">`);
            }
            continue;
        }

        if (inCodeBlock) {
            processedLines.push(escapedLine);
            continue;
        }

        // --- 2. インライン要素の処理 (文字数を変更しない) ---
        let processed = escapedLine;

        // 太字: **text**
        processed = processed.replace(/(\*\*.*?\*\*)/g, '<span class="md-bold">$1</span>');

        // イタリック: *text*
        processed = processed.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<span class="md-italic">*$1*</span>');

        // インラインコード: `code`
        processed = processed.replace(/(`.*?`)/g, '<span class="md-inline-code">$1</span>');

        // リンク: [text](url) の記法を残し、url の部分のみを <a> にする
        processed = processed.replace(/(\[)(.*?)(\]\()([^\)]+?)(\))/g, 
            '<span class="md-link-bracket">$1</span>' +
            '<span class="md-link-text">$2</span>' +
            '<span class="md-link-bracket">$3</span>' +
            '<a href="$4" target="_blank" class="md-link-url">$4</a>' +
            '<span class="md-link-bracket">$5</span>'
        );

        // 生のURLの処理（すでにタグ属性やタグ中身になっているものは除外する）
        processed = processed.replace(/(?<!["'>\/>])(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" class="md-link-url">$1</a>');

        // --- 3. ブロック要素の処理 ---
        if (processed.startsWith('### ')) {
            processedLines.push(`<span class="md-h3">${processed}</span>`);
        } else if (processed.startsWith('## ')) {
            processedLines.push(`<span class="md-h2">${processed}</span>`);
        } else if (processed.startsWith('# ')) {
            processedLines.push(`<span class="md-h1">${processed}</span>`);
        } else if (processed.trim().startsWith('* ')) {
            processedLines.push(processed.replace(/^(\s*)(\*\s+)/, '$1<span class="md-bullet">$2</span>'));
        } else if (processed.trim().startsWith('- ')) {
            processedLines.push(processed.replace(/^(\s*)(-\s+)/, '$1<span class="md-bullet">$2</span>'));
        } else {
            processedLines.push(processed);
        }
    }

    if (inCodeBlock) {
        processedLines.push('</span></div>'); // 閉じ忘れ
    }

    return processedLines.join('\n');
}

