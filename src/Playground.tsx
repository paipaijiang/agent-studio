import { useEffect, useState } from 'react';
import type { Agent } from './data/mock';

type Provider = 'openai' | 'qwen' | 'deepseek' | 'ollama' | 'custom';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  time: string;
};

const providerOptions: {
  value: Provider;
  label: string;
  defaultModel: string;
  defaultUrl: string;
}[] = [
  {
    value: 'openai',
    label: 'OpenAI 兼容接口',
    defaultModel: 'gpt-4o-mini',
    defaultUrl: 'https://api.openai.com/v1',
  },
  {
    value: 'qwen',
    label: '阿里云百炼 / 通义千问',
    defaultModel: 'qwen-plus',
    defaultUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  },
  {
    value: 'deepseek',
    label: 'DeepSeek',
    defaultModel: 'deepseek-chat',
    defaultUrl: 'https://api.deepseek.com',
  },
  {
    value: 'ollama',
    label: '本地 Ollama',
    defaultModel: 'qwen2.5:7b',
    defaultUrl: 'http://localhost:11434/v1',
  },
  {
    value: 'custom',
    label: '公司内部 / 自定义接口',
    defaultModel: '',
    defaultUrl: '',
  },
];

const styles: Record<string, React.CSSProperties> = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
    color: '#1e293b',
  },
  heading: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    margin: '0 0 8px',
  },
  subtitle: {
    color: '#64748b',
    fontSize: 14,
    margin: 0,
  },
  badge: {
    fontSize: 12,
    color: '#7c3aed',
    background: '#ede9fe',
    borderRadius: 20,
    padding: '7px 12px',
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(270px, 340px) minmax(0, 1fr)',
    gap: 20,
    alignItems: 'start',
  },
  panel: {
    border: '1px solid #e2e8f0',
    borderRadius: 14,
    background: '#ffffff',
    padding: 20,
    minWidth: 0,
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: 700,
    margin: '0 0 6px',
  },
  panelSubtitle: {
    fontSize: 12,
    color: '#64748b',
    margin: '0 0 20px',
    lineHeight: 1.7,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 7,
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: '#334155',
  },
  input: {
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    border: '1px solid #cbd5e1',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 13,
    color: '#1e293b',
    background: '#fff',
    outlineColor: '#8b5cf6',
  },
  textarea: {
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    border: '1px solid #cbd5e1',
    borderRadius: 8,
    padding: 12,
    fontSize: 13,
    lineHeight: 1.8,
    color: '#1e293b',
    background: '#fff',
    resize: 'vertical',
    fontFamily: 'Consolas, "Microsoft YaHei", monospace',
  },
  hint: {
    fontSize: 11,
    color: '#64748b',
    lineHeight: 1.7,
  },
  button: {
    border: '1px solid #cbd5e1',
    borderRadius: 8,
    padding: '9px 13px',
    background: '#fff',
    color: '#334155',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
  },
  primaryButton: {
    border: 'none',
    borderRadius: 8,
    padding: '10px 16px',
    background: '#6d5efc',
    color: '#fff',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
  },
  chatPanel: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: 650,
    border: '1px solid #e2e8f0',
    borderRadius: 14,
    background: '#fff',
    overflow: 'hidden',
    minWidth: 0,
  },
  chatHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    padding: '16px 20px',
    borderBottom: '1px solid #e2e8f0',
  },
  messages: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    padding: 20,
    flex: 1,
    minHeight: 300,
    maxHeight: 600,
    overflowY: 'auto',
    background: '#f8fafc',
  },
  message: {
    maxWidth: '88%',
    borderRadius: 12,
    padding: '12px 14px',
    fontSize: 14,
    lineHeight: 1.8,
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
  },
  composer: {
    borderTop: '1px solid #e2e8f0',
    padding: 16,
    background: '#fff',
  },
};

