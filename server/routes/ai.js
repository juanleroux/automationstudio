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

function buildProjectSummary(project) {
  if (!project) return 'No project currently loaded.';
  return JSON.stringify({
    name: project.name,
    templates: (project.templates || []).map(t => ({
      id: t.id,
      name: t.name,
      attributes: (t.attributes || []).map(a => ({ id: a.id, name: a.name, type: a.type, defaultValue: a.value })),
      instances: (t.instances || []).map(i => ({
        id: i.id,
        name: i.name,
        isFlagged: i.isFlagged || false,
        attributes: (i.attributes || []).reduce((acc, ia) => {
          const ta = (t.attributes || []).find(a => a.id === ia.id);
          if (ta) acc[ta.name] = ia.value;
          return acc;
        }, {}),
      })),
    })),
    nodes: (project.nodes || []).map(n => ({ id: n.id, name: n.name, type: n.type, level: n.level })),
    connections: (project.connections || []).map(c => ({ from: c.from, to: c.to, label: c.label })),
  }, null, 2);
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
async function callOpenAICompat(apiKey, model, baseUrl, messages, systemWithContext, allActions) {
  const url = `${(baseUrl || 'http://localhost:11434').replace(/\/$/, '')}/v1/chat/completions`;
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const openAIMessages = [
    { role: 'system', content: systemWithContext },
    ...messages.map(m => ({ role: m.role, content: m.content })),
  ];
  const tools = toOpenAITools(TOOLS_ANTHROPIC);

  for (let i = 0; i < 5; i++) {
    const payload = { model, messages: openAIMessages, max_tokens: 2048, tools, tool_choice: 'auto' };
    const resp = await axios.post(url, payload, { headers, timeout: 60000 });
    const choice = resp.data.choices?.[0];
    const msg = choice?.message;

    if (choice?.finish_reason === 'tool_calls' && msg?.tool_calls?.length) {
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

  const systemWithContext = `${SYSTEM_PROMPT}\n\n## Current State\nActive view: ${activeView || 'unknown'}\n\n## Project Data\n\`\`\`json\n${buildProjectSummary(project)}\n\`\`\``;
  const allActions = [];

  try {
    let reply = '';
    if (provider === 'anthropic') {
      if (!apiKey) return res.status(503).json({ error: 'No Anthropic API key configured. Add it in Settings → AI Assistant.' });
      reply = await callAnthropic(apiKey, model, messages, systemWithContext, allActions);
    } else {
      // OpenAI-compatible (Ollama, Groq, etc.)
      if (!model) return res.status(503).json({ error: 'No model specified. Configure it in Settings → AI Assistant.' });
      reply = await callOpenAICompat(apiKey, model, baseUrl, messages, systemWithContext, allActions);
    }
    res.json({ reply, actions: allActions });
  } catch (err) {
    console.error('[AI] Error:', err.response?.data || err.message);
    const msg = err.response?.data?.error?.message || err.response?.data?.error || err.message;
    res.status(500).json({ error: msg });
  }
});

module.exports = router;
