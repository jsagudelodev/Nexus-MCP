# Nexus-MCP - Arquitectura del Sistema

## 🏗️ **Visión General**

Nexus-MCP es un servidor MCP (Model Context Protocol) construido con TypeScript/Node.js que expone herramientas universales para que los modelos de IA ejecuten tareas del mundo real. La arquitectura está diseñada para ser modular, extensible y de alto rendimiento.

```
┌─────────────────────────────────────────────────────────────┐
│                     Claude / LLM Client                     │
└────────────────────┬────────────────────────────────────────┘
                     │ MCP Protocol (stdio)
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   Nexus-MCP Server                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              MCP Server Core                          │  │
│  │  - Protocol Handler                                  │  │
│  │  - Request/Response Router                           │  │
│  │  - Tool Registry                                      │  │
│  │  - Resource Manager                                  │  │
│  └──────────────────────────────────────────────────────┘  │
│                          │                                  │
│  ┌───────────────────────┼───────────────────────────────┐  │
│  │                       │                               │  │
│  ▼                       ▼                               ▼  │
│  ┌──────────┐        ┌──────────┐                    ┌──────────┐  │
│  │ Filesystem│        │   HTTP   │                    │    Git   │  │
│  │  Tools   │        │  Tools   │                    │  Tools   │  │
│  └──────────┘        └──────────┘                    └──────────┘  │
│  ┌──────────┐        ┌──────────┐                    ┌──────────┐  │
│  │ Database │        │  System  │                    │    AI    │  │
│  │  Tools   │        │  Tools   │                    │  Tools   │  │
│  └──────────┘        └──────────┘                    └──────────┘  │
│  ┌──────────┐                                                        │
│  │ Utilities│                                                        │
│  │  Tools   │                                                        │
│  └──────────┘                                                        │
└─────────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   External Systems                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │   Local  │  │  Remote  │  │  APIs    │  │  Databases│     │
│  │  Files   │  │  Servers │  │          │  │           │     │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘      │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 **Componentes Principales**

### **1. MCP Server Core (`src/index.ts`)**

El corazón del sistema que implementa el protocolo MCP.

**Responsabilidades:**
- Manejar la conexión stdio con el cliente LLM
- Registrar y exponer herramientas MCP
- Enrutar requests a las herramientas apropiadas
- Manejar el ciclo de vida del servidor
- Validar requests y responses

**Interfaces Clave:**
```typescript
interface MCPServer {
  start(): Promise<void>;
  stop(): Promise<void>;
  registerTool(tool: MCPTool): void;
  listTools(): MCPTool[];
  callTool(name: string, args: any): Promise<any>;
}
```

### **2. Configuration Manager (`src/config.ts`)**

Gestiona la configuración del sistema desde múltiples fuentes.

**Fuentes de Configuración (en orden de prioridad):**
1. Variables de entorno (.env)
2. Archivo de configuración YAML (config/config.yaml)
3. Valores por defecto

**Estructura de Configuración:**
```yaml
# config/config.yaml
server:
  name: "nexus-mcp"
  version: "1.0.0"
  log_level: "info"

logging:
  format: "json"
  output: "stdout"
  file: "logs/nexus.log"

tools:
  filesystem:
    enabled: true
    max_file_size: "100MB"
    allowed_paths: ["/tmp", "./workspace"]
  
  http:
    enabled: true
    timeout: 30000
    max_redirects: 5
    user_agent: "Nexus-MCP/1.0"
  
  git:
    enabled: true
    default_branch: "main"
    ssh_key_path: "~/.ssh/id_rsa"
  
  database:
    enabled: true
    default_connection: "postgresql"
    pool_size: 10
  
  system:
    enabled: true
    allow_shell_commands: true
    max_execution_time: 60000
  
  ai:
    enabled: true
    default_provider: "anthropic"
    max_tokens: 4096
    temperature: 0.7
```

### **3. Type System (`src/types.ts`)**

Define todos los tipos TypeScript del sistema para type safety.

**Tipos Principales:**
```typescript
// Tool definition
interface MCPTool {
  name: string;
  description: string;
  inputSchema: z.ZodSchema;
  handler: (args: any) => Promise<any>;
  category: ToolCategory;
}

// Tool categories
enum ToolCategory {
  FILESYSTEM = "filesystem",
  HTTP = "http",
  GIT = "git",
  DATABASE = "database",
  SYSTEM = "system",
  AI = "ai",
  UTILITIES = "utilities"
}

// Result types
interface ToolResult {
  success: boolean;
  data?: any;
  error?: Error;
  metadata?: Record<string, any>;
}

