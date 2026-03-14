# SchemaViz 开发计划

## 当前进度
- [x] 项目初始化
- [x] 基础 CLI 框架
- [ ] 数据库适配器实现
- [ ] Schema 提取功能
- [ ] ER 图生成功能
- [ ] Diff + 迁移脚本功能
- [ ] 完整测试
- [ ] 文档完善

---

## Phase 1: 数据库适配器

### 任务
实现 `src/adapters/` 目录下的数据库连接和 Schema 提取

### 文件清单
```
src/adapters/
├── index.ts        # 统一导出
├── base.ts         # 基础适配器抽象
├── postgresql.ts  # PostgreSQL 适配器
├── mysql.ts       # MySQL 适配器
├── sqlite.ts      # SQLite 适配器
└── sqlserver.ts   # SQL Server 适配器
```

---

## Phase 2: Schema 提取

### 任务
完善 `extract` 命令，实现真正的数据库连接

### 需要完成
- [ ] 读取配置文件（YAML/JSON）
- [ ] 根据数据库类型选择适配器
- [ ] 提取表结构、字段、主键、索引、外键
- [ ] 输出标准 Schema JSON

---

## Phase 3: ER 图生成

### 任务
完善 `diagram` 命令，支持更多输出格式

### 需要完成
- [ ] 优化 Mermaid 输出样式
- [ ] 支持 PNG/SVG 导出（需安装相关工具）
- [ ] 支持自定义模板

---

## Phase 4: Diff + 迁移脚本

### 任务
完善 `diff` 命令，生成迁移 SQL

### 需要完成
- [ ] 完善 Diff 算法
- [ ] 支持 SQL Server 语法
- [ ] 生成 ALTER TABLE 迁移脚本
- [ ] 生成回滚脚本

---

## Phase 5: 测试

### 任务
添加基本测试用例

### 文件清单
```
tests/
├── adapters/
│   └── database.test.ts
├── commands/
│   ├── extract.test.ts
│   ├── diagram.test.ts
│   └── diff.test.ts
└── fixtures/
    ├── schema1.json
    └── schema2.json
```

---

## Phase 6: 文档

### 任务
完善 README 和使用说明

---

## 下一步行动
1. 实现数据库适配器
2. 完善 extract 命令
3. 添加测试
4. 完成后通知用户
