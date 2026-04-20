// Interactive CLI for AI Tools — Nexus-MCP
'use strict';

// Silence winston logs so they don't pollute the CLI output
const { logger } = require('../dist/logger.js');
const winston = require('winston');
logger.add(new winston.transports.Console({ silent: true }));

const readline = require('readline');
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const { Ollama } = require('ollama');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { zodToJsonSchema } = require('zod-to-json-schema');
const { z } = require('zod');
const { aiHandlers } = require('../dist/tools/ai/index.js');
const { filesystemTools } = require('../dist/tools/filesystem/index.js');
const { httpTools }        = require('../dist/tools/http/index.js');
const { gitTools }         = require('../dist/tools/git/index.js');
const { systemTools }      = require('../dist/tools/system/index.js');
const { aiTools }          = require('../dist/tools/ai/index.js');
const { utilitiesTools }   = require('../dist/tools/utilities/index.js');

// MCP Gateway imports
const { MCPGatewayConfigManager } = require('../dist/mcp-gateway/config.js');
const { MCPGatewayRegistry } = require('../dist/mcp-gateway/registry.js');
const { MCPGatewayDiscovery } = require('../dist/mcp-gateway/discovery.js');
const { MCPGatewayRouter } = require('../dist/mcp-gateway/router.js');

// ── Agent tool registry (tools disponibles para function calling) ────────────
const AGENT_EXCLUDED = new Set(['nexus_execute_command', 'nexus_list_processes']);
const AGENT_TOOL_LIST = [
  ...utilitiesTools,
  ...systemTools.filter(t => !AGENT_EXCLUDED.has(t.name)),
];
const agentToolIndex = Object.fromEntries(AGENT_TOOL_LIST.map(t => [t.name, t]));

// ── MCP Gateway Initialization (will be initialized after colors) ─────────────
let mcpConfigManager, mcpRegistry, mcpDiscovery, mcpRouter;
let mcpGatewayEnabled = false;
let mcpServersLoaded = false;

function toOpenAIParams(zodSchema) {
  try {
    const json = zodToJsonSchema(zodSchema, { target: 'openApi3' });
    const { $schema, ...clean } = json;
    if (!clean.type) clean.type = 'object';
    if (!clean.properties) clean.properties = {};
    return clean;
  } catch { return { type: 'object', properties: {} }; }
}

const openaiToolDefs = AGENT_TOOL_LIST.map(t => ({
  type: 'function',
  function: { name: t.name, description: t.description, parameters: toOpenAIParams(t.inputSchema) },
}));

// ── Ollama Tool Definitions ──────────────────────────────────────────────────────
const ollamaToolDefs = AGENT_TOOL_LIST.map(t => ({
  type: 'function',
  function: { name: t.name, description: t.description, parameters: toOpenAIParams(t.inputSchema) },
}));

// ── Gemini Tool Definitions ────────────────────────────────────────────────────
function toGeminiToolDef(zodSchema) {
  const clean = zodSchema.shape ? zodSchema.shape : {};
  const properties = {};
  const required = [];

  for (const [key, value] of Object.entries(clean)) {
    let type = 'string';
    if (value instanceof z.ZodNumber) type = 'number';
    else if (value instanceof z.ZodBoolean) type = 'boolean';
    else if (value instanceof z.ZodArray) type = 'array';
    else if (value instanceof z.ZodObject) type = 'object';

    properties[key] = { type, description: value.description || '' };
    if (!value.isOptional()) required.push(key);
  }

  return { type: 'object', properties, required };
}

const geminiToolDefs = AGENT_TOOL_LIST.map(t => ({
  name: t.name,
  description: t.description,
  parameters: toGeminiToolDef(t.inputSchema),
}));

// ── Ejecuta un turno con OpenAI Function Calling ──────────────────────────────
// Soporta múltiples tool_calls paralelos (GPT puede llamar varios tools a la vez)
async function runAgentTurn(model, sessionMessages, userInput) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const messages = [
    { role: 'system', content: 'Eres un asistente con acceso a herramientas de sistema y utilidades. Usa las herramientas disponibles cuando sean útiles para responder.' },
    ...sessionMessages.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: userInput },
  ];

  const first = await openai.chat.completions.create({
    model, messages, tools: openaiToolDefs, tool_choice: 'auto',
  });
  const msg = first.choices[0].message;
  const usage1 = first.usage?.total_tokens || 0;

  if (!msg.tool_calls?.length) {
    return { text: msg.content, tokens: usage1, toolsUsed: [] };
  }

  // Verificar si hay tools peligrosos y pedir confirmación
  const dangerousTools = msg.tool_calls.filter(call => isDangerousTool(call.function.name));
  if (dangerousTools.length > 0 && dangerConfirmEnabled) {
    console.log(`\n  ${c.yellow}⚠ La IA quiere ejecutar ${dangerousTools.length} tool(s) peligroso(s):${c.reset}`);
    dangerousTools.forEach(call => {
      console.log(`  ${c.dim}  - ${call.function.name}${c.reset}`);
    });
    const answer = await ask(`  ${c.dim}¿Permitir ejecución? [y/N]:${c.reset} `);
    if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
      console.log(`  ${c.dim}○ Ejecución cancelada${c.reset}\n`);
      return { text: 'Ejecución de tools peligrosos cancelada por el usuario.', tokens: usage1, toolsUsed: [] };
    }
  }

  // Ejecutar TODOS los tool_calls en paralelo
  const executed = await Promise.all(msg.tool_calls.map(async call => {
    const toolName = call.function.name;
    const toolArgs = JSON.parse(call.function.arguments);
    const tool = agentToolIndex[toolName];
    const toolStart = Date.now();
    let result, success = false;
    try {
      const r = tool ? await tool.handler(toolArgs) : null;
      success = r?.success || false;
      result = success ? r.data : { error: r?.error?.message || `Tool not found: ${toolName}` };
    } catch (err) {
      result = { error: err.message };
      success = false;
    }
    const toolDuration = Date.now() - toolStart;
    const category = tool?.category || 'unknown';
    return { call, toolName, toolArgs, result, success, toolDuration, category };
  }));

  // Responder a TODOS los tool_call_ids (OpenAI lo requiere)
  const toolMessages = executed.map(({ call, result }) => ({
    role: 'tool',
    tool_call_id: call.id,
    content: JSON.stringify(result),
  }));

  const second = await openai.chat.completions.create({
    model,
    messages: [...messages, msg, ...toolMessages],
  });
  const usage2 = second.usage?.total_tokens || 0;
  return {
    text: second.choices[0].message.content,
    tokens: usage1 + usage2,
    toolsUsed: executed.map(e => ({ name: e.toolName, args: e.toolArgs, result: e.result })),
  };
}

