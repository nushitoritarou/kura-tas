# Kura-Tas デザイン仕様書 (DESIGN.md)

## 1. デザインコンセプト
**「Sakura Modernism」**
サクラエディタの伝統的な配色・視覚的安心感と、現代的なUI設計（Material Designのレイアウト、フラットな操作感）を融合させる。

## 2. カラーパレット (Sakura Editor Inspired)

### A. ベースカラー
- **Background (Main)**: `#FFFBF0` (淡いクリーム色) - 長時間の作業でも目が疲れにくい。
- **Foreground (Text)**: `#000000` (黒)
- **Sidebar Background**: `#F0F0F0` (薄いグレー)
- **Border / Divider**: `#D7D7D7` (細い境目線)

### B. アクセント・セマンティック
- **Primary (Accent)**: `#0000FF` (サクラエディタの行番号ブルー) - リンク、アクティブなボタン。
- **Done (Completed)**: `#AAAAAA` (コメントグレー) - 完了タスク、非アクティブ要素。
- **Function / Alert**: `#AA3731` (関数レッド) - 重要な警告、削除ボタン。
- **Keyword / Focus**: `#4B83CD` (キーワードブルー) - 選択中のタスクのハイライト。

### C. ステータスバー
- **Background**: `#F0F0F0` (グレー)
- **Border-top**: `#D7D7D7`

## 3. タイポグラフィ
- **Main Font**: `Consolas`, `Monaco`, `'Courier New'`, `monospace`
  - エンジニアとしての馴染み深さと、文字の読みやすさを優先。
- **Font Size**:
  - Task List: `14px`
  - Editor / Preview: `15px`
  - Sidebar: `12px`

## 4. UIコンポーネントの挙動

### 4.1. タスクリスト
- **Hover**: `#3399FF15` (薄い水色) で行ハイライト。
- **Active Selection**: `#3399FF30` で背景を固定。
- **Checkmark**: `#0000FF` のボーダー。

### 4.2. Markdownプレビュー
- **H1, H2**: `#AA3731` (関数レッド) をアクセントに使用。
- **Inline Code**: 背景 `#F0F0F0`、文字色 `#AB6526` (定数オレンジ)。
- **Link**: `#0000FF` (アンダーラインなし、Hoverでアンダーライン)。

### 4.3. 操作フィードバック
- 右クリックで表示されるコンテキストメニューは `#F0F0F0` 背景に `#D7D7D7` のシャドウを付け、サクラエディタのメニュー風にする。

## 5. レイアウト・グリッド
- **3カラム固定レイアウト**:
  - Navigation: `200px`
  - Task List: `minmax(400px, 1fr)`
  - Knowledge: `minmax(400px, 1.2fr)`
- **Padding**: `10px` 〜 `15px` を基本とし、詰まりすぎず、余白すぎない「エディタ的」な密度を保つ。
