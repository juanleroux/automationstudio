const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const Anthropic = require('@anthropic-ai/sdk');

const configPath = path.join(__dirname, '..', 'config', 'app.config.json');

function readAiConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return cfg.ai || {};
    }
  } catch (_) {}
  return {};
}

// ── System prompt ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are an AI assistant embedded in Automation Studio — an industrial automation project management tool built by One Technology Limited.

You have full access to the user's project and can control every feature of the application.

## Application Views
- dashboard: Project overview and quick stats
- topology: Network/system topology diagram (nodes, connections, levels)
- engineering: Asset management — templates (types) and instances (tags). This is the main Derivation view.
- notes: Project notes and documentation
- proposal: Proposal / quote document generator
- calculators: Engineering calculators
- commtest: Live communications testing (OPC-UA, MQTT, Modbus, EtherNet/IP, S7)
- settings: App settings including Ignition, Siemens TIA Portal, and Studio 5000 integration

## Project Data Model
- project.templates[]: Asset templates/types, each with:
  - id (number), name (string)
  - attributes[]: { id, name, type (String|Int32|Float|Bool|DateTime), value (default), required }
  - instances[]: { id, name, description, isFlagged, attributes: [{ id, value }] }
- project.nodes[]: Topology nodes — { id, name, type, x, y, level, color, confirmed }
- project.connections[]: Topology edges — { id, from, to, label, style, width }