// ── Ejecuta un turno con Ollama Function Calling ────────────────────────────────
async function runOllamaAgentTurn(model, sessionMessages, userInput) {
  const ollama = new Ollama({ host: process.env.OLLAMA_HOST || 'http://localhost:11434' });
  const messages = [
    { role: 'system', content: 'Eres un asistente con acceso a herramientas de sistema y utilidades. Usa las herramientas disponibles cuando sean útiles para responder.' },
    ...sessionMessages.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: userInput },
  ];

  const first = await ollama.chat({
    model,
    messages,
    tools: ollamaToolDefs,
    stream: false,
  });
  const msg = first.message;

  if (!msg.tool_calls?.length) {
    return { text: msg.content, tokens: 0, toolsUsed: [] };
  }

  // Verificar si hay tools peligrosos y pedir confirmación
  const dangerousTools = msg.tool_calls.filter(call => isDangerousTool(call.function.name));
  if (dangerousTools.length > 0 && dangerConfirmEnabled) {
    console.log(`\n  ${c.yellow}⚠ La IA quiere ejecutar ${dangerousTools.length} tool(s) peligroso(s):${c.reset}`);
    dangerousTools.forEach(call => {
      console.log(`  ${c.dim}  - ${call.function.name}${c.reset}`);
    });
    const answer = await ask(`  ${c.dim}¿Permitir ejecución? [y/N]:${c.reset} `);
    if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
      console.log(`  ${c.dim}○ Ejecución cancelada${c.reset}\n`);
      return { text: 'Ejecución de tools peligrosos cancelada por el usuario.', tokens: 0, toolsUsed: [] };
    }
  }

  // Ejecutar tools en paralelo
  const executed = await Promise.all(msg.tool_calls.map(async call => {
    const toolName = call.function.name;
    const toolArgs = JSON.parse(call.function.arguments);
    const tool = agentToolIndex[toolName];
    const toolStart = Date.now();
    let result, success = false;
    try {
      const r = tool ? await tool.handler(toolArgs) : null;
      success = r?.success || false;
      result = success ? r.data : { error: r?.error?.message || `Tool not found: ${toolName}` };
    } catch (err) {
      result = { error: err.message };
      success = false;
    }
    const toolDuration = Date.now() - toolStart;
    const category = tool?.category || 'unknown';
    return { call, toolName, toolArgs, result, success, toolDuration, category };
  }));

  // Responder a todos los tool_calls
  const toolMessages = executed.map(({ call, result }) => ({
    role: 'tool',
    content: JSON.stringify(result),
  }));

  const second = await ollama.chat({
    model,
    messages: [...messages, msg, ...toolMessages],
    stream: false,
  });

  return {
    text: second.message.content,
    tokens: 0, // Ollama no proporciona token count
    toolsUsed: executed.map(e => ({ name: e.toolName, args: e.toolArgs, result: e.result })),
  };
}

// ── Ejecuta un turno con Gemini Function Calling ─────────────────────────────
async function runGeminiAgentTurn(model, sessionMessages, userInput) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const geminiModel = genAI.getGenerativeModel({ 
    model,
    tools: geminiToolDefs,
  });

  // Convertir mensajes al formato de Gemini
  const history = sessionMessages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const chat = geminiModel.startChat({ history });
  const result = await chat.sendMessage(userInput);
  const response = await result.response;
  const text = response.text();

  // Gemini function calling es más complejo, por ahora implementamos versión básica
  // Si hay function calls, los ejecutamos
  const functionCalls = response.functionCalls();
  if (!functionCalls || functionCalls.length === 0) {
    return { text, tokens: 0, toolsUsed: [] };
  }

  // Verificar si hay tools peligrosos
  const dangerousTools = functionCalls.filter(call => isDangerousTool(call.name));
  if (dangerousTools.length > 0 && dangerConfirmEnabled) {
    console.log(`\n  ${c.yellow}⚠ La IA quiere ejecutar ${dangerousTools.length} tool(s) peligroso(s):${c.reset}`);
    dangerousTools.forEach(call => {
      console.log(`  ${c.dim}  - ${call.name}${c.reset}`);
    });
    const answer = await ask(`  ${c.dim}¿Permitir ejecución? [y/N]:${c.reset} `);
    if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
      console.log(`  ${c.dim}○ Ejecución cancelada${c.reset}\n`);
      return { text: 'Ejecución de tools peligrosos cancelada por el usuario.', tokens: 0, toolsUsed: [] };
    }
  }

  // Ejecutar tools
  const executed = await Promise.all(functionCalls.map(async call => {
    const toolName = call.name;
    const toolArgs = call.args;
    const tool = agentToolIndex[toolName];
    const toolStart = Date.now();
    let result, success = false;
    try {
      const r = tool ? await tool.handler(toolArgs) : null;
      success = r?.success || false;
      result = success ? r.data : { error: r?.error?.message || `Tool not found: ${toolName}` };
    } catch (err) {
      result = { error: err.message };
      success = false;
    }
    const toolDuration = Date.now() - toolStart;
    const category = tool?.category || 'unknown';
    return { toolName, toolArgs, result, success, toolDuration, category };
  }));

  // Enviar resultados de tools a Gemini
  const functionResponseParts = executed.map(e => ({
    functionResponse: {
      name: e.toolName,
      response: e.result,
    },
  }));

  const followUpResult = await chat.sendMessage(functionResponseParts);
  const followUpText = followUpResult.response.text();

  return {
    text: followUpText,
    tokens: 0, // Gemini no proporciona token count fácilmente
    toolsUsed: executed.map(e => ({ name: e.toolName, args: e.toolArgs, result: e.result })),
  };
}

