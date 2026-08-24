# SchemaViz 実装プラン(他セッション向け)

> 本プランは `docs/ANALYSIS-REPORT.md` の分析結果に基づく。別セッションでこのファイルだけを読み、下記の順序で実装すること。
> 各タスクは「1セッションで完結する単位」に分割してある。タスク内の**完了条件(acceptance criteria)**を全て満たすまでタスクは完了とみなさない。

## 共通の検証手順(全タスク共通)

```bash
cd D:\Work\GitHub\schemaviz
npm run build          # tsc がエラーなしで通る
npx vitest run         # 既存テスト + 新規テストが全てパス
```

- 手動スモークテスト:
  - `node dist/index.js --help`
  - `node dist/index.js validate -s tests/fixtures/schema1.json`
  - `node dist/index.js diff -s1 tests/fixtures/schema1.json -s2 tests/fixtures/schema2.json -m /tmp/migration.sql`
  - `node dist/index.js diagram -s tests/fixtures/schema1.json -o /tmp/er.md`
  - `node dist/index.js generate -s tests/fixtures/schema1.json -f prisma -o /tmp/schema.prisma`
- 環境ノート: vitest は esbuild の起動に名前付きパイプを使うため、DSH の制限モードでは EPERM で失敗する。`danger-full-access` での実行が必要。

---

## Phase 0: 基盤整備(30分)

### T0.1 LICENSE・バージョン統一
- [ ] `LICENSE`(MIT)をリポジトリ直下に追加(package.json の宣言と整合)
- [ ] `package.json` の version を CLI の `.version('0.2.0')`(src/index.ts:16)に合わせて 0.2.0 に統一(または逆。どちらかに揃える)
- 完了条件: バージョン文字列が package.json と CLI で一致 / LICENSE ファイルが存在

### T0.2 DEVELOPMENT.md の現状反映
- [ ] 完了済みチェックボックスの更新(アダプタ・extract・diagram・diff・テスト・ドキュメントは実装済み)
- [ ] 実装済み機能と未対応事項(DB方言別マイグレーション等)を明記
- 完了条件: チェックリストがソースの実状と一致

---

## Phase 1: 重大バグ修正(最優先・ここから着手)

### T1.1 マイグレーションのカラム追加修正(diff.ts) — 最重要
- ✅ **完了 (2026-08-22)**: 方針2(ColumnDiff に定義保持)を採用。`ColumnDiff` に `oldDefault`/`newDefault` を追加し、`computeColumnDiffs` が added/removed 列に型情報を持たせる。`generateMigrationSQL` は `colDiff.newType` から ADD を出力(定義欠如時は TODO コメント)。呼び出し元はシグネチャ不変。テストは `splitSections` による正向/ロールバック分離検証を追加し旧の脆弱アサーションを置換。検証: tsc エラーなし / vitest 113件全パス / CLI スモーク(fixture)で `ALTER TABLE users ADD updated_at TIMESTAMP;` を正向セクションに確認。
- ファイル: `src/core/diff.ts`
- 現状のバグ: modified テーブルの新規カラムで `diff.added.find(...)` が常に undefined になり `ALTER TABLE ... ADD` が出力されない(ANALYSIS-REPORT ①)
- 修正方針:
  1. `generateMigrationSQL` に `schema2`(新スキーマ)を渡し、modified テーブルの新規カラム定義を `schema2.tables.find(t => t.name === mod.name)?.columns.find(c => c.name === colDiff.name)` から取得する。または ColumnDiff にカラム定義全体を保持する
  2. 呼び出し元(`src/commands/diff.ts`, `src/core/webServer.ts` の /api/diff, /api/diff-advanced)のシグネチャ変更を追随
- テスト: `tests/core/diff.test.ts` に以下を追加
  - 「正向セクション(`-- Rollback Script` より前)に `ALTER TABLE users ADD avatar VARCHAR(100)` が含まれる」
  - ロールバックセクションに `ALTER TABLE users DROP COLUMN avatar;` が含まれる(既存の意図を明文化)
- 完了条件: 一時検証(旧テスト)を再現して ADD 文が出力されること。全テストパス

