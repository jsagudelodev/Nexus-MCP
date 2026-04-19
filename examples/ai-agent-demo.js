// ai-agent-demo.js — Demostración de cómo la IA usa los tools de Nexus-MCP
// Usa OpenAI Function Calling nativo para máxima fiabilidad en args
'use strict';

const { logger } = require('../dist/logger.js');
const winston = require('winston');
logger.add(new winston.transports.Console({ silent: true }));

const OpenAI = require('openai');
const { zodToJsonSchema } = require('zod-to-json-schema');
const { utilitiesTools } = require('../dist/tools/utilities/index.js');
const { systemTools }    = require('../dist/tools/system/index.js');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Tool registry disponible para el agente ──────────────────────────────────
// nexus_execute_command y nexus_list_processes tienen schemas con tipos
// incompatibles con OpenAI function calling (ej: minimum:true en lugar de number)
const EXCLUDED = new Set(['nexus_execute_command', 'nexus_list_processes']);
const AGENT_TOOLS = [
  ...utilitiesTools,
  ...systemTools.filter(t => !EXCLUDED.has(t.name)),
];

const toolIndex = Object.fromEntries(AGENT_TOOLS.map(t => [t.name, t]));

// Convertir Zod schema → JSON Schema limpio para OpenAI
function toOpenAIParams(zodSchema) {
  try {
    const json = zodToJsonSchema(zodSchema, { target: 'openApi3' });
    // zodToJsonSchema añade $schema y otros campos que OpenAI no acepta
    const { $schema, ...clean } = json;
    if (!clean.type) clean.type = 'object';
    if (!clean.properties) clean.properties = {};
    return clean;
  } catch {
    return { type: 'object', properties: {} };
  }
}

// Convertir tools de Nexus-MCP al formato que espera la API de OpenAI
const openaiToolDefs = AGENT_TOOLS.map(t => ({
  type: 'function',
  function: {
    name: t.name,
    description: t.description,
    parameters: toOpenAIParams(t.inputSchema),
  },
}));

// ── Colores ───────────────────────────────────────────────────────────────────
const c = {
  reset: '\x1b[0m', bright: '\x1b[1m', dim: '\x1b[2m',
  cyan: '\x1b[36m', green: '\x1b[32m', yellow: '\x1b[33m', magenta: '\x1b[35m',
};

const hr = (label = '') => {
  const pad = Math.max(0, 54 - label.length);
  console.log(label
    ? `\n${c.dim}──── ${c.reset}${c.bright}${label}${c.reset} ${c.dim}${'─'.repeat(pad)}${c.reset}`
    : `\n${c.dim}${'─'.repeat(58)}${c.reset}`);
};

// ── 1. Llamada directa (sin IA) ───────────────────────────────────────────────
async function demo1_directCall() {
  hr('1. Llamada directa a tools (sin IA)');

  const [uuid, hash, ts, sys] = await Promise.all([
    toolIndex['nexus_uuid_generate'].handler({}),
    toolIndex['nexus_hash_generate'].handler({ text: 'Nexus-MCP', algorithm: 'sha256' }),
    toolIndex['nexus_timestamp'].handler({ format: 'iso' }),
    toolIndex['nexus_system_info'].handler({}),
  ]);

  console.log(`  ${c.cyan}nexus_uuid_generate${c.reset}  →  ${uuid.data.uuid}`);
  console.log(`  ${c.cyan}nexus_hash_generate${c.reset}  →  ${hash.data.hash.slice(0, 40)}…`);
  console.log(`  ${c.cyan}nexus_timestamp${c.reset}      →  ${ts.data.timestamp}`);
  console.log(`  ${c.cyan}nexus_system_info${c.reset}    →  ${sys.data.cpu.model}  |  RAM libre: ${Math.round(sys.data.memory.free / 1e6)} MB`);
}

