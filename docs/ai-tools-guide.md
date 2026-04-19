# AI Tools Guide

This guide explains how to interact with AI tools in Nexus-MCP.

## Overview

Nexus-MCP provides integration with 4 major AI providers:

1. **Ollama** - Local LLMs (runs on your machine)
2. **Gemini** - Google AI (cloud-based)
3. **OpenAI** - GPT models (cloud-based)
4. **Anthropic** - Claude models (cloud-based)

## Available Tools

### Ollama Tools

#### nexus_ollama_chat
Chat with local LLM models using Ollama.

**Parameters:**
- `prompt` (string, required): The prompt to send to the model
- `model` (string, default: "llama2"): Ollama model name (e.g., llama2, mistral, codellama)
- `stream` (boolean, default: false): Whether to stream the response
- `options` (object, optional):
  - `temperature` (number, 0-1): Sampling temperature
  - `top_p` (number, 0-1): Top P sampling
  - `num_predict` (number): Maximum tokens to predict

**Example:**
```javascript
const result = await aiHandlers.nexusOllamaChat({
  prompt: "Explain quantum computing in simple terms",
  model: "llama2",
  temperature: 0.7,
  stream: false
});
```

#### nexus_ollama_list_models
List available Ollama models.

**Parameters:**
- `detailed` (boolean, default: false): Whether to return detailed model information

**Example:**
```javascript
const result = await aiHandlers.nexusOllamaListModels({ detailed: true });
console.log(result.data.models);
```

### Gemini Tools

#### nexus_gemini_chat
Chat with Google Gemini AI models.

**Parameters:**
- `prompt` (string, required): The prompt to send to the model
- `model` (string, default: "gemini-pro"): Gemini model name (e.g., gemini-pro, gemini-pro-vision)
- `temperature` (number, 0-2): Temperature for generation
- `topP` (number, 0-1): Top P for generation
- `maxOutputTokens` (number): Maximum output tokens

**Example:**
```javascript
const result = await aiHandlers.nexusGeminiChat({
  prompt: "Write a haiku about programming",
  model: "gemini-pro",
  temperature: 0.7,
  topP: 0.9,
  maxOutputTokens: 100
});
```

#### nexus_gemini_list_models
List available Gemini models.

**Example:**
```javascript
const result = await aiHandlers.nexusGeminiListModels({});
console.log(result.data.models);
```

### OpenAI Tools

#### nexus_openai_chat
Chat with OpenAI GPT models.

**Parameters:**
- `prompt` (string, required): The prompt to send to the model
- `model` (string, default: "gpt-3.5-turbo"): OpenAI model name (e.g., gpt-3.5-turbo, gpt-4)
- `temperature` (number, 0-2): Temperature for generation
- `maxTokens` (number): Maximum tokens to generate
- `stream` (boolean, default: false): Whether to stream the response

**Example:**
```javascript
const result = await aiHandlers.nexusOpenAIChat({
  prompt: "Explain the difference between HTTP and HTTPS",
  model: "gpt-3.5-turbo",
  temperature: 0.7,
  maxTokens: 200,
  stream: false
});
console.log(result.data.response);
console.log(result.data.usage); // Token usage statistics
```

#### nexus_openai_list_models
List available OpenAI models.

**Example:**
```javascript
const result = await aiHandlers.nexusOpenAIListModels({});
console.log(`Found ${result.data.models.length} models`);
console.log(result.data.models.map(m => m.id));
```

### Anthropic Tools

#### nexus_anthropic_chat
Chat with Anthropic Claude models.

**Parameters:**
- `prompt` (string, required): The prompt to send to the model
- `model` (string, default: "claude-3-haiku-20240307"): Anthropic model name
- `temperature` (number, 0-1): Temperature for generation
- `maxTokens` (number): Maximum tokens to generate
- `stream` (boolean, default: false): Whether to stream the response

**Example:**
```javascript
const result = await aiHandlers.nexusAnthropicChat({
  prompt: "What are the benefits of TypeScript over JavaScript?",
  model: "claude-3-sonnet-20240229",
  temperature: 0.7,
  maxTokens: 300,
  stream: false
});
console.log(result.data.response);
console.log(result.data.usage); // Token usage statistics
```

#### nexus_anthropic_list_models
List available Anthropic models.

**Example:**
```javascript
const result = await aiHandlers.nexusAnthropicListModels({});
console.log(result.data.models);
```

## Interactive CLI

