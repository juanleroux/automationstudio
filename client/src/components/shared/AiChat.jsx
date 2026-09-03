import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, X, Send, Loader2, ChevronDown, Trash2, Bot } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';

// ── Action executor ────────────────────────────────────────────────────────────
function useActionExecutor(onChangeView, updateProject, saveCurrentProject) {
  return useCallback((actions) => {
    const results = [];
    for (const { tool, input } of actions) {
      try {
        switch (tool) {
          case 'navigate_to_view':
            onChangeView(input.view);
            results.push(`Navigated to ${input.view}`);
            break;

          case 'create_template':
            updateProject(p => {
              const newId = Math.max(0, ...(p.templates || []).map(t => t.id)) + 1;
              const attrs = (input.attributes || []).map((a, i) => ({
                id: Date.now() + i,
                name: a.name,
                type: a.type || 'String',
                value: a.value ?? '',
                required: a.required ?? false,
              }));
              return { ...p, templates: [...(p.templates || []), { id: newId, name: input.name, attributes: attrs, instances: [] }] };
            });
            results.push(`Created template "${input.name}"`);
            break;

          case 'create_instance':
            updateProject(p => {
              const templates = (p.templates || []).map(t => {
                const match = input.templateId ? t.id === input.templateId : t.name === input.templateName;
                if (!match) return t;
                const newId = Math.max(0, ...(t.instances || []).map(i => i.id)) + 1;
                const attrs = Object.entries(input.attributes || {}).map(([name, value]) => {
                  const ta = (t.attributes || []).find(a => a.name === name);
                  return ta ? { id: ta.id, value: String(value) } : null;
                }).filter(Boolean);
                return { ...t, instances: [...(t.instances || []), { id: newId, name: input.name, isFlagged: false, attributes: attrs }] };
              });
              return { ...p, templates };
            });
            results.push(`Created instance "${input.name}"`);
            break;

          case 'update_instance':
            updateProject(p => {
              const templates = (p.templates || []).map(t => {
                if (input.templateId && t.id !== input.templateId) return t;
                const instances = (t.instances || []).map(i => {
                  const match = input.instanceId ? i.id === input.instanceId : i.name === input.instanceName;
                  if (!match) return i;
                  let updated = { ...i };
                  if (input.newName) updated.name = input.newName;
                  if (input.isFlagged !== undefined) updated.isFlagged = input.isFlagged;
                  if (input.attributes) {
                    const existingAttrs = [...(i.attributes || [])];
                    Object.entries(input.attributes).forEach(([name, value]) => {
                      const ta = (t.attributes || []).find(a => a.name === name);
                      if (!ta) return;
                      const idx = existingAttrs.findIndex(a => a.id === ta.id);
                      if (idx >= 0) existingAttrs[idx] = { ...existingAttrs[idx], value: String(value) };
                      else existingAttrs.push({ id: ta.id, value: String(value) });
                    });
                    updated.attributes = existingAttrs;
                  }
                  return updated;
                });
                return { ...t, instances };
              });
              return { ...p, templates };
            });
            results.push(`Updated instance "${input.instanceName || input.instanceId}"`);
            break;

          case 'delete_instance':
            updateProject(p => {
              const templates = (p.templates || []).map(t => {
                if (input.templateId && t.id !== input.templateId) return t;
                return {
                  ...t,
                  instances: (t.instances || []).filter(i =>
                    input.instanceId ? i.id !== input.instanceId : i.name !== input.instanceName
                  ),
                };
              });
              return { ...p, templates };
            });
            results.push(`Deleted instance "${input.instanceName || input.instanceId}"`);
            break;

          case 'delete_template':
            updateProject(p => ({
              ...p,
              templates: (p.templates || []).filter(t =>
                input.templateId ? t.id !== input.templateId : t.name !== input.templateName
              ),
            }));
            results.push(`Deleted template "${input.templateName || input.templateId}"`);
            break;

          case 'add_topology_node':
            updateProject(p => {
              const nodes = p.nodes || [];
              const newId = `node_${Date.now()}`;
              const x = 200 + (nodes.length % 8) * 120;
              const y = 100 + Math.floor(nodes.length / 8) * 140;
              return {
                ...p,
                nodes: [...nodes, { id: newId, name: input.name, type: input.type, x, y, level: input.level ?? 0, color: null, confirmed: false }],
              };
            });
            results.push(`Added node "${input.name}" (${input.type})`);
            break;

          case 'flag_instance':
            updateProject(p => {
              const itemSet = new Set((input.items || []).map(it => it.instanceId ?? it.instanceName));
              const templates = (p.templates || []).map(t => ({
                ...t,
                instances: (t.instances || []).map(i => {
                  const match = itemSet.has(i.id) || itemSet.has(i.name);
                  return match ? { ...i, isFlagged: input.isFlagged } : i;
                }),
              }));
              return { ...p, templates };
            });
            results.push(`${input.isFlagged ? 'Flagged' : 'Unflagged'} ${(input.items || []).length} instance(s)`);
            break;

          case 'save_project':
            saveCurrentProject();
            results.push('Project saved');
            break;

          default:
            results.push(`Unknown action: ${tool}`);
        }
      } catch (e) {
        results.push(`Action "${tool}" failed: ${e.message}`);
      }
    }
    return results;
  }, [onChangeView, updateProject, saveCurrentProject]);
}