// ── 2. Agente con OpenAI Function Calling nativo ──────────────────────────────
// Flujo:
//   [1] Usuario envía solicitud en lenguaje natural
//   [2] GPT analiza y emite un tool_call con args validados por JSON schema
//   [3] Nexus-MCP ejecuta el tool
//   [4] GPT recibe el resultado y redacta la respuesta final
async function demo2_nativeFunctionCalling(userRequest) {
  hr(`2. Function Calling — "${userRequest}"`);

  const messages = [
    { role: 'system', content: 'Eres un asistente con acceso a herramientas de sistema. Usa la herramienta más adecuada para responder.' },
    { role: 'user',   content: userRequest },
  ];

  // ── Paso A: GPT decide qué tool usar y con qué args ──────────────────────
  console.log(`\n  ${c.dim}[1] Enviando solicitud a GPT con ${openaiToolDefs.length} tools disponibles…${c.reset}`);

  const firstCall = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages,
    tools: openaiToolDefs,
    tool_choice: 'auto',
  });

  const assistantMsg = firstCall.choices[0].message;

  if (!assistantMsg.tool_calls?.length) {
    console.log(`\n  ${c.yellow}GPT respondió sin usar tools:${c.reset} ${assistantMsg.content}\n`);
    return;
  }

  const call = assistantMsg.tool_calls[0];
  const toolName = call.function.name;
  const toolArgs = JSON.parse(call.function.arguments);

  console.log(`  ${c.green}[2] Tool elegido:${c.reset} ${c.bright}${toolName}${c.reset}`);
  console.log(`      Args (JSON schema validado): ${JSON.stringify(toolArgs)}`);

  // ── Paso B: Ejecutar el tool en Nexus-MCP ────────────────────────────────
  const tool = toolIndex[toolName];
  if (!tool) {
    console.log(`  ${c.yellow}⚠ Tool "${toolName}" no disponible en el agente${c.reset}`);
    return;
  }

  let resultPayload;
  try {
    const toolResult = await tool.handler(toolArgs);
    resultPayload = toolResult.success ? toolResult.data : { error: toolResult.error?.message };
  } catch (err) {
    // Zod o cualquier error de validación → enviarlo a GPT para que corrija los args
    resultPayload = { error: err.message };
  }
  console.log(`  ${c.green}[3] Resultado del tool:${c.reset} ${JSON.stringify(resultPayload).slice(0, 120)}…`);

  // ── Paso C: GPT recibe el resultado y redacta respuesta final ───────────────
  const secondCall = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      ...messages,
      assistantMsg,
      {
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(resultPayload),
      },
    ],
    tools: openaiToolDefs,
    tool_choice: 'auto',
  });

  const secondMsg = secondCall.choices[0].message;

  // Si GPT reintenta con un segundo tool_call (autocorrección de args)
  if (secondMsg.tool_calls?.length) {
    const retry = secondMsg.tool_calls[0];
    const retryArgs = JSON.parse(retry.function.arguments);
    console.log(`  ${c.yellow}[3b] GPT reintenta con args corregidos:${c.reset} ${JSON.stringify(retryArgs)}`);
    let retryPayload;
    try {
      const retryResult = await toolIndex[retry.function.name]?.handler(retryArgs);
      retryPayload = retryResult?.success ? retryResult.data : { error: retryResult?.error?.message };
    } catch (err) {
      retryPayload = { error: err.message };
    }
    console.log(`      Resultado: ${JSON.stringify(retryPayload).slice(0, 110)}…`);

    const thirdCall = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        ...messages, assistantMsg,
        { role: 'tool', tool_call_id: call.id, content: JSON.stringify(resultPayload) },
        secondMsg,
        { role: 'tool', tool_call_id: retry.id, content: JSON.stringify(retryPayload) },
      ],
    });
    console.log(`\n  ${c.magenta}${c.bright}[4] Respuesta final:${c.reset} ${thirdCall.choices[0].message.content}\n`);
  } else {
    console.log(`\n  ${c.magenta}${c.bright}[4] Respuesta final:${c.reset} ${secondMsg.content}\n`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${c.bright}${c.cyan}  Nexus-MCP — Agente IA con Function Calling nativo${c.reset}`);
  console.log(`  ${c.dim}OpenAI valida los args directamente con el JSON schema de cada tool${c.reset}\n`);

  await demo1_directCall();

  await demo2_nativeFunctionCalling('¿Cuánta memoria RAM libre tiene el sistema?');
  await demo2_nativeFunctionCalling('Genera un UUID v4 para una nueva sesión');
  await demo2_nativeFunctionCalling('Dame el hash SHA-256 del texto "Nexus-MCP v1"');
}

main().catch(console.error);