const ALL_TOOLS = [
  { cat: 'Filesystem', icon: '📁', tools: filesystemTools },
  { cat: 'HTTP',       icon: '🌐', tools: httpTools        },
  { cat: 'Git',        icon: '🔀', tools: gitTools         },
  { cat: 'System',     icon: '💻', tools: systemTools      },
  { cat: 'AI',         icon: '🤖', tools: aiTools          },
  { cat: 'Utilities',  icon: '🔧', tools: utilitiesTools   },
];

// ── Tool Index for Manual Execution ────────────────────────────────────────────
const toolIndex = {};
ALL_TOOLS.forEach(({ cat, tools }) => {
  tools.forEach(tool => {
    toolIndex[tool.name] = { ...tool, category: cat.toLowerCase() };
  });
});

// ── Colors ────────────────────────────────────────────────────────────────────
const c = {
  reset: '\x1b[0m', bright: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m', white: '\x1b[37m',
};

// ── MCP Gateway Initialization ─────────────────────────────────────────────────
(async () => {
  try {
    mcpConfigManager = new MCPGatewayConfigManager();
    mcpRegistry = new MCPGatewayRegistry({ debug: false });
    mcpDiscovery = new MCPGatewayDiscovery({ autoRefresh: false });
    mcpRouter = new MCPGatewayRouter(mcpRegistry);
    mcpGatewayEnabled = true;

    // Load and register external MCP servers
    const servers = mcpConfigManager.getServers();
    if (servers.length > 0) {
      console.log(`  ${c.cyan}○ Cargando ${servers.length} servidores MCP externos...${c.reset}`);
      for (const serverConfig of servers) {
        try {
          await mcpRegistry.registerServer(serverConfig);
          console.log(`  ${c.green}✓${c.reset} Servidor '${serverConfig.name}' registrado`);
        } catch (error) {
          console.log(`  ${c.red}✗${c.reset} Error al registrar '${serverConfig.name}': ${error.message}`);
        }
      }
      mcpServersLoaded = true;

      // Add external tools to agent tool list
      const externalRoutes = mcpRouter.listToolRoutes();
      console.log(`  ${c.cyan}○ ${externalRoutes.length} tools externos disponibles${c.reset}`);

      for (const route of externalRoutes) {
        const proxyTool = {
          name: route.qualifiedName,
          description: `External tool from ${route.server}: ${route.tool}`,
          inputSchema: z.object({}),
          category: 'external',
          version: '1.0.0',
          handler: async (args) => {
            try {
              const result = await mcpRouter.routeToolCall(route.qualifiedName, args);
              if (result.success) {
                return { success: true, data: result.result };
              } else {
                return { success: false, error: new Error(result.error || 'Tool execution failed') };
              }
            } catch (error) {
              return { success: false, error: error };
            }
          }
        };

        AGENT_TOOL_LIST.push(proxyTool);
        agentToolIndex[route.qualifiedName] = proxyTool;
        openaiToolDefs.push({
          type: 'function',
          function: {
            name: route.qualifiedName,
            description: proxyTool.description,
            parameters: { type: 'object', properties: {}, required: [] }
          }
        });
        ollamaToolDefs.push({
          type: 'function',
          function: {
            name: route.qualifiedName,
            description: proxyTool.description,
            parameters: { type: 'object', properties: {}, required: [] }
          }
        });
      }
    }
  } catch (error) {
    console.log(`  ${c.dim}○ MCP Gateway no disponible: ${error.message}${c.reset}`);
    mcpGatewayEnabled = false;
  }
})();

// ── Readline ──────────────────────────────────────────────────────────────────
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(resolve => rl.question(q, a => resolve(a.trim())));

// ── Chat History ──────────────────────────────────────────────────────────────
const HISTORY_FILE = path.join(__dirname, '.chat-history.json');
let chatHistory = { history: [], totalTokens: 0, messageCount: 0, lastUpdated: '' };

function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE))
      chatHistory = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
  } catch (_) {}
}

function saveHistory() {
  try { fs.writeFileSync(HISTORY_FILE, JSON.stringify(chatHistory, null, 2)); } catch (_) {}
}

function addToHistory(role, content, meta = {}) {
  chatHistory.history.push({ role, content, timestamp: new Date().toISOString(), ...meta });
  if (role === 'assistant') {
    chatHistory.totalTokens += meta.tokens || 0;
    chatHistory.messageCount++;
    chatHistory.lastUpdated = new Date().toISOString();
    saveHistory();
  }
}

// ── Agent Tool History ───────────────────────────────────────────────────────
let agentToolHistory = []; // { name, args, result, success, duration, category, timestamp }
let agentVerboseMode = false;
let dangerConfirmEnabled = true; // Confirmación de tools peligrosos activada por defecto

