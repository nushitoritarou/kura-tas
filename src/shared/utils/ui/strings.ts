/**
 * 文字列操作に関する純粋な計算ロジック
 */

/**
 * HTML特殊文字をエスケープする
 * OWASPの推奨に基づき、属性値としても安全に使用できるレベルでエスケープを行う。
 */
export function escapeHTML(str: string): string {
    if (typeof str !== 'string') return '';
    const map: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
        '/': '&#x2F;',
        '`': '&#x60;',
        '=': '&#x3D;'
    };
    return str.replace(/[&<>"'`=\/]/g, (m) => map[m]);
}
