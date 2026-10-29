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

// Agent 主表：保留已有字段。
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

// 兼容旧数据库：没有 system_prompt 时自动添加。
const columnsResult = db.exec('PRAGMA table_info(agents)');
const columns = columnsResult[0]?.values ?? [];
const hasSystemPrompt = columns.some((column) => column[1] === 'system_prompt');

if (!hasSystemPrompt) {
  db.run(`
    ALTER TABLE agents
    ADD COLUMN system_prompt TEXT NOT NULL DEFAULT ''
  `);
}

// 新增提示词历史版本表。
// 每条记录对应一个 Agent 的一次提示词版本。
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

// 按 Agent 查询版本时使用。
db.run(`
  CREATE INDEX IF NOT EXISTS idx_prompt_versions_agent
  ON agent_prompt_versions (agent_id, version_number)
`);

function saveDatabase() {
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

function closeDatabase() {
  saveDatabase();
  db.close();
}

// 保存新增表结构。
saveDatabase();

export { db, saveDatabase, closeDatabase };
