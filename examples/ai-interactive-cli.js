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
const { zodToJsonSchema } = require('zod-to-json-schema');
const { aiHandlers } = require('../dist/tools/ai/index.js');
const { filesystemTools } = require('../dist/tools/filesystem/index.js');
const { httpTools }        = require('../dist/tools/http/index.js');
const { gitTools }         = require('../dist/tools/git/index.js');
const { systemTools }      = require('../dist/tools/system/index.js');
const { aiTools }          = require('../dist/tools/ai/index.js');
const { utilitiesTools }   = require('../dist/tools/utilities/index.js');

// ── Agent tool registry (tools disponibles para function calling) ────────────
const AGENT_EXCLUDED = new Set(['nexus_execute_command', 'nexus_list_processes']);
const AGENT_TOOL_LIST = [
  ...utilitiesTools,
  ...systemTools.filter(t => !AGENT_EXCLUDED.has(t.name)),
];
const agentToolIndex = Object.fromEntries(AGENT_TOOL_LIST.map(t => [t.name, t]));

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

// ── Ejecuta un turno con OpenAI Function Calling ──────────────────────────────
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
    return { text: msg.content, tokens: usage1, toolUsed: null };
  }

  const call = msg.tool_calls[0];
  const toolName = call.function.name;
  const toolArgs = JSON.parse(call.function.arguments);
  const tool = agentToolIndex[toolName];

  let toolResult;
  try {
    const r = await tool.handler(toolArgs);
    toolResult = r.success ? r.data : { error: r.error?.message };
  } catch (err) { toolResult = { error: err.message }; }

  const second = await openai.chat.completions.create({
    model,
    messages: [
      ...messages, msg,
      { role: 'tool', tool_call_id: call.id, content: JSON.stringify(toolResult) },
    ],
  });
  const usage2 = second.usage?.total_tokens || 0;
  return { text: second.choices[0].message.content, tokens: usage1 + usage2, toolUsed: { name: toolName, args: toolArgs, result: toolResult } };
}

const ALL_TOOLS = [
  { cat: 'Filesystem', icon: '📁', tools: filesystemTools },
  { cat: 'HTTP',       icon: '🌐', tools: httpTools        },
  { cat: 'Git',        icon: '🔀', tools: gitTools         },
  { cat: 'System',     icon: '💻', tools: systemTools      },
  { cat: 'AI',         icon: '🤖', tools: aiTools          },
  { cat: 'Utilities',  icon: '🔧', tools: utilitiesTools   },
];

// ── Colors ────────────────────────────────────────────────────────────────────
const c = {
  reset: '\x1b[0m', bright: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m', white: '\x1b[37m',
};

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

function showHelp(agentMode) {
  console.log(`\n${c.bright}  Comandos disponibles:${c.reset}`);
  console.log(`  ${c.cyan}/menu${c.reset}      Volver al menú de proveedores`);
  console.log(`  ${c.cyan}/agent${c.reset}     ${agentMode ? c.green + '✓ Modo agente ACTIVO' + c.reset + ' (la IA usa tools de Nexus-MCP)' : 'Activar modo agente (solo OpenAI)'}`);
  console.log(`  ${c.cyan}/tools${c.reset}     Listar todos los tools disponibles`);
  console.log(`  ${c.cyan}/reset${c.reset}     Limpiar el contexto de la conversación`);
  console.log(`  ${c.cyan}/clear${c.reset}     Limpiar pantalla`);
  console.log(`  ${c.cyan}/history${c.reset}   Ver últimos 6 mensajes`);
  console.log(`  ${c.cyan}/tokens${c.reset}    Ver uso de tokens de la sesión`);
  console.log(`  ${c.cyan}/help${c.reset}      Mostrar esta ayuda`);
  console.log(`  ${c.cyan}/exit${c.reset}      Salir\n`);
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
      if (providerKey !== 'openai') {
        console.log(`\n  ${c.yellow}⚠ El modo agente solo está disponible con OpenAI${c.reset}\n`);
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
    if (input === '/help')    { showHelp(agentMode); continue; }
    if (input === '/history') { showHistoryPreview(); continue; }
    if (input.startsWith('/tools')) { showTools(input.slice(6).trim()); continue; }
    if (input === '/tokens')  {
      console.log(`\n  ${c.dim}Sesión:${c.reset} ${sessionTokens} tokens  ${c.dim}Total acumulado:${c.reset} ${chatHistory.totalTokens} tokens`);
      console.log(`  ${c.dim}Contexto activo:${c.reset} ${Math.floor(sessionMessages.length / 2)} turnos (${sessionMessages.length} mensajes)`);
      console.log(`  ${c.dim}Modo agente:${c.reset} ${agentMode ? c.green + 'ACTIVO' + c.reset + ' (' + AGENT_TOOL_LIST.length + ' tools)' : c.dim + 'inactivo' + c.reset}\n`);
      continue;
    }

    addToHistory('user', input);
    sessionMessages.push({ role: 'user', content: input });

    const start = Date.now();
    let text, tokens;

    if (agentMode && providerKey === 'openai') {
      // ── Modo agente: OpenAI Function Calling ─────────────────────────────
      try {
        const turn = await runAgentTurn(model, sessionMessages.slice(0, -1), input);
        text   = turn.text;
        tokens = turn.tokens;

        if (turn.toolUsed) {
          const r = JSON.stringify(turn.toolUsed.result).slice(0, 80);
          console.log(`\n  ${c.yellow}🔧 ${turn.toolUsed.name}${c.reset}  ${c.dim}args: ${JSON.stringify(turn.toolUsed.args)}${c.reset}`);
          console.log(`  ${c.dim}   → ${r}…${c.reset}`);
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