// ── Dangerous Tools List ───────────────────────────────────────────────────────
const DANGEROUS_TOOLS = [
  'nexus_execute_command',  // Ejecuta comandos de shell
  'nexus_file_delete',      // Borra archivos
  'nexus_file_write',       // Escribe archivos
  'nexus_file_copy',        // Copia archivos
  'nexus_file_move',        // Mueve archivos
  'nexus_git_clone',        // Clona repositorios (puede ser de fuentes no confiables)
];

function isDangerousTool(toolName) {
  return DANGEROUS_TOOLS.includes(toolName);
}

async function confirmDangerousTool(toolName, args) {
  if (!dangerConfirmEnabled) return true;
  
  console.log(`\n  ${c.yellow}⚠ ${toolName} requiere confirmación${c.reset}`);
  console.log(`  ${c.dim}Comando:${c.reset} ${JSON.stringify(args)}`);
  const answer = await ask(`  ${c.dim}¿Ejecutar? [y/N]:${c.reset} `);
  return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
}

function getAgentStats() {
  const stats = {};
  let totalTime = 0;
  agentToolHistory.forEach(t => {
    stats[t.name] = (stats[t.name] || 0) + 1;
    totalTime += t.toolDuration || 0;
  });
  return { count: agentToolHistory.length, stats, totalTime };
}

// ── Manual Tool Execution ───────────────────────────────────────────────────────
async function executeToolManually(toolName, argsStr = '{}') {
  const tool = toolIndex[toolName];
  if (!tool) {
    console.log(`\n  ${c.red}✗ Tool no encontrado: ${toolName}${c.reset}\n`);
    return;
  }

  let args;
  try {
    args = argsStr ? JSON.parse(argsStr) : {};
  } catch (err) {
    console.log(`\n  ${c.red}✗ Error al parsear argumentos JSON: ${err.message}${c.reset}\n`);
    return;
  }

  // Confirmación para tools peligrosos
  if (isDangerousTool(toolName)) {
    const confirmed = await confirmDangerousTool(toolName, args);
    if (!confirmed) {
      console.log(`  ${c.dim}○ Ejecución cancelada${c.reset}\n`);
      return;
    }
  }

  const toolStart = Date.now();
  let result, success = false;
  try {
    const r = await tool.handler(args);
    success = r?.success || false;
    result = success ? r.data : { error: r?.error?.message || 'Error desconocido' };
  } catch (err) {
    result = { error: err.message };
    success = false;
  }
  const toolDuration = Date.now() - toolStart;
  const category = tool.category || 'unknown';

  // Agregar al historial
  addToAgentHistory({
    name: toolName,
    args,
    result,
    success,
    toolDuration,
    category
  });

  // Mostrar resultado con formato visual mejorado
  console.log();
  const categoryColor = {
    'utilities': c.green,
    'system': c.yellow,
    'filesystem': c.blue,
    'http': c.magenta,
    'git': c.cyan,
    'ai': c.red,
    'unknown': c.white
  }[category] || c.white;
  const successIcon = success ? '✅' : '❌';
  const successColor = success ? c.green : c.red;
  console.log(`  ${c.yellow}🔧 ${categoryColor}${toolName}${c.reset}  ${c.dim}${JSON.stringify(args)}${c.reset}`);
  
  if (agentVerboseMode) {
    console.log(`  ${c.dim}   →${c.reset} ${JSON.stringify(result, null, 2)}`);
  } else {
    const r = JSON.stringify(result).slice(0, 80);
    console.log(`  ${c.dim}   → ${r}…${c.reset}`);
  }
  
  console.log(`  ${c.dim}   ⏱ ${toolDuration}ms  ${successColor}${successIcon} ${success ? 'éxito' : 'error'}${c.reset}\n`);
}

// ── Providers ─────────────────────────────────────────────────────────────────
const providers = {
  ollama:    { name: 'Ollama (Local LLMs)',  emoji: '🦙', color: c.magenta, chat: aiHandlers.nexusOllamaChat,    list: aiHandlers.nexusOllamaListModels,    defaultModel: 'llama2'                },
  gemini:    { name: 'Gemini (Google AI)',   emoji: '🔮', color: c.blue,    chat: aiHandlers.nexusGeminiChat,     list: aiHandlers.nexusGeminiListModels,    defaultModel: 'gemini-pro'            },
  openai:    { name: 'OpenAI (GPT)',         emoji: '🤖', color: c.green,   chat: aiHandlers.nexusOpenAIChat,     list: aiHandlers.nexusOpenAIListModels,    defaultModel: 'gpt-3.5-turbo'         },
  anthropic: { name: 'Anthropic (Claude)',   emoji: '🧠', color: c.yellow,  chat: aiHandlers.nexusAnthropicChat,  list: aiHandlers.nexusAnthropicListModels, defaultModel: 'claude-3-haiku-20240307'},
};

// ── UI helpers ────────────────────────────────────────────────────────────────
function divider(label = '') {
  const W = 58;
  if (!label) { console.log(`${c.dim}${'─'.repeat(W)}${c.reset}`); return; }
  const pad = Math.max(0, Math.floor((W - label.length - 2) / 2));
  const line = '─'.repeat(pad);
  console.log(`${c.dim}${line}${c.reset} ${c.bright}${label}${c.reset} ${c.dim}${line}${c.reset}`);
}

function banner() {
  console.clear();
  console.log(`\n${c.cyan}${c.bright}  ╔══════════════════════════════════════════════════════╗`);
  console.log(`  ║          Nexus-MCP  ·  AI Interactive CLI           ║`);
  console.log(`  ╚══════════════════════════════════════════════════════╝${c.reset}\n`);
}

