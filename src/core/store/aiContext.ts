import { storage } from '@/core/storage';
import { buildAiContextMarkdown } from '@/core/engine/aiContext';
import { Config } from '@/types';

/** ルート直下に生成する、AIエージェント向けのデータ構造説明ファイル名 */
export const AI_CONTEXT_FILE_NAME = 'AI_CONTEXT.md';

/**
 * AI_CONTEXT.md をディレクトリ直下に生成・上書きする。
 * ディレクトリのセットアップ完了時、およびAIメモ更新時に呼び出す。
 */
export async function writeAiContextFile(version: string, config: Config): Promise<void> {
    const content = buildAiContextMarkdown({ version, userMemo: config.aiMemo });
    await storage.writeText(AI_CONTEXT_FILE_NAME, content);
}
