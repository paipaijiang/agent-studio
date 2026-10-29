
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
    color: '#047857',
    background: '#d1fae5',
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

  const [provider, setProvider] = useState<Provider>('deepseek');
  const initialProvider = providerOptions.find(
    (item) => item.value === 'deepseek'
  )!;

  const [model, setModel] = useState(initialProvider.defaultModel);
  const [baseUrl, setBaseUrl] = useState(initialProvider.defaultUrl);
  const [apiKey, setApiKey] = useState('');
  const [systemPrompt, setSystemPrompt] = useState(
    selectedAgent?.systemPrompt ?? ''
  );
  const [userInput, setUserInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState(
    '已接入真实模型接口。填写 API Key 后即可测试。'
  );

  useEffect(() => {
    setSystemPrompt(selectedAgent?.systemPrompt ?? '');
    setMessages([]);
    setStatusMessage('已切换 Agent，对话已清空。');
  }, [agentId]);

  function handleProviderChange(nextProvider: Provider) {
    const option = providerOptions.find(
      (item) => item.value === nextProvider
    );

    if (!option) return;

    setProvider(nextProvider);
    setModel(option.defaultModel);
    setBaseUrl(option.defaultUrl);
    setApiKey('');
    setStatusMessage('模型配置已切换，请检查模型名称和 API Key。');
  }

  function handleClearChat() {
    if (busy) return;

    setMessages([]);
    setUserInput('');
    setStatusMessage('对话已清空。');
  }

  async function handleRun() {
    const input = userInput.trim();

    if (busy) return;

    if (!selectedAgent) {
      setStatusMessage('请先创建或选择一个 Agent。');
      return;
    }

    if (!input) {
      setStatusMessage('请先输入一条测试消息。');
      return;
    }

    if (!model.trim()) {
      setStatusMessage('请填写模型名称。');
      return;
    }

    if (!baseUrl.trim()) {
      setStatusMessage('请填写 API Base URL。');
      return;
    }

    if (!apiKey.trim()) {
      setStatusMessage('请先填写 API Key。');
      return;
    }

    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: 'user',
      content: input,
      time: new Date().toLocaleTimeString(),
    };

    // 将当前输入与之前的对话一起发送，支持多轮交流。
    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setUserInput('');
    setBusy(true);
    setStatusMessage('正在请求真实模型，请稍候……');

    try {
      const response = await fetch('/api/playground/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agentId: selectedAgent.id,
          model: model.trim(),
          baseUrl: baseUrl.trim(),
          apiKey: apiKey.trim(),
          systemPrompt,
          messages: nextMessages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || result?.success !== true) {
        throw new Error(
          result?.message || `请求失败，HTTP ${response.status}`
        );
      }

      const answer = result?.data?.content;

      if (typeof answer !== 'string' || !answer.trim()) {
        throw new Error('接口没有返回有效的模型回答。');
      }

      const assistantMessage: ChatMessage = {
        id: `${Date.now()}-assistant`,
        role: 'assistant',
        content: answer,
        time: new Date().toLocaleTimeString(),
      };

      setMessages((current) => [...current, assistantMessage]);

      const actualModel = result?.data?.model || model;

      setStatusMessage(`真实模型调用成功：${actualModel}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '未知错误';

      setStatusMessage(`调用失败：${message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={styles.page}>
      <div style={styles.heading}>
        <div>
          <h1 style={styles.title}>Agent 运行试验场</h1>
          <p style={styles.subtitle}>
            配置模型、调整临时提示词，并测试 Agent 的真实对话效果。
          </p>
        </div>
        <span style={styles.badge}>真实模型调用</span>
      </div>

      <div style={styles.layout} className="playground-layout">
        <section style={styles.panel}>
          <h2 style={styles.panelTitle}>运行配置</h2>
          <p style={styles.panelSubtitle}>
            当前使用后端代理调用模型。API Key 不会写入 Agent 数据库。
          </p>

          <label style={styles.field}>
            <span style={styles.label}>选择 Agent</span>
            <select
              style={styles.input}
              value={agentId}
              disabled={busy}
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
              disabled={busy}
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
              disabled={busy}
              onChange={(event) => setModel(event.target.value)}
              placeholder="例如 deepseek-chat"
            />
          </label>

          <label style={styles.field}>
            <span style={styles.label}>API Base URL</span>
            <input
              style={styles.input}
              value={baseUrl}
              disabled={busy}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="https://api.deepseek.com"
            />
            <span style={styles.hint}>
              DeepSeek 默认地址为 https://api.deepseek.com。
            </span>
          </label>

          <label style={styles.field}>
            <span style={styles.label}>API Key</span>
            <input
              style={styles.input}
              type="password"
              autoComplete="new-password"
              value={apiKey}
              disabled={busy}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="在这里填写自己的 API Key"
            />
            <span style={styles.hint}>
              仅保存在当前页面内存中，刷新后清空。调用时会通过后端转发；
              不要将 Key 发给他人或提交到 GitHub。
            </span>
          </label>

          <label style={styles.field}>
            <span style={styles.label}>临时 System Prompt</span>
            <textarea
              style={styles.textarea}
              rows={10}
              value={systemPrompt}
              disabled={busy}
              onChange={(event) => setSystemPrompt(event.target.value)}
              placeholder="临时修改提示词，不会覆盖 Agent 已保存的版本。"
            />
            <span style={styles.hint}>
              {systemPrompt.length} 个字符 · 仅用于当前试验场
            </span>
          </label>

          <div
            style={{
              borderRadius: 8,
              background: '#eff6ff',
              color: '#1d4ed8',
              fontSize: 12,
              padding: 12,
              lineHeight: 1.8,
            }}
          >
            运行前请确认 API Key 有效、账户有可用额度，并确认模型名称正确。
            真实调用可能产生费用。
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
            <button
              style={{
                ...styles.button,
                opacity: busy ? 0.5 : 1,
                cursor: busy ? 'not-allowed' : 'pointer',
              }}
              disabled={busy}
              onClick={handleClearChat}
            >
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
                  填写 API Key，输入问题，即可查看真实模型的回答。
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
                    {message.role === 'user'
                      ? '你'
                      : 'Agent 真实回复'}
                    {' · '}
                    {message.time}
                  </div>
                  <div
                    style={{
                      ...styles.message,
                      background:
                        message.role === 'user' ? '#6d5efc' : '#ffffff',
                      color:
                        message.role === 'user' ? '#ffffff' : '#1e293b',
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

            {busy && (
              <div
                style={{
                  alignSelf: 'flex-start',
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 12,
                  padding: '12px 14px',
                  fontSize: 13,
                  color: '#64748b',
                }}
              >
                正在等待模型回复……
              </div>
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
                opacity: busy ? 0.7 : 1,
              }}
              rows={3}
              value={userInput}
              disabled={busy}
              onChange={(event) => setUserInput(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === 'Enter' &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  void handleRun();
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
                  opacity: busy || !userInput.trim() ? 0.6 : 1,
                  cursor: busy ? 'wait' : 'pointer',
                }}
                disabled={busy || !userInput.trim()}
                onClick={() => void handleRun()}
              >
                {busy ? '模型运行中…' : '运行真实 Agent →'}
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
