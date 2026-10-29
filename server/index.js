import express from 'express';
import { db, saveDatabase } from './db.js';

const app = express();
const PORT = 3001;

app.use(express.json({ limit: '1mb' }));

// 统一读取查询结果
function queryAll(sql, params = []) {
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

function queryOne(sql, params = []) {
  return queryAll(sql, params)[0] ?? null;
}

// 获取 Agent 当前提示词
function getAgent(id) {
  return queryOne(
    `SELECT id, name, description, model, status, updated_at, system_prompt
     FROM agents WHERE id = ?`,
    [id]
  );
}

// 保存提示词历史版本。
// 内容没有变化时不重复创建版本。
function recordPromptVersion(agentId, prompt) {
  const latest = queryOne(
    `SELECT version_number, system_prompt
     FROM agent_prompt_versions
     WHERE agent_id = ?
     ORDER BY version_number DESC
     LIMIT 1`,
    [agentId]
  );

  if (latest && latest.system_prompt === prompt) {
    return latest.version_number;
  }

  const nextVersion = latest ? latest.version_number + 1 : 1;

  db.run(
    `INSERT INTO agent_prompt_versions
      (agent_id, version_number, system_prompt, created_at)
     VALUES (?, ?, ?, ?)`,
    [agentId, nextVersion, prompt, new Date().toISOString()]
  );

  return nextVersion;
}

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    message: 'Agent Studio 后端运行正常',
    timestamp: new Date().toISOString(),
  });
});

// 查询所有 Agent
app.get('/api/agents', (_req, res) => {
  try {
    const result = db.exec(`
      SELECT id, name, description, model, status, updated_at, system_prompt
      FROM agents
      ORDER BY updated_at DESC
    `);

    const agents = result.length
      ? result[0].values.map((row) => ({
          id: row[0],
          name: row[1],
          description: row[2],
          model: row[3],
          status: row[4],
          updatedAt: row[5],
          systemPrompt: row[6] ?? '',
        }))
      : [];

    res.json({ success: true, data: agents });
  } catch (error) {
    console.error('查询 Agent 失败：', error);
    res.status(500).json({ success: false, message: '查询 Agent 失败' });
  }
});

