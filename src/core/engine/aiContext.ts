/**
 * AI_CONTEXT.md の生成に関する純粋関数 (Pure)
 * ローカルデータディレクトリの構造を外部のAIエージェントが機械的に理解できるように
 * 説明する Markdown コンテンツを組み立てる。
 */

/** ファイル内容のスキーマバージョン。記載する構造に破壊的変更が入った場合にインクリメントする。 */
export const AI_CONTEXT_SCHEMA_VERSION = 1;

export interface AiContextParams {
    /** package.json の version（kura-tas アプリ自体のバージョン） */
    version: string;
    /** ユーザーが「AIメモ」機能から入力した、AIエージェント向けの自由記述メモ */
    userMemo?: string;
}

export function buildAiContextMarkdown(params: AiContextParams): string {
    const { version, userMemo } = params;
    const memoSection = userMemo && userMemo.trim()
        ? userMemo.trim()
        : '(未設定。kura-tas アプリのナビゲーション「🤖 AIメモ」から、ユーザーがこのアプリの使い方に関するメモを自由記述できます。)';

    return `# AI_CONTEXT.md

このファイルは [kura-tas](https://github.com/nushitoritarou/kura-tas) が自動生成した、このディレクトリのデータ構造説明です。
外部のAIエージェント（Claude Code など）がこのディレクトリを読み込んで操作する際の手引きとして参照してください。

- kura-tas バージョン: ${version}
- スキーマバージョン: ${AI_CONTEXT_SCHEMA_VERSION}

> [!WARNING]
> **このファイルおよび以下に記載する全てのデータファイルを、AIエージェントが直接書き換えないでください。**
> kura-tas はアプリケーションの実行中にファイルが裏で（アプリを経由せず）更新されることを想定していません。
> 直接編集すると、アプリ内部の状態（キャッシュやUndo/Redo履歴）との不整合やデータ破損の原因になります。
> ファイルの内容を読み取って要約・提案することは歓迎しますが、変更はユーザー自身が kura-tas アプリ上から行ってください。

## ディレクトリ構成

| パス | 役割 |
| :--- | :--- |
| \`config.json\` | アプリ設定（営業日・休日・履歴上限・AIメモなど）。 |
| \`inbox.json\` | Inbox（走り書きメモの一時保管場所）。 |
| \`links.json\` | 共通リンク集。 |
| \`routine.json\` | 定期タスクの定義（マスタ）。 |
| \`tasks/{YYYY-MM-DD}.json\` | 日付ごとのタスク一覧。 |
| \`notes/*.md\` | タスク・日付に紐づくメモ（Markdown、フロントマター付き）。 |

## JSON スキーマ

### Task (\`tasks/{date}.json\` の要素)
\`\`\`typescript
interface Task {
  id: string;
  text: string;
  done: boolean;
  delegated?: boolean;      // 他者依頼マーク
  priority?: number;        // 優先度 1(最優先)〜5
  deadline?: string;        // "YYYY-MM-DD"
  noteId?: string;          // 紐づく notes/*.md のID（未設定時は "task-{id}"）
  routineId?: string;       // 生成元の定期タスク（RoutineTask）のID
  originalDate: string;     // 生成時点の日付（手動移動判定に使用）
  date: string;             // このタスクが属する日付 "YYYY-MM-DD"
}
\`\`\`

### InboxItem (\`inbox.json\` の要素)
\`\`\`typescript
interface InboxItem {
  id: string;
  text: string;
}
\`\`\`

### CommonLink (\`links.json\` の要素)
\`\`\`typescript
interface CommonLink {
  id: string;
  title: string;
  url: string;
}
\`\`\`

### Config (\`config.json\`)
\`\`\`typescript
interface Config {
  carryOverDays?: number;
  historyLimit?: number;
  logLevel?: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  enableFileLog?: boolean;
  logFilePath?: string;
  workDays?: number[];      // 営業日の曜日 (0:日 ... 6:土)
  holidays?: string[];      // 休日の日付 "YYYY-MM-DD"
  aiMemo?: string;          // ユーザーからAIエージェントへのメモ（下記「ユーザーからのメモ」参照）
}
\`\`\`

### RoutineTask (\`routine.json\` の要素)
\`\`\`typescript
interface RoutineTask {
  id: string;
  text: string;
  schedule: {
    type: 'weekly' | 'interval' | 'monthly-day' | 'monthly-weekday' | 'none';
    days?: ('Sun'|'Mon'|'Tue'|'Wed'|'Thu'|'Fri'|'Sat')[]; // 'weekly','interval','monthly-weekday' 用
    intervalWeeks?: number;        // 'interval' 用
    baseDate?: string;             // 'interval' 用
    monthlyDay?: number | 'last';  // 'monthly-day' 用
    weekIndex?: number | 'last';   // 'monthly-weekday' 用
  };
  lastGenerated?: string;
  generatedDates?: string[];
  holiday_adjustment?: 'before' | 'after' | 'skip'; // 休日調整ルール
  noteTemplate?: string;
}
\`\`\`

## notes/*.md のファイル名規則とフロントマター

- ファイル名: \`daily-{YYYY-MM-DD}.md\`（その日全体のメモ） または \`task-{taskId}.md\`（個別タスクのメモ）
- 先頭にYAML風のフロントマターを持つプレーンテキスト:

\`\`\`markdown
---
title: タイトル
date: YYYY-MM-DD
type: daily | task
taskId: 紐づくタスクID（type が task の場合のみ）
---

本文（Markdown）
\`\`\`

## ユーザーからのメモ

${memoSection}
`;
}
