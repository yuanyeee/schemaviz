# SchemaViz

SchemaViz は、データベーススキーマを **抽出（extract）→可視化（diagram / serve）→検証（validate）→差分比較（diff）→コード生成（generate）→履歴管理（snapshot/history）** できる TypeScript 製 CLI ツールです。

## 主な機能

- PostgreSQL / MySQL / SQLite / SQL Server からスキーマ抽出
- Mermaid / PlantUML の ER 図生成
- PNG / SVG / PDF 画像出力（Mermaid レンダリング経由）
- スキーマ差分（追加・削除・変更）とマイグレーション SQL 生成
- ベストプラクティス検証（エラー/警告/情報）
- ブラウザ UI (`serve`) での対話的な ER 図閲覧
- Prisma / TypeORM / GraphQL のコード生成
- スナップショット保存と履歴操作（list/show/delete）

---

## 必要環境

- Node.js 20 以上推奨
- npm
- TypeScript 実行環境（開発時は `npm install` で同梱依存を利用）

画像出力（`.png` / `.svg` / `.pdf`）には Puppeteer が使われます。実行環境に応じて Chromium の準備が必要になる場合があります。

---

## インストール

### 1) リポジトリから利用

```bash
git clone https://github.com/yuanyeee/schemaviz.git
cd schemaviz
npm install
npm run build
```

### 2) CLI として呼び出し

```bash
# 直接実行
node dist/index.js --help

# あるいはリンクして短縮コマンド化
npm link
schemaviz --help
```

---

## クイックスタート

```bash
# 1. スキーマ抽出
schemaviz extract -c examples/postgresql.yaml -o schema.json

# 2. ER 図生成（Mermaid Markdown）
schemaviz diagram -s schema.json -o er.md

# 3. スキーマ検証
schemaviz validate -s schema.json

# 4. 差分比較（同時に migration.sql 出力）
schemaviz diff -s1 schema_old.json -s2 schema_new.json -m migration.sql
```

---

## コマンド一覧

```bash
schemaviz <command> [options]
```

### `extract`
DB に接続して `Schema JSON` を生成します。

```bash
schemaviz extract -c <config.(yaml|yml|json)> -o <schema.json>
```

オプション:

- `-c, --config <path>`: DB 設定ファイル（必須）
- `-o, --output <path>`: 出力先 JSON（必須）

---

### `diagram`
Schema JSON から ER 図を生成します。

```bash
schemaviz diagram -s <schema.json> [-f mermaid|plantuml] [-o output]
```

オプション:

- `-s, --schema <path>`: スキーマ JSON（必須）
- `-f, --format <format>`: `mermaid`（既定）または `plantuml`
- `-o, --output <path>`: 出力先

出力拡張子が `.png` / `.svg` / `.pdf` の場合、画像として出力します（このとき Mermaid で描画）。

---

### `diff`
2 つの Schema JSON を比較し、差分と migration SQL を扱います。

```bash
schemaviz diff -s1 <old.json> -s2 <new.json> [-o diff.json] [-m migration.sql]
```

オプション:

- `-s1, --schema1 <path>`: 旧スキーマ（必須）
- `-s2, --schema2 <path>`: 新スキーマ（必須）
- `-o, --output <path>`: 差分 JSON 出力
- `-m, --migration <path>`: migration SQL 出力

`-m` を指定しない場合は migration SQL を標準出力に表示します。

---

### `validate`
スキーマを静的チェックし、レポートを出力します。

```bash
schemaviz validate -s <schema.json> [-f text|json] [-o report] [--fail-on-warning]
```

オプション:

- `-s, --schema <path>`: スキーマ JSON（必須）
- `-f, --format <format>`: `text`（既定）または `json`
- `-o, --output <path>`: レポート保存先
- `--fail-on-warning`: 警告があれば終了コード 1

主なチェックルール:

- `no-primary-key`
- `no-columns`
- `fk-missing-index`
- `email-not-unique`
- `id-column-missing-fk`
- `missing-timestamps`
- `duplicate-index`
- `nullable-id-column`

---

### `serve`
ローカル Web UI を起動し、ER 図をインタラクティブに閲覧します。

```bash
schemaviz serve [-s schema.json] [-p 3000] [-H localhost] [-w]
```

オプション:

- `-s, --schema <path>`: 起動時に読み込むスキーマ JSON（省略時は接続ログイン UI）
- `-p, --port <port>`: ポート（既定 `3000`）
- `-H, --host <host>`: バインドホスト（既定 `localhost`）
- `-w, --watch`: リクエストごとにスキーマ再読込

#### Web画面は含まれますか？

はい。`serve` には以下の 2 つの画面があります。

- **ログイン画面**（`-s` 未指定で起動時）
  - DB 種別・接続情報を入力して接続
- **ER 図画面**（接続成功後、または `-s` 指定で起動時）
  - Mermaid / PlantUML 切替
  - Validate / Generate / Snapshot / Diff パネル
  - テーブル検索、詳細表示、SVG ダウンロード、テーマ切替

#### すぐ試す

```bash
# 1) ビルド
npm run build

# 2) サンプルスキーマで Web UI 起動（ログインをスキップ）
node dist/index.js serve -s schema.json -p 3000

# 3) ブラウザでアクセス
# http://localhost:3000
```

> 補足: `-s` を省略するとログイン画面から DB 接続して利用できます。

---

### `generate`
Schema JSON からコードを生成します。

