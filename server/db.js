
import initSqlJs from 'sql.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, 'data');
const dbPath = path.join(dataDir, 'agent-studio.db');

fs.mkdirSync(dataDir, { recursive: true });

const SQL = await initSqlJs({
  locateFile: (file) => `./node_modules/sql.js/dist/${file}`,
});

let db;

if (fs.existsSync(dbPath)) {
  const fileBuffer = fs.readFileSync(dbPath);
  db = new SQL.Database(fileBuffer);
} else {
  db = new SQL.Database();
}

// 启用 SQLite 外键约束。
db.run('PRAGMA foreign_keys = ON');

// ================================
// 1. Agent 主表
// ================================

db.run(`
  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    model TEXT NOT NULL DEFAULT '未配置',
    status TEXT NOT NULL DEFAULT '草稿'
      CHECK (status IN ('运行中', '已停用', '草稿')),
    updated_at TEXT NOT NULL
  )
`);

// 兼容旧数据库：自动补充 system_prompt 字段。
const columnsResult = db.exec('PRAGMA table_info(agents)');
const columns = columnsResult[0]?.values ?? [];
const hasSystemPrompt = columns.some(
  (column) => column[1] === 'system_prompt'
);

if (!hasSystemPrompt) {
  db.run(`
    ALTER TABLE agents
    ADD COLUMN system_prompt TEXT NOT NULL DEFAULT ''
  `);
}

// ================================
// 2. Agent 提示词历史版本表
// ================================

db.run(`
  CREATE TABLE IF NOT EXISTS agent_prompt_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT NOT NULL,
    version_number INTEGER NOT NULL,
    system_prompt TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    UNIQUE (agent_id, version_number)
  )
`);

db.run(`
  CREATE INDEX IF NOT EXISTS idx_prompt_versions_agent
  ON agent_prompt_versions (agent_id, version_number)
`);

// ================================
// 3. 平台模型配置表
// 保存模型基本信息，不保存明文 API Key。
// ================================

db.run(`
  CREATE TABLE IF NOT EXISTS model_catalog (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    provider TEXT NOT NULL,
    model_name TEXT NOT NULL,
    base_url TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    is_enabled INTEGER NOT NULL DEFAULT 1
      CHECK (is_enabled IN (0, 1)),
    is_default INTEGER NOT NULL DEFAULT 0
      CHECK (is_default IN (0, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`);

db.run(`
  CREATE INDEX IF NOT EXISTS idx_model_catalog_provider
  ON model_catalog (provider)
`);

// ================================
// 4. 模型密钥表
// 预留加密后的 API Key 存储。
// 当前版本不会自动加密或写入密钥。
// ================================

db.run(`
  CREATE TABLE IF NOT EXISTS model_secrets (
    model_id TEXT PRIMARY KEY,
    encrypted_api_key TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (model_id)
      REFERENCES model_catalog (id)
      ON DELETE CASCADE
  )
`);

// ================================
// 5. 用户模型关联表
// 为后续注册、权限隔离和个人默认模型预留。
// 当前项目尚未实现用户认证。
// ================================

db.run(`
  CREATE TABLE IF NOT EXISTS user_model_configs (
    id TEXT PRIMARY KEY,
    owner_user_id TEXT NOT NULL,
    model_id TEXT NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 0
      CHECK (is_default IN (0, 1)),
    created_at TEXT NOT NULL,
    UNIQUE (owner_user_id, model_id),
    FOREIGN KEY (model_id)
      REFERENCES model_catalog (id)
      ON DELETE CASCADE
  )
`);

db.run(`
  CREATE INDEX IF NOT EXISTS idx_user_model_configs_owner
  ON user_model_configs (owner_user_id)
`);

// ================================
// 6. 数据库持久化
// ================================

function saveDatabase() {
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

function closeDatabase() {
  saveDatabase();
  db.close();
}

// 保存数据库初始化结果。
saveDatabase();

export { db, saveDatabase, closeDatabase };