function showHelp(agentMode, providerKey) {
  console.log(`\n${c.bright}  Comandos disponibles:${c.reset}`);
  console.log(`  ${c.cyan}/menu${c.reset}      Volver al menú de proveedores`);
  const agentAvailable = ['openai', 'ollama', 'gemini'].includes(providerKey);
  console.log(`  ${c.cyan}/agent${c.reset}     ${agentMode ? c.green + '✓ Modo agente ACTIVO' + c.reset + ' (la IA usa tools de Nexus-MCP)' : (agentAvailable ? 'Activar modo agente (OpenAI, Ollama, Gemini)' : 'No disponible con este proveedor')}`);
  console.log(`  ${c.cyan}/tools${c.reset}     Listar todos los tools disponibles`);
  console.log(`  ${c.cyan}/manual${c.reset}   Ejecutar un tool manualmente: /manual <tool> [args_json]`);
  console.log(`  ${c.cyan}/danger-confirm${c.reset} Toggle confirmación de tools peligrosos`);
  if (mcpGatewayEnabled) {
    console.log(`  ${c.cyan}/mcp-servers${c.reset}  Listar servidores MCP externos`);
    console.log(`  ${c.cyan}/mcp-add${c.reset}     Agregar servidor: /mcp-add <name> <transport> [command]`);
    console.log(`  ${c.cyan}/mcp-remove${c.reset}  Remover servidor: /mcp-remove <name>`);
    console.log(`  ${c.cyan}/mcp-refresh${c.reset} Refrescar tools: /mcp-refresh <name>`);
    console.log(`  ${c.cyan}/mcp-tools${c.reset}   Listar tools de servidores externos`);
  }
  console.log(`  ${c.cyan}/reset${c.reset}     Limpiar el contexto de la conversación`);
  console.log(`  ${c.cyan}/clear${c.reset}     Limpiar pantalla`);
  console.log(`  ${c.cyan}/history${c.reset}   Ver últimos 6 mensajes`);
  console.log(`  ${c.cyan}/tokens${c.reset}    Ver uso de tokens de la sesión`);
  console.log(`  ${c.cyan}/help${c.reset}      Mostrar esta ayuda`);
  console.log(`  ${c.cyan}/exit${c.reset}      Salir`);
  if (agentMode) {
    console.log(`\n${c.dim}  Modo agente: Tools mostrados con colores por categoría, tiempo de ejecución y estado${c.reset}\n`);
  } else {
    console.log();
  }
}

function showAgentStats() {
  const { count, stats, totalTime } = getAgentStats();
  console.log(`\n${c.bright}  📊 Estadísticas del Agente${c.reset}\n`);
  console.log(`  ${c.dim}Tools ejecutados:${c.reset} ${count}`);
  console.log(`  ${c.dim}Tiempo total de tools:${c.reset} ${totalTime}ms\n`);
  
  if (Object.keys(stats).length > 0) {
    console.log(`  ${c.bright}Por tool:${c.reset}`);
    Object.entries(stats).forEach(([name, times]) => {
      console.log(`  ${c.cyan}  - ${name}:${c.reset} ${times} vez${times > 1 ? 'es' : ''}`);
    });
    console.log();
  }
}

function showAgentHistory() {
  console.log(`\n${c.bright}  📜 Historial de Tools${c.reset}\n`);
  
  if (agentToolHistory.length === 0) {
    console.log(`  ${c.dim}Sin tools ejecutados aún${c.reset}\n`);
    return;
  }
  
  agentToolHistory.forEach((t, i) => {
    const categoryColor = {
      'utilities': c.green,
      'system': c.yellow,
      'filesystem': c.blue,
      'http': c.magenta,
      'git': c.cyan,
      'ai': c.red,
      'unknown': c.white
    }[t.category] || c.white;
    const successIcon = t.success ? '✅' : '❌';
    const successColor = t.success ? c.green : c.red;
    console.log(`  ${c.dim}[${i + 1}]${c.reset} ${c.yellow}🔧 ${categoryColor}${t.name}${c.reset} ${c.dim}→${c.reset} ${t.toolDuration}ms ${successColor}${successIcon}${c.reset}`);
  });
  console.log();
}

const MAX_CONTEXT_TURNS = 6; // max pairs (user+assistant) kept in context

function buildPromptWithContext(sessionMessages, currentInput) {
  if (!sessionMessages.length) return currentInput;
  const recent = sessionMessages.slice(-(MAX_CONTEXT_TURNS * 2));
  const history = recent
    .map(m => `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.content}`)
    .join('\n');
  return `[Historial de conversación]\n${history}\n\n[Mensaje actual]\nUsuario: ${currentInput}\nAsistente:`;
}

function showTools(filter) {
  const term = filter ? filter.toLowerCase() : '';
  let total = 0;
  console.log();
  ALL_TOOLS.forEach(({ cat, icon, tools }) => {
    const matched = term
      ? tools.filter(t => t.name.includes(term) || (t.description || '').toLowerCase().includes(term))
      : tools;
    if (!matched.length) return;
    divider(`${icon} ${cat} (${matched.length})`);
    matched.forEach(t => {
      const desc = t.description ? `  ${c.dim}${t.description.slice(0, 55)}${t.description.length > 55 ? '…' : ''}${c.reset}` : '';
      console.log(`  ${c.cyan}${t.name}${c.reset}${desc}`);
    });
    total += matched.length;
  });
  console.log(`\n  ${c.dim}Total: ${total} tools${term ? ` para "${term}"` : ''}${c.reset}\n`);
}

