
import express from 'express';
import { randomUUID } from 'node:crypto';
import authRouter from './routes/auth.js';
import { requireAuth, requireAdmin } from './middleware/auth.js';
import { db, saveDatabase } from './db.js';
import {
  queryAll,
  queryOne,
  getAgent,
  getModel,
  formatModel,
} from './utils/db-query.js';

const app = express();
const PORT = 3001;

app.use(express.json({ limit: '1mb' }));

// ================================
// 认证路由：登录、登出、当前用户
// ================================
app.use('/api/auth', authRouter);

// ================================
// 公开健康检查
// ================================
app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    message: 'Agent Studio 后端运行正常',
    timestamp: new Date().toISOString(),
  });
});

// 其余业务 API 必须先登录。
// 此中间件之后注册的业务路由均受到登录保护。
app.use('/api', requireAuth);

// ================================
// 通用数据库工具
// ================================

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

// 检查模型配置字段。
// 只允许 HTTP/HTTPS URL，不允许 URL 中包含用户名或密码。
function validateModelInput(body, partial = false) {
  const fields = [
    'name',
    'provider',
    'modelName',
    'baseUrl',
    'description',
    'isEnabled',
    'isDefault',
  ];

  if (partial) {
    for (const field of fields) {
      if (
        body[field] !== undefined &&
        ['name', 'provider', 'modelName', 'baseUrl', 'description']
          .includes(field) &&
        typeof body[field] !== 'string'
      ) {
        return `${field} 必须是字符串`;
      }
    }
  } else {
    for (const field of ['name', 'provider', 'modelName', 'baseUrl']) {
      if (typeof body[field] !== 'string' || !body[field].trim()) {
        return `${field} 为必填项`;
      }
    }
  }

  const baseUrl = body.baseUrl;

  if (baseUrl !== undefined) {
    if (typeof baseUrl !== 'string' || !baseUrl.trim()) {
      return 'Base URL 不能为空';
    }

    try {
      const url = new URL(baseUrl.trim());

      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      ) {
        return 'Base URL 格式不合法';
      }
    } catch {
      return 'Base URL 格式不正确';
    }
  }

  for (const field of ['isEnabled', 'isDefault']) {
    if (
      body[field] !== undefined &&
      typeof body[field] !== 'boolean'
    ) {
      return `${field} 必须是布尔值`;
    }
  }

  for (const field of ['name', 'provider', 'modelName', 'baseUrl']) {
    if (
      typeof body[field] === 'string' &&
      body[field].trim().length > 500
    ) {
      return `${field} 长度不能超过 500 个字符`;
    }
  }

  if (
    typeof body.description === 'string' &&
    body.description.length > 2000
  ) {
    return 'description 长度不能超过 2000 个字符';
  }

  return null;
}

// ================================
// 模型管理 API
// 所有接口要求登录；写操作额外要求管理员权限。
// ================================

// 查询模型配置列表：登录用户可访问
app.get('/api/models', (_req, res) => {
  try {
    const models = queryAll(
      `SELECT id, name, provider, model_name, base_url, description,
              is_enabled, is_default, created_at, updated_at
       FROM model_catalog
       ORDER BY is_default DESC, updated_at DESC`
    ).map(formatModel);

    res.json({ success: true, data: models });
  } catch (error) {
    console.error('查询模型失败：', error.message);
    res.status(500).json({
      success: false,
      message: '查询模型配置失败',
    });
  }
});