// 创建 Agent
app.post('/api/agents', (req, res) => {
  try {
    const {
      id,
      name,
      description = '',
      model = '未配置',
      status = '草稿',
      systemPrompt = '',
    } = req.body;

    if (!id || !name) {
      return res.status(400).json({
        success: false,
        message: 'id 和 name 为必填项',
      });
    }

    if (!['运行中', '已停用', '草稿'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Agent 状态不合法',
      });
    }

    const updatedAt = new Date().toISOString().slice(0, 10);

    db.run(
      `INSERT INTO agents
        (id, name, description, model, status, updated_at, system_prompt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, name, description, model, status, updatedAt, systemPrompt]
    );

    // 初始提示词也作为第一个版本保存。
    recordPromptVersion(id, systemPrompt);
    saveDatabase();

    res.status(201).json({
      success: true,
      data: {
        id,
        name,
        description,
        model,
        status,
        updatedAt,
        systemPrompt,
      },
    });
  } catch (error) {
    console.error('创建 Agent 失败：', error);
    res.status(500).json({
      success: false,
      message: '创建失败，请检查 ID 是否重复',
    });
  }
});

// 修改 Agent（系统提示词变化时自动创建版本）
app.put('/api/agents/:id', (req, res) => {
  try {
    const existing = getAgent(req.params.id);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Agent 不存在',
      });
    }

    const {
      name,
      description = '',
      model = '未配置',
      status = '草稿',
      systemPrompt = existing.system_prompt ?? '',
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'name 为必填项',
      });
    }

    if (!['运行中', '已停用', '草稿'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Agent 状态不合法',
      });
    }

    const updatedAt = new Date().toISOString().slice(0, 10);

    db.run(
      `UPDATE agents
       SET name = ?, description = ?, model = ?, status = ?,
           updated_at = ?, system_prompt = ?
       WHERE id = ?`,
      [name, description, model, status, updatedAt, systemPrompt, req.params.id]
    );

    recordPromptVersion(req.params.id, systemPrompt);
    saveDatabase();

    res.json({
      success: true,
      data: {
        id: req.params.id,
        name,
        description,
        model,
        status,
        updatedAt,
        systemPrompt,
      },
    });
  } catch (error) {
    console.error('修改 Agent 失败：', error);
    res.status(500).json({
      success: false,
      message: '修改 Agent 失败',
    });
  }
});

// 查询某个 Agent 的提示词历史版本
app.get('/api/agents/:id/prompt-versions', (req, res) => {
  try {
    if (!getAgent(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Agent 不存在',
      });
    }

    const versions = queryAll(
      `SELECT id, agent_id, version_number, system_prompt, created_at
       FROM agent_prompt_versions
       WHERE agent_id = ?
       ORDER BY version_number DESC`,
      [req.params.id]
    ).map((row) => ({
      id: row.id,
      agentId: row.agent_id,
      versionNumber: row.version_number,
      systemPrompt: row.system_prompt,
      createdAt: row.created_at,
    }));

    res.json({ success: true, data: versions });
  } catch (error) {
    console.error('查询提示词历史失败：', error);
    res.status(500).json({
      success: false,
      message: '查询提示词历史失败',
    });
  }
});

// 手动创建历史版本快照
app.post('/api/agents/:id/prompt-versions', (req, res) => {
  try {
    const agent = getAgent(req.params.id);

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent 不存在',
      });
    }

    const prompt = agent.system_prompt ?? '';
    const versionNumber = recordPromptVersion(agent.id, prompt);
    saveDatabase();

    const version = queryOne(
      `SELECT id, agent_id, version_number, system_prompt, created_at
       FROM agent_prompt_versions
       WHERE agent_id = ? AND version_number = ?`,
      [agent.id, versionNumber]
    );

    res.status(201).json({
      success: true,
      data: {
        id: version.id,
        agentId: version.agent_id,
        versionNumber: version.version_number,
        systemPrompt: version.system_prompt,
        createdAt: version.created_at,
      },
    });
  } catch (error) {
    console.error('创建提示词版本失败：', error);
    res.status(500).json({
      success: false,
      message: '创建提示词版本失败',
    });
  }
});

// 回滚到指定历史版本。
// 不覆盖历史记录，而是将恢复内容保存为一个新版本。
app.post('/api/agents/:id/prompt-versions/:versionId/restore', (req, res) => {
  try {
    const agent = getAgent(req.params.id);

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent 不存在',
      });
    }

    const version = queryOne(
      `SELECT id, version_number, system_prompt
         FROM agent_prompt_versions
         WHERE id = ? AND agent_id = ?`,
      [Number(req.params.versionId), req.params.id]
    );

    if (!version) {
      return res.status(404).json({
        success: false,
        message: '指定的历史版本不存在',
      });
    }

    const updatedAt = new Date().toISOString().slice(0, 10);
    const restoredPrompt = version.system_prompt ?? '';

    db.run(
      `UPDATE agents
         SET system_prompt = ?, updated_at = ?
         WHERE id = ?`,
      [restoredPrompt, updatedAt, req.params.id]
    );

    const newVersionNumber = recordPromptVersion(req.params.id, restoredPrompt);

    saveDatabase();

    res.json({
      success: true,
      message: '提示词回滚成功',
      data: {
        agentId: req.params.id,
        restoredFromVersion: version.version_number,
        currentVersion: newVersionNumber,
        systemPrompt: restoredPrompt,
        updatedAt,
      },
    });
  } catch (error) {
    console.error('提示词回滚失败：', error);
    res.status(500).json({
      success: false,
      message: '提示词回滚失败',
    });
  }
});

// 删除 Agent，同时删除其提示词历史
app.delete('/api/agents/:id', (req, res) => {
  try {
    if (!getAgent(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Agent 不存在',
      });
    }

    db.run('DELETE FROM agent_prompt_versions WHERE agent_id = ?', [
      req.params.id,
    ]);
    db.run('DELETE FROM agents WHERE id = ?', [req.params.id]);

    saveDatabase();

    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除 Agent 失败：', error);
    res.status(500).json({
      success: false,
      message: '删除 Agent 失败',
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Agent Studio API 已启动：http://localhost:${PORT}`);
});