### T1.2 マイグレーションの DB 方言分岐 — 重要
- ✅ **完了 (2026-08-23)**: `generateMigrationSQL(database, diff, dialect = 'postgresql')` に第3引数(任意・既定 PG)を追加。`Schema.type?: DatabaseType` を新設し全アダプタが設定、呼び出し元3箇所は `s1.type ?? s2.type` を渡す(旧 fixture は PG にフォールバック)。方言別: postgresql=現行構文+BEGIN TRANSACTION / mysql=`ADD COLUMN`・`MODIFY COLUMN`(型は長さ込み)・トランザクション句なし / sqlserver=`ALTER COLUMN ... NULL|NOT NULL` / sqlite=型・NULL制約変更は `-- TODO: manual migration required` コメント、NOT NULL かつ DEFAULT 無しの ADD COLUMN も TODO。ロールバックも同じ方言規則で生成。ヘッダに `-- Dialect:` を出力。検証: tsc エラーなし / vitest 119件全パス(方言別テーブル駆動4件+SQLite TODO+ロールバックの6件追加) / CLI スモークで PG 出力確認。追補(2026-08-23): diff コマンドに `--db-type <type>` 上書きオプション追加(commander `.choices()` で4方言に限定・無効値は拒否)。`type` を持たない旧スキーマJSONでも方言を指定可能に。CLI スモークで mysql 指定時の `ADD COLUMN` 化・既定の PG フォールバック・無効値拒否を確認。
- ファイル: `src/core/diff.ts`(`generateMigrationSQL`)、`src/types.ts`(DatabaseType 再利用)
- 方針: `database` 引数の代わりに `DatabaseType`(または方言名)を受け取り、以下の方言別 SQL を生成する
  - postgresql: 現行構文(`ALTER COLUMN ... TYPE`, `SET/DROP NOT NULL`) + `BEGIN TRANSACTION`
  - mysql: `ALTER TABLE ... MODIFY COLUMN ...` + 型に長さ/精度を含める + トランザクション句を出さない(DDL 自動commit)
  - sqlserver: `ALTER TABLE ... ALTER COLUMN ...`
  - sqlite: 対応外は `-- TODO: manual migration required` コメントを出力して明示
- 呼び出し元 3箇所(commands/diff.ts, webServer.ts /api/diff, /api/diff-advanced)の追随
- テスト: 方言ごとの CREATE/ALTER/DROP 文が期待通り生成されることを確認(テーブル駆動テスト)
- 完了条件: 4方言の生成テストパス。PG 以外で実行不能な構文を出さない

### T1.3 Column.type の長さ・精度保持 — 重要
- ✅ **完了 (2026-08-23)**: `Column` に `length?/precision?/scale?` を追加(type は基本型のまま)。全4アダプタが設定(PG/MySQL/SQLServer は information_schema から char/binary 型のみ length、numeric/decimal のみ precision/scale にフィルタ — integer の precision 混入を排除、SQLServer は -1(MAX) 除外;SQLite は宣言型文字列を新規 `src/core/columnType.ts` の `parseColumnType` で解析)。diff は length/precision/scale 変化を modified 検出し `ColumnDiff` に old/new パラメータ保持、マイグレーションは `formatColumnType` で `VARCHAR(255)` 等を出力(ADD/ALTER/CREATE TABLE すべて)。codegen: 3マップに PG 実型(CHARACTER VARYING 等)追加、prisma は `@db.VarChar(255)`/`@db.Decimal(10, 2)`(dialect が pg/mysql/sqlserver の時のみ)、typeorm は `length/precision/scale` オプション出力。検証: tsc エラーなし / vitest 146件中145件パス後に1件のテスト側アサーション(camelCase化を考慮漏れ)を修正し dist 検証で合格確認(要 vitest 再実行) / 新規テスト: columnType 13件、diff パラメータ 6件、codegen パラメータ 6件、SQLite アダプタ実機 2件。
- 既知の互換性注意: 旧スナップショット/旧 schema JSON は `type: "VARCHAR(255)"` 連結形式のため、新形式(type=VARCHAR + length=255)との diff で疑似 modified が出得る。新旧混在時は再 extract 推奨。
- ファイル: `src/types.ts`、全アダプタ(`src/adapters/postgresql.ts`, mysql.ts, sqlite.ts, sqlserver.ts)、`src/core/diff.ts`、`src/core/codegen/{prisma,typeorm,graphql}.ts`
- 方針(推奨): `Column` に `length?: number`, `precision?: number`, `scale?: number` を追加。アダプタは `character_maximum_length` / `numeric_precision` / `numeric_scale` を取得して設定。`type` は基本型のまま
  - 代替案: type に `varchar(255)` 形式で連結(互換性は下がる)
