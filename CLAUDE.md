# CLAUDE.md - Development Guidelines for Claude

このファイルは GitHub Claude 連携および Claude Code 用の開発ガイドラインです。
作業を開始する前に、必ず本ガイドラインおよび関連ドキュメントを確認・遵守してください。

---

## 🚨 最重要ルール (Strict Rules)

1. **ブランチ戦略の厳格遵守**
   - **ブランチ作成元**: 新しい機能開発や修正を行う際は、**必ず `develop` ブランチから切ってください**。`main` や `master` から直接ブランチを作成することは**厳禁**です。
   - **ブランチ命名規則**: `feature/issue-<ID>-<name>` または `fix/issue-<ID>-<name>`
   - **プルリクエスト (PR) 送信先**: PRは必ず **`develop`** ブランチ宛てに作成してください。
   - **直接コミット禁止**: `main`, `master`, `develop` ブランチへの直接コミットは禁止です。

2. **事前計画の確認 (MUST)**
   - コードの変更や実装に着手する前に、必ず**「実装計画（どのような方針・手順で進めるか）」**をユーザーに提示し、確認（Goサイン）を得てください。

3. **言語方針**
   - チャットでの対話、思考プロセス、コミットメッセージ、PR説明文等は**すべて日本語**で行ってください。

---

## 🛠 主要コマンド (Commands)

- **テスト実行**: `npm test`
- **ビルド実行**: `npm run build`
- **依存関係更新・解析**: `npm run check:deps` (必要に応じて)

※ 実装完了時やUAT依頼前には、必ず `npm test` および `npm run build` を実行してエラーがないか確認してください。

---

## 🔄 開発ワークフロー (Workflow)

1. **最新状態の取得**: `git checkout develop && git pull origin develop`
2. **Issue確認**: 対象の GitHub Issue の内容・仕様を確認する。
3. **計画立案と承認**: ユーザーに実装計画を提示し、OKを得る。
4. **作業ブランチ作成**: `git checkout -b feature/issue-<ID>-<name> develop`
5. **実装とテスト**:
   - 設計原則に従い実装する。
   - `npm test` でユニットテストを通過させる。
   - 仕様変更が発生した場合は `spec/` 配下のドキュメントおよび `architecture.md` も更新する。
6. **動作確認・技術レビュー**:
   - `npm run build` で成果物が正常に生成されることを確認する。
   - 設計原則に反していないかSubAgentにてセルフレビュー（または技術レビュー）を実施する。
7. **PR作成**:
   - 、`develop` ブランチ宛てに PR を作成する。

---

## 📐 アーキテクチャと設計原則 (Architecture & Principles)

リポジトリのアーキテクチャおよび設計方針は `architecture.md` に記載されています。

- **Tier 1 (Core)**: 開発時は必ず `architecture.md` の「2. 設計原則 (Golden Rules)」を読み、常に意識してください。
- **Tier 2 (Rules)**: インポート関係に迷った際は `docs/arch/dependency.md` を参照してください。
- **Tier 3 (Details)**: 構造の詳細は `docs/arch/` 配下を参照してください。

### マインドセット・その他のルール
- **オーバーエンジニアリング厳禁**: 数万件のデータを想定した過剰な最適化や複雑な構造は避け、コードの可読性と保守性を優先してください。
- **一時ファイル**: 一時的な作業ファイルは `.gitignore` 対象である `tmp/` 配下に作成してください。
- **Issue起票**: 新規 Issue を作成する場合は `.github/ISSUE_TEMPLATE/` のテンプレートを使用してください。
