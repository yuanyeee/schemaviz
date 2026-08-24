# SchemaViz ソース分析レポート

- 対象: D:\Work\GitHub\schemaviz (src/ 26ファイル・約5,100行 / tests 8ファイル・109件)
- 実施日: 2026-08-22
- テスト実行結果: `npx vitest run` 109件全パス(ただし下記①のバグを通過する脆弱アサーションあり・検証テストで実証済み)

---

## 1. 重大バグ(実証済み)

### 🔴 ① マイグレーションSQLから「カラム追加」が消える
- 場所: `src/core/diff.ts` `generateMigrationSQL` 92-99行
- 原因: modified テーブルの新規カラム定義を `diff.added.find(t => t.name === mod.name)` から探している。modified テーブルは両スキーマに存在するため `diff.added` には絶対に入らず、`col` は常に undefined → `ALTER TABLE ... ADD` が一切出力されない。
- 実証: `users` に `avatar` 列追加の差分で、正向マイグレーションは `BEGIN TRANSACTION; -- Modify table: users; COMMIT;` のまま(ADD 文ゼロ)。ロールバック側には `ALTER TABLE users DROP COLUMN avatar;` が生成される。
- 既存テスト `tests/core/diff.test.ts:112` がパスするのは `toContain('ALTER TABLE users')` の弱いアサーションがロールバック側の文にマッチしているだけ。

### 🔴 ② マイグレーションSQLが PostgreSQL 専用構文
- `ALTER TABLE ... ALTER COLUMN x TYPE t` / `SET NOT NULL` / `DROP NOT NULL` は PG 固有。
- `generateMigrationSQL(database, diff)` は `database` 引数を受け取るが**完全に無視**(方言分岐なし)。MySQL(`MODIFY COLUMN`)・SQL Server(`ALTER COLUMN`)では実行不能。
- MySQL の DDL はトランザクション非対応(自動commit)なのに `BEGIN TRANSACTION` で包んでいる。

### 🟠 ③ 型情報(長さ・精度)が欠落
- 各アダプタは `data_type` のみ保存。`varchar(100)` は `varchar` になる。
- 影響1: マイグレーション `CREATE TABLE` で MySQL は `name varchar` = varchar(1) 扱い。
- 影響2: `codegen/prisma.ts` の型マップに `CHARACTER VARYING` がなく PG 系は全てフォールバック `String`。
- 対策: `Column.type` に長さ/精度を含めるか、`type`+`length`/`precision` を分離。

### 🟠 ④ diff がインデックス・FK・DEFAULT の変化を検出しない
- `computeDiff`(src/core/diff.ts:34-60)は列の type/nullable のみ比較。インデックス・FK・デフォルト値の変更は無視される。

## 2. セキュリティ

| 箇所 | 問題 |
|---|---|
| src/core/webServer.ts 各API | 認証なしで任意DB接続が可能。/api/connect・/api/fetch-schema・/api/diff-advanced がブラウザから任意 host/port/credentials を受けてサーバーが接続。`-H 0.0.0.0` で公開すると SSRF 経路。localhost 縛りまたはトークン認証を推奨 |
| webServer.ts:2317 | パスワード保存が base64 のみ(`_encodedPassword`)。可逆エンコードであり暗号化ではない。.schemaviz/connections.json に平文保存。OSキーチェーン/DPAPI 利用または保存機能の警告を |
| webServer.ts:1067,1491,1533 | `buildHtml` が `JSON.stringify(schema)` と Mermaid コードを HTML にそのまま埋め込み。テーブル/カラム名(DB由来)に `</script>` を含むと注入の恐れ |
| ログインページ loadHistory | 接続履歴の `c.label` が `innerHTML` へエスケープなし注入。escapeHtml は34箇所使用済みだがここだけ漏れ |
| webServer.ts:1075 / imageGenerator.ts:135 | Mermaid を CDN(jsdelivr)から読み込み(オフライン不可・スキーマ情報を第三者へ送出)。ローカル依存 mermaid は未使用 |

## 3. アーキテクチャ・コード品質

