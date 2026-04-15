# SchemaViz（日本語）

> Other languages: [English](./README.en.md) | [中文](./README.zh-CN.md)

SchemaViz は、データベーススキーマを抽出・可視化・検証・差分比較・コード生成・履歴管理できる TypeScript 製 CLI ツールです。

## 機能（実装ベース）

- DB スキーマ抽出（`extract`）
  - PostgreSQL / MySQL / SQLite / SQL Server
- ER 図生成（`diagram`）
  - Mermaid / PlantUML
  - 画像出力: `.png` / `.svg` / `.pdf`（Mermaidレンダリング経由）
- スキーマ差分と migration SQL 生成（`diff`）
- スキーマ検証（`validate`）
- Web UI（`serve`）
- コード生成（`generate`）
  - Prisma / TypeORM / GraphQL
- スナップショット履歴（`snapshot` / `history`）

## セットアップ

```bash
git clone https://github.com/yuanyeee/schemaviz.git
cd schemaviz
npm install
npm run build
```

CLI 実行方法:

```bash
# 直接
node dist/index.js --help

# または link 後
npm link
schemaviz --help
```

## Web の利用方法（重要）

`serve` には2つの起動パターンがあります。

### 1) スキーマ JSON を指定して起動（ログイン画面をスキップ）

```bash
schemaviz serve -s schema.json -p 3000
# http://localhost:3000
```

- 起動時に `schema.json` を読み込み、ER 図画面を直接表示します。
- `--watch` を付けるとリクエストごとにスキーマファイルを再読込します。

### 2) スキーマ JSON を指定せず起動（ログイン画面から接続）

```bash
schemaviz serve -p 3000
# http://localhost:3000
```

- ログイン画面が表示され、DB接続情報を入力して接続できます。
- 接続後に ER 図画面へ遷移します。

### `serve` オプション

- `-s, --schema <path>`: 事前に読み込むスキーマ JSON
- `-p, --port <port>`: ポート（既定 `3000`）
- `-H, --host <host>`: バインドホスト（既定 `localhost`）
- `-w, --watch`: リクエストごとに再読込

### Web 画面で使える主な機能

- Mermaid / PlantUML の表示切替
- Validate / Generate / Snapshot / Diff パネル
- テーブル検索、詳細表示、SVG ダウンロード、テーマ切替、切断

## 主なコマンド

```bash
schemaviz extract -c examples/postgresql.yaml -o schema.json
schemaviz diagram -s schema.json -o er.md
schemaviz validate -s schema.json
schemaviz diff -s1 schema_old.json -s2 schema_new.json -m migration.sql
schemaviz generate -s schema.json -f prisma -o schema.prisma
schemaviz snapshot -s schema.json -t v1
schemaviz history list
```

## 補足

- 画像出力（`.png` / `.svg` / `.pdf`）には Puppeteer を使用します。環境によって Chromium の追加セットアップが必要です。
- migration SQL は汎用テンプレートです。DB 方言や複雑な変更は手動調整が必要な場合があります。