## Instructions
- Be concise and direct. When asked to do something, do it using the available tools.
- When creating things, make sensible choices for any unspecified parameters.
- After taking an action, briefly confirm what you did.
- When showing data, be structured and clear.
- If a task is ambiguous, ask one focused clarifying question.`;

const MAX_SUMMARY_CHARS = 8000;

function buildProjectSummary(project) {
  if (!project) return 'No project currently loaded.';

  // Build compact text format: one line per instance with all attribute values
  const lines = [`Project: ${project.name}`, ''];

  for (const t of (project.templates || [])) {
    const attrs = t.attributes || [];
    lines.push(`Template: ${t.name} (id:${t.id})`);
    lines.push(`Attributes: ${attrs.map(a => a.name).join(', ')}`);

    const instances = t.instances || [];
    for (const inst of instances) {
      // Build key=value pairs for non-empty attributes only
      const vals = attrs
        .map(a => {
          const ia = (inst.attributes || []).find(x => x.id === a.id);
          const v = ia?.value ?? a.value ?? '';
          return v !== '' && v !== null && v !== undefined ? `${a.name}=${v}` : null;
        })
        .filter(Boolean)
        .join(', ');
      const flag = inst.isFlagged ? ' [FLAGGED]' : '';
      lines.push(`  ${inst.name}${flag}${vals ? ': ' + vals : ''}`);
    }
    lines.push('');
  }

  if ((project.nodes || []).length > 0) {
    lines.push('Topology nodes: ' + project.nodes.map(n => `${n.name}(${n.type})`).join(', '));
  }

  const summary = lines.join('\n');
  if (summary.length <= MAX_SUMMARY_CHARS) return summary;

  // Too large — truncate instances per template proportionally
  const maxPerTemplate = Math.max(5, Math.floor(MAX_SUMMARY_CHARS / Math.max(1, (project.templates||[]).length) / 60));
  const truncLines = [`Project: ${project.name}`, ''];
  for (const t of (project.templates || [])) {
    const attrs = t.attributes || [];
    const instances = t.instances || [];
    truncLines.push(`Template: ${t.name} (id:${t.id}, ${instances.length} instances)`);
    truncLines.push(`Attributes: ${attrs.map(a => a.name).join(', ')}`);
    for (const inst of instances.slice(0, maxPerTemplate)) {
      const vals = attrs
        .map(a => { const ia = (inst.attributes||[]).find(x=>x.id===a.id); const v=ia?.value??a.value??''; return v!==''&&v!==null?`${a.name}=${v}`:null; })
        .filter(Boolean).join(', ');
      truncLines.push(`  ${inst.name}${inst.isFlagged?' [FLAGGED]':''}${vals?': '+vals:''}`);
    }
    if (instances.length > maxPerTemplate) truncLines.push(`  ... ${instances.length - maxPerTemplate} more instances`);
    truncLines.push('');
  }
  return truncLines.join('\n');
}

// ── Tool definitions (Anthropic format) ───────────────────────────────────────
const TOOLS_ANTHROPIC = [
  {
    name: 'navigate_to_view',
    description: 'Switch the application to a different view/tab',
    input_schema: {
      type: 'object',
      properties: {
        view: { type: 'string', enum: ['dashboard', 'topology', 'engineering', 'notes', 'proposal', 'calculators', 'commtest', 'settings'] },
      },
      required: ['view'],
    },
  },
  {
    name: 'create_template',
    description: 'Create a new asset template in the engineering/assets view',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        attributes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              type: { type: 'string', enum: ['String', 'Int32', 'Float', 'Bool', 'DateTime'] },
              value: { type: 'string' },
              required: { type: 'boolean' },
            },
            required: ['name', 'type'],
          },
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'create_instance',
    description: 'Add a new instance (tag/device) to an existing template',
    input_schema: {
      type: 'object',
      properties: {
        templateId: { type: 'number' },
        templateName: { type: 'string' },
        name: { type: 'string' },
        attributes: { type: 'object' },
      },
      required: ['name'],
    },
  },
  {
    name: 'update_instance',
    description: 'Update an existing instance — rename, change attributes, or flag/unflag',
    input_schema: {
      type: 'object',
      properties: {
        templateId: { type: 'number' },
        instanceId: { type: 'number' },
        instanceName: { type: 'string' },
        newName: { type: 'string' },
        attributes: { type: 'object' },
        isFlagged: { type: 'boolean' },
      },
    },
  },
  {
    name: 'delete_instance',
    description: 'Delete an instance from a template',
    input_schema: {
      type: 'object',
      properties: {
        templateId: { type: 'number' },
        instanceId: { type: 'number' },
        instanceName: { type: 'string' },
      },
    },
  },
  {
    name: 'delete_template',
    description: 'Delete an entire template and all its instances',
    input_schema: {
      type: 'object',
      properties: {
        templateId: { type: 'number' },
        templateName: { type: 'string' },
      },
    },
  },
  {
    name: 'add_topology_node',
    description: 'Add a node to the topology/network diagram',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        type: { type: 'string', enum: ['PLC', 'PAC', 'RTU', 'DCS', 'HMI', 'SCADA', 'Historian', 'MES', 'Server', 'Workstation', 'Switch', 'Firewall', 'Sensor', 'Actuator', 'I/O Card', 'Cloud', 'ERP', 'Custom'] },
        level: { type: 'number' },
      },
      required: ['name', 'type'],
    },
  },
  {
    name: 'flag_instance',
    description: 'Flag or unflag one or more instances for review',
    input_schema: {
      type: 'object',
      properties: {
        items: { type: 'array', items: { type: 'object', properties: { templateId: { type: 'number' }, instanceId: { type: 'number' }, instanceName: { type: 'string' } } } },
        isFlagged: { type: 'boolean' },
      },
      required: ['isFlagged'],
    },
  },
  {
    name: 'save_project',
    description: 'Save the current project',
    input_schema: { type: 'object', properties: {} },
  },
];

// Convert Anthropic tools to OpenAI function-calling format
function toOpenAITools(tools) {
  return tools.map(t => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    },
  }));
}

// ── Anthropic provider ─────────────────────────────────────────────────────────
async function callAnthropic(apiKey, model, messages, systemWithContext, allActions) {
  const client = new Anthropic({ apiKey });
  const resolvedModel = model || 'claude-haiku-4-5-20251001';
  let apiMessages = messages.map(m => ({ role: m.role, content: m.content }));

  for (let i = 0; i < 5; i++) {
    const response = await client.messages.create({
      model: resolvedModel,
      max_tokens: 2048,
      system: systemWithContext,
      tools: TOOLS_ANTHROPIC,
      messages: apiMessages,
    });

    if (response.stop_reason === 'tool_use') {
      const toolUses = response.content.filter(b => b.type === 'tool_use');
      const toolResults = toolUses.map(tu => {
        allActions.push({ tool: tu.name, input: tu.input, id: tu.id });
        return { type: 'tool_result', tool_use_id: tu.id, content: 'Action queued for client execution.' };
      });
      apiMessages = [
        ...apiMessages,
        { role: 'assistant', content: response.content },
        { role: 'user', content: toolResults },
      ];
    } else {
      const text = response.content.find(b => b.type === 'text')?.text ?? '';
      return text;
    }
  }
  return "I've queued several actions. Check the results above.";
}

// ── OpenAI-compatible provider (Ollama, Groq, etc.) ───────────────────────────
function isToolCallUnsupportedError(err) {
  const msg = (err.response?.data?.error?.message || err.response?.data?.error || err.message || '').toLowerCase();
  return msg.includes('tool') || msg.includes('function call') || msg.includes('not supported');
}

async function callOpenAICompat(apiKey, model, baseUrl, messages, systemWithContext, allActions) {
  const url = `${(baseUrl || 'http://localhost:11434').replace(/\/$/, '')}/v1/chat/completions`;
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const openAIMessages = [
    { role: 'system', content: systemWithContext },
    ...messages.map(m => ({ role: m.role, content: m.content })),
  ];
  const tools = toOpenAITools(TOOLS_ANTHROPIC);

  // Try with tool calling first; fall back to plain chat if unsupported
  let useTools = true;

  for (let i = 0; i < 5; i++) {
    const payload = useTools
      ? { model, messages: openAIMessages, max_tokens: 1024, tools, tool_choice: 'auto' }
      : { model, messages: openAIMessages, max_tokens: 1024 };

    let resp;
    try {
      resp = await axios.post(url, payload, { headers, timeout: 60000 });
    } catch (err) {
      if (useTools && isToolCallUnsupportedError(err)) {
        // Model doesn't support tool calling — retry without tools
        useTools = false;
        const plainPayload = { model, messages: openAIMessages, max_tokens: 1024 };
        resp = await axios.post(url, plainPayload, { headers, timeout: 60000 });
        return (resp.data.choices?.[0]?.message?.content || '') +
          '\n\n*Note: this model does not support actions. Switch to a tool-capable model in Settings → AI Assistant to enable full app control.*';
      }
      throw err;
    }

    const choice = resp.data.choices?.[0];
    const msg = choice?.message;

    if (useTools && choice?.finish_reason === 'tool_calls' && msg?.tool_calls?.length) {
      openAIMessages.push({ role: 'assistant', content: msg.content || null, tool_calls: msg.tool_calls });
      const toolResults = msg.tool_calls.map(tc => {
        let input = {};
        try { input = JSON.parse(tc.function.arguments); } catch (_) {}
        allActions.push({ tool: tc.function.name, input, id: tc.id });
        return { role: 'tool', tool_call_id: tc.id, content: 'Action queued for client execution.' };
      });
      openAIMessages.push(...toolResults);
    } else {
      return msg?.content || '';
    }
  }
  return "I've queued several actions. Check the results above.";
}

// ── Chat endpoint ──────────────────────────────────────────────────────────────
router.post('/chat', async (req, res) => {
  const { messages, project, activeView } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array required' });
  }

  const cfg = readAiConfig();
  const provider = cfg.provider || 'anthropic';
  const PROVIDER_DEFAULT_MODELS = { anthropic: 'claude-haiku-4-5-20251001', groq: 'llama-3.1-8b-instant', ollama: '' };
  const model    = cfg.model    || PROVIDER_DEFAULT_MODELS[provider] || '';
  const apiKey   = cfg.apiKey   || (provider === 'anthropic' ? process.env.ANTHROPIC_API_KEY : process.env.GROQ_API_KEY) || '';
  const baseUrl  = provider === 'groq'
    ? 'https://api.groq.com/openai'
    : (cfg.baseUrl || 'http://localhost:11434');

  const systemWithContext = `${SYSTEM_PROMPT}\n\n## Current State\nActive view: ${activeView || 'unknown'}\n\n## Project Data\n\`\`\`\n${buildProjectSummary(project)}\n\`\`\``;
  // Keep only the last 10 messages to avoid context overflow
  const trimmedMessages = messages.slice(-10);
  const allActions = [];

  try {
    let reply = '';
    if (provider === 'anthropic') {
      if (!apiKey) return res.status(503).json({ error: 'No Anthropic API key configured. Add it in Settings → AI Assistant.' });
      reply = await callAnthropic(apiKey, model, trimmedMessages, systemWithContext, allActions);
    } else {
      // OpenAI-compatible (Ollama, Groq, etc.)
      if (!model) return res.status(503).json({ error: 'No model specified. Configure it in Settings → AI Assistant.' });
      reply = await callOpenAICompat(apiKey, model, baseUrl, trimmedMessages, systemWithContext, allActions);
    }
    res.json({ reply, actions: allActions });
  } catch (err) {
    console.error('[AI] Error:', err.response?.data || err.message);
    const msg = err.response?.data?.error?.message || err.response?.data?.error || err.message;
    res.status(500).json({ error: msg });
  }
});