// 新增模型配置：管理员
app.post('/api/models', requireAdmin, (req, res) => {
  try {
    const body = req.body ?? {};
    const validationError = validateModelInput(body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    const now = new Date().toISOString();
    const id = randomUUID();

    const name = body.name.trim();
    const provider = body.provider.trim();
    const modelName = body.modelName.trim();
    const baseUrl = body.baseUrl.trim().replace(/\/+$/, '');
    const description = (body.description ?? '').trim();
    const isEnabled = body.isEnabled ?? true;
    const isDefault = body.isDefault ?? false;

    if (isDefault && !isEnabled) {
      return res.status(400).json({
        success: false,
        message: '停用的模型不能设为默认模型',
      });
    }

    db.run('BEGIN TRANSACTION');

    try {
      if (isDefault) {
        db.run('UPDATE model_catalog SET is_default = 0');
      }

      db.run(
        `INSERT INTO model_catalog
          (id, name, provider, model_name, base_url, description,
           is_enabled, is_default, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          name,
          provider,
          modelName,
          baseUrl,
          description,
          isEnabled ? 1 : 0,
          isDefault ? 1 : 0,
          now,
          now,
        ]
      );

      db.run('COMMIT');
    } catch (error) {
      db.run('ROLLBACK');
      throw error;
    }

    saveDatabase();

    res.status(201).json({
      success: true,
      data: formatModel(getModel(id)),
    });
  } catch (error) {
    console.error('新增模型失败：', error.message);
    res.status(500).json({
      success: false,
      message: '新增模型配置失败',
    });
  }
});

// 修改模型配置：管理员
app.put('/api/models/:id', requireAdmin, (req, res) => {
  try {
    const id = req.params.id;
    const existing = getModel(id);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: '模型配置不存在',
      });
    }

    const body = req.body ?? {};
    const validationError = validateModelInput(body, true);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    const name = body.name === undefined
      ? existing.name : body.name.trim();
    const provider = body.provider === undefined
      ? existing.provider : body.provider.trim();
    const modelName = body.modelName === undefined
      ? existing.model_name : body.modelName.trim();
    const baseUrl = body.baseUrl === undefined
      ? existing.base_url : body.baseUrl.trim().replace(/\/+$/, '');
    const description = body.description === undefined
      ? existing.description : body.description.trim();
    const isEnabled = body.isEnabled === undefined
      ? Boolean(existing.is_enabled) : body.isEnabled;
    const isDefault = body.isDefault === undefined
      ? Boolean(existing.is_default) : body.isDefault;

    if (isDefault && !isEnabled) {
      return res.status(400).json({
        success: false,
        message: '停用的模型不能设为默认模型',
      });
    }

    const now = new Date().toISOString();

    db.run('BEGIN TRANSACTION');

    try {
      if (isDefault) {
        db.run(
          'UPDATE model_catalog SET is_default = 0 WHERE id != ?',
          [id]
        );
      }

      db.run(
        `UPDATE model_catalog
         SET name = ?, provider = ?, model_name = ?, base_url = ?,
             description = ?, is_enabled = ?, is_default = ?,
             updated_at = ?
         WHERE id = ?`,
        [
          name,
          provider,
          modelName,
          baseUrl,
          description,
          isEnabled ? 1 : 0,
          isDefault ? 1 : 0,
          now,
          id,
        ]
      );

      db.run('COMMIT');
    } catch (error) {
      db.run('ROLLBACK');
      throw error;
    }

    saveDatabase();

    res.json({
      success: true,
      data: formatModel(getModel(id)),
    });
  } catch (error) {
    console.error('修改模型失败：', error.message);
    res.status(500).json({
      success: false,
      message: '修改模型配置失败',
    });
  }
});

// 设置平台默认模型：管理员
app.patch('/api/models/:id/default', requireAdmin, (req, res) => {
  try {
    const id = req.params.id;
    const model = getModel(id);

    if (!model) {
      return res.status(404).json({
        success: false,
        message: '模型配置不存在',
      });
    }

    if (!model.is_enabled) {
      return res.status(400).json({
        success: false,
        message: '请先启用该模型，再设置为默认模型',
      });
    }

    db.run('BEGIN TRANSACTION');

    try {
      db.run('UPDATE model_catalog SET is_default = 0');

      db.run(
        `UPDATE model_catalog
         SET is_default = 1, updated_at = ?
         WHERE id = ?`,
        [new Date().toISOString(), id]
      );

      db.run('COMMIT');
    } catch (error) {
      db.run('ROLLBACK');
      throw error;
    }

    saveDatabase();

    res.json({
      success: true,
      data: formatModel(getModel(id)),
      message: '默认模型设置成功',
    });
  } catch (error) {
    console.error('设置默认模型失败：', error.message);
    res.status(500).json({
      success: false,
      message: '设置默认模型失败',
    });
  }
});

// 启用或停用模型：管理员
app.patch('/api/models/:id/status', requireAdmin, (req, res) => {
  try {
    const id = req.params.id;
    const model = getModel(id);
    const { isEnabled } = req.body ?? {};

    if (!model) {
      return res.status(404).json({
        success: false,
        message: '模型配置不存在',
      });
    }

    if (typeof isEnabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isEnabled 必须是布尔值',
      });
    }

    if (!isEnabled && model.is_default) {
      return res.status(400).json({
        success: false,
        message: '请先将其他已启用模型设为默认模型，再停用此模型',
      });
    }

    db.run(
      `UPDATE model_catalog
       SET is_enabled = ?, updated_at = ?
       WHERE id = ?`,
      [isEnabled ? 1 : 0, new Date().toISOString(), id]
    );

    saveDatabase();

    res.json({
      success: true,
      data: formatModel(getModel(id)),
      message: isEnabled ? '模型已启用' : '模型已停用',
    });
  } catch (error) {
    console.error('修改模型状态失败：', error.message);
    res.status(500).json({
      success: false,
      message: '修改模型状态失败',
    });
  }
});

// 删除模型配置：管理员
app.delete('/api/models/:id', requireAdmin, (req, res) => {
  try {
    const id = req.params.id;
    const model = getModel(id);

    if (!model) {
      return res.status(404).json({
        success: false,
        message: '模型配置不存在',
      });
    }

    const referencedAgent = queryOne(
      'SELECT id FROM agents WHERE model = ? LIMIT 1',
      [model.model_name]
    );

    if (referencedAgent) {
      return res.status(409).json({
        success: false,
        message: '仍有 Agent 使用该模型，请先调整相关 Agent 的模型配置',
      });
    }

    db.run('BEGIN TRANSACTION');

    try {
      db.run('DELETE FROM model_secrets WHERE model_id = ?', [id]);
      db.run('DELETE FROM user_model_configs WHERE model_id = ?', [id]);
      db.run('DELETE FROM model_catalog WHERE id = ?', [id]);
      db.run('COMMIT');
    } catch (error) {
      db.run('ROLLBACK');
      throw error;
    }

    saveDatabase();

    res.json({
      success: true,
      message: '模型配置删除成功',
    });
  } catch (error) {
    console.error('删除模型失败：', error.message);
    res.status(500).json({
      success: false,
      message: '删除模型配置失败',
    });
  }
});

// ================================
// Agent API
// ================================

// 查询所有 Agent：登录用户
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
    console.error('查询 Agent 失败：', error.message);
    res.status(500).json({
      success: false,
      message: '查询 Agent 失败',
    });
  }
});

// 创建 Agent：管理员
app.post('/api/agents', requireAdmin, (req, res) => {
  try {
    const {
      id,
      name,
      description = '',
      model = '未配置',
      status = '草稿',
      systemPrompt = '',
    } = req.body ?? {};

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
    console.error('创建 Agent 失败：', error.message);
    res.status(500).json({
      success: false,
      message: '创建失败，请检查 ID 是否重复',
    });
  }
});

// 修改 Agent：管理员
app.put('/api/agents/:id', requireAdmin, (req, res) => {
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
    } = req.body ?? {};

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
      [
        name,
        description,
        model,
        status,
        updatedAt,
        systemPrompt,
        req.params.id,
      ]
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
    console.error('修改 Agent 失败：', error.message);
    res.status(500).json({
      success: false,
      message: '修改 Agent 失败',
    });
  }
});

// 查询提示词历史：登录用户
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
    console.error('查询提示词历史失败：', error.message);
    res.status(500).json({
      success: false,
      message: '查询提示词历史失败',
    });
  }
});

// 创建提示词历史快照：管理员
app.post(
  '/api/agents/:id/prompt-versions',
  requireAdmin,
  (req, res) => {
    try {
      const agent = getAgent(req.params.id);

      if (!agent) {
        return res.status(404).json({
          success: false,
          message: 'Agent 不存在',
        });
      }

      const versionNumber = recordPromptVersion(
        agent.id,
        agent.system_prompt ?? ''
      );

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
      console.error('创建提示词版本失败：', error.message);
      res.status(500).json({
        success: false,
        message: '创建提示词版本失败',
      });
    }
  }
);

// 回滚提示词：管理员
app.post(
  '/api/agents/:id/prompt-versions/:versionId/restore',
  requireAdmin,
  (req, res) => {
    try {
      const agent = getAgent(req.params.id);

      if (!agent) {
        return res.status(404).json({
          success: false,
          message: 'Agent 不存在',
        });
      }

      const versionId = Number(req.params.versionId);

      if (!Number.isSafeInteger(versionId) || versionId <= 0) {
        return res.status(400).json({
          success: false,
          message: '历史版本 ID 不合法',
        });
      }

      const version = queryOne(
        `SELECT id, version_number, system_prompt
         FROM agent_prompt_versions
         WHERE id = ? AND agent_id = ?`,
        [versionId, req.params.id]
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

      const newVersionNumber = recordPromptVersion(
        req.params.id,
        restoredPrompt
      );

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
      console.error('提示词回滚失败：', error.message);
      res.status(500).json({
        success: false,
        message: '提示词回滚失败',
      });
    }
  }
);

// ================================
// 试验场：调用真实大模型
// 要求登录，暂不要求管理员权限。
// ================================

app.post('/api/playground/chat', async (req, res) => {
  const {
    agentId,
    model,
    baseUrl,
    apiKey,
    systemPrompt,
    messages,
  } = req.body ?? {};

  if (
    typeof agentId !== 'string' || !agentId.trim() ||
    typeof model !== 'string' || !model.trim() ||
    typeof baseUrl !== 'string' || !baseUrl.trim() ||
    typeof apiKey !== 'string' || !apiKey.trim() ||
    !Array.isArray(messages) || messages.length === 0
  ) {
    return res.status(400).json({
      success: false,
      message: '请填写 Agent、模型名称、Base URL、API Key 和测试消息',
    });
  }

  const agent = getAgent(agentId.trim());

  if (!agent) {
    return res.status(404).json({
      success: false,
      message: 'Agent 不存在，请刷新页面后重试',
    });
  }

  let endpoint;

  try {
    const parsedUrl = new URL(baseUrl.trim());

    if (
      !['http:', 'https:'].includes(parsedUrl.protocol) ||
      parsedUrl.username ||
      parsedUrl.password ||
      parsedUrl.search ||
      parsedUrl.hash
    ) {
      throw new Error('URL 不合法');
    }

    endpoint = `${parsedUrl.href.replace(/\/+$/, '')}/chat/completions`;
  } catch {
    return res.status(400).json({
      success: false,
      message: 'Base URL 格式不正确',
    });
  }

  if (messages.length > 50) {
    return res.status(400).json({
      success: false,
      message: '单次最多发送 50 条历史消息',
    });
  }

  const normalizedMessages = [];

  for (const message of messages) {
    if (
      !message ||
      !['user', 'assistant'].includes(message.role) ||
      typeof message.content !== 'string' ||
      !message.content.trim() ||
      message.content.length > 20000
    ) {
      return res.status(400).json({
        success: false,
        message: '对话消息格式不正确或内容过长',
      });
    }

    normalizedMessages.push({
      role: message.role,
      content: message.content,
    });
  }

  const effectivePrompt = typeof systemPrompt === 'string'
    ? systemPrompt
    : agent.system_prompt ?? '';

  if (effectivePrompt.length > 30000) {
    return res.status(400).json({
      success: false,
      message: 'System Prompt 不能超过 30000 个字符',
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: model.trim(),
        messages: [
          ...(effectivePrompt.trim()
            ? [{ role: 'system', content: effectivePrompt }]
            : []),
          ...normalizedMessages,
        ],
        stream: false,
      }),
      signal: controller.signal,
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      console.error('模型调用失败，HTTP 状态码：', response.status);

      return res.status(502).json({
        success: false,
        message:
          response.status === 401 || response.status === 403
            ? '模型认证失败，请检查 API Key 或账号权限'
            : response.status === 429
              ? '模型服务限流或额度不足，请稍后重试'
              : `模型服务请求失败（HTTP ${response.status}）`,
      });
    }

    const content = result?.choices?.[0]?.message?.content;

    if (typeof content !== 'string' || !content.trim()) {
      return res.status(502).json({
        success: false,
        message: '模型返回内容为空或响应格式不符合 OpenAI 兼容协议',
      });
    }

    return res.json({
      success: true,
      data: {
        content,
        model: result.model ?? model.trim(),
        usage: result.usage ?? null,
      },
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      return res.status(504).json({
        success: false,
        message: '模型请求超时，请稍后重试',
      });
    }

    console.error('模型请求异常：', error?.message ?? '未知错误');

    return res.status(502).json({
      success: false,
      message: '无法连接模型服务，请检查 Base URL 和网络连接',
    });
  } finally {
    clearTimeout(timeout);
  }
});

// 删除 Agent 和其提示词历史：管理员
app.delete('/api/agents/:id', requireAdmin, (req, res) => {
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

    res.json({
      success: true,
      message: '删除成功',
    });
  } catch (error) {
    console.error('删除 Agent 失败：', error.message);
    res.status(500).json({
      success: false,
      message: '删除 Agent 失败',
    });
  }
});

// ================================
// 启动服务
// ================================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Agent Studio API 已启动：http://localhost:${PORT}`);
});
