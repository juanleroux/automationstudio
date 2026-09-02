const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');

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
- project.name: Project name
- project.templates[]: Asset templates/types, each with:
  - id (number), name (string)
  - attributes[]: { id, name, type (String|Int32|Float|Bool|DateTime), value (default), required }
  - instances[]: { id, name, description, isFlagged, attributes: [{ id, value }] }
- project.nodes[]: Topology nodes — { id, name, type, x, y, level, color, confirmed }
- project.connections[]: Topology edges — { id, from, to, label, style, width }
- project.siemens: { bridgeUrl, tiaVersion, templateFBs }
- project.engineering: { ignitionGateway, apiKey }

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

const TOOLS = [
  {
    name: 'navigate_to_view',
    description: 'Switch the application to a different view/tab',
    input_schema: {
      type: 'object',
      properties: {
        view: {
          type: 'string',
          enum: ['dashboard', 'topology', 'engineering', 'notes', 'proposal', 'calculators', 'commtest', 'settings'],
          description: 'The view to navigate to',
        },
      },
      required: ['view'],
    },
  },
  {
    name: 'create_template',
    description: 'Create a new asset template (type) in the engineering/assets view',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Template name' },
        attributes: {
          type: 'array',
          description: 'Attributes to add to the template',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              type: { type: 'string', enum: ['String', 'Int32', 'Float', 'Bool', 'DateTime'] },
              value: { type: 'string', description: 'Default value' },
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
        templateId: { type: 'number', description: 'ID of the template to add the instance to' },
        templateName: { type: 'string', description: 'Template name (used to look up the template if templateId is unknown)' },
        name: { type: 'string', description: 'Instance name (tag name)' },
        attributes: { type: 'object', description: 'Attribute name → value pairs to set on this instance' },
      },
      required: ['name'],
    },
  },
  {
    name: 'update_instance',
    description: 'Update an existing instance — rename it, change its attributes, or flag/unflag it',
    input_schema: {
      type: 'object',
      properties: {
        templateId: { type: 'number' },
        instanceId: { type: 'number' },
        instanceName: { type: 'string', description: 'Current instance name (used to look up if IDs not known)' },
        newName: { type: 'string', description: 'New name for the instance' },
        attributes: { type: 'object', description: 'Attribute name → value pairs to update' },
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
        instanceName: { type: 'string', description: 'Instance name to look up if IDs not known' },
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
        type: {
          type: 'string',
          enum: ['PLC', 'PAC', 'RTU', 'DCS', 'HMI', 'SCADA', 'Historian', 'MES', 'Server', 'Workstation', 'Switch', 'Firewall', 'Sensor', 'Actuator', 'I/O Card', 'Cloud', 'ERP', 'Custom'],
        },
        level: { type: 'number', description: 'Hierarchy level: 0 = Field, 1 = Control, 2 = Supervisory, 3 = Enterprise' },
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
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              templateId: { type: 'number' },
              instanceId: { type: 'number' },
              instanceName: { type: 'string' },
            },
          },
        },
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

router.post('/chat', async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY not set on the server. Add it to your Docker environment.' });
  }

  const { messages, project, activeView } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array required' });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const systemWithContext = `${SYSTEM_PROMPT}\n\n## Current State\nActive view: ${activeView || 'unknown'}\n\n## Project Data\n\`\`\`json\n${buildProjectSummary(project)}\n\`\`\``;

  const allActions = [];
  let apiMessages = messages.map(m => ({ role: m.role, content: m.content }));

  try {
    // Agentic tool-use loop — keep calling until end_turn or max iterations
    for (let iteration = 0; iteration < 5; iteration++) {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: systemWithContext,
        tools: TOOLS,
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
        const textBlock = response.content.find(b => b.type === 'text');
        return res.json({ reply: textBlock?.text ?? '', actions: allActions });
      }
    }
    // Exceeded loop limit — return whatever we have
    res.json({ reply: "I've queued several actions. Check the results above.", actions: allActions });
  } catch (err) {
    console.error('[AI] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