function showHistoryPreview() {
  const recent = chatHistory.history.slice(-6);
  if (!recent.length) { console.log(`\n  ${c.dim}Sin historial aún${c.reset}\n`); return; }
  console.log();
  recent.forEach(m => {
    const who = m.role === 'user' ? `${c.green}Tú ${c.reset}` : `${c.cyan}AI  ${c.reset}`;
    const text = m.content.length > 90 ? m.content.slice(0, 87) + '...' : m.content;
    console.log(`  ${who} ${c.dim}│${c.reset} ${text}`);
  });
  console.log();
}

// ── Provider selection ────────────────────────────────────────────────────────
async function selectProvider() {
  banner();
  divider('Proveedores de IA');
  console.log();
  Object.entries(providers).forEach(([, p], i) => {
    console.log(`  ${c.bright}${i + 1}${c.reset}  ${p.emoji}  ${p.color}${p.name}${c.reset}`);
  });
  console.log(`  ${c.bright}0${c.reset}  Salir\n`);

  const choice = await ask(`${c.green}›${c.reset} Elige proveedor: `);
  if (choice === '0') { console.log(`\n${c.green}✓ ¡Hasta luego!${c.reset}\n`); rl.close(); process.exit(0); }
  return Object.keys(providers)[parseInt(choice) - 1] || null;
}

// ── Model selection ───────────────────────────────────────────────────────────
async function selectModel(providerKey) {
  const p = providers[providerKey];
  console.log(`\n${c.dim}  Obteniendo modelos de ${p.name}...${c.reset}`);

  const result = await p.list({});
  if (!result.success) {
    console.log(`${c.red}  ✗ No se pudieron obtener los modelos${c.reset}\n`);
    return null;
  }

  const models = result.data.models;
  console.log();
  divider(`${p.emoji} ${p.name}`);
  console.log();
  models.slice(0, 10).forEach((m, i) => {
    const name = m.name || m.id || m.displayName || '?';
    const desc = m.description ? `  ${c.dim}${m.description}${c.reset}` : '';
    console.log(`  ${c.bright}${i + 1}${c.reset}  ${name}${desc}`);
  });
  if (models.length > 10) console.log(`  ${c.dim}  ... y ${models.length - 10} más${c.reset}`);
  console.log(`\n  ${c.dim}Enter = default: ${p.defaultModel}${c.reset}\n`);

  const choice = await ask(`${c.green}›${c.reset} Elige modelo (1-10 o Enter): `);
  if (!choice) return p.defaultModel;
  const idx = parseInt(choice) - 1;
  return models[idx]?.name || models[idx]?.id || models[idx]?.displayName || null;
}

