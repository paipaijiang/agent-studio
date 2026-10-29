
import type { Agent } from './data/mock';

const API_BASE_URL = '/api';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

interface ApiResponseWithVersions {
  success: boolean;
  data?: Record<string, unknown>[];
  message?: string;
}

// ==================== 数据结构 ====================

// 系统提示词版本
export interface PromptVersion {
  id: number;
  agentId: string;
  versionNumber: number;
  systemPrompt: string;
  createdAt: string;
}

// 模型配置
export interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  modelName: string;
  baseUrl: string;
  description: string;
  isEnabled: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

// 新增、编辑模型时使用
export interface ModelInput {
  name: string;
  provider: string;
  modelName: string;
  baseUrl: string;
  description: string;
}

// 当前登录用户
export interface AuthUser {
  id: string;
  username: string;
  email: string | null;
  role: 'admin' | 'user';
}

// ==================== 数据转换 ====================

function handleAgent(raw: Record<string, unknown>): Agent {
  return {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? ''),
    description: String(raw.description ?? ''),
    model: String(raw.model ?? '未配置'),
    status: raw.status as Agent['status'],
    updatedAt: String(raw.updatedAt ?? raw.updated_at ?? ''),
    systemPrompt: String(raw.systemPrompt ?? raw.system_prompt ?? ''),
  };
}

function handlePromptVersion(
  raw: Record<string, unknown>
): PromptVersion {
  return {
    id: Number(raw.id ?? 0),
    agentId: String(raw.agentId ?? raw.agent_id ?? ''),
    versionNumber: Number(
      raw.versionNumber ?? raw.version_number ?? 0
    ),
    systemPrompt: String(
      raw.systemPrompt ?? raw.system_prompt ?? ''
    ),
    createdAt: String(raw.createdAt ?? raw.created_at ?? ''),
  };
}

function handleModel(raw: Record<string, unknown>): ModelConfig {
  return {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? ''),
    provider: String(raw.provider ?? ''),
    modelName: String(raw.modelName ?? raw.model_name ?? ''),
    baseUrl: String(raw.baseUrl ?? raw.base_url ?? ''),
    description: String(raw.description ?? ''),
    isEnabled: Boolean(raw.isEnabled ?? raw.is_enabled ?? false),
    isDefault: Boolean(raw.isDefault ?? raw.is_default ?? false),
    createdAt: String(raw.createdAt ?? raw.created_at ?? ''),
    updatedAt: String(raw.updatedAt ?? raw.updated_at ?? ''),
  };
}

// ==================== 通用响应处理 ====================

async function parseResponse<T>(
  response: Response,
  fallbackMessage: string,
  requireData = true
): Promise<ApiResponse<T>> {
  let result: ApiResponse<T>;

  try {
    result = await response.json();
  } catch {
    throw new Error(
      `${fallbackMessage}：服务器返回了无效响应（HTTP ${response.status}）`
    );
  }

  if (!response.ok || !result.success) {
    throw new Error(
      result.message ?? `${fallbackMessage}：HTTP ${response.status}`
    );
  }

  if (requireData && result.data === undefined) {
    throw new Error(`${fallbackMessage}：服务器未返回有效数据`);
  }

  return result;
}

async function readResponse<T>(
  response: Response,
  fallbackMessage: string
): Promise<T> {
  const result = await parseResponse<T>(
    response,
    fallbackMessage
  );

  return result.data as T;
}

// ==================== Agent 接口 ====================

// 获取 Agent 列表
export async function getAgents(): Promise<Agent[]> {
  const response = await fetch(`${API_BASE_URL}/agents`);

  const data = await readResponse<Record<string, unknown>[]>(
    response,
    '获取 Agent 失败'
  );

  return data.map(handleAgent);
}

// 创建 Agent
export async function createAgentApi(
  agent: Agent
): Promise<Agent> {
  const response = await fetch(`${API_BASE_URL}/agents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...agent,
      systemPrompt: agent.systemPrompt ?? '',
    }),
  });

  const data = await readResponse<Record<string, unknown>>(
    response,
    '创建 Agent 失败'
  );

  return handleAgent(data);
}

// 更新 Agent
export async function updateAgentApi(
  agent: Agent
): Promise<Agent> {
  const response = await fetch(
    `${API_BASE_URL}/agents/${encodeURIComponent(agent.id)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...agent,
        systemPrompt: agent.systemPrompt ?? '',
      }),
    }
  );

  const data = await readResponse<Record<string, unknown>>(
    response,
    '更新 Agent 失败'
  );

  return handleAgent(data);
}

