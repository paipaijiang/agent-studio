
import { db } from '../db.js';

// 查询多条记录
export function queryAll(sql, params = []) {
  const statement = db.prepare(sql);

  try {
    statement.bind(params);
    const rows = [];

    while (statement.step()) {
      rows.push(statement.getAsObject());
    }

    return rows;
  } finally {
    statement.free();
  }
}

// 查询单条记录
export function queryOne(sql, params = []) {
  return queryAll(sql, params)[0] ?? null;
}

// 查询单个 Agent
export function getAgent(id) {
  return queryOne(
    `SELECT id, name, description, model, status, updated_at, system_prompt
     FROM agents
     WHERE id = ?`,
    [id]
  );
}

// 查询单个模型
export function getModel(id) {
  return queryOne(
    `SELECT id, name, provider, model_name, base_url, description,
            is_enabled, is_default, created_at, updated_at
     FROM model_catalog
     WHERE id = ?`,
    [id]
  );
}

// 将数据库字段转换为前端使用的 camelCase 格式
export function formatModel(row) {
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    modelName: row.model_name,
    baseUrl: row.base_url,
    description: row.description,
    isEnabled: Boolean(row.is_enabled),
    isDefault: Boolean(row.is_default),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