// ── Message bubble ─────────────────────────────────────────────────────────────
function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
      {!isUser && (
        <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginRight: 8, marginTop: 2 }}>
          <Sparkles size={13} color="white" />
        </div>
      )}
      <div
        style={{
          maxWidth: '80%',
          padding: '8px 12px',
          borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
          background: isUser ? 'var(--accent)' : 'var(--bg-surface)',
          color: isUser ? 'white' : 'var(--text-primary)',
          fontSize: 13,
          lineHeight: 1.5,
          border: isUser ? 'none' : '1px solid var(--border)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {msg.content}
      </div>
    </div>
  );
}

// ── Action chip ────────────────────────────────────────────────────────────────
function ActionChip({ label }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11, padding: '2px 8px', borderRadius: 20,
      background: 'rgba(34,197,94,0.15)', color: '#22c55e',
      border: '1px solid rgba(34,197,94,0.3)', marginRight: 4, marginBottom: 4,
    }}>
      ✓ {label}
    </span>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function AiChat({ activeView, onChangeView, open, onSetOpen }) {
  const { project, updateProject, saveCurrentProject } = useProject();
  const [messages, setMessages] = useState([]);   // { role, content, actions? }
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const executeAction = useActionExecutor(onChangeView, updateProject, saveCurrentProject);

  useEffect(() => {
    if (open && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open]);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { role: 'user', content: text };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    try {
      const apiMessages = nextMessages.map(m => ({ role: m.role, content: m.content }));
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, project, activeView }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');

      let actionResults = [];
      if (data.actions?.length) {
        actionResults = executeAction(data.actions);
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.reply,
        actions: actionResults,
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Sorry, something went wrong: ${err.message}`,
      }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, project, activeView, executeAction]);

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const clearChat = () => setMessages([]);

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => onSetOpen(v => !v)}
        title="AI Assistant"
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
          width: 52, height: 52, borderRadius: '50%',
          background: open ? 'var(--accent)' : 'var(--bg-surface)',
          border: '2px solid var(--accent)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'all 0.2s',
        }}
      >
        {open
          ? <ChevronDown size={20} color="white" />
          : <Sparkles size={22} style={{ color: 'var(--accent)' }} />
        }
      </button>

      {/* Chat panel */}
      {open && (
        <div
          style={{
            position: 'fixed', bottom: 88, right: 24, zIndex: 999,
            width: 380, height: 560,
            background: 'var(--bg-main)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            boxShadow: '0 8px 40px rgba(0,0,0,0.3)',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px',
            background: 'var(--bg-surface)',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles size={15} color="white" />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>AI Assistant</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Automation Studio · Full access</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {messages.length > 0 && (
                <button
                  onClick={clearChat}
                  title="Clear chat"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6, color: 'var(--text-muted)' }}
                >
                  <Trash2 size={14} />
                </button>
              )}
              <button
                onClick={() => onSetOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6, color: 'var(--text-muted)' }}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px', display: 'flex', flexDirection: 'column' }}>
            {messages.length === 0 && (
              <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>
                <Bot size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6, color: 'var(--text-secondary)' }}>How can I help?</div>
                <div style={{ fontSize: 12, lineHeight: 1.6 }}>
                  Ask me to create templates, add instances, navigate views, manage your topology, or anything else in your project.
                </div>
                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    'Show me a summary of my project',
                    'Create a template for analog inputs',
                    'Flag all instances missing descriptions',
                    'Navigate to the topology view',
                  ].map(hint => (
                    <button
                      key={hint}
                      onClick={() => { setInput(hint); inputRef.current?.focus(); }}
                      style={{
                        fontSize: 11, padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border)',
                        background: 'var(--bg-surface)', color: 'var(--text-secondary)', cursor: 'pointer', textAlign: 'left',
                      }}
                    >
                      {hint}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i}>
                <MessageBubble msg={msg} />
                {msg.actions?.length > 0 && (
                  <div style={{ marginLeft: 34, marginTop: -4, marginBottom: 8, display: 'flex', flexWrap: 'wrap' }}>
                    {msg.actions.map((a, j) => <ActionChip key={j} label={a} />)}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Sparkles size={13} color="white" />
                </div>
                <div style={{ padding: '8px 12px', borderRadius: '14px 14px 14px 4px', background: 'var(--bg-surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Loader2 size={13} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Thinking…</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: '10px 12px',
            borderTop: '1px solid var(--border)',
            background: 'var(--bg-surface)',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask anything or give a command…"
                rows={1}
                disabled={loading}
                style={{
                  flex: 1, resize: 'none', border: '1px solid var(--border)',
                  borderRadius: 10, padding: '8px 12px', fontSize: 13,
                  background: 'var(--bg-main)', color: 'var(--text-primary)',
                  outline: 'none', lineHeight: 1.4, maxHeight: 100, overflowY: 'auto',
                  fontFamily: 'inherit',
                }}
                onInput={e => {
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
                }}
              />
              <button
                onClick={send}
                disabled={!input.trim() || loading}
                style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: input.trim() && !loading ? 'var(--accent)' : 'var(--bg-surface)',
                  color: input.trim() && !loading ? 'white' : 'var(--text-disabled)',
                  cursor: input.trim() && !loading ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: input.trim() && !loading ? 'none' : '1px solid var(--border)',
                  transition: 'all 0.15s', flexShrink: 0,
                }}
              >
                <Send size={15} />
              </button>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 5, textAlign: 'center' }}>
              Enter to send · Shift+Enter for new line
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