export default function Playground({ agents }: { agents: Agent[] }) {
  const [agentId, setAgentId] = useState(agents[0]?.id ?? '');
  const selectedAgent = agents.find((agent) => agent.id === agentId);

  const [provider, setProvider] = useState<Provider>('openai');
  const initialProvider = providerOptions[0];

  const [model, setModel] = useState(initialProvider.defaultModel);
  const [baseUrl, setBaseUrl] = useState(initialProvider.defaultUrl);
  const [apiKey, setApiKey] = useState('');
  const [systemPrompt, setSystemPrompt] = useState(
    selectedAgent?.systemPrompt ?? ''
  );
  const [userInput, setUserInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [statusMessage, setStatusMessage] =
    useState('当前为模拟模式，尚未调用真实模型。');

  useEffect(() => {
    setSystemPrompt(selectedAgent?.systemPrompt ?? '');
    setMessages([]);
    setStatusMessage('已切换 Agent。当前为模拟模式。');
  }, [agentId]);

  function handleProviderChange(nextProvider: Provider) {
    const option = providerOptions.find((item) => item.value === nextProvider);

    if (!option) return;

    setProvider(nextProvider);
    setModel(option.defaultModel);
    setBaseUrl(option.defaultUrl);
    setApiKey('');
    setStatusMessage('模型配置已切换。当前为模拟模式。');
  }

  function handleClearChat() {
    setMessages([]);
    setUserInput('');
    setStatusMessage('对话已清空。');
  }

  function handleRun() {
    const input = userInput.trim();

    if (!input) {
      setStatusMessage('请先输入一条测试消息。');
      return;
    }

    const now = new Date().toLocaleTimeString();

    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: 'user',
      content: input,
      time: now,
    };

    const assistantMessage: ChatMessage = {
      id: `${Date.now()}-assistant`,
      role: 'assistant',
      content: [
        '【模拟回复：尚未连接真实大模型】',
        '',
        `当前 Agent：${selectedAgent?.name ?? '未选择 Agent'}`,
        `模型提供方：${
          providerOptions.find((item) => item.value === provider)?.label ??
          provider
        }`,
        `模型名称：${model || '未填写'}`,
        '',
        '你的测试消息是：',
        input,
        '',
        '接入真实模型后，这里将展示模型根据 System Prompt 和对话上下文生成的实际回复。',
      ].join('\n'),
      time: new Date().toLocaleTimeString(),
    };

    setMessages((current) => [...current, userMessage, assistantMessage]);

    setUserInput('');
    setStatusMessage('模拟运行完成。该结果不是实际模型输出。');
  }

  return (
    <section style={styles.page}>
      <div style={styles.heading}>
        <div>
          <h1 style={styles.title}>Agent 运行试验场</h1>
          <p style={styles.subtitle}>
            配置模型、调整临时提示词，并测试 Agent 的对话效果。
          </p>
        </div>
        <span style={styles.badge}>页面预览 · 模拟模式</span>
      </div>

      <div style={styles.layout} className="playground-layout">
        <section style={styles.panel}>
          <h2 style={styles.panelTitle}>运行配置</h2>
          <p style={styles.panelSubtitle}>
            当前配置仅用于页面测试，尚未发送到模型服务。
          </p>

          <label style={styles.field}>
            <span style={styles.label}>选择 Agent</span>
            <select
              style={styles.input}
              value={agentId}
              onChange={(event) => setAgentId(event.target.value)}
            >
              <option value="">请选择 Agent</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </label>

          {selectedAgent && (
            <div
              style={{
                padding: 12,
                background: '#f8fafc',
                borderRadius: 8,
                marginBottom: 18,
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 13 }}>
                {selectedAgent.name}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: '#64748b',
                  marginTop: 5,
                  lineHeight: 1.7,
                }}
              >
                {selectedAgent.description || '暂无描述'}
              </div>
            </div>
          )}

          <label style={styles.field}>
            <span style={styles.label}>模型提供方</span>
            <select
              style={styles.input}
              value={provider}
              onChange={(event) =>
                handleProviderChange(event.target.value as Provider)
              }
            >
              {providerOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label style={styles.field}>
            <span style={styles.label}>模型名称</span>
            <input
              style={styles.input}
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder="填写模型名称"
            />
          </label>

          <label style={styles.field}>
            <span style={styles.label}>API Base URL</span>
            <input
              style={styles.input}
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="填写模型 API 地址"
            />
            <span style={styles.hint}>
              本地 Ollama
              需要后端能够访问对应地址；浏览器地址不一定等于后端地址。
            </span>
          </label>

          <label style={styles.field}>
            <span style={styles.label}>API Key（可选）</span>
            <input
              style={styles.input}
              type="password"
              autoComplete="new-password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="页面预览阶段无需填写"
            />
            <span style={styles.hint}>
              当前仅保存在页面内存中，不会发送或保存。刷新页面后会清空。
            </span>
          </label>

          <label style={styles.field}>
            <span style={styles.label}>临时 System Prompt</span>
            <textarea
              style={styles.textarea}
              rows={10}
              value={systemPrompt}
              onChange={(event) => setSystemPrompt(event.target.value)}
              placeholder="在这里临时修改提示词，不会覆盖 Agent 已保存的版本。"
            />
            <span style={styles.hint}>
              {systemPrompt.length} 个字符 · 仅用于当前试验场页面
            </span>
          </label>

          <div
            style={{
              borderRadius: 8,
              background: '#fffbeb',
              color: '#92400e',
              fontSize: 12,
              padding: 12,
              lineHeight: 1.8,
            }}
          >
            注意：现在点击运行只会生成模拟回复。真实模型调用将在下一阶段接入后端。
          </div>
        </section>

        <section style={styles.chatPanel}>
          <div style={styles.chatHeader}>
            <div>
              <h2 style={{ ...styles.panelTitle, marginBottom: 5 }}>
                测试对话
              </h2>
              <div style={styles.hint}>
                {selectedAgent?.name ?? '尚未选择 Agent'}
                {' · '}
                {model || '未配置模型'}
              </div>
            </div>
            <button style={styles.button} onClick={handleClearChat}>
              清空对话
            </button>
          </div>

          <div style={styles.messages}>
            {messages.length === 0 ? (
              <div
                style={{
                  margin: 'auto',
                  textAlign: 'center',
                  maxWidth: 360,
                  padding: 24,
                }}
              >
                <div style={{ fontSize: 36, marginBottom: 12 }}>✧</div>
                <h3 style={{ fontSize: 17, margin: '0 0 8px' }}>
                  开始测试你的 Agent
                </h3>
                <p
                  style={{
                    fontSize: 13,
                    lineHeight: 1.9,
                    color: '#64748b',
                    margin: 0,
                  }}
                >
                  输入问题，观察模拟运行结果。后续接入真实模型后，这里将显示实际回复。
                </p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  style={{
                    alignSelf:
                      message.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '100%',
                    width: 'fit-content',
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: '#64748b',
                      marginBottom: 6,
                      textAlign: message.role === 'user' ? 'right' : 'left',
                    }}
                  >
                    {message.role === 'user' ? '你' : 'Agent 模拟回复'}
                    {' · '}
                    {message.time}
                  </div>
                  <div
                    style={{
                      ...styles.message,
                      background:
                        message.role === 'user' ? '#6d5efc' : '#ffffff',
                      color: message.role === 'user' ? '#ffffff' : '#1e293b',
                      border:
                        message.role === 'user'
                          ? '1px solid #6d5efc'
                          : '1px solid #e2e8f0',
                    }}
                  >
                    {message.content}
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={styles.composer}>
            <div style={styles.hint} role="status">
              {statusMessage}
            </div>
            <textarea
              style={{
                ...styles.textarea,
                marginTop: 10,
                marginBottom: 10,
              }}
              rows={3}
              value={userInput}
              onChange={(event) => setUserInput(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === 'Enter' &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  handleRun();
                }
              }}
              placeholder="输入测试消息，按 Enter 运行，Shift + Enter 换行"
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <span style={styles.hint}>
                {messages.filter((message) => message.role === 'user').length}{' '}
                条测试消息
              </span>
              <button
                style={{
                  ...styles.primaryButton,
                  opacity: userInput.trim() ? 1 : 0.6,
                }}
                onClick={handleRun}
              >
                运行模拟 Agent →
              </button>
            </div>
          </div>
        </section>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .playground-layout {
            grid-template-columns: minmax(0, 1fr) !important;
          }
        }
      `}</style>
    </section>
  );
}