```bash
schemaviz generate -s <schema.json> -f <prisma|typeorm|graphql> [-o output]
```

オプション:

- `-s, --schema <path>`: スキーマ JSON（必須）
- `-f, --format <format>`: `prisma` / `typeorm` / `graphql`（必須）
- `-o, --output <path>`: 出力先

フォーマット別既定出力先:

- `prisma`: `schema.prisma`
- `typeorm`: `./entities`
- `graphql`: `schema.graphql`

---

### `snapshot` / `history`
スキーマ履歴を保存・閲覧・削除します。

```bash
# 保存
schemaviz snapshot -s schema.json [-t tag] [-d dir]

# 一覧
schemaviz history list [-d dir] [--json]

# 詳細
schemaviz history show <ref> [-d dir] [--json]

# 削除
schemaviz history delete <ref> [-d dir]
```

---

## 設定ファイル例

`extract` の `--config` で使用する設定です。

### PostgreSQL (`examples/postgresql.yaml`)

```yaml
type: postgresql
host: localhost
port: 5432
database: myapp
user: postgres
password: mypassword
```

### MySQL (`examples/mysql.yaml`)

```yaml
type: mysql
host: localhost
port: 3306
database: myapp
user: root
password: mypassword
```

### SQLite (`examples/sqlite.yaml`)

```yaml
type: sqlite
filename: ./myapp.db
database: sqlite
```

### SQL Server (`examples/sqlserver.yaml`)

```yaml
type: sqlserver
host: localhost
port: 1433
database: myapp
user: sa
password: yourStrong(!)Password
```

---

## Schema JSON 形式

```json
{
  "database": "mydb",
  "generatedAt": "2026-01-01T00:00:00.000Z",
  "tables": [
    {
      "name": "users",
      "columns": [
        {
          "name": "id",
          "type": "INTEGER",
          "nullable": false,
          "isPrimaryKey": true,
          "isForeignKey": false
        }
      ],
      "indexes": [
        {
          "name": "users_pkey",
          "columns": ["id"],
          "isUnique": true
        }
      ],
      "foreignKeys": []
    }
  ]
}
```

---

## GitHub Actions

サンプル Workflow が同梱されています。

- `.github/workflows/schema-validate.yml`
- `.github/workflows/schema-diff.yml`

必要に応じて自身のリポジトリへコピーして利用してください。

---

## 開発

```bash
npm install
npm run build
npm test
npm run dev
```

---

## English Guide (Quick Reference)

SchemaViz is a TypeScript CLI for:

- extracting DB schema (`extract`)
- rendering ER diagrams (`diagram` / `serve`)
- validating schema quality (`validate`)
- diffing schemas and generating migration SQL (`diff`)
- generating Prisma / TypeORM / GraphQL code (`generate`)
- saving and browsing snapshots (`snapshot` / `history`)

### Install

```bash
git clone https://github.com/yuanyeee/schemaviz.git
cd schemaviz
npm install
npm run build
```

### Run CLI

```bash
node dist/index.js --help
# or
npm link
schemaviz --help
```

### Common commands

```bash
schemaviz extract -c examples/postgresql.yaml -o schema.json
schemaviz diagram -s schema.json -o er.md
schemaviz validate -s schema.json
schemaviz diff -s1 schema_old.json -s2 schema_new.json -m migration.sql
schemaviz serve -s schema.json -p 3000
schemaviz generate -s schema.json -f prisma -o schema.prisma
schemaviz snapshot -s schema.json -t v1
schemaviz history list
```

> Notes:
> - Image export (`.png`, `.svg`, `.pdf`) uses Puppeteer and may require Chromium setup.
> - Generated migration SQL is generic and may need manual adjustment for DB-specific dialects.

---

## 中文指南（快速参考）

SchemaViz 是一个 TypeScript CLI，可用于：

- 从数据库提取 Schema（`extract`）
- 生成 ER 图（`diagram` / `serve`）
- 做 Schema 规则校验（`validate`）
- 对比两个 Schema 并生成迁移 SQL（`diff`）
- 生成 Prisma / TypeORM / GraphQL 代码（`generate`）
- 管理快照历史（`snapshot` / `history`）

### 安装

```bash
git clone https://github.com/yuanyeee/schemaviz.git
cd schemaviz
npm install
npm run build
```

### 运行方式

```bash
node dist/index.js --help
# 或
npm link
schemaviz --help
```

### 常用命令

```bash
schemaviz extract -c examples/postgresql.yaml -o schema.json
schemaviz diagram -s schema.json -o er.md
schemaviz validate -s schema.json
schemaviz diff -s1 schema_old.json -s2 schema_new.json -m migration.sql
schemaviz serve -s schema.json -p 3000
schemaviz generate -s schema.json -f prisma -o schema.prisma
schemaviz snapshot -s schema.json -t v1
schemaviz history list
```

> 说明：
> - 图片导出（`.png` / `.svg` / `.pdf`）依赖 Puppeteer，部分环境需要额外配置 Chromium。
> - 迁移 SQL 为通用模板，遇到特定数据库方言时可能需要手动调整。

---

## 既知の注意点

- `diff` の migration SQL は汎用テンプレートであり、すべての DB 方言・複雑な変更（制約詳細など）を完全には復元できません。
- 画像出力は実行環境（CI, コンテナ, OS）によって追加セットアップが必要な場合があります。

---

## ライセンス

MIT