// Configuration types
interface NexusConfig {
  server: ServerConfig;
  logging: LoggingConfig;
  tools: ToolsConfig;
}
```

### **4. Logger (`src/logger.ts`)**

Sistema de logging estructurado basado en Winston.

**Características:**
- Múltiples niveles (error, warn, info, debug)
- Formatos JSON y texto
- Salida a stdout, archivos, y servicios externos
- Contexto por herramienta/request
- Correlation IDs para trazar requests

**Uso:**
```typescript
logger.info("Tool execution started", {
  tool: "nexus_read_file",
  requestId: "req_123",
  args: { path: "/tmp/file.txt" }
});
```

### **5. Tool Registry**

Sistema centralizado para registrar y descubrir herramientas.

**Funcionalidades:**
- Registro dinámico de herramientas
- Búsqueda por nombre, categoría, tags
- Validación de esquemas de entrada
- Metadata de herramientas (versión, autor, deprecated)

---

## 🔧 **Arquitectura de Herramientas**

### **Estructura de una Herramienta**

Cada herramienta sigue un patrón consistente:

```
src/tools/[category]/
├── index.ts              # Export principal de la categoría
├── [tool-name].ts        # Implementación de la herramienta
├── schema.ts             # Esquema Zod de validación
├── types.ts              # Tipos específicos de la herramienta
└── tests/
    └── [tool-name].test.ts
```

### **Plantilla de Herramienta**

```typescript
// src/tools/filesystem/read_file.ts
import { z } from 'zod';
import { logger } from '../../logger';
import { ToolResult } from '../../types';

// 1. Definir esquema de validación
const ReadFileSchema = z.object({
  path: z.string().min(1),
  encoding: z.enum(['utf8', 'base64']).optional().default('utf8'),
  offset: z.number().optional(),
  limit: z.number().optional()
});

// 2. Definir tipos
type ReadFileArgs = z.infer<typeof ReadFileSchema>;

// 3. Implementar handler
export async function readFile(args: ReadFileArgs): Promise<ToolResult> {
  try {
    logger.info("Reading file", { path: args.path });
    
    // Validar entrada
    const validated = ReadFileSchema.parse(args);
    
    // Lógica de la herramienta
    const content = await fs.readFile(validated.path, validated.encoding);
    
    // Retornar resultado
    return {
      success: true,
      data: content,
      metadata: { size: content.length }
    };
  } catch (error) {
    logger.error("Failed to read file", { error, path: args.path });
    return {
      success: false,
      error: error as Error
    };
  }
}

// 4. Definir metadata de la herramienta
export const readFileTool = {
  name: 'nexus_read_file',
  description: 'Read a file from the filesystem',
  inputSchema: ReadFileSchema,
  handler: readFile,
  category: ToolCategory.FILESYSTEM,
  version: '1.0.0'
};
```

### **Categorías de Herramientas**

#### **1. Filesystem Tools**
- Operaciones CRUD de archivos
- Navegación de directorios
- Búsqueda de archivos
- Monitoreo de cambios
- Soporte para múltiples formatos

#### **2. HTTP Tools**
- Cliente HTTP completo
- Web scraping
- Integración con APIs REST/GraphQL
- Manejo de autenticación
- Soporte para WebSocket

#### **3. Git Tools**
- Operaciones Git completas
- Gestión de branches
- Pull Requests
- Integración con GitHub/GitLab/Bitbucket APIs

#### **4. Database Tools**
- Conexiones a múltiples DBs
- Consultas SQL parametrizadas
- Exploración de esquemas
- Transacciones
- Soporte NoSQL

#### **5. System Tools**
- Ejecución de comandos
- Gestión de procesos
- Información del sistema
- Gestión de servicios

#### **6. AI Tools**
- Integración con LLMs
- Embeddings y búsqueda semántica
- Procesamiento de texto
- Generación de código

#### **7. Utilities Tools**
- Manipulación de datos (JSON, YAML, CSV)
- Compresión
- Encriptación
- Fechas y tiempos

---

## 🔄 **Flujo de Ejecución**

### **1. Inicialización del Servidor**

```
1. Cargar configuración (env + YAML)
2. Inicializar logger
3. Validar configuración
4. Registrar herramientas
5. Iniciar servidor MCP (stdio)
6. Esperar requests
```

### **2. Procesamiento de Request**

```
Cliente LLM
    │
    ▼
┌─────────────────────────────────────┐
│  MCP Server recibe request          │
│  - Parsear JSON                     │
│  - Validar formato MCP              │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Tool Registry                     │
│  - Buscar herramienta por nombre    │
│  - Validar esquema de entrada      │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Tool Handler                      │
│  - Ejecutar lógica de la herramienta│
│  - Manejar errores                  │
│  - Loggear operaciones              │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Response Builder                  │
│  - Formatear respuesta MCP         │
│  - Incluir metadata                 │
└──────────────┬──────────────────────┘
               │
               ▼
Cliente LLM (Response)
```

### **3. Manejo de Errores**

**Estrategia de Manejo de Errores:**
1. **Validación de entrada**: Errores de validación Zod
2. **Errores de herramienta**: Excepciones en la lógica
3. **Errores de sistema**: Fallos de filesystem, red, etc.
4. **Errores de timeout**: Operaciones que exceden el tiempo límite

**Tipos de Error:**
```typescript
enum ErrorType {
  VALIDATION_ERROR = "validation_error",
  TOOL_ERROR = "tool_error",
  SYSTEM_ERROR = "system_error",
  TIMEOUT_ERROR = "timeout_error",
  PERMISSION_ERROR = "permission_error"
}