// ── Chat session ──────────────────────────────────────────────────────────────
async function chatSession(providerKey, model) {
  const p = providers[providerKey];
  let sessionTokens = 0;
  let sessionMessages = []; // multi-turn context
  let agentMode = false;    // OpenAI function calling mode

  const sessionHeader = () => {
    console.log(`\n${p.color}${c.bright}  ${p.emoji} ${p.name}  ·  ${model}${c.reset}`);
    console.log(`  ${c.dim}Escribe /help para ver comandos${c.reset}\n`);
    divider();
    console.log();
  };

  console.clear();
  sessionHeader();

  while (true) {
    const ctxLabel = sessionMessages.length
      ? `${c.dim}[ctx:${Math.floor(sessionMessages.length / 2)} turn${sessionMessages.length > 2 ? 's' : ''}] ${c.reset}`
      : '';
    const agentLabel = agentMode ? `${c.yellow}[🔧 agente] ${c.reset}` : '';
    const input = await ask(`${agentLabel}${ctxLabel}${c.green}Tú${c.reset}  › `);
    if (!input) continue;

    // Commands
    if (input === '/exit')  { console.log(`\n${c.green}✓ ¡Hasta luego!${c.reset}\n`); rl.close(); process.exit(0); }
    if (input === '/menu')  return;
    if (input === '/agent') {
      if (!['openai', 'ollama', 'gemini'].includes(providerKey)) {
        console.log(`\n  ${c.yellow}⚠ El modo agente solo está disponible con OpenAI, Ollama y Gemini${c.reset}\n`);
      } else {
        agentMode = !agentMode;
        console.log(`\n  ${agentMode ? c.green + '✓ Modo agente ACTIVADO' : c.dim + '○ Modo agente desactivado'}${c.reset}`);
        if (agentMode) console.log(`  ${c.dim}La IA usará los ${AGENT_TOOL_LIST.length} tools de Nexus-MCP cuando los necesite${c.reset}`);
        console.log();
      }
      continue;
    }
    if (input === '/reset') {
      sessionMessages = [];
      console.log(`\n  ${c.green}✓ Contexto de conversación limpiado${c.reset}\n`);
      continue;
    }
    if (input === '/clear')   { console.clear(); sessionHeader(); continue; }
    if (input === '/help')    { showHelp(agentMode, providerKey); continue; }
    if (input === '/history') { showHistoryPreview(); continue; }
    if (input.startsWith('/tools')) { showTools(input.slice(6).trim()); continue; }
    if (input === '/tokens')  {
      console.log(`\n  ${c.dim}Sesión:${c.reset} ${sessionTokens} tokens  ${c.dim}Total acumulado:${c.reset} ${chatHistory.totalTokens} tokens`);
      console.log(`  ${c.dim}Contexto activo:${c.reset} ${Math.floor(sessionMessages.length / 2)} turnos (${sessionMessages.length} mensajes)`);
      console.log(`  ${c.dim}Modo agente:${c.reset} ${agentMode ? c.green + 'ACTIVO' + c.reset + ' (' + AGENT_TOOL_LIST.length + ' tools)' : c.dim + 'inactivo' + c.reset}\n`);
      continue;
    }
    if (input === '/agent-stats') {
      if (!agentMode) {
        console.log(`\n  ${c.yellow}⚠ Este comando solo está disponible en modo agente${c.reset}\n`);
      } else {
        showAgentStats();
      }
      continue;
    }
    if (input === '/agent-history') {
      if (!agentMode) {
        console.log(`\n  ${c.yellow}⚠ Este comando solo está disponible en modo agente${c.reset}\n`);
      } else {
        showAgentHistory();
      }
      continue;
    }
    if (input === '/agent-verbose') {
      if (!agentMode) {
        console.log(`\n  ${c.yellow}⚠ Este comando solo está disponible en modo agente${c.reset}\n`);
      } else {
        agentVerboseMode = !agentVerboseMode;
        console.log(`\n  ${agentVerboseMode ? c.green + '✓ Modo verbose ACTIVADO' : c.dim + '○ Modo verbose desactivado'}${c.reset}`);
        if (agentVerboseMode) console.log(`  ${c.dim}Ahora se mostrará el JSON completo de los resultados${c.reset}`);
        console.log();
      }
      continue;
    }
    if (input.startsWith('/manual')) {
      const parts = input.slice(8).trim().split(/\s+/);
      const toolName = parts[0];
      const argsStr = parts.slice(1).join(' ') || '{}';
      
      if (!toolName) {
        console.log(`\n  ${c.yellow}⚠ Uso: /manual <tool> [args_json]${c.reset}\n`);
        console.log(`  ${c.dim}Ejemplos:${c.reset}`);
        console.log(`  ${c.dim}  /manual nexus_uuid_generate${c.reset}`);
        console.log(`  ${c.dim}  /manual nexus_hash_generate '{"text":"hola","algorithm":"sha256"}'${c.reset}\n`);
        continue;
      }
      
      await executeToolManually(toolName, argsStr);
      continue;
    }
    if (input === '/danger-confirm') {
      dangerConfirmEnabled = !dangerConfirmEnabled;
      console.log(`\n  ${dangerConfirmEnabled ? c.green + '✓ Confirmación de tools peligrosos ACTIVADA' : c.dim + '○ Confirmación de tools peligrosos DESACTIVADA'}${c.reset}`);
      if (dangerConfirmEnabled) {
        console.log(`  ${c.dim}Tools peligrosos (${DANGEROUS_TOOLS.length}): ${DANGEROUS_TOOLS.join(', ')}${c.reset}`);
      }
      console.log();
      continue;
    }

    // ── MCP Gateway Commands ─────────────────────────────────────────────────────
    if (input === '/mcp-servers') {
      if (!mcpGatewayEnabled) {
        console.log(`\n  ${c.yellow}⚠ MCP Gateway no está disponible${c.reset}\n`);
      } else {
        const connections = mcpRegistry.getAllConnections();
        const stats = mcpRegistry.getStats();
        console.log(`\n  ${c.bright}Servidores MCP Registrados:${c.reset}`);
        console.log(`  ${c.dim}Total: ${stats.totalServers} | Conectados: ${stats.connectedServers} | Tools: ${stats.totalTools}${c.reset}\n`);
        if (connections.length === 0) {
          console.log(`  ${c.dim}○ No hay servidores registrados${c.reset}`);
        } else {
          connections.forEach(conn => {
            const status = conn.connected ? c.green + '✓ Conectado' : c.red + '✗ Desconectado';
            console.log(`  ${c.cyan}${conn.config.name}${c.reset}  ${status}${c.reset}  ${conn.tools.size} tools`);
            if (conn.lastConnected) {
              console.log(`  ${c.dim}  Última conexión: ${conn.lastConnected.toLocaleString()}${c.reset}`);
            }
          });
        }
        console.log();
      }
      continue;
    }

    if (input.startsWith('/mcp-add')) {
      if (!mcpGatewayEnabled) {
        console.log(`\n  ${c.yellow}⚠ MCP Gateway no está disponible${c.reset}\n`);
      } else {
        const args = input.slice(9).trim().split(/\s+/);
        if (args.length < 2) {
          console.log(`\n  ${c.dim}Uso: /mcp-add <name> <transport> [command] [args...]${c.reset}\n`);
          console.log(`  ${c.dim}Ejemplo: /mcp-add filesystem stdio node /path/to/server.js${c.reset}\n`);
        } else {
          const [name, transport, command, ...cmdArgs] = args;
          try {
            const config = { name, transport, command, args: cmdArgs };
            await mcpRegistry.registerServer(config);
            console.log(`\n  ${c.green}✓ Servidor '${name}' registrado exitosamente${c.reset}\n`);
          } catch (error) {
            console.log(`\n  ${c.red}✗ Error al registrar servidor: ${error.message}${c.reset}\n`);
          }
        }
      }
      continue;
    }

    if (input.startsWith('/mcp-remove')) {
      if (!mcpGatewayEnabled) {
        console.log(`\n  ${c.yellow}⚠ MCP Gateway no está disponible${c.reset}\n`);
      } else {
        const name = input.slice(12).trim();
        if (!name) {
          console.log(`\n  ${c.dim}Uso: /mcp-remove <name>${c.reset}\n`);
        } else {
          try {
            await mcpRegistry.unregisterServer(name);
            console.log(`\n  ${c.green}✓ Servidor '${name}' removido exitosamente${c.reset}\n`);
          } catch (error) {
            console.log(`\n  ${c.red}✗ Error al remover servidor: ${error.message}${c.reset}\n`);
          }
        }
      }
      continue;
    }

    if (input.startsWith('/mcp-refresh')) {
      if (!mcpGatewayEnabled) {
        console.log(`\n  ${c.yellow}⚠ MCP Gateway no está disponible${c.reset}\n`);
      } else {
        const name = input.slice(13).trim();
        if (!name) {
          console.log(`\n  ${c.dim}Uso: /mcp-refresh <name>${c.reset}\n`);
        } else {
          try {
            const config = mcpConfigManager.getServer(name);
            if (!config) {
              console.log(`\n  ${c.red}✗ Servidor '${name}' no encontrado en configuración${c.reset}\n`);
            } else {
              await mcpRegistry.refreshTools(name);
              console.log(`\n  ${c.green}✓ Tools de servidor '${name}' refrescados exitosamente${c.reset}\n`);
            }
          } catch (error) {
            console.log(`\n  ${c.red}✗ Error al refrescar tools: ${error.message}${c.reset}\n`);
          }
        }
      }
      continue;
    }

    if (input === '/mcp-tools') {
      if (!mcpGatewayEnabled) {
        console.log(`\n  ${c.yellow}⚠ MCP Gateway no está disponible${c.reset}\n`);
      } else {
        const routes = mcpRouter.listToolRoutes();
        console.log(`\n  ${c.bright}Tools de Servidores Externos:${c.reset}`);
        console.log(`  ${c.dim}Total: ${routes.length} tools${c.reset}\n`);
        if (routes.length === 0) {
          console.log(`  ${c.dim}○ No hay tools disponibles${c.reset}`);
        } else {
          routes.forEach(r => {
            console.log(`  ${c.cyan}${r.qualifiedName}${c.reset}  ${c.dim}→ ${r.server}${c.reset}`);
          });
        }
        console.log();
      }
      continue;
    }

    addToHistory('user', input);
    sessionMessages.push({ role: 'user', content: input });

    const start = Date.now();
    let text, tokens;

    if (agentMode) {
      // ── Modo agente: Function Calling ────────────────────────────────────────────
      try {
        let turn;
        if (providerKey === 'openai') {
          turn = await runAgentTurn(model, sessionMessages.slice(0, -1), input);
        } else if (providerKey === 'ollama') {
          turn = await runOllamaAgentTurn(model, sessionMessages.slice(0, -1), input);
        } else if (providerKey === 'gemini') {
          turn = await runGeminiAgentTurn(model, sessionMessages.slice(0, -1), input);
        } else {
          console.log(`\n  ${c.yellow}⚠ El modo agente solo está disponible con OpenAI, Ollama y Gemini${c.reset}\n`);
          sessionMessages.pop();
          continue;
        }
        
        text   = turn.text;
        tokens = turn.tokens;

        if (turn.toolsUsed?.length) {
          console.log();
          turn.toolsUsed.forEach(t => {
            addToAgentHistory(t);
            const categoryColor = {
              'utilities': c.green,
              'system': c.yellow,
              'filesystem': c.blue,
              'http': c.magenta,
              'git': c.cyan,
              'ai': c.red,
              'unknown': c.white
            }[t.category] || c.white;
            const successIcon = t.success ? '✅' : '❌';
            const successColor = t.success ? c.green : c.red;
            console.log(`  ${c.yellow}🔧 ${categoryColor}${t.name}${c.reset}  ${c.dim}${JSON.stringify(t.args)}${c.reset}`);
            
            if (agentVerboseMode) {
              console.log(`  ${c.dim}   →${c.reset} ${JSON.stringify(t.result, null, 2)}`);
            } else {
              const r = JSON.stringify(t.result).slice(0, 80);
              console.log(`  ${c.dim}   → ${r}…${c.reset}`);
            }
            
            console.log(`  ${c.dim}   ⏱ ${t.toolDuration}ms  ${successColor}${successIcon} ${t.success ? 'éxito' : 'error'}${c.reset}`);
          });
        }
      } catch (err) {
        sessionMessages.pop();
        console.log(`\n  ${c.red}✗ ${err.message}${c.reset}\n`);
        continue;
      }
    } else {
      // ── Modo chat normal ─────────────────────────────────────────────────
      const promptWithContext = buildPromptWithContext(sessionMessages.slice(0, -1), input);
      const result = await p.chat({ prompt: promptWithContext, model, temperature: 0.7, maxTokens: 1000, stream: false });
      const duration = Date.now() - start;

      if (!result.success) {
        sessionMessages.pop();
        console.log(`\n  ${c.red}✗ ${result.error?.message || 'Error desconocido'}${c.reset}\n`);
        continue;
      }
      text   = result.data.response || '';
      const usage = result.data.usage;
      tokens = usage?.total_tokens || (usage?.input_tokens ?? 0) + (usage?.output_tokens ?? 0) || 0;
      void duration;
    }

    const duration = Date.now() - start;
    sessionTokens += tokens;
    sessionMessages.push({ role: 'assistant', content: text });
    console.log(`\n${c.cyan}AI${c.reset}   › ${text}`);
    console.log(`  ${c.dim}↳ ${duration}ms${tokens ? `  ·  ${tokens} tokens` : ''}${c.reset}\n`);
    addToHistory('assistant', text, { provider: providerKey, tokens });
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  loadHistory();
  while (true) {
    const providerKey = await selectProvider();
    if (!providerKey) { console.log(`  ${c.yellow}⚠ Opción inválida${c.reset}\n`); continue; }

    const model = await selectModel(providerKey);
    if (!model) { console.log(`  ${c.yellow}⚠ Modelo inválido${c.reset}\n`); continue; }

    await chatSession(providerKey, model);
  }
}

main().catch(err => {
  console.error(`\n${c.red}✗ Error fatal:${c.reset}`, err.message);
  rl.close();
  process.exit(1);
});
