# Kura-Tas アーキテクチャドキュメント

## 1. Overview (概要)
Kura-Tas は、ブラウザの FileSystem Access API を活用した、サーバーレス・ファイルベースのタスク管理ツールです。

- **状態駆動（State-driven）**: `src/core/store/` に集約された状態（Single Source of Truth）を更新し、それに基づいて UI を再描画します。
- **トランザクションベース（Transaction-based）**: 複数のストア更新を `StoreRegistry.transaction` で一括管理し、アトミックな更新と Undo/Redo を実現します。
- **テスタビリティの最大化**: 副作用を伴う「手順（Logic/Renderer）」と、副作用のない「計算（Engine/Ui）」を分離し、自動テストを容易にしています。
- **ファイルベース永続化**: ユーザーが指定したローカルディレクトリ内に JSON/Markdown 形式でデータを保存します。

---

## 2. 設計原則 (Golden Rules) - [Tier 1]
*開発時には必ずこのセクションを読み、遵守してください。これらはプロジェクトの根本的な思想であり、AIエージェントの基本バイアスとして機能します。*

1. **表示文言の決定は UI 層の責務**
   - 「もしこのアプリが CLI だった場合、この表示ロジックは必要か？」を問い、不要であれば `ui.ts` に配置する。
2. **永続化形式への変換は Store 層の責務**
   - 保存先（ファイル/DB等）に依存する変換処理は `Store` の責務とする。
3. **ドメインルールの隠蔽は Engine 層の責務**
   - ID 発番規則などのドメイン知識は `Engine` 層に閉じ込める。
4. **Renderer の「書き込み専用」および「差分更新」原則**
   - Renderer は `el.ts` を用いて DOM を参照（描画先として取得）することは許容されるが、そこからユーザー入力（`input.value` 等）を取得してはならない。入力値の取得は必ず Integration層（`main.ts`）が行い、データとして Logic に渡すこと。
   - **DOM 更新時、`innerHTML = ''` による全置換を禁止する。** パフォーマンスの維持とフォーカス/スクロール位置の消失を防ぐため、必ず `shared/utils/dom/diff.ts` の `patch()` ユーティリティを使用して差分更新を行うこと。
5. **レイヤー間の徹底した疎結合**
   - Logic と Renderer は互いに直接参照してはならない。また、Renderer は Store を直接参照してはならない。各モジュールの紐付けは Integration層（`main.ts`）のみが行う。（※ Logic が Store をインポートすることは許容される）
6. **副作用（Side Effects）の明示的検証**
   - テストでは状態（State）の変化だけでなく、永続化（save）などの重要な副作用が正しい引数で呼び出されたことを必ず検証する。
7. **Types / El は「最強の内側」**
   - `types.ts` と `el.ts` は全レイヤーから参照可能だが、これらが外部のドメインコード（Logic/Store等）をインポートしてはならない。
8. **自己文書化する命名**
   - 副作用の有無や振る舞いが一目でわかる命名を徹底する。
9. **例外ベースのエラーハンドリングと統一通知**
   - バリデーションエラーや実行時エラーは、Logic層で具体的なメッセージを持つ例外（Error）をスローする。
   - これらの例外は Integration層（`main.ts`）でキャッチし、`globalRenderer.notifyError()` を通じてユーザーにフィードバックする。Logic層が直接 Renderer を呼んだり、サイレントに `return` してはならない。

---

## 3. 詳細ドキュメント (Tiered Docs)

コンテキスト節約のため、詳細な情報は以下の階層に分割されています。

- **Tier 2: 実装規約 (Rules)**
  - **[依存関係ルール](docs/arch/dependency.md)**: 詳細なインポート可否マトリックスと禁止事項。
- **Tier 3: 背景・詳細 (Backgrounds)**
  - **[構造とデータフロー](docs/arch/layers.md)**: ディレクトリ構成、各モジュールの役割、主要パターン。
  - **[テスト戦略](docs/arch/testing.md)**: テストの配置、分類、モックの境界。

---

## 4. 技術スタック (Technical Stack)
- **Frontend**: Vite + TypeScript (インライン化による単一HTMLビルド)。
- **Storage**: Web File System Access API (ローカルファイル) & IndexedDB (ハンドル保持)。
- **Parser**: 外部依存なしの自作軽量 Markdown Parser。
- **Testing**: Vitest による Unit Test。

## 5. ビルド・配布プロセス (Build & Distribution)
- **単一ファイル化**: `vite-plugin-singlefile` を使用し、JS/CSSを全て `index.html` に埋め込む。
- **成果物**: `dist/index.html` の1ファイルのみで動作し、ポータビリティを維持する。
- **デバッグモード**: `npm run build:debug` または URLパラメータ `?debug=1` により詳細ログを有効化可能。
- **環境変数の注入**: ビルド時に `package.json` のバージョン情報、Gitコミットハッシュ、ビルド日時（JST）を環境変数（`__APP_VERSION__`, `__COMMIT_HASH__`, `__BUILD_TIME__`）として注入する。これらはアプリ起動時にバージョン表記（通常時 / デバッグ時）の表示更新に利用される。