interface NexusError extends Error {
  type: ErrorType;
  code: string;
  details?: Record<string, any>;
  recoverable: boolean;
}
```

---

## 🔒 **Seguridad**

### **1. Validación de Entrada**
- Todas las entradas validadas con Zod
- Sanitización de paths para prevenir path traversal
- Validación de URLs para prevenir SSRF
- Limitación de tamaños de archivos

### **2. Control de Acceso**
- Paths permitidos configurables
- Comandos de shell permitidos/denegados
- Rate limiting por herramienta
- Autenticación para servicios externos

### **3. Aislamiento**
- Ejecución en sandbox cuando sea posible
- Límites de recursos (CPU, memoria, tiempo)
- Separación de privilegios
- Auditoría de todas las operaciones

### **4. Secrets Management**
- Variables de entorno para secrets
- Nunca loggear secrets
- Encriptación en reposo para datos sensibles
- Rotación de credenciales

---

## 📊 **Performance y Optimización**

### **1. Caching**
- Cache de respuestas de herramientas idempotentes
- Cache de conexiones de base de datos
- Cache de embeddings y vectores
- TTL configurable por herramienta

### **2. Concurrencia**
- Ejecución paralela de herramientas independientes
- Pool de conexiones para bases de datos
- Límites de concurrencia por herramienta
- Colas para operaciones asíncronas

### **3. Optimización de Memoria**
- Streaming para archivos grandes
- Paginación para listados
- Liberación de recursos después del uso
- Monitoreo de memoria

### **4. Optimización de Red**
- Reutilización de conexiones HTTP
- Compresión de datos
- Timeout y reintentos inteligentes
- CDN para assets estáticos

---

## 🧪 **Testing Strategy**

### **1. Unit Tests**
- Tests aislados por herramienta
- Mock de dependencias externas
- Cobertura de casos edge
- Tests de validación de esquemas

### **2. Integration Tests**
- Tests con sistemas reales (filesystem, Git local)
- Tests con APIs externas (mock o sandbox)
- Tests con bases de datos (SQLite en memoria)
- Tests de flujos completos

### **3. E2E Tests**
- Escenarios de uso reales
- Tests de estrés
- Tests de rendimiento
- Tests de seguridad

### **4. Test Structure**
```
tests/
├── unit/
│   ├── tools/
│   │   ├── filesystem/
│   │   │   └── read_file.test.ts
│   │   ├── http/
│   │   └── ...
│   └── utils/
├── integration/
│   ├── filesystem.test.ts
│   ├── git.test.ts
│   └── database.test.ts
└── e2e/
    ├── workflows.test.ts
    └── performance.test.ts
```

---

## 📈 **Monitoring y Observabilidad**

### **1. Métricas**
- Contador de invocaciones por herramienta
- Tiempo de ejecución por herramienta
- Tasa de errores por herramienta
- Uso de recursos (CPU, memoria)

### **2. Logging**
- Logs estructurados en JSON
- Niveles configurables
- Contexto por request
- Exportación a servicios externos (ELK, Datadog)

### **3. Tracing**
- Correlation IDs para requests
- Distributed tracing para operaciones complejas
- Timeline de ejecución
- Identificación de cuellos de botella

### **4. Alerting**
- Alertas de alta tasa de errores
- Alertas de alto uso de recursos
- Alertas de herramientas degradadas
- Alertas de security events

---

## 🚀 **Deployment**

### **1. Development**
```bash
npm install
npm run dev  # Hot reload con ts-node
```

### **2. Production**
```bash
npm run build
npm start
```

### **3. Docker**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
CMD ["node", "dist/index.js"]
```

### **4. Kubernetes**
- Deployment con replicas
- ConfigMap para configuración
- Secret para variables de entorno
- Service para exposición
- HPA para auto-scaling

---

## 🔌 **Extensibilidad**

### **1. Agregar Nuevas Herramientas**

1. Crear archivo en `src/tools/[category]/[tool-name].ts`
2. Definir esquema Zod
3. Implementar handler
4. Exportar metadata
5. Registrar en `src/tools/[category]/index.ts`
6. Agregar tests
7. Documentar

### **2. Agregar Nuevas Categorías**

1. Crear directorio en `src/tools/[category]/`
2. Crear `index.ts` que exporte todas las herramientas
3. Agregar categoría al enum `ToolCategory`
4. Actualizar configuración
5. Documentar

### **3. Plugins**

Futuro: Sistema de plugins para extensiones externas sin modificar el core.

---

## 📚 **Referencias**

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Zod Documentation](https://zod.dev/)
- [Winston Logging](https://github.com/winstonjs/winston)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

---

**Última Actualización**: 2026-04-15
**Versión**: 1.0.0-alpha
