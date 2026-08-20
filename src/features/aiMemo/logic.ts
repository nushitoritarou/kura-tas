import { ConfigStore } from '@/core/store/ConfigStore';

/**
 * AIメモ機能が依存するストアの型定義
 */
export interface AiMemoDeps {
    config: ConfigStore;
}

/**
 * ユーザーから外部AIエージェントへのメモを保存する
 */
export async function saveAiMemo(memo: string, deps: AiMemoDeps): Promise<void> {
    await deps.config.update({ aiMemo: memo });
}