// ── Models list endpoint ───────────────────────────────────────────────────────
router.get('/models', async (req, res) => {
  const { provider, apiKey, baseUrl } = req.query;

  try {
    if (provider === 'anthropic') {
      // Anthropic doesn't have a public models list endpoint — return static list
      return res.json({ models: [
        { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5 (fast & cheap)' },
        { id: 'claude-sonnet-4-6',         name: 'Claude Sonnet 4.6 (best quality)' },
      ]});
    }

    if (provider === 'groq') {
      const key = apiKey || process.env.GROQ_API_KEY || '';
      if (!key) return res.status(400).json({ error: 'API key required to fetch Groq models' });
      const resp = await axios.get('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${key}` },
        timeout: 10000,
      });
      const EXCLUDED = ['whisper', 'guard', 'tts', 'vision', 'distil', 'allam'];
      const models = (resp.data.data || [])
        .filter(m => m.id && !EXCLUDED.some(ex => m.id.toLowerCase().includes(ex)))
        .sort((a, b) => a.id.localeCompare(b.id))
        .map(m => ({ id: m.id, name: m.id }));
      return res.json({ models });
    }

    if (provider === 'ollama') {
      const base = (baseUrl || 'http://localhost:11434').replace(/\/$/, '');
      const resp = await axios.get(`${base}/api/tags`, { timeout: 5000 });
      const models = (resp.data.models || []).map(m => ({ id: m.name, name: m.name }));
      return res.json({ models });
    }

    res.status(400).json({ error: 'Unknown provider' });
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.response?.data?.error || err.message;
    res.status(500).json({ error: msg });
  }
});

module.exports = router;