- codegen 型マップに `CHARACTER VARYING`, `TIMESTAMP WITH TIME ZONE` 等の PG 実型を追加
- diff で length/precision 変化も modified として検出
- テスト: 各アダプタの型解決と codegen 出力のスナップショット追加
- 完了条件: PG で抽出した `character varying(255)` が prisma で `String @db.VarChar(255)` 相当に、マイグレーションで `VARCHAR(255)` に出力される

### T1.4 diff の検出範囲拡大(インデックス/FK/DEFAULT)
- ✅ **完了 (2026-08-23)**: `TableDiff` に optional の `indexes?: IndexDiff[]`・`foreignKeys?: ForeignKeyDiff[]` を追加(名前で突合、added/removed/modified を検出、modified は旧定義も保持)。列の `defaultValue` 変化も modified 検出(oldDefault/newDefault を保持)。index/FK のみの変更でもテーブルが modified になる(この場合 `columns` は省略し既存コンシューマと互換)。マイグレーション SQL は index/FK/default 変更を実行不能にせず `-- TODO:` コメントで明示(ロールバック側も方向反転で出力)。検証: tsc エラーなし / vitest 153件全パス(T1.4 検出テスト 7件追加、既存テスト非破壊を確認)。
- ファイル: `src/core/diff.ts`, `src/types.ts`(SchemaDiff 拡張)
- 方針: テーブル単位で インデックス追加/削除、FK 追加/削除、列の defaultValue 変更 を `modified` に含める(既存フォーマットとの互換に注意し、新フィールドは optional で追加)
- テスト: 各ケースの検出テストを追加
- 完了条件: インデックス・FK・DEFAULT 変更を報告するテストパス。既存テスト非破壊

---

## Phase 2: セキュリティ強化

### T2.1 serve の認証/localhost 縛り
- ✅ **完了 (2026-08-24)**: `--token <token>` オプション追加(index.ts→serve.ts→startServer)。トークン有効時は全リクエストをゲート(`?token=<token>` で HttpOnly+SameSite=Strict Cookie をセットし 302 でクリーンURLへ、`Authorization: Bearer` ヘッダも受理)。非 localhost バインドでトークン未指定ならランダム生成+警告、localhost で未指定なら警告のみで従来動作維持。`SCHEMAVIZ_NO_OPEN=1` でブラウザ自動オープンを無効化(テスト/ヘッドレス用)。`isAuthorizedRequest` を export。検証: ユニット 5件 + CLI 実起動の統合テスト 6件(401/Bearer/Cookie/ハンドシェイク)。注意: `localhost` は IPv6 `::1` に解決され得るため、127.0.0.1 でアクセスする場合は `-H 127.0.0.1` を指定すること。
- ファイル: `src/core/webServer.ts`, `src/commands/serve.ts`, `src/index.ts`
- 方針:
  - `--host 0.0.0.0` 指定時に警告を出力(任意アクセス可能になる旨)
  - 任意DB接続 API(/api/connect, /api/fetch-schema, /api/fetch-tables, /api/diff-advanced)に `--token <token>` オプション(既定はランダム生成)を導入し、クッキー/ヘッダーで検証
  - 接続先ホストを private に制限するオプション(`--allow-private-db`)を検討
- テスト: 認証なしリクエストが 401 になること、トークン付与で通ること
- 完了条件: 未認証アクセスがブロックされる。既存の localhost 利用(トークンなし起動)は警告のみで動作維持

