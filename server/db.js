
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
// 不保存明文 API Key。
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
// 仅用于存储后续实现的加密密钥。
// 不能直接把明文 API Key 写入此表。
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
// 为用户个人模型配置预留。
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
// 6. 用户账号表
// 密码只存安全哈希，不存明文。
// role 由后端控制，不能信任前端传值。
// ================================

db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL COLLATE NOCASE UNIQUE,
    email TEXT COLLATE NOCASE UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user'
      CHECK (role IN ('user', 'admin')),
    status TEXT NOT NULL DEFAULT 'active'
      CHECK (status IN ('active', 'disabled')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_login_at TEXT
  )
`);

db.run(`
  CREATE INDEX IF NOT EXISTS idx_users_role_status
  ON users (role, status)
`);

// ================================
// 7. 邀请码表
// 只存邀请码的哈希，不存可直接使用的明文令牌。
// created_by 为创建邀请的管理员。
// used_by 为成功使用邀请的用户。
// ================================

db.run(`
  CREATE TABLE IF NOT EXISTS invitations (
    id TEXT PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    created_by TEXT NOT NULL,
    used_by TEXT,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    revoked_at TEXT,
    FOREIGN KEY (created_by)
      REFERENCES users (id)
      ON DELETE RESTRICT,
    FOREIGN KEY (used_by)
      REFERENCES users (id)
      ON DELETE RESTRICT
  )
`);

db.run(`
  CREATE INDEX IF NOT EXISTS idx_invitations_creator
  ON invitations (created_by, created_at)
`);

db.run(`
  CREATE INDEX IF NOT EXISTS idx_invitations_expiry
  ON invitations (expires_at, used_at, revoked_at)
`);

// ================================
// 8. 登录会话表
// 只存会话令牌的哈希。
// 支持过期、退出登录和主动撤销。
// ================================

db.run(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    last_seen_at TEXT,
    revoked_at TEXT,
    FOREIGN KEY (user_id)
      REFERENCES users (id)
      ON DELETE CASCADE
  )
`);

db.run(`
  CREATE INDEX IF NOT EXISTS idx_sessions_user
  ON sessions (user_id, created_at)
`);

db.run(`
  CREATE INDEX IF NOT EXISTS idx_sessions_expiry
  ON sessions (expires_at, revoked_at)
`);

// ================================
// 9. 数据库持久化
// ================================

function saveDatabase() {
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

function closeDatabase() {
  saveDatabase();
  db.close();
}

// 保存新增表结构及数据库初始化结果。
saveDatabase();

export { db, saveDatabase, closeDatabase };
