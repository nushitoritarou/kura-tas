# 構造とデータフロー (Layers & Flow)

## 1. Directory Structure (ディレクトリ構成)

### プロジェクト構成
```text
src/
├── types/            # [共有型定義] 循環参照を防ぐため独立。Task, Note, Config等。
├── core/             # [ドメイン核心層]
│   ├── engine/       # 純粋関数ベースのドメインロジック（日付計算、ソート等）。
│   ├── store/        # アプリの状態管理（データ金庫）。
│   └── storage.ts    # [API層] File System Access API を隠蔽。初期化ガード、直列化を担当。
├── features/         # [機能（ドメイン）単位の分割]
│   └── (inbox, notes, routine, tasks...)
│       ├── ui.ts       # [Presentation] HTML文字列への変換（Pure）。
│       ├── renderer.ts # [View] DOMへの反映、クラス操作等のUI手順（Impure）。
│       └── logic.ts    # [Business] UIイベントを受けてStore/Engineを繋ぐ手順（Impure）。
├── shared/           # [共通基盤] ドメインに依存しない汎用UI部品やユーティリティ。
│   └── utils/
│       └── ui/       # [UI共通ユーティリティ] エスケープ、フォーマッタ等。ui.tsから参照可。
├── wiring/           # [統合（配線）層] main.tsから分割された各機能ごとのイベント・状態バインドロジック。
├── main.ts           # [Orchestrator] アプリの初期化、配線、エントリポイント。
└── el.ts             # [Input Ref] 画面上のHTML要素への参照地図（Inputの取得に利用）。
```

## 2. Module Roles (モジュールの役割)

アプリケーションの各モジュールは以下の役割を持ちます。

| カテゴリ | モジュール | 役割 |
| :--- | :--- | :--- |
| **Types** | `types/*.ts` | アプリケーションで利用されるあらゆる型のインターフェースを保持。 |
| **Core (Logic)** | `core/engine/*.ts` | アプリケーションのビジネスロジック層における純粋関数を持つ。副作用を持たず、冪等である。 |
| **Core (State)** | `core/store/*.ts` | アプリケーション内で保持するデータを取り扱う。永続化関連処理はここかstorage.tsに記述され、logicからは見えない。 |
| **Core (API)** | `core/storage.ts` | アプリケーションで保持したデータを永続化するための処理を記述。このアプリケーションではFile System Accessの処理となる。 |
| **Input Map** | `core/el.ts` | HTML要素（DOM Element）を意味的な変数として扱えるようにするためのファイル。画面からのインプット（入力値の取得、イベントのフック）を手軽に扱えるようにする。 |
| **Feature (Presentation)** | `features/xxx/ui.ts` | データをHTML文字列（またはDOM構造）へ変換する純粋関数。副作用を持たず、冪等である。 |
| **Feature (View)** | `features/xxx/renderer.ts` | 実際のDOM操作と、UIに関する手順（レシピ）の実行をする。ui.tsを使った手続きを記述する。 |
| **Feature (Business)** | `features/xxx/logic.ts` | ビジネスロジック層で手続き（実際のデータ操作）を実行する。engineやstoreを使った手続きを記述する。 |
| **Shared (Logic)** | `shared/xxx/engine/*.ts` | sharedで定義するモジュールでロジックに関する純粋関数を記述。 |
| **Shared (Presentation)** | `shared/xxx/ui.ts` | sharedで定義するモジュールでHTML要素を作成する純粋関数を記述。 |
| **Shared (View)** | `shared/xxx/renderer.ts` | sharedで定義するモジュールでDOM操作に関する手続きを記述する。 |
| **Shared (Business)** | `shared/xxx/logic` | sharedで定義するモジュールでロジックに関する手続きを記述する。 |
| **Wiring** | `wiring/*.ts` | 各機能単位で Logic/Renderer/Store を紐付けるイベント配線ロジック。 |
| **Orchestration** | `main.ts` | アプリケーションのブートストラップ、および共通コンテキストの初期化。 |

### 層の分類
- **ビジネスロジック層 (Business Logic Layer)**: `engine`, `store`, `storage`, `logic`。アプリケーションがCUIなどの別のインターフェースで提供されるとしても変わらないロジックを記述。
- **UI層 (UI Layer)**: `el`, `ui`, `renderer`。ビジネスロジック層の計算結果をUIに反映する。
- **統合層 (Integration Layer)**: `el`, `wiring/*.ts`, `main`。ビジネスロジック層とUI層の統合。UI層の挙動とビジネスロジック層の挙動をなんのトリガーでどのような順番で実行するかを担当する。
- **共通基盤 (Shared)**: このアプリケーション以外でも使用できるような共通部品を格納する。例：日付のフォーマット処理、一般的なモーダルUIの動きなど。

## 3. Key Patterns (主要なパターン)

### 初期化ガード (Initialization Guard)
`storage.ts` は内部に `initializedPromise` を持ち、`init()` が完了するまで `readJson` や `writeJson` の実行を自動的に待機させます。これにより、上位層は初期化状態を意識せずにデータアクセスが可能です。

### 非同期直列化 (Async Serialization)
同一ファイルに対する複数の書き込み要求が発生した場合、`storage.ts` 内のキューにより実行が直列化され、データの破損を防止します。

## 4. Data Flow (データフロー)

### ユーザー操作（タスク追加の例）
1. **User**: 入力欄で Enter を押下。
2. **main.ts**: イベントを検知し、`store.transaction` 内で `taskFeature.logic.addTask(text)` を呼び出す。
3. **logic.ts**: バリデーション後、`engine.createTask(text)` でオブジェクトを生成し、`store.add(task)` を実行。
4. **store (transaction)**: 成功時、実行前のスナップショットを履歴に積み、`dirtyStores` を確定させて `Commit` イベントを発火。
5. **main.ts (onCommit)**: `dirtyStores` に含まれるストア（例: `tasks`）に対応する `taskFeature.renderer.render(store.getState())` を呼び出す。
6. **renderer.ts**: `ui.ts` で生成したHTMLをDOMに反映し、入力欄をクリアする。

### Undo/Redo の流れ
1. **User**: `Ctrl + Z` を押下。
2. **main.ts**: `store.undo()` を実行。
3. **store (Registry)**: 履歴からスナップショットを取り出し、関連する各ストアの `restoreSnapshot()` を呼び出す。
4. **store (each)**: 状態を戻し、即座に `save()` を実行。
5. **main.ts (onCommit)**: 復元されたストアに基づき、自動的に UI が再描画される。
