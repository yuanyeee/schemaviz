# SchemaViz（中文）

> Other languages: [日本語](./README.ja.md) | [English](./README.en.md)

SchemaViz 是一个 TypeScript CLI 工具，用于数据库 Schema 的提取、可视化、校验、差异比较、代码生成与快照历史管理。

## 功能（与当前实现一致）

- Schema 提取（`extract`）：PostgreSQL / MySQL / SQLite / SQL Server
- ER 图生成（`diagram`）：Mermaid / PlantUML
- 图片导出（`.png` / `.svg` / `.pdf`，基于 Mermaid 渲染）
- Schema 对比与迁移 SQL 生成（`diff`）
- Schema 校验（`validate`）
- 交互式 Web UI（`serve`）
- 代码生成（`generate`）：Prisma / TypeORM / GraphQL
- 快照历史（`snapshot` / `history`）

## 安装

```bash
git clone https://github.com/yuanyeee/schemaviz.git
cd schemaviz
npm install
npm run build
```

运行 CLI：

```bash
node dist/index.js --help
# 或
npm link
schemaviz --help
```

## Web 使用方式（重点）

`serve` 支持两种模式。

### 1）指定 schema 文件启动（跳过登录页）

```bash
schemaviz serve -s schema.json -p 3000
# 打开 http://localhost:3000
```

- 启动时直接加载 schema JSON，进入 ER 图页面。
- 加 `--watch` 可在每次请求时重新读取 schema 文件。

### 2）不指定 `-s` 启动（通过登录页连接数据库）

```bash
schemaviz serve -p 3000
# 打开 http://localhost:3000
```

- 会显示登录页，输入数据库连接信息后连接。
- 连接成功后进入 ER 图页面。

### `serve` 参数

- `-s, --schema <path>`：预加载 schema JSON
- `-p, --port <port>`：端口（默认 `3000`）
- `-H, --host <host>`：绑定主机（默认 `localhost`）
- `-w, --watch`：每次请求重新加载 schema

### Web 界面的主要能力

- Mermaid / PlantUML 切换
- Validate / Generate / Snapshot / Diff 面板
- 表搜索、表详情、SVG 下载、主题切换、断开连接

## 常用命令

```bash
schemaviz extract -c examples/postgresql.yaml -o schema.json
schemaviz diagram -s schema.json -o er.md
schemaviz validate -s schema.json
schemaviz diff -s1 schema_old.json -s2 schema_new.json -m migration.sql
schemaviz generate -s schema.json -f prisma -o schema.prisma
schemaviz snapshot -s schema.json -t v1
schemaviz history list
```

## 说明

- 图片导出依赖 Puppeteer，部分环境需要额外配置 Chromium。
- 迁移 SQL 为通用模板，针对特定数据库方言可能需要手动调整。