Nexus-MCP incluye una CLI interactiva para probar todos los proveedores de IA sin escribir código, con soporte de conversación multi-turn, historial persistente y acceso a la lista de tools.

### Uso

```powershell
# Asegúrate de tener el .env configurado con tus API keys
node --env-file=.env examples/ai-interactive-cli.js
```

### Flujo de la CLI

**1 — Selección de proveedor**

```
  ╔══════════════════════════════════════════════════════╗
  ║          Nexus-MCP  ·  AI Interactive CLI           ║
  ╚══════════════════════════════════════════════════════╝

────────────── Proveedores de IA ──────────────

  1  🦙  Ollama (Local LLMs)
  2  🔮  Gemini (Google AI)
  3  🤖  OpenAI (GPT)
  4  🧠  Anthropic (Claude)
  0  Salir

› Elige proveedor: _
```

**2 — Selección de modelo**

```
  Obteniendo modelos de OpenAI (GPT)...

──────── 🤖 OpenAI (GPT) ────────

  1  gpt-4-0613
  2  gpt-4
  3  gpt-3.5-turbo
  4  gpt-5.4-mini
  ...

  Enter = default: gpt-3.5-turbo

› Elige modelo (1-10 o Enter): _
```

**3 — Sesión de chat con contexto multi-turn**

```
  🤖 OpenAI (GPT)  ·  gpt-3.5-turbo
  Escribe /help para ver comandos
──────────────────────────────────────────────

Tú  › Mi nombre es Carlos
AI   › ¡Hola Carlos! ¿En qué puedo ayudarte hoy?
  ↳ 623ms  ·  18 tokens

[ctx:1 turn] Tú  › ¿Cómo me llamo?
AI   › Tu nombre es Carlos.
  ↳ 401ms  ·  22 tokens

[ctx:2 turns] Tú  › _
```

El indicador `[ctx:N turns]` muestra cuántos intercambios previos están activos como contexto (máximo 6 turnos).

### Comandos disponibles

| Comando | Descripción |
|---|---|
| `/menu` | Volver al menú de proveedores |
| `/agent` | Activar/desactivar modo agente con tools (solo OpenAI) |
| `/tools` | Listar los 72 tools disponibles con descripción |
| `/tools <filtro>` | Filtrar tools por nombre o descripción (ej: `/tools git`, `/tools file`) |
| `/reset` | Limpiar el contexto de la conversación sin salir de la sesión |
| `/clear` | Limpiar la pantalla |
| `/history` | Ver los últimos 6 mensajes del historial persistente |
| `/tokens` | Ver tokens usados en la sesión, contexto activo y estado del agente |
| `/help` | Mostrar la lista de comandos |
| `/exit` | Salir de la CLI |

### Ejemplo — `/tools` con filtro

```
[ctx:2 turns] Tú  › /tools git

────────────── 🔀 Git (15) ──────────────

  nexus_git_init       Initialize a new Git repository
  nexus_git_clone      Clone a Git repository from URL
  nexus_git_status     Get Git repository status
  nexus_git_add        Add files to Git staging area
  nexus_git_commit     Create a Git commit
  nexus_git_log        Get Git commit history
  ...

  Total: 15 tools para "git"
```

### Modo Agente — OpenAI Function Calling

Cuando usas OpenAI como proveedor, puedes activar el **modo agente** con `/agent`. En este modo la IA tiene acceso a los tools de Nexus-MCP y los invoca automáticamente cuando los necesita para responder.

```
  ✓ Modo agente ACTIVADO
  La IA usará los 14 tools de Nexus-MCP cuando los necesite

[🔧 agente] Tú  › dame información del sistema

  🔧 nexus_system_info  {}
     → {"cpu":{"model":"12th Gen Intel i7-1255U","count":12}...
  🔧 nexus_system_memory_info  {}
     → {"freeGB":"10.27","usedGB":"29.42",...

AI   › El sistema tiene un i7-1255U con 12 núcleos y 10.27 GB de RAM libre.
  ↳ 2341ms  ·  498 tokens

[🔧 agente] Tú  › genera un UUID para esta sesión

  🔧 nexus_uuid_generate  {}
     → {"uuid":"9d7dc0bf-f432-44da-a1d1-d9776d86ed8f",...

AI   › Aquí tienes tu UUID: `9d7dc0bf-f432-44da-a1d1-d9776d86ed8f`
  ↳ 921ms  ·  201 tokens

[🔧 agente] Tú  › /agent   ← toggle OFF
  ○ Modo agente desactivado
```

