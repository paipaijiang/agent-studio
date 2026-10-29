import type { Agent } from './data/mock';

const API_BASE_URL = '/api';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

// 系统提示词版本的数据结构
export interface PromptVersion {
  id: number;
  agentId: string;
  versionNumber: number;
  systemPrompt: string;
  createdAt: string;
}

interface ApiResponseWithVersions {
  success: boolean;
  data?: Record<string, unknown>[];
  message?: string;
}

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

function handlePromptVersion(raw: Record<string, unknown>): PromptVersion {
  return {
    id: Number(raw.id ?? 0),
    agentId: String(raw.agentId ?? raw.agent_id ?? ''),
    versionNumber: Number(raw.versionNumber ?? raw.version_number ?? 0),
    systemPrompt: String(raw.systemPrompt ?? raw.system_prompt ?? ''),
    createdAt: String(raw.createdAt ?? raw.created_at ?? ''),
  };
}

// 获取 Agent 列表
export async function getAgents(): Promise<Agent[]> {
  const response = await fetch(`${API_BASE_URL}/agents`);

  if (!response.ok) {
    throw new Error(`获取 Agent 失败：HTTP ${response.status}`);
  }

  const result: ApiResponse<Record<string, unknown>[]> = await response.json();

  if (!result.success) {
    throw new Error(result.message ?? '获取 Agent 失败');
  }

  return (result.data ?? []).map(handleAgent);
}

// 创建 Agent
export async function createAgentApi(agent: Agent): Promise<Agent> {
  const response = await fetch(`${API_BASE_URL}/agents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...agent,
      systemPrompt: agent.systemPrompt ?? '',
    }),
  });

  const result: ApiResponse<Record<string, unknown>> = await response.json();

  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.message ?? '创建 Agent 失败');
  }

  return handleAgent(result.data);
}

// 更新 Agent
export async function updateAgentApi(agent: Agent): Promise<Agent> {
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

  const result: ApiResponse<Record<string, unknown>> = await response.json();

  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.message ?? '更新 Agent 失败');
  }

  return handleAgent(result.data);
}

// 删除 Agent
export async function deleteAgentApi(id: string): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/agents/${encodeURIComponent(id)}`,
    { method: 'DELETE' }
  );

  const result: ApiResponse<unknown> = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.message ?? '删除 Agent 失败');
  }
}

// 获取指定 Agent 的系统提示词版本历史
export async function getPromptVersionsApi(
  agentId: string
): Promise<PromptVersion[]> {
  const response = await fetch(
    `${API_BASE_URL}/agents/${encodeURIComponent(agentId)}/prompt-versions`
  );

  const result: ApiResponseWithVersions = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.message ?? '获取提示词版本历史失败');
  }

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

  const result: ApiResponse<Record<string, unknown>> = await response.json();

  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.message ?? '创建提示词版本失败');
  }

  return handlePromptVersion(result.data);
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

  const result: ApiResponse<Record<string, unknown>> = await response.json();

  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.message ?? '回滚系统提示词失败');
  }

  return handleAgent(result.data);
}
