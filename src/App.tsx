import { useEffect, useMemo, useState } from 'react';
import './App.css';
import { type Agent, type AgentStatus } from './data/mock';
import {
  getAgents,
  createAgentApi,
  updateAgentApi,
  deleteAgentApi,
  getPromptVersionsApi,
  restorePromptVersionApi,
  type PromptVersion,
} from './api';
import Playground from './Playground';
const navigation = [
  { id: 'overview', label: '总览', icon: '◫' },
  { id: 'agents', label: 'Agents', icon: '◇' },
  { id: 'playground', label: '试验场', icon: '▷' },
  { id: 'skills', label: 'Skills', icon: '⌘' },
  { id: 'runs', label: '运行记录', icon: '≋' },
  { id: 'settings', label: '系统设置', icon: '⚙' },
] as const;

type PageId = (typeof navigation)[number]['id'] | 'agentDetail';
type AgentFormData = Omit<Agent, 'id' | 'updatedAt' | 'systemPrompt'>;

const descriptions: Record<PageId, string> = {
  overview: '查看 Agent 平台的运行状态和关键指标',
  agents: '创建、配置和管理你的智能体',
  playground: '在这里测试 Agent 的提示词和执行效果',
  skills: '管理可供 Agent 调用的工具与技能',
  runs: '查看历史执行记录与运行结果',
  settings: '管理平台的基础配置',
  agentDetail: '查看智能体的基本信息与当前配置',
};

