# 依存関係ルール (Dependency Rules)

## 1. 依存関係の基本構造
依存関係は **「ビジネスロジックの列」** と **「表示・UIの列」** の二本柱に分け、それらを `main.ts` が統合（配線）する構造とする。これにより Logic と Renderer の結合を排除し、テスト可能性を最大化する。

## 2. 決定論的な依存関係チェック
これらのルールは `.dependency-cruiser.js` によって定義されており、ビルドプロセスやCI時に検証されます。
- `npm run lint:types`: ビルドを伴わずに依存関係の違反がないかチェックします。
- `npm run build`: ビルドプロセスの一環として自動的にチェックを実行します。

## 3. 依存マトリックス

| カテゴリ | モジュール | 参照元 (Imported by) | 参照先 (Imports) |
| :--- | :--- | :--- | :--- |
| **Shared Type** | `src/types.ts` | 全ファイル | (なし) |
| **Core Engine** | `src/core/engine/*.ts` | logic, renderer, shared | `src/types.ts` |
| **Core State** | `src/core/store/*.ts` | logic, main | `src/types.ts`, `src/core/storage.ts`, `core/store` (Base) |
| **Core API** | `src/core/storage.ts` | store, logger | (なし) |
| **Core API** | `src/core/logger/*.ts` | 全ファイル | `src/types.ts`, `src/core/storage.ts` |
| **Input Map** | `src/core/el.ts` | renderer, main | (なし) |
| **Shared UI Util**| `src/shared/utils/ui/*.ts` | ui (features/shared) | (なし) |
| **Shared DOM Util**| \`src/shared/utils/dom/*.ts\` | renderer (features/shared) | \`src/types.ts\` |
| **Feature UI** | `src/features/x/ui.ts` | `features/x/renderer` | `src/types.ts`, `shared/utils/ui` |
| **Feature View** | `src/features/x/renderer.ts`| `main.ts` | `src/types.ts`, `engine`, `el`, `ui` (同一機能), \`shared/utils/dom\` |
| **Feature Biz** | `src/features/x/logic.ts` | `main.ts` | `src/types.ts`, `engine`, `store` |
| **Shared Engine**| `src/shared/x/engine/*.ts` | logic, renderer, shared | `src/types.ts` |
| **Shared UI** | `src/shared/x/ui.ts` | renderer (同一機能) | `src/types.ts`, `shared/utils/ui` |
| **Shared View** | `src/shared/x/renderer.ts` | `main.ts` | `src/types.ts`, `engine`, `el`, `ui` (同一機能) |
| **Shared Biz** | `src/shared/x/logic.ts` | `main.ts` | `src/types.ts`, `engine` |
| **Orchestrator** | `src/main.ts` | (なし) | 全て (紐付けのため) |

## 4. 禁止事項
1. **Logic と Renderer は互いを知らない**: 直接のインポートを禁止し、`main.ts` が仲介する。
2. **Core は UI を知らない**: `engine` や `store` が `features/` 配下をインポートすることを禁止する。
3. **Logic 同士の直接参照禁止**: 機能間の連携は必ず `main.ts` を介して行う。
4. **Engine は Store を知らない**: 純粋な計算に徹し、外部状態への依存を排除する。
5. **Types/El は最強の内側**: どこから参照しても良いが、これらが外部へ依存することは禁止。
6. **Shared はドメインを知らない**: `shared/` は `core/store` や `features/` など、Kura-Tas特有のドメイン知識（状態）に依存してはならない。
7. **循環参照**: プロジェクト全体で一切禁止。
8. **Renderer は「書き込み専用（Input禁止）」**: Renderer の責務は「Store の状態を DOM に反映すること」です。DOM から入力値（例: `input.value`）を取得する処理は、Integration層（`main.ts`）が `el.ts` を使用して直接行い、取得した**データのみ**を Logic の関数に引数として渡してください。Renderer や Logic が直接 `el.ts` から値を取得（get）する手続きを書いてはなりません。