#### Cómo funciona internamente (4 pasos)

```
[1] Tú envías una solicitud en lenguaje natural
[2] GPT analiza y emite tool_calls con args validados por JSON schema
[3] Nexus-MCP ejecuta los tools (en paralelo si son varios)
[4] GPT recibe los resultados y redacta la respuesta final
```

**Tools disponibles en modo agente** (14 tools de utilities + system):
- `nexus_uuid_generate`, `nexus_hash_generate`, `nexus_timestamp`, `nexus_url_parse`
- `nexus_json_parse`, `nexus_json_stringify`, `nexus_base64_encode`, `nexus_base64_decode`
- `nexus_system_info`, `nexus_system_memory_info`, `nexus_system_cpu_info`
- `nexus_system_disk_info`, `nexus_system_network_info`, `nexus_system_os_info`

> **Nota**: Solo disponible con OpenAI. GPT puede invocar múltiples tools en paralelo (parallel function calling) — el agente los ejecuta todos y devuelve todos los resultados antes de formular la respuesta.

### Historial persistente

Cada conversación se guarda automáticamente en `examples/.chat-history.json` con timestamps, proveedor y tokens acumulados. El archivo se carga al iniciar la CLI y `/history` muestra los últimos 6 mensajes.

### Prueba rápida sin CLI (Node.js)

Para verificar que los handlers funcionan directamente:

```javascript
// test-ai.js
'use strict';
const { aiHandlers } = require('./dist/tools/ai/index.js');

async function test() {
  // Listar modelos OpenAI
  const models = await aiHandlers.nexusOpenAIListModels({});
  console.log('Modelos (primeros 5):', models.data.models.slice(0, 5).map(m => m.id));

  // Chat con GPT-3.5
  const chat = await aiHandlers.nexusOpenAIChat({
    prompt: 'Di hola en una sola palabra',
    model: 'gpt-3.5-turbo',
    temperature: 0.7,
    maxTokens: 20,
    stream: false
  });
  console.log('Respuesta:', chat.data.response);
  console.log('Tokens:', chat.data.usage?.total_tokens);
}

test().catch(console.error);
```

```powershell
node --env-file=.env test-ai.js
```

## Configuration

### Environment Variables

Los AI tools leen las variables de entorno **directamente** (sin prefijo `NEXUS_`).
Copia `.env.example` a `.env` y rellena los valores:

```bash
# Ollama — LLMs locales (no requiere API key)
OLLAMA_HOST=http://localhost:11434
NEXUS_AI_OLLAMA_DEFAULT_MODEL=llama2

# Google Gemini
GEMINI_API_KEY=your_gemini_api_key
NEXUS_AI_GEMINI_MODEL=gemini-pro

# OpenAI
OPENAI_API_KEY=your_openai_api_key
NEXUS_AI_OPENAI_MODEL=gpt-4-turbo-preview

# Anthropic Claude
ANTHROPIC_API_KEY=your_anthropic_api_key
NEXUS_AI_ANTHROPIC_MODEL=claude-3-sonnet-20240229
```

> **Nota**: Las variables `NEXUS_AI_*` son para configuración general del servidor (modelo por defecto, tokens, temperatura). Las variables sin prefijo (`OPENAI_API_KEY`, etc.) son las que los tools leen para autenticarse.

### Getting API Keys

**OpenAI:**
1. Go to https://platform.openai.com/api-keys
2. Create an account or sign in
3. Generate a new API key

**Gemini:**
1. Go to https://makersuite.google.com/app/apikey
2. Create a project or sign in
3. Generate an API key

**Anthropic:**
1. Go to https://console.anthropic.com/
2. Create an account or sign in
3. Generate an API key

**Ollama (Local):**
1. Download from https://ollama.ai/
2. Install on your machine
3. Start the Ollama server: `ollama serve`
4. Pull a model: `ollama pull llama2`

## Usage Examples

### Example 1: Simple Chat with OpenAI

```javascript
import { aiHandlers } from '@nexus-mcp/server';

const response = await aiHandlers.nexusOpenAIChat({
  prompt: "What is the capital of France?",
  model: "gpt-3.5-turbo",
  temperature: 0.7,
  maxTokens: 100
});

console.log(response.data.response);
// Output: "The capital of France is Paris."
```

### Example 2: Compare Responses from Multiple Providers