function Sidebar({
  activePage,
  onNavigate,
  agentCount,
}: {
  activePage: PageId;
  onNavigate: (page: PageId) => void;
  agentCount: number;
}) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">A</div>
        <div>
          <div className="brand-name">Agent Studio</div>
          <div className="brand-caption">AI WORKFLOW PLATFORM</div>
        </div>
      </div>

      <div className="nav-label">工作空间</div>
      <nav className="nav-list">
        {navigation.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${
              activePage === item.id ||
              (activePage === 'agentDetail' && item.id === 'agents')
                ? 'active'
                : ''
            }`}
            onClick={() => onNavigate(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
            {item.id === 'agents' && (
              <span className="nav-count">{agentCount}</span>
            )}
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="workspace-card">
          <div className="workspace-dot" />
          <div>
            <div className="workspace-title">个人工作空间</div>
            <div className="workspace-subtitle">本地演示环境</div>
          </div>
        </div>
        <div className="user-profile">
          <div className="avatar">U</div>
          <div className="user-info">
            <div className="user-name">Workspace User</div>
            <div className="user-role">管理员</div>
          </div>
          <span className="user-more">···</span>
        </div>
      </div>
    </aside>
  );
}

function Topbar({
  activePage,
  onMenuClick,
}: {
  activePage: PageId;
  onMenuClick: () => void;
}) {
  const current = navigation.find((item) => item.id === activePage);
  const pageLabel =
    activePage === 'agentDetail' ? 'Agent 详情' : current?.label;

  return (
    <header className="topbar">
      <button className="mobile-menu-button" onClick={onMenuClick}>
        ☰
      </button>
      <div className="breadcrumbs">
        <span>工作空间</span>
        <span className="breadcrumb-separator">/</span>
        <strong>{pageLabel}</strong>
      </div>
      <div className="topbar-actions">
        <div className="environment-badge">
          <span className="status-dot" />
          本地演示
        </div>
        <button className="icon-button" title="通知">
          ♧
        </button>
        <div className="topbar-avatar">U</div>
      </div>
    </header>
  );
}

function Overview({
  onNavigate,
  agents,
  loading,
  error,
}: {
  onNavigate: (page: PageId) => void;
  agents: Agent[];
  loading: boolean;
  error: string;
}) {
  const agentCount = agents.length;
  const runningCount = agents.filter(
    (agent) => agent.status === '运行中'
  ).length;

  const metrics = [
    {
      label: 'Agent 总数',
      value: loading ? '…' : error ? '—' : String(agentCount),
      change: loading
        ? '正在读取数据库'
        : error
        ? '加载失败，请检查后端'
        : '数据库中的 Agent 总数',
      icon: '◇',
    },
    {
      label: '运行中',
      value: loading ? '…' : error ? '—' : String(runningCount),
      change: loading
        ? '正在读取数据库'
        : error
        ? '加载失败，请检查后端'
        : '当前状态为运行中的 Agent',
      icon: '▷',
    },
    {
      label: '今日运行',
      value: '128',
      change: '模拟统计数据',
      icon: '≋',
    },
    {
      label: '成功率',
      value: '98.4%',
      change: '模拟统计数据',
      icon: '↗',
    },
  ];

  return (
    <>
      <section className="welcome-banner">
        <div className="welcome-content">
          <div className="welcome-eyebrow">
            <span className="welcome-eyebrow-dot" />
            YOUR AI WORKSPACE
          </div>
          <h1>让智能体，成为你的生产力</h1>
          <p>在一个工作空间中创建 Agent、组合 Skills，并管理每一次运行。</p>
          <button
            className="primary-button"
            onClick={() => onNavigate('agents')}
          >
            管理 Agents <span>→</span>
          </button>
        </div>
        <div className="banner-decoration">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="orbit-core">AI</div>
          <div className="orbit-node node-one">✦</div>
          <div className="orbit-node node-two">⌘</div>
          <div className="orbit-node node-three">↗</div>
        </div>
      </section>

      <div className="section-heading">
        <div>
          <h2>平台概览</h2>
          <p>了解当前工作空间的运行情况</p>
        </div>
        <span className="muted-label">部分为演示数据</span>
      </div>

      {error && (
        <div className="agent-empty">
          <strong>Agent 数据加载失败</strong>
          <p>{error}</p>
          <button
            className="secondary-button"
            onClick={() => onNavigate('agents')}
          >
            前往 Agent 管理查看
          </button>
        </div>
      )}

      <section className="metrics-grid">
        {metrics.map((metric) => (
          <div className="metric-card" key={metric.label}>
            <div className="metric-top">
              <span>{metric.label}</span>
              <span className="metric-icon">{metric.icon}</span>
            </div>
            <div className="metric-value">{metric.value}</div>
            <div className="metric-change">{metric.change}</div>
          </div>
        ))}
      </section>

      <section className="content-grid">
        <div className="panel activity-panel">
          <div className="panel-heading">
            <div>
              <h3>运行趋势</h3>
              <p>最近 7 天的模拟执行情况</p>
            </div>
            <span className="panel-menu">···</span>
          </div>
          <div className="chart-legend">
            <span>
              <i className="legend-dot purple" />
              执行次数
            </span>
            <span>
              <i className="legend-dot cyan" />
              成功次数
            </span>
          </div>
          <div className="fake-chart">
            <div className="chart-y-labels">
              <span>160</span>
              <span>120</span>
              <span>80</span>
              <span>40</span>
              <span>0</span>
            </div>
            <div className="chart-main">
              <div className="chart-grid-lines">
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>
              <div className="chart-bars">
                {[62, 75, 54, 88, 68, 96, 79].map((height, index) => (
                  <div className="bar-pair" key={index}>
                    <div
                      className="bar purple-bar"
                      style={{ height: `${height}%` }}
                    />
                    <div
                      className="bar cyan-bar"
                      style={{ height: `${height * 0.83}%` }}
                    />
                  </div>
                ))}
              </div>
              <div className="chart-x-labels">
                {['周四', '周五', '周六', '周日', '周一', '周二', '周三'].map(
                  (day) => (
                    <span key={day}>{day}</span>
                  )
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="panel quick-panel">
          <div className="panel-heading">
            <div>
              <h3>快速开始</h3>
              <p>继续构建你的 AI 工作空间</p>
            </div>
          </div>
          <button className="quick-action" onClick={() => onNavigate('agents')}>
            <span className="quick-icon purple-bg">◇</span>
            <span className="quick-copy">
              <strong>创建 Agent</strong>
              <small>配置一个新的智能体</small>
            </span>
            <span className="quick-arrow">→</span>
          </button>
          <button className="quick-action" onClick={() => onNavigate('skills')}>
            <span className="quick-icon blue-bg">⌘</span>
            <span className="quick-copy">
              <strong>管理 Skills</strong>
              <small>为 Agent 添加能力</small>
            </span>
            <span className="quick-arrow">→</span>
          </button>
          <button
            className="quick-action"
            onClick={() => onNavigate('playground')}
          >
            <span className="quick-icon green-bg">▷</span>
            <span className="quick-copy">
              <strong>进入试验场</strong>
              <small>测试提示词与执行效果</small>
            </span>
            <span className="quick-arrow">→</span>
          </button>
        </div>
      </section>

      <section className="panel recent-panel">
        <div className="panel-heading">
          <div>
            <h3>最近运行</h3>
            <p>以下为示例记录，并非真实执行结果</p>
          </div>
          <button className="text-button" onClick={() => onNavigate('runs')}>
            查看全部 →
          </button>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Agent 名称</th>
                <th>触发方式</th>
                <th>耗时</th>
                <th>状态</th>
                <th>运行时间</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <span className="table-agent-icon">◇</span> 智能运维助手
                </td>
                <td>手动触发</td>
                <td>2.4s</td>
                <td>
                  <span className="run-status success">成功</span>
                </td>
                <td>10:42:18</td>
              </tr>
              <tr>
                <td>
                  <span className="table-agent-icon">◇</span> 知识库问答助手
                </td>
                <td>API 调用</td>
                <td>1.8s</td>
                <td>
                  <span className="run-status success">成功</span>
                </td>
                <td>10:36:05</td>
              </tr>
              <tr>
                <td>
                  <span className="table-agent-icon">◇</span> 代码审查助手
                </td>
                <td>手动触发</td>
                <td>—</td>
                <td>
                  <span className="run-status failed">已停用</span>
                </td>
                <td>昨天</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function AgentManagement({
  agents,
  loading,
  error,
  onCreate,
  onToggle,
  onEdit,
  onDelete,
  onDetail,
}: {
  agents: Agent[];
  loading: boolean;
  error: string;
  onCreate: () => void;
  onToggle: (id: string) => void;
  onEdit: (agent: Agent) => void;
  onDelete: (agent: Agent) => void;
  onDetail: (agent: Agent) => void;
}) {
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<'全部' | AgentStatus>(
    '全部'
  );

  const filteredAgents = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();

    return agents.filter((agent) => {
      const matchesSearch =
        !keyword ||
        agent.name.toLowerCase().includes(keyword) ||
        agent.description.toLowerCase().includes(keyword) ||
        agent.model.toLowerCase().includes(keyword);

      const matchesStatus =
        statusFilter === '全部' || agent.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [agents, searchText, statusFilter]);

  return (
    <section className="agent-management">
      <div className="agent-page-heading">
        <div>
          <h1>Agent 管理</h1>
          <p>创建和管理智能体，查看配置状态。</p>
        </div>
        <button
          className="primary-button"
          onClick={onCreate}
          disabled={loading}
        >
          ＋ 创建 Agent
        </button>
      </div>

      <div className="agent-summary-grid">
        <div className="agent-summary-card">
          <span>全部 Agent</span>
          <strong>{agents.length}</strong>
        </div>
        <div className="agent-summary-card">
          <span>运行中</span>
          <strong>{agents.filter((a) => a.status === '运行中').length}</strong>
        </div>
        <div className="agent-summary-card">
          <span>已停用</span>
          <strong>{agents.filter((a) => a.status === '已停用').length}</strong>
        </div>
        <div className="agent-summary-card">
          <span>草稿</span>
          <strong>{agents.filter((a) => a.status === '草稿').length}</strong>
        </div>
      </div>

      <div className="panel agent-list-panel">
        <div className="agent-toolbar">
          <div className="agent-search">
            <span>⌕</span>
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="搜索 Agent 名称、描述或模型..."
            />
          </div>
          <select
            className="agent-status-filter"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as '全部' | AgentStatus)
            }
          >
            <option value="全部">全部状态</option>
            <option value="运行中">运行中</option>
            <option value="已停用">已停用</option>
            <option value="草稿">草稿</option>
          </select>
        </div>

        {loading ? (
          <div className="agent-empty">
            <strong>正在加载 Agent...</strong>
          </div>
        ) : error ? (
          <div className="agent-empty">
            <strong>加载失败</strong>
            <p>{error}</p>
          </div>
        ) : filteredAgents.length === 0 ? (
          <div className="agent-empty">
            <div className="agent-empty-icon">⌕</div>
            <strong>没有找到匹配的 Agent</strong>
            <p>可以创建一个新 Agent，数据将保存到数据库。</p>
          </div>
        ) : (
          <div className="agent-card-list">
            {filteredAgents.map((agent) => (
              <article className="agent-card" key={agent.id}>
                <div className="agent-card-icon">◇</div>
                <div className="agent-card-main">
                  <div className="agent-card-title-row">
                    <h3>{agent.name}</h3>
                    <span
                      className={`agent-status status-${
                        agent.status === '运行中'
                          ? 'running'
                          : agent.status === '已停用'
                          ? 'stopped'
                          : 'draft'
                      }`}
                    >
                      <i />
                      {agent.status}
                    </span>
                  </div>
                  <p>{agent.description}</p>
                  <div className="agent-card-meta">
                    <span>
                      <i>AI</i> 模型：{agent.model}
                    </span>
                    <span>最近更新：{agent.updatedAt}</span>
                  </div>
                </div>
                <div className="agent-card-actions">
                  <button
                    className="secondary-button"
                    onClick={() => onDetail(agent)}
                  >
                    详情
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() => onEdit(agent)}
                  >
                    编辑
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() => onToggle(agent.id)}
                  >
                    {agent.status === '运行中' ? '停用' : '启用'}
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() => onDelete(agent)}
                  >
                    删除
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="agent-list-footer">
          显示 {filteredAgents.length} 个 Agent，共 {agents.length} 个
        </div>
      </div>
    </section>
  );
}

function AgentDetail({
  agent,
  onBack,
  onEdit,
  onToggle,
  onSavePrompt,
  onRestoreAgent,
}: {
  agent: Agent;
  onBack: () => void;
  onEdit: (agent: Agent) => void;
  onToggle: (id: string) => void;
  onSavePrompt: (agent: Agent, systemPrompt: string) => Promise<void>;
  onRestoreAgent: (agent: Agent) => void;
}) {
  const statusClass =
    agent.status === '运行中'
      ? 'running'
      : agent.status === '已停用'
      ? 'stopped'
      : 'draft';

  const [systemPrompt, setSystemPrompt] = useState(agent.systemPrompt ?? '');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState('');

  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionsError, setVersionsError] = useState('');
  const [selectedVersion, setSelectedVersion] = useState<PromptVersion | null>(
    null
  );
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    setSystemPrompt(agent.systemPrompt ?? '');
  }, [agent.id, agent.systemPrompt]);

  async function loadPromptVersions() {
    setVersionsLoading(true);
    setVersionsError('');

    try {
      const data = await getPromptVersionsApi(agent.id);
      setVersions(data);
    } catch (error) {
      setVersionsError(
        error instanceof Error ? error.message : '加载版本历史失败'
      );
    } finally {
      setVersionsLoading(false);
    }
  }

  useEffect(() => {
    setSelectedVersion(null);
    void loadPromptVersions();
  }, [agent.id]);

  async function handleSavePrompt() {
    if (saving || restoring) return;

    setSaving(true);
    setSaveMessage('');
    setSaveError('');

    try {
      await onSavePrompt(agent, systemPrompt);
      setSaveMessage('系统提示词已保存。');
      await loadPromptVersions();
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : '保存失败，请重试。'
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleRestoreVersion(version: PromptVersion) {
    if (restoring || saving) return;

    const confirmed = window.confirm(
      `确定回滚到版本 V${version.versionNumber} 吗？当前提示词将替换为该版本的内容。回滚操作会创建新的版本记录。`
    );

    if (!confirmed) return;

    setRestoring(true);
    setSaveMessage('');
    setSaveError('');
    setVersionsError('');

    try {
      const restoredAgent = await restorePromptVersionApi(agent.id, version.id);

      setSystemPrompt(restoredAgent.systemPrompt ?? '');
      onRestoreAgent(restoredAgent);
      setSaveMessage(`已成功回滚到 V${version.versionNumber}。`);
      setSelectedVersion(null);

      await loadPromptVersions();
    } catch (error) {
      setVersionsError(
        error instanceof Error ? error.message : '回滚失败，请重试。'
      );
    } finally {
      setRestoring(false);
    }
  }

  return (
    <section className="agent-management">
      <div className="agent-page-heading">
        <div>
          <button className="text-button" onClick={onBack}>
            ← 返回 Agent 列表
          </button>
          <h1 style={{ marginTop: 16 }}>Agent 详情</h1>
          <p>查看智能体的基本信息与当前配置。</p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            className="secondary-button"
            onClick={() => onToggle(agent.id)}
          >
            {agent.status === '运行中' ? '停用 Agent' : '启用 Agent'}
          </button>
          <button className="primary-button" onClick={() => onEdit(agent)}>
            编辑 Agent
          </button>
        </div>
      </div>

      <div className="panel" style={{ padding: 24, marginBottom: 20 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            marginBottom: 24,
          }}
        >
          <div className="agent-card-icon">◇</div>
          <div>
            <h2 style={{ margin: '0 0 8px' }}>{agent.name}</h2>
            <span className={`agent-status status-${statusClass}`}>
              <i />
              {agent.status}
            </span>
          </div>
        </div>

        <div className="agent-summary-grid">
          <div className="agent-summary-card">
            <span>Agent ID</span>
            <strong style={{ fontSize: 14, overflowWrap: 'anywhere' }}>
              {agent.id}
            </strong>
          </div>
          <div className="agent-summary-card">
            <span>使用模型</span>
            <strong>{agent.model}</strong>
          </div>
          <div className="agent-summary-card">
            <span>当前状态</span>
            <strong>{agent.status}</strong>
          </div>
          <div className="agent-summary-card">
            <span>最近更新</span>
            <strong>{agent.updatedAt || '暂无记录'}</strong>
          </div>
        </div>
      </div>

      <div className="panel" style={{ padding: 24, marginBottom: 20 }}>
        <div className="panel-heading">
          <div>
            <h3>基本信息</h3>
            <p>此处展示已保存到数据库的 Agent 信息。</p>
          </div>
        </div>

        <div style={{ marginTop: 20 }}>
          <div style={{ marginBottom: 20 }}>
            <div className="muted-label" style={{ marginBottom: 8 }}>
              Agent 名称
            </div>
            <div>{agent.name}</div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div className="muted-label" style={{ marginBottom: 8 }}>
              功能描述
            </div>
            <div style={{ lineHeight: 1.8, overflowWrap: 'anywhere' }}>
              {agent.description || '暂无描述'}
            </div>
          </div>

          <div>
            <div className="muted-label" style={{ marginBottom: 8 }}>
              模型
            </div>
            <div>{agent.model}</div>
          </div>
        </div>
      </div>

      <div className="panel" style={{ padding: 24, marginBottom: 20 }}>
        <div className="panel-heading">
          <div>
            <h3>系统提示词</h3>
            <p>配置这个 Agent 的角色、行为规则和输出要求。</p>
          </div>
        </div>

        <div style={{ marginTop: 20 }}>
          <label htmlFor="agent-system-prompt" className="form-field">
            <span>System Prompt</span>
            <textarea
              id="agent-system-prompt"
              value={systemPrompt}
              onChange={(event) => {
                setSystemPrompt(event.target.value);
                setSaveMessage('');
                setSaveError('');
              }}
              placeholder="例如：你是一个专业的智能运维助手。请根据告警信息分析可能的故障原因，并给出有依据的排查建议。"
              rows={14}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                fontFamily: 'Consolas, "Microsoft YaHei", monospace',
                fontSize: 15,
                lineHeight: 1.8,
                resize: 'vertical',
              }}
            />
          </label>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
              marginTop: 12,
            }}
          >
            <span className="muted-label">{systemPrompt.length} 个字符</span>

            <button
              type="button"
              className="primary-button"
              onClick={() => void handleSavePrompt()}
              disabled={saving || restoring}
            >
              {saving ? '保存中...' : '保存系统提示词'}
            </button>
          </div>

          {saveMessage && (
            <p role="status" style={{ color: 'green', marginTop: 12 }}>
              {saveMessage}
            </p>
          )}

          {saveError && (
            <p role="alert" style={{ color: 'crimson', marginTop: 12 }}>
              {saveError}
            </p>
          )}
        </div>
      </div>

      <div className="panel" style={{ padding: 24, marginBottom: 20 }}>
        <div className="panel-heading">
          <div>
            <h3>提示词版本历史</h3>
            <p>查看历史版本、检查提示词内容，并按需回滚。</p>
          </div>

          <button
            type="button"
            className="secondary-button"
            onClick={() => void loadPromptVersions()}
            disabled={versionsLoading || restoring}
          >
            {versionsLoading ? '加载中...' : '刷新历史'}
          </button>
        </div>

        {versionsError && (
          <div role="alert" style={{ color: 'crimson', marginTop: 16 }}>
            {versionsError}
          </div>
        )}

        {versionsLoading ? (
          <div className="agent-empty">
            <strong>正在加载版本历史...</strong>
          </div>
        ) : versions.length === 0 ? (
          <div className="agent-empty">
            <strong>暂无版本记录</strong>
            <p>保存系统提示词后，版本记录会显示在这里。</p>
          </div>
        ) : (
          <div style={{ marginTop: 20 }}>
            {versions.map((version) => (
              <div
                key={version.id}
                style={{
                  border: '1px solid var(--border-color, #cbd5e1)',
                  borderRadius: 10,
                  padding: 16,
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <strong>V{version.versionNumber}</strong>
                    <div className="muted-label" style={{ marginTop: 6 }}>
                      {version.createdAt
                        ? new Date(version.createdAt).toLocaleString()
                        : '时间未知'}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: '#64748b',
                        marginTop: 5,
                      }}
                    >
                      {version.systemPrompt.length} 个字符
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() =>
                        setSelectedVersion((current) =>
                          current?.id === version.id ? null : version
                        )
                      }
                    >
                      {selectedVersion?.id === version.id
                        ? '收起内容'
                        : '查看内容'}
                    </button>

                    <button
                      type="button"
                      className="secondary-button"
                      disabled={restoring || saving}
                      onClick={() => void handleRestoreVersion(version)}
                    >
                      {restoring ? '回滚中...' : '回滚此版本'}
                    </button>
                  </div>
                </div>

                {selectedVersion?.id === version.id && (
                  <div style={{ marginTop: 16 }}>
                    <div className="muted-label" style={{ marginBottom: 8 }}>
                      V{version.versionNumber} 的系统提示词
                    </div>
                    <pre
                      style={{
                        whiteSpace: 'pre-wrap',
                        overflowWrap: 'anywhere',
                        wordBreak: 'break-word',
                        fontFamily:
                          'Consolas, "Microsoft YaHei", "PingFang SC", monospace',
                        fontSize: 16,
                        lineHeight: 2,
                        color: '#1e293b',
                        background: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        borderRadius: 10,
                        padding: 24,
                        maxHeight: 600,
                        overflowY: 'auto',
                        margin: 0,
                        textAlign: 'left',
                        tabSize: 2,
                      }}
                    >
                      {version.systemPrompt || '（该版本的提示词为空）'}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel" style={{ padding: 24 }}>
        <div className="panel-heading">
          <div>
            <h3>其他高级配置</h3>
            <p>模型参数与 Skills 绑定将在后续步骤中实现。</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function AgentFormModal({
  initialAgent,
  title,
  description: modalDescription,
  submitLabel,
  onClose,
  onSubmit,
}: {
  initialAgent?: Agent;
  title: string;
  description: string;
  submitLabel: string;
  onClose: () => void;
  onSubmit: (data: AgentFormData) => void | Promise<void>;
}) {
  const [name, setName] = useState(initialAgent?.name ?? '');
  const [description, setDescription] = useState(
    initialAgent?.description ?? ''
  );
  const [model, setModel] = useState(initialAgent?.model ?? 'Qwen');
  const [status, setStatus] = useState<AgentStatus>(
    initialAgent?.status ?? '草稿'
  );
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      setError('请先填写 Agent 名称。');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || '暂无描述',
        model,
        status,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败，请重试');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form className="agent-modal" onSubmit={submitForm}>
        <div className="modal-heading">
          <div>
            <h2>{title}</h2>
            <p>{modalDescription}</p>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <label className="form-field">
          <span>
            Agent 名称 <i>*</i>
          </span>
          <input
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setError('');
            }}
            placeholder="例如：智能运维助手"
            autoFocus
          />
        </label>

        <label className="form-field">
          <span>功能描述</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="简要描述这个 Agent 的用途"
            rows={3}
          />
        </label>

        <label className="form-field">
          <span>模型</span>
          <select
            value={model}
            onChange={(event) => setModel(event.target.value)}
          >
            <option value="Qwen">Qwen</option>
            <option value="DeepSeek">DeepSeek</option>
            <option value="GLM">GLM</option>
            <option value="未配置">未配置</option>
          </select>
        </label>

        <label className="form-field">
          <span>{initialAgent ? 'Agent 状态' : '初始状态'}</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as AgentStatus)}
          >
            <option value="草稿">草稿</option>
            <option value="运行中">运行中</option>
            <option value="已停用">已停用</option>
          </select>
        </label>

        {error && <div className="form-error">{error}</div>}

        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            取消
          </button>
          <button
            type="submit"
            className="primary-button"
            disabled={submitting}
          >
            {submitting ? '保存中...' : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

function PlaceholderPage({ page }: { page: PageId }) {
  const current = navigation.find((item) => item.id === page);

  return (
    <div className="placeholder-page">
      <div className="placeholder-icon">{current?.icon}</div>
      <h1>{current?.label}</h1>
      <p>{descriptions[page]}</p>
      <span className="coming-soon">功能开发中</span>
    </div>
  );
}

export default function App() {
  const [activePage, setActivePage] = useState<PageId>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [agentsError, setAgentsError] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  async function reloadAgents() {
    setAgentsLoading(true);
    setAgentsError('');

    try {
      const data = await getAgents();
      setAgents(data);
    } catch (error) {
      setAgentsError(
        error instanceof Error ? error.message : '加载 Agent 失败'
      );
    } finally {
      setAgentsLoading(false);
    }
  }

  useEffect(() => {
    void reloadAgents();
  }, []);

  async function createAgent(agentData: AgentFormData) {
    const newAgent: Agent = {
      ...agentData,
      id: `agent-${Date.now()}`,
      updatedAt: new Date().toISOString().slice(0, 10),
      systemPrompt: '',
    };

    const savedAgent = await createAgentApi(newAgent);
    setAgents((current) => [savedAgent, ...current]);
    setCreateModalOpen(false);
    setAgentsError('');
  }

  async function updateAgent(agentData: AgentFormData) {
    if (!editingAgent) return;

    const updated: Agent = {
      ...editingAgent,
      ...agentData,
      systemPrompt: editingAgent.systemPrompt ?? '',
      updatedAt: new Date().toISOString().slice(0, 10),
    };

    const savedAgent = await updateAgentApi(updated);

    setAgents((current) =>
      current.map((agent) => (agent.id === savedAgent.id ? savedAgent : agent))
    );

    setSelectedAgent((current) =>
      current?.id === savedAgent.id ? savedAgent : current
    );

    setEditingAgent(null);
    setAgentsError('');
  }

  async function saveSystemPrompt(agent: Agent, systemPrompt: string) {
    const updated: Agent = {
      ...agent,
      systemPrompt,
      updatedAt: new Date().toISOString().slice(0, 10),
    };

    const savedAgent = await updateAgentApi(updated);

    setAgents((current) =>
      current.map((item) => (item.id === savedAgent.id ? savedAgent : item))
    );

    setSelectedAgent((current) =>
      current?.id === savedAgent.id ? savedAgent : current
    );

    setAgentsError('');
  }

  function updateRestoredAgent(restoredAgent: Agent) {
    setAgents((current) =>
      current.map((item) =>
        item.id === restoredAgent.id ? restoredAgent : item
      )
    );

    setSelectedAgent((current) =>
      current?.id === restoredAgent.id ? restoredAgent : current
    );

    setAgentsError('');
  }

  async function toggleAgent(id: string) {
    const agent = agents.find((item) => item.id === id);
    if (!agent) return;

    const updated: Agent = {
      ...agent,
      status: agent.status === '运行中' ? '已停用' : '运行中',
      updatedAt: new Date().toISOString().slice(0, 10),
    };

    try {
      const savedAgent = await updateAgentApi(updated);

      setAgents((current) =>
        current.map((item) => (item.id === id ? savedAgent : item))
      );

      setSelectedAgent((current) =>
        current?.id === id ? savedAgent : current
      );

      setAgentsError('');
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '修改状态失败');
    }
  }

  async function deleteAgent(agent: Agent) {
    const confirmed = window.confirm(
      `确定要删除 Agent「${agent.name}」吗？\n删除后无法通过页面恢复。`
    );

    if (!confirmed) return;

    try {
      await deleteAgentApi(agent.id);
      setAgents((current) => current.filter((item) => item.id !== agent.id));

      if (selectedAgent?.id === agent.id) {
        setSelectedAgent(null);
        setActivePage('agents');
      }

      setAgentsError('');
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '删除 Agent 失败');
    }
  }

  function navigate(page: PageId) {
    if (page !== 'agentDetail') {
      setActivePage(page);
    }

    setMobileMenuOpen(false);
  }

  const detailAgent = selectedAgent
    ? agents.find((item) => item.id === selectedAgent.id) ?? selectedAgent
    : null;

  return (
    <div className="app-shell">
      {mobileMenuOpen && (
        <button
          className="mobile-overlay"
          aria-label="关闭菜单"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <div
        className={
          mobileMenuOpen
            ? 'sidebar-wrap mobile-drawer open'
            : 'sidebar-wrap mobile-drawer'
        }
      >
        <Sidebar
          activePage={activePage}
          onNavigate={navigate}
          agentCount={agents.length}
        />
      </div>

      <main className="main-area">
        <Topbar
          activePage={activePage}
          onMenuClick={() => setMobileMenuOpen(true)}
        />

        <div className="page-content">
          {activePage === 'overview' && (
            <Overview
              onNavigate={navigate}
              agents={agents}
              loading={agentsLoading}
              error={agentsError}
            />
          )}

          {activePage === 'agents' && (
            <AgentManagement
              agents={agents}
              loading={agentsLoading}
              error={agentsError}
              onCreate={() => setCreateModalOpen(true)}
              onToggle={(id) => void toggleAgent(id)}
              onEdit={(agent) => setEditingAgent(agent)}
              onDelete={(agent) => void deleteAgent(agent)}
              onDetail={(agent) => {
                setSelectedAgent(agent);
                setActivePage('agentDetail');
              }}
            />
          )}

          {activePage === 'agentDetail' && detailAgent && (
            <AgentDetail
              agent={detailAgent}
              onBack={() => setActivePage('agents')}
              onEdit={(agent) => {
                setSelectedAgent(agent);
                setEditingAgent(agent);
              }}
              onToggle={(id) => void toggleAgent(id)}
              onSavePrompt={saveSystemPrompt}
              onRestoreAgent={updateRestoredAgent}
            />
          )}

          {activePage === 'agentDetail' && !detailAgent && (
            <div className="agent-empty">
              <strong>没有选择 Agent</strong>
              <p>请返回 Agent 管理并选择一个 Agent。</p>
              <button
                className="primary-button"
                onClick={() => setActivePage('agents')}
              >
                返回 Agent 列表
              </button>
            </div>
          )}

          {activePage === 'playground' && <Playground agents={agents} />}

          {activePage !== 'overview' &&
            activePage !== 'agents' &&
            activePage !== 'agentDetail' &&
            activePage !== 'playground' && (
              <PlaceholderPage page={activePage} />
            )}
        </div>
      </main>

      {createModalOpen && (
        <AgentFormModal
          title="创建 Agent"
          description="填写基本信息，创建一个 Agent 并保存到数据库。"
          submitLabel="创建 Agent"
          onClose={() => setCreateModalOpen(false)}
          onSubmit={createAgent}
        />
      )}

      {editingAgent && (
        <AgentFormModal
          key={editingAgent.id}
          initialAgent={editingAgent}
          title="编辑 Agent"
          description="修改智能体的基本信息，保存后同步更新数据库。"
          submitLabel="保存修改"
          onClose={() => setEditingAgent(null)}
          onSubmit={updateAgent}
        />
      )}
    </div>
  );
}
