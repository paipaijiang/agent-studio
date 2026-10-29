export type AgentStatus = '运行中' | '已停用' | '草稿';

export interface Agent {
  id: string;
  name: string;
  description: string;
  model: string;
  status: AgentStatus;
  updatedAt: string;

  // Agent 的系统提示词
  systemPrompt: string;
}