```javascript
import { aiHandlers } from '@nexus-mcp/server';

const prompt = "Explain the concept of recursion in programming";

const openai = await aiHandlers.nexusOpenAIChat({
  prompt,
  model: "gpt-3.5-turbo"
});

const anthropic = await aiHandlers.nexusAnthropicChat({
  prompt,
  model: "claude-3-haiku-20240307"
});

console.log("OpenAI:", openai.data.response);
console.log("Anthropic:", anthropic.data.response);
```

### Example 3: Streaming Response

```javascript
import { aiHandlers } from '@nexus-mcp/server';

const response = await aiHandlers.nexusOpenAIChat({
  prompt: "Write a short story about a robot",
  model: "gpt-3.5-turbo",
  stream: true
});

// When stream is true, the response is accumulated and returned
console.log(response.data.response);
```

### Example 4: List All Available Models

```javascript
import { aiHandlers } from '@nexus-mcp/server';

// OpenAI
const openaiModels = await aiHandlers.nexusOpenAIListModels({});
console.log("OpenAI models:", openaiModels.data.models.map(m => m.id));

// Gemini
const geminiModels = await aiHandlers.nexusGeminiListModels({});
console.log("Gemini models:", geminiModels.data.models.map(m => m.name));

// Anthropic
const anthropicModels = await aiHandlers.nexusAnthropicListModels({});
console.log("Anthropic models:", anthropicModels.data.models.map(m => m.name));

// Ollama (if installed)
const ollamaModels = await aiHandlers.nexusOllamaListModels({});
console.log("Ollama models:", ollamaModels.data.models.map(m => m.name));
```

## Best Practices

1. **Choose the Right Model**:
   - Use `gpt-3.5-turbo` or `claude-3-haiku` for simple tasks (faster, cheaper)
   - Use `gpt-4` or `claude-3-opus` for complex tasks (more capable)

2. **Temperature Settings**:
   - Lower temperature (0.1-0.3) for more deterministic responses
   - Higher temperature (0.7-1.0) for more creative responses

3. **Token Management**:
   - Set reasonable `maxTokens` limits to control costs
   - Monitor `usage` statistics to track token consumption

4. **Error Handling**:
   - Always check `success` field in response
   - Handle missing API keys gracefully
   - Implement retry logic for rate limits

5. **Security**:
   - Never commit API keys to version control
   - Use environment variables or secret managers
   - Rotate API keys regularly

## Common Use Cases

### Code Generation

```javascript
const code = await aiHandlers.nexusOpenAIChat({
  prompt: "Write a TypeScript function that sorts an array of numbers",
  model: "gpt-4",
  temperature: 0.2
});
```

### Text Summarization

```javascript
const summary = await aiHandlers.nexusAnthropicChat({
  prompt: "Summarize the following text in 3 bullet points: [long text]",
  model: "claude-3-sonnet-20240229",
  maxTokens: 200
});
```

### Translation

```javascript
const translation = await aiHandlers.nexusGeminiChat({
  prompt: "Translate 'Hello, world!' to Spanish",
  model: "gemini-pro"
});
```

### Code Review

```javascript
const review = await aiHandlers.nexusOpenAIChat({
  prompt: "Review this code for bugs and improvements:\n[code]",
  model: "gpt-4",
  temperature: 0.3
});
```

## Troubleshooting

### "API key not configured" Error
- Ensure the environment variable is set
- Check that the API key is valid
- Verify the API key has the necessary permissions

### "Model not found" Error
- Check the model name spelling
- Verify the model is available in your region
- Some models may require special access

### Rate Limiting
- Implement exponential backoff
- Use a queue for multiple requests
- Consider upgrading your API plan

### Ollama Connection Issues
- Ensure Ollama is running: `ollama serve`
- Check the OLLAMA_HOST configuration
- Verify the model is downloaded: `ollama list`

## Performance Tips

1. **Batch Requests**: Process multiple prompts in parallel when possible
2. **Caching**: Cache responses for repeated prompts
3. **Model Selection**: Use smaller models for simple tasks
4. **Streaming**: Use streaming for long responses to improve perceived latency
5. **Connection Pooling**: Reuse client instances for multiple requests

## Cost Considerations

- **OpenAI**: Charged per 1K tokens (input and output)
- **Gemini**: Free tier available, then charged per request
- **Anthropic**: Charged per 1K tokens (input and output)
- **Ollama**: Free (runs locally, uses your hardware)

Always monitor token usage and set appropriate limits to control costs.

## Support

For issues or questions:
- Check the [main documentation](./README.md)
- Review the [API reference](./api-reference.md)
- Open an issue on GitHub
