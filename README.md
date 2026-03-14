# SchemaViz

Database ER diagram generator and schema diff tool for developers.

![npm version](https://img.shields.io/npm/v/schemaviz)
![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)

## Features

- 📊 **Generate ER diagrams** from database schema
- 🔄 **Compare schemas** and show differences  
- 📝 **Generate migration scripts** with rollback support
- 🖼️ **Export to Mermaid** format
- 🗄️ **Support multiple databases**: PostgreSQL, MySQL, SQLite, SQL Server

## Installation

```bash
# Clone the repository
git clone https://github.com/yuanyeee/schemaviz.git
cd schemaviz

# Install dependencies
npm install

# Build
npm run build
```

## Usage

### Extract Schema

Extract database schema to JSON:

```bash
# Using YAML config
schemaviz extract -c examples/postgresql.yaml -o schema.json

# Using JSON config
schemaviz extract -c config.json -o schema.json
```

### Generate ER Diagram

Generate ER diagram from schema:

```bash
schemaviz diagram -s schema.json -o er.md
```

### Compare Schemas

Compare two schemas and generate migration:

```bash
# Compare and show diff
schemaviz diff -s1 schema1.json -s2 schema2.json

# Generate migration SQL
schemaviz diff -s1 schema1.json -s2 schema2.json -m migration.sql
```

## Configuration

### PostgreSQL

```yaml
type: postgresql
host: localhost
port: 5432
database: myapp
user: postgres
password: mypassword
```

### MySQL

```yaml
type: mysql
host: localhost
port: 3306
database: myapp
user: root
password: mypassword
```

### SQLite

```yaml
type: sqlite
filename: ./myapp.db
```

### SQL Server

```yaml
type: sqlserver
host: localhost
port: 1433
database: myapp
user: sa
password: mypassword
```

## Commands

| Command | Description |
|---------|-------------|
| `extract` | Extract schema from database |
| `diagram` | Generate ER diagram from schema |
| `diff` | Compare two schemas |

## Development

```bash
# Run tests
npm test

# Build
npm run build

# Run in development mode
npm run dev
```

## Project Structure

```
schemaviz/
├── src/
│   ├── index.ts           # CLI entry point
│   ├── types.ts           # TypeScript types
│   ├── commands/          # CLI commands
│   │   ├── extract.ts
│   │   ├── diagram.ts
│   │   └── diff.ts
│   └── adapters/          # Database adapters
│       ├── base.ts
│       ├── postgresql.ts
│       ├── mysql.ts
│       ├── sqlite.ts
│       └── sqlserver.ts
├── tests/                 # Test files
├── examples/              # Configuration examples
└── package.json
```

## Roadmap

- [x] PostgreSQL support
- [x] MySQL support
- [x] SQLite support
- [x] SQL Server support
- [ ] Generate PNG/SVG images
- [ ] VS Code extension
- [ ] GitHub Action for CI/CD

## License

MIT