// 删除 Agent
export async function deleteAgentApi(id: string): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/agents/${encodeURIComponent(id)}`,
    { method: 'DELETE' }
  );

  // DELETE 接口可能不返回 data，只要 success 为 true 即可
  await parseResponse<unknown>(
    response,
    '删除 Agent 失败',
    false
  );
}

// 获取指定 Agent 的系统提示词版本历史
export async function getPromptVersionsApi(
  agentId: string
): Promise<PromptVersion[]> {
  const response = await fetch(
    `${API_BASE_URL}/agents/${encodeURIComponent(agentId)}/prompt-versions`
  );

  const result = await parseResponse<Record<string, unknown>[]>(
    response,
    '获取提示词版本历史失败',
    false
  );

  return (result.data ?? []).map(handlePromptVersion);
}

// 手动创建系统提示词版本快照
export async function createPromptVersionApi(
  agentId: string
): Promise<PromptVersion> {
  const response = await fetch(
    `${API_BASE_URL}/agents/${encodeURIComponent(agentId)}/prompt-versions`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }
  );

  const data = await readResponse<Record<string, unknown>>(
    response,
    '创建提示词版本失败'
  );

  return handlePromptVersion(data);
}

// 将指定历史版本回滚为当前系统提示词
export async function restorePromptVersionApi(
  agentId: string,
  versionId: number
): Promise<Agent> {
  const response = await fetch(
    `${API_BASE_URL}/agents/${encodeURIComponent(
      agentId
    )}/prompt-versions/${versionId}/restore`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }
  );

  const data = await readResponse<Record<string, unknown>>(
    response,
    '回滚系统提示词失败'
  );

  return handleAgent(data);
}

// ==================== 模型管理接口 ====================

// 获取模型列表
export async function getModelsApi(): Promise<ModelConfig[]> {
  const response = await fetch(`${API_BASE_URL}/models`);

  const data = await readResponse<Record<string, unknown>[]>(
    response,
    '获取模型列表失败'
  );

  return data.map(handleModel);
}

// 新增模型
export async function createModelApi(
  model: ModelInput
): Promise<ModelConfig> {
  const response = await fetch(`${API_BASE_URL}/models`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(model),
  });

  const data = await readResponse<Record<string, unknown>>(
    response,
    '创建模型失败'
  );

  return handleModel(data);
}

// 编辑模型
export async function updateModelApi(
  id: string,
  model: ModelInput
): Promise<ModelConfig> {
  const response = await fetch(
    `${API_BASE_URL}/models/${encodeURIComponent(id)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(model),
    }
  );

  const data = await readResponse<Record<string, unknown>>(
    response,
    '更新模型失败'
  );

  return handleModel(data);
}

// 设置默认模型
export async function setDefaultModelApi(
  id: string
): Promise<ModelConfig> {
  const response = await fetch(
    `${API_BASE_URL}/models/${encodeURIComponent(id)}/default`,
    { method: 'PATCH' }
  );

  const data = await readResponse<Record<string, unknown>>(
    response,
    '设置默认模型失败'
  );

  return handleModel(data);
}

// 启用或停用模型
export async function setModelStatusApi(
  id: string,
  isEnabled: boolean
): Promise<ModelConfig> {
  const response = await fetch(
    `${API_BASE_URL}/models/${encodeURIComponent(id)}/status`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isEnabled }),
    }
  );

  const data = await readResponse<Record<string, unknown>>(
    response,
    '修改模型状态失败'
  );

  return handleModel(data);
}

// 删除模型
export async function deleteModelApi(id: string): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/models/${encodeURIComponent(id)}`,
    { method: 'DELETE' }
  );

  await parseResponse<unknown>(
    response,
    '删除模型失败',
    false
  );
}

// ==================== 用户认证接口 ====================

// 获取当前登录用户；未登录时返回 null
export async function getCurrentUserApi(): Promise<AuthUser | null> {
  const response = await fetch(`${API_BASE_URL}/auth/me`);

  if (response.status === 401) {
    return null;
  }

  const data = await readResponse<{ user: AuthUser }>(
    response,
    '获取当前用户失败'
  );

  return data.user;
}

// 登录
export async function loginApi(
  username: string,
  password: string
): Promise<AuthUser> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  const data = await readResponse<{ user: AuthUser }>(
    response,
    '登录失败'
  );

  return data.user;
}

// 注册：后端不允许客户端指定角色，新用户固定为普通用户
export async function registerApi(input: {
  username: string;
  email: string;
  password: string;
  invitationCode: string;
}): Promise<AuthUser> {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  const data = await readResponse<{ user: AuthUser }>(
    response,
    '注册失败'
  );

  return data.user;
}

// 退出登录
export async function logoutApi(): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/auth/logout`, {
    method: 'POST',
  });

  // 退出接口只返回 success 和 message，不要求 data
  await parseResponse<unknown>(
    response,
    '退出登录失败',
    false
  );
}

// ==================== 管理员邀请码接口 ====================

export interface InvitationResult {
  id: string;
  invitationCode: string;
  expiresAt: string;
}

// 创建邀请码，有效期 1-30 天
export async function createInvitationApi(
  expiresInDays = 7
): Promise<InvitationResult> {
  const response = await fetch(`${API_BASE_URL}/auth/invitations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresInDays }),
  });

  return readResponse<InvitationResult>(
    response,
    '创建邀请码失败'
  );
}

// 撤销尚未使用的邀请码
export async function revokeInvitationApi(
  id: string
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/auth/invitations/${encodeURIComponent(id)}/revoke`,
    { method: 'POST' }
  );

  await parseResponse<unknown>(
    response,
    '撤销邀请码失败',
    false
  );
}