- **src/core/webServer.ts が2,947行の単体モジュール**: 3つのHTMLアプリ(ログイン/テーブル選択/図ページ)と約20のAPIハンドラが1つの if/else チェーンに同居。ルータ+機能別モジュールへの分割が最優先の構造改善。
- **N+1 クエリ**: 全アダプタがテーブルごとに列/インデックス/FK の3クエリをループ。500テーブルで1,500往復。information_schema 一括クエリ化を推奨。
- **BaseAdapter.extractSchemaForTables の既定実装**(base.ts:46-54)が全スキーマ抽出→フィルタ。SQL Server のみ高效なオーバーライド。
- **config: any が全面** + tsconfig が strict:false + noImplicitAny:false。strict 化で①-④の類のバグを早期検出可能。
- **createAdapter が CJS require()**(base.ts:123-129)。ESM/バンドルで壊れ、型チェックも回避。
- **手書き declare module 'sql.js'/'mssql'**(src/types.d.ts): 実パッケージ型を置換する脆い ambient 宣言。@types 利用に置換を。
- **デッドコード**: BaseAdapter.mapType(未使用)、pako 依存(未使用)、mermaid 依存(未使用・CDN使用中)、commands/diff.ts の output 変数(合成して .diff のみ書出)、imageGenerator.ts の getSvgContentFn(未使用)。
- **バージョン不一致**: package.json = 0.1.0、CLI = 0.2.0(src/index.ts:16)。
- **i18n 不統一**: CLIログ=英語 / バリデータ=日本語のみ(src/core/validator.ts) / WebUI=日本語 / README=ja/en/zh。
- **LICENSE ファイル不在**(package.json は MIT 宣言のみ)。
- DEVELOPMENT.md が陳腐化(チェックボックスが実装状況と乖離)。

## 4. テスト・CI・運用

- テストは109件全パス。ただし**アダプタのテストがゼロ**(4DBドライバの未テスト領域が最大)。SQLite アダプタはファイルベースでテスト可能。
- 脆弱アサーションがバグを通過させた(①参照)。生成SQLはセクション分離後の検証を推奨。
- **プロジェクト自身の CI が皆無**: build/test を実行するワークフローがない。
- 既存ワークフロー(.github/workflows/schema-diff.yml, schema-validate.yml)は**利用者向けテンプレート**で `npm install -g schemaviz` を実行するが、当パッケージは npm 非公開(同名の無関係パッケージ schema-viz のみ存在)のため現状必ず失敗する。リポジトリから `npm ci` する形への修正が先。
- lint(eslint/prettier)・engines 指定なし。
- commander の `--format` に `.choices([...])` 未指定(generate は exit(1) まで落ちる)。
- extract は console.error 後に再throw しスタック2重表示、設定ファイル欠如は素の例外。
- history.ts: ID がタイムスタンプ+16bit乱数の8hexで衝突余地、index.json 書込が非原子(並行保存で lost update)。
- Webサーバー: /api/databases 等で MAX_BODY_SIZE 未適用、リクエストタイムアウトなし、DELETE /api/connections/:index がインデックス指定で競合し得る。
- imageGenerator: CDN 依存、レンダリング後に viewport 変更するため PNG clip 座標がずれ得る、PDF が固定 A4、puppeteer が重い(システム Chrome 利用の選択肢をドキュメント化)。

## 5. 優先度別アクション

**即対応(バグ)**
1. diff.ts のカラム追加修正 + 正向/ロールバックを分離して検証するテスト強化
2. generateMigrationSQL の方言分岐(または PG 専用と明示して他DBでエラー)
3. Column.type に長さ/精度を含める(アダプタ+codegen 型マップ同時改修)

**早急(セキュリティ)**
4. serve の認証/localhost 縛り、buildHtml と接続履歴の HTML エスケープ
5. パスワード保存の扱い見直し

**中期的(構造)**
6. webServer.ts の分割、アダプタのクエリ一括化
7. strict:true 化 + any 排除、require()→import()
8. 自己CI(build+test)追加、テンプレートCI の npm ci 化
9. アダプタテスト、LICENSE 追加、バージョン統一