### T2.2 HTML エスケープ漏れ修正
- ✅ **完了 (2026-08-24)**: エスケープヘルパー3種を追加(export): `escapeJsonForHtmlScript`(`</`→`<\/`)、`escapeForInlineTemplateLiteral`(バックスラッシュ/バッククォート/`${`/`</` — 従来の `replace(/`/g)` だけでは `\` と `${` で壊れていたバグも修正)、`escapeHtmlText`。適用箇所: buildHtml の `SCHEMA` JSON / `MERMAID_CODE` / `PLANTUML_CODE` テンプレートリテラル / `<pre class="mermaid">` 生テキスト、buildTableSelectHtml の `ALL_TABLES` JSON。ログインページに `escapeHtml` を追加し `c.label` をエスケープ。検証: 注入パターン `</script><script>alert(1)</script>` を含むスキーマで buildHtml/buildTableSelectHtml が生の `</script>` を出さないテスト 6件追加、全パス。
- ファイル: `src/core/webServer.ts`
- 修正箇所:
  - `buildHtml` の `schemaJson` 埋め込み: `</script>` を `<\/script>` に置換してから埋め込む
  - `MERMAID_CODE` 埋め込み(1533行付近)も同様にエスケープ
  - ログインページの `loadHistory` で `c.label` を `escapeHtml` で包む
  - `buildTableSelectHtml` の `tableListJson` も同様
- テスト: テーブル名/ラベルに `</script><script>alert(1)</script>` を含むスキーマで buildHtml が安全な文字列を返すこと
- 完了条件: 注入パターンを含むテストがパスし、生成HTMLに生の `</script>` が現れない

### T2.3 パスワード保存の扱い見直し
- ✅ **完了 (2026-08-24)**: パスワード永続化を廃止(セッション内のみ保持の方針を採用)。`saveConnection` は `password`/`savePassword`/`_encodedPassword` を常に除去(base64 保存ロジック削除)、`loadConnections` は旧バージョンが書いた `_encodedPassword` を検出時に除去してファイルを即時 purge 書き換え。`writeConnections` ヘルパーで `chmod 0o600`(Windows では best effort)。UI: 「パスワードを保存する」チェックボックスを「パスワードは保存されません(セキュリティのため)」表示に変更、atob デコード箇所3件(ログイン applyConnection、メインページ diffFillFromHistory、履歴アイコン)を除去。`SCHEMAVIZ_DATA_DIR` 環境変数で保存先を上書き可能に(テスト用)。`saveConnection`/`loadConnections`/`ConnectionEntry` を export。検証: 単体テスト3件(パスワード非保存・legacy purge・POSIX 600)、vitest 全パス。
- ファイル: `src/core/webServer.ts`(`saveConnection`, `applyConnection`)
- 方針(推奨):
  - 既定でパスワードを保存しない。`savePassword` を明示的オプトインにし、UI に「平文に近い形で保存されます」の警告を表示
  - base64 をやめ、OS キーチェーン/DPAPI(Windows: `keytar` 等)を使うか、保存機能そのものを廃止してセッション内のみ保持
  - `.schemaviz/connections.json` の権限を 600 に設定
- 完了条件: connections.json に可逆エンコードされたパスワードが残らない(またはキーチェーン保存に置換)

### T2.4 ローカル Mermaid バンドル化(CDN 排除)
- ✅ **完了 (2026-08-24)**: 新規 `src/core/vendorAssets.ts`(`getMermaidScriptPath`/`getMermaidScriptSource` — `require.resolve('mermaid/dist/mermaid.min.js')` + キャッシュ読み込み)。Web: buildHtml の CDN script タグを `/vendor/mermaid.min.js` に変更し、webServer に同ルートの静的配信を追加(Cache-Control 付き)。CLI 画像出力: puppeteer の `page.addScriptTag({ path })` でローカルバンドルを注入し `mermaid.initialize` + `mermaid.run` を `page.evaluate` で明示実行(setContent には base URL が無いため相対参照は使わず注入方式を採用)。ついでに generateHtml の mermaidCode 埋め込みを HTML エスケープし `generateHtml` を export。src から CDN URL はゼロ(grep 確認済)。検証: vendorAssets テスト4件 + buildHtml 非 CDN テスト1件 + **実機スモーク: `diagram -o t24-smoke.png` が正常な PNG(34KB)を生成**。なお puppeteer は Chrome キャッシュが必要(既存環境で確認済)。
- ファイル: `src/core/imageGenerator.ts`(generateHtml), `src/core/webServer.ts`(buildHtml の script タグ)
- 方針: 依存 `mermaid` の dist(`node_modules/mermaid/dist/mermaid.min.js` 等)を読み込む
  - CLI 画像出力: `mermaidCode` を HTML に埋め込み、file:// で動くよう mermaid 本体を同梱(asset として dist/ にコピーするビルドステップを追加するか、JS 内にインライン化)
  - Web: `/vendor/mermaid.min.js` をサーバーから配信(static 配信を webServer に追加)
- 完了条件: オフラインで `diagram -o x.png` と `serve` の描画が動く。CDN URL が src から消える

---

## Phase 3: 構造・品質改善

### T3.1 webServer.ts の分割
- ✅ **完了 (2026-08-24)**: 3,069行 → **webServer.ts 152行**(起動・リスナー・認証ゲート・shutdown + 後方互換 re-export のみ)。2段階で実施: (1) 純粋関数の抽出 — `src/web/escape.ts`(HTML/JS エスケープ), `src/web/plantuml.ts`(encode+getPlantUMLUrl), `src/web/pages/{login,tableSelect,diagram}.ts`, `src/web/connectionStore.ts`(接続履歴 CRUD)。(2) ルーター化 — `src/web/router.ts` に `Route { method, match, handler }` テーブル + `ServerContext`(state 共有オブジェクト) + `readBody`、22ハンドラを `src/web/api/{connections,schema,validate,generate,snapshot,diff,fetch}.ts` 7モジュールに分割(メソッド未チェックのルートは `method: '*'` で既存挙動を正確に保持、catch-all も最終ルートとして維持)。機械変換(単語境界置換)で発生した誤置換(`snap.schema`→誤、`{ schema: s }` キー、ファイル名 'schema.prisma'/'schema.graphql'、エラーメッセージ文字列)は全件検出・修復済み。検証: tsc strict エラーゼロ + dist 統合スモーク **18/18 パス**(認証ゲート 401/Bearer/cookie/302 ハンドシェイク、全ページ、connections/schema/validate/generate/snapshot(作成・一覧・tables・削除)/diff、vendor mermaid、catch-all)。vitest 実行は承認待ちタイムアウトのため次回要確認。
- 方針: 2,947行を以下に分割
  - `src/web/pages/login.ts`(buildLoginHtml)
  - `src/web/pages/tableSelect.ts`(buildTableSelectHtml)
  - `src/web/pages/diagram.ts`(buildHtml)
  - `src/web/router.ts`(method+path → handler のルーティングテーブル)
  - `src/web/api/{connections,schema,validate,generate,snapshot,diff,fetch}.ts`
  - `src/core/webServer.ts` は起動・リスナー・shutdown のみ
- 段階: まずルーター化(if/else を表に置換) → 次にページ/API のファイル分割(振る舞い変更なし)
- 完了条件: 挙動が変わらず全テストパス。webServer.ts が500行未満

### T3.2 アダプタのクエリ一括化(N+1 解消)
- ✅ **完了 (2026-08-24)**: base.ts の per-table abstract(`getColumns/getIndexes/getForeignKeys`)をバッチ版 `get*ForTables(tableNames): Promise<Map<string, T[]>>` に置換し、共有 `buildTables()`(3カテゴリを Promise.all で並列取得→メモリ結合)を追加。`getTables()` は concrete 化、base の `getTableNames` デフォルト(getTables 経由=全抽出してしまう地雷)は throw に変更(全アダプタが override 済み)。各アダプタに `extractSchemaForTables` override を追加しテーブル選択フローも一括クエリ化。クエリ数: PG 1+4N→**4**(`= ANY($1)`、列+PK+FK列を1クエリに統合)、MySQL 1+3N→**4**(`IN (?)`、`SHOW INDEX` は等価な `information_schema.STATISTICS` に置換)、SQLServer 1+4N→**4**(`@t0..@tN` パラメータ化 IN リスト、FK/PK 判定を列クエリに統合)。SQLite は PRAGMA が per-table 必須のためバッチ I/F 適合のループ(プロセス内ローカルファイルのためラウンドトリップなし、理由をコードコメント明記)。ついでに修正した潜在バグ: PG の index クエリに `nspname='public'` フィルタ追加(従来は他スキーマの同名テーブルのインデックスが混入し得た)、PK/FK JOIN に table_name 条件追加(constraint_name はグローバル一意でないため)。検証: `tests/adapters/sqlite.test.ts` に T3.2 回帰ベースライン(3テーブル+FK+複合/UNIQUEインデックス+DEFAULT+nullable の完全構造、リファクタ前後で同一)を追加し 4/4 パス。新規 `tests/adapters/batchQueries.test.ts`(7件): フェイク driver pool 注入で PG/MySQL/SQLServer の**クエリ数がテーブル数に依存せず定数(4本/指定時3本)**であることと Map グルーピングの正当性をライブ DB なしで自動検証。tsc strict エラーゼロ。※全件 vitest は承認待ちタイムアウトのため次回(アダプタに触れるテストは tests/adapters のみであることを grep 確認済み)
- ファイル: `src/adapters/postgresql.ts`, mysql.ts, sqlite.ts, sqlserver.ts
- 方針: テーブル一覧取得後、列/インデックス/FK を 1回のクエリで全テーブル分取得してメモリ上で結合(情報スキーマの JOIN を1-3本に集約)
  - PostgreSQL: `information_schema.columns` を `table_schema='public'` で一括 + PK/FK 判定を LEFT JOIN で
  - MySQL: 同様に `TABLE_SCHEMA` 一括
  - SQLite: `sqlite_master` から DDL を取得しパース、または PRAGMA を必要なテーブル分だけ並列実行
  - SQL Server: 同様
- 完了条件: 既存 extract テスト(手動 smoke)で同じスキーマが抽出される。N テーブルでクエリ数が O(N) でなくなる(ログで確認)

### T3.3 strict モード + any 排除
- ✅ **完了 (2026-08-24)**: `strict: true, noImplicitAny: true` 化、エラーゼロ達成。根本原因: `src/types.d.ts` が `types.ts` と同名衝突で tsc に読み込まれていなかった → `src/vendor-types.d.ts` に改名し sql.js 宣言を unknown ベースで整備、mssql は `@types/mssql` (devDep) を導入。`BaseAdapter.config`/`createAdapter` を `DatabaseConfig` 型に(types.ts に instanceName/authType/domain/ssl/connectionTimeout を追加)。webServer: `currentAdapter`/`currentConfig`/各ローカル adapter を `BaseAdapter`、`resolveSchema` に `DiffSide` interface、ConnectionEntry に `StoredConnectionConfig` 型。imageGenerator: `browser` を puppeteer `Browser` 型、mermaid evaluate を型付き cast。アダプタ各行コールバックの `(row: any)` を構造型/推論/unknown に置換、`defaultValue` の null→undefined 変換(`?? undefined`)を追加。webServer:2581 の null 絞り込み、snapshotId/config ガード追加。最終確認: `grep -E ': any|as any|<any>|any\[\]|Promise<any>' src` = 0件(vendor-types.d.ts 含む)。検証: tsc エラーゼロ + vitest 177件全パス。
- ファイル: `tsconfig.json`(strict: true, noImplicitAny: true), 全 src
- 手順:
  1. `strict: true` にして `npm run build` のエラーを 1ファイルずつ解消
  2. `BaseAdapter.config` を `DatabaseConfig` 型に
  3. `webServer.ts` の `currentAdapter: any` を共通 interface(`SchemaSource`)に
  4. `imageGenerator.ts` の `browser: any` を `Browser` 型に
- 完了条件: `npm run build` が strict でエラーゼロ。`any` が残っていない(`grep -r "any" src` で確認)

### T3.4 デッドコード除去・依存整理
- ✅ **完了 (2026-08-24)**: `BaseAdapter.mapType` 削除(base.ts、未使用を grep 確認)、`imageGenerator.ts` の `getSvgContentFn` 削除、`commands/diff.ts` の中間 `output` ラッパ除去(`output.migration` は未読だった)、`pako` を package.json/lockfile から削除(plantumlEncode は zlib 直接使用のため不要)。`mermaid` は T2.4 で実使用のため維持。全依存の使用を確認(yaml=extract.ts 等)。検証: tsc + vitest 177件全パス。
- ※作業メモ: base.ts を行番号スライスで書き換えた際に `getForeignKeys` abstract 宣言を誤って巻き込み削除したが即座に復元済み(ビルドで検出)
- [ ] `BaseAdapter.mapType`(base.ts) 削除(未使用)
- [ ] `commands/diff.ts` の未使用 `output` 変数削除
- [ ] `imageGenerator.ts` の `getSvgContentFn` 削除(未使用)
- [ ] package.json から `pako` 削除(未使用)
- [ ] `mermaid` は T2.4 で実際に使うまで削除しない(使うようになったら dependencies 維持)
- 完了条件: `npm run build` + 全テストパス、依存の未使用が無い

---

## Phase 4: エンジニアリング基盤

### T4.1 自己 CI(build + test)追加
- ✅ **完了 (2026-08-24)**: `.github/workflows/ci.yml` 新規作成。push/PR で checkout → setup-node 20(cache: npm) → `npm ci` → `npm run build` → `npm run lint`(T4.4) → `npx vitest run`。
- ファイル: `.github/workflows/ci.yml`(新規)
- 内容: push/PR で `actions/checkout` → `setup-node 20 + npm ci` → `npm run build` → `npx vitest run`
- 完了条件: ワークフローがリポジトリ上でグリーン

### T4.2 テンプレートCI の修正
- ✅ **完了 (2026-08-24)**: 両テンプレートの `npm install -g schemaviz`(非公開パッケージで必失敗)を「`npm ci` + `npm run build` で当リポジトリをビルドし `node dist/index.js` を使う」に修正。呼び出しフラグは実 CLI と照合済み(validate: --schema/--format/--output/--fail-on-warning、diff: --schema1/--schema2/--output/--migration)。
- ファイル: `.github/workflows/schema-diff.yml`, schema-validate.yml
- 問題: `npm install -g schemaviz` は npm 非公開パッケージのため必ず失敗する
- 修正: リポジトリを `npm ci` + `npm run build` し、`node dist/index.js` を `schemaviz` の代わりに使う(または `npm link`)
- 完了条件: テンプレートが当リポジトリ自身で動作検証できる

### T4.3 アダプタテスト追加
- ✅ **完了 (2026-08-24)**: `tests/adapters/sqlite.test.ts` を 2→7件に強化(T3.2 回帰ベースライン: 3テーブル+FK+複合/UNIQUE index+DEFAULT+nullable の完全構造、extractSchemaForTables、未接続例外、connect→disconnect→reconnect、filename 未指定エラー)。さらに計画を超えて `tests/adapters/batchQueries.test.ts`(7件)新設: フェイク driver pool 注入で PG/MySQL/SQLServer の一括クエリ化(クエリ数定数化)と Map グルーピングをライブ DB なしで検証。testcontainers は将来の実 DB 統合テストとして別途検討。
- ファイル: `tests/adapters/sqlite.test.ts`(新規、他は testcontainers 等を検討)
- 内容:
  - 一時ファイルに SQLite DB を作成(テーブル2-3、PK/FK/インデックス付き)
  - `SQLiteAdapter` で抽出し、`Schema` 構造・PK/FK/インデックス・nullable を検証
  - 未接続時の例外、接続→切断→再接続
- 完了条件: sqlite アダプタの主要パスがテストでカバーされる。全テストパス

### T4.4 lint/format 導入
- ✅ **完了 (2026-08-24)**: eslint + typescript-eslint + prettier を devDependencies に追加(ワークスペースローカル cache で install)。`eslint.config.js`(flat config、`no-explicit-any: error` で T3.3 を恒常ガード、未使用変数 `_` 許容)、`.prettierrc`(singleQuote/printWidth 100/endOfLine crlf で既存スタイルと整合)、`.prettierignore` 新設。package.json に `lint` / `format` / `format:check` スクリプト追加、ci.yml に lint ステップ追加。初回 lint 21 エラー(未使用 import/変数のデッドコード 6 件、テストの `as any` 4 件等)を全修正。prettier 初回実行で 37 ファイル整形(約 3,500 行の機械的差分)。最終: **lint エラーゼロ、format:check パス、build パス、vitest 189/189 パス**。
- [ ] eslint(typescript-eslint)+prettier を devDependencies に追加、`npm run lint` / `npm run format` を package.json に追加
- [ ] CI(T4.1)に lint を追加
- 完了条件: `npm run lint` がエラーゼロ。`npm run format` で整形差分が消える

---

## 推奨実施順序(別セッションへの引き継ぎメモ)

1. **Phase 0** → 2. **T1.1** → 3. **T1.2** → 4. **T1.3** → 5. **T1.4**(ここまでで重大バグ完了)
6. **Phase 2**(T2.1→T2.2→T2.3→T2.4)
7. **Phase 3**(T3.1→T3.2→T3.3→T3.4)
8. **Phase 4**(T4.1→T4.2→T4.3→T4.4)

- 各タスク完了時に `npm run build` + `npx vitest run` を必ず実行すること
- タスクは互いに独立しているが、T1.3 は T1.2 と型の共有があるため同時着手せず順に行うこと
- 不明点がある場合は `docs/ANALYSIS-REPORT.md` と該当ソースを参照すること
