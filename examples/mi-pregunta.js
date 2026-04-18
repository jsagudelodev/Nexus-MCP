// Script simple para hacer una pregunta a la IA
import { aiHandlers } from '../dist/tools/ai/index.js';

async function preguntar() {
  const response = await aiHandlers.nexusOpenAIChat({
    prompt: "¿Qué es Nexus-MCP?",
    model: "gpt-3.5-turbo",
    temperature: 0.7,
    maxTokens: 200,
    stream: false
  });
  
  if (response.success) {
    console.log('Respuesta:', response.data.response);
    console.log('Tokens usados:', response.data.usage.total_tokens);
  } else {
    console.error('Error:', response.error);
  }
}

preguntar();
