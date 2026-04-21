# Nexus-MCP - Guía de Inicio Rápido

## 🚀 **Instalación**

### **Requisitos Previos**
- Node.js 18+ o 20+
- npm o yarn
- Git (opcional, para herramientas de Git)

### **Instalación desde npm**
```bash
npm install -g @nexus-mcp/server
```

### **Instalación desde código fuente**
```bash
git clone https://github.com/your-org/Nexus-MCP.git
cd Nexus-MCP
npm install
npm run build
```

---

## ⚙️ **Configuración**

### **1. Variables de Entorno**

Crea un archivo `.env` en la raíz del proyecto:

```bash
# Server Configuration
NEXUS_LOG_LEVEL=info
NEXUS_LOG_FORMAT=json

# Filesystem Configuration
NEXUS_FILESYSTEM_ALLOWED_PATHS=/tmp,./workspace
NEXUS_FILESYSTEM_MAX_FILE_SIZE=100MB

# HTTP Configuration
NEXUS_HTTP_TIMEOUT=30000
NEXUS_HTTP_MAX_REDIRECTS=5
NEXUS_HTTP_USER_AGENT=Nexus-MCP/1.0

# Git Configuration
NEXUS_GIT_DEFAULT_BRANCH=main
NEXUS_GIT_SSH_KEY_PATH=~/.ssh/id_rsa

# Database Configuration (opcional)
NEXUS_DB_DEFAULT_CONNECTION=postgresql
NEXUS_DB_POSTGRESQL_HOST=localhost
NEXUS_DB_POSTGRESQL_PORT=5432
NEXUS_DB_POSTGRESQL_DATABASE=nexus
NEXUS_DB_POSTGRESQL_USER=nexus
NEXUS_DB_POSTGRESQL_PASSWORD=your_password

# AI Configuration (opcional)
NEXUS_AI_DEFAULT_PROVIDER=anthropic
NEXUS_AI_ANTHROPIC_API_KEY=your_anthropic_key
NEXUS_AI_OPENAI_API_KEY=your_openai_key
```

### **2. Archivo de Configuración YAML**

Opcionalmente, crea `config/config.yaml`:

```yaml
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

### **3. Configuración del MCP Gateway**

El MCP Gateway permite conectar servidores MCP externos para usar sus herramientas junto con las herramientas integradas.

Crea o edita `mcp-gateway.config.json`:

```json
{
  "servers": [
    {
      "name": "google-news",
      "transport": "stdio",
      "command": "node",
      "args": ["node_modules/@chanmeng666/google-news-server/dist/index.js"],
      "env": {
        "SERP_API_KEY": "${env:SERP_API_KEY}"
      }
    }
  ],
  "defaultTimeout": 30000,
  "enableDiscovery": true
}
```

**Opciones de configuración:**
- `name`: Identificador único del servidor
- `transport`: Tipo de conexión (`stdio` o `sse`)
- `command`: Comando para iniciar el servidor
- `args`: Argumentos del comando
- `env`: Variables de entorno del servidor

Para más detalles, consulta la [Guía de Configuración MCP](./mcp-configuration-guide.md).

---

## 🎮 **Uso Básico**

### **Iniciar el Servidor**

```bash
# Development (con hot reload)
npm run dev

# Production
npm start

# Con configuración personalizada
npm start -- --config /path/to/config.yaml
```

### **Integración con Claude Code**

Agrega Nexus-MCP a tu configuración de Claude Desktop:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "nexus-mcp": {
      "command": "node",
      "args": ["/path/to/nexus-mcp/dist/index.js"],
      "env": {
        "NEXUS_LOG_LEVEL": "info"
      }
    }
  }
}
```

Reinicia Claude Desktop y las herramientas estarán disponibles.

---

## 🛠️ **Herramientas Disponibles**

### **Filesystem Tools**

#### `nexus_read_file`
Lee un archivo del sistema de archivos.

```typescript
{
  "path": "/tmp/example.txt",
  "encoding": "utf8",
  "offset": 0,
  "limit": 100
}
```

#### `nexus_write_file`
Escribe o crea un archivo.

```typescript
{
  "path": "/tmp/example.txt",
  "content": "Hello, World!",
  "encoding": "utf8"
}
```

#### `nexus_list_directory`
Lista el contenido de un directorio.

```typescript
{
  "path": "/tmp",
  "recursive": false,
  include_hidden": false
}
```

#### `nexus_search_files`
Busca archivos por nombre o patrón.

```typescript
{
  "directory": "/tmp",
  "pattern": "*.txt",
  "recursive": true
}
```

### **HTTP Tools**

#### `nexus_http_get`
Realiza una solicitud HTTP GET.

```typescript
{
  "url": "https://api.example.com/data",
  "headers": {
    "Authorization": "Bearer token123"
  },
  "timeout": 30000
}
```

#### `nexus_http_post`
Realiza una solicitud HTTP POST.

```typescript
{
  "url": "https://api.example.com/data",
  "headers": {
    "Content-Type": "application/json"
  },
  "body": {
    "key": "value"
  }
}
```

#### `nexus_fetch_url`
Obtiene y parsea el contenido de una URL.

```typescript
{
  "url": "https://example.com",
  "extract_text": true,
  "extract_links": true
}
```

### **Git Tools**

#### `nexus_git_status`
Muestra el estado del repositorio Git.

```typescript
{
  "path": "/path/to/repo"
}
```

#### `nexus_git_clone`
Clona un repositorio Git.

```typescript
{
  "url": "https://github.com/user/repo.git",
  "path": "/tmp/repo",
  "branch": "main"
}
```

#### `nexus_git_commit`
Crea un commit.

```typescript
{
  "path": "/path/to/repo",
  "message": "Add new feature",
  "files": ["file1.ts", "file2.ts"]
}
```

### **Database Tools**

#### `nexus_db_query`
Ejecuta una consulta SQL.

```typescript
{
  "connection": "postgresql",
  "query": "SELECT * FROM users WHERE id = $1",
  "params": [123]
}
```

#### `nexus_db_list_tables`
Lista todas las tablas de la base de datos.

```typescript
{
  "connection": "postgresql"
}
```

### **System Tools**

#### `nexus_exec_command`
Ejecuta un comando de shell.

```typescript
{
  "command": "ls -la",
  "cwd": "/tmp",
  "timeout": 30000
}
```

#### `nexus_system_info`
Obtiene información del sistema.

```typescript
{
  "include": ["os", "cpu", "memory", "disk"]
}
```

### **AI Tools**

#### `nexus_llm_chat`
Chat con un LLM.

```typescript
{
  "provider": "anthropic",
  "model": "claude-3-sonnet-20240229",
  "messages": [
    {
      "role": "user",
      "content": "Hello, how are you?"
    }
  ],
  "max_tokens": 1000
}
```

#### `nexus_embedding_create`
Crea embeddings de texto.

```typescript
{
  "provider": "openai",
  "model": "text-embedding-3-small",
  "text": "Hello, World!"
}
```

### **Utilities Tools**

#### `nexus_json_parse`
Parsea una cadena JSON.

```typescript
{
  "json": '{"key": "value"}'
}
```

#### `nexus_date_format`
Formatea una fecha.

```typescript
{
  "date": "2024-04-15",
  "format": "YYYY-MM-DD HH:mm:ss",
  "timezone": "UTC"
}
```

---

## 📚 **Ejemplos de Uso**

### **Ejemplo 1: Leer y Procesar un Archivo**

```typescript
// 1. Leer archivo
const fileResult = await nexus_read_file({
  path: "/tmp/data.csv"
});

// 2. Parsear CSV
const csvResult = await nexus_csv_parse({
  csv: fileResult.data
});

// 3. Procesar datos
// ... (lógica de procesamiento)
```

### **Ejemplo 2: Web Scraping**

```typescript
// 1. Obtener página web
const pageResult = await nexus_fetch_url({
  url: "https://example.com",
  extract_text: true,
  extract_links: true
});

// 2. Guardar resultados
await nexus_write_file({
  path: "/tmp/scraped_data.json",
  content: JSON.stringify(pageResult.data)
});
```

### **Ejemplo 3: Workflow de Git**

```typescript
// 1. Clonar repositorio
await nexus_git_clone({
  url: "https://github.com/user/repo.git",
  path: "/tmp/repo"
});

// 2. Crear branch
await nexus_git_branch_create({
  path: "/tmp/repo",
  name: "feature/new-feature"
});

// 3. Hacer cambios
await nexus_write_file({
  path: "/tmp/repo/new_file.ts",
  content: "// new code"
});

// 4. Commit
await nexus_git_commit({
  path: "/tmp/repo",
  message: "Add new feature",
  files: ["new_file.ts"]
});

// 5. Push
await nexus_git_push({
  path: "/tmp/repo",
  branch: "feature/new-feature"
});
```

### **Ejemplo 4: Análisis de Base de Datos**

```typescript
// 1. Listar tablas
const tables = await nexus_db_list_tables({
  connection: "postgresql"
});

// 2. Describir tabla específica
const schema = await nexus_db_describe_table({
  connection: "postgresql",
  table: "users"
});

// 3. Ejecutar consulta
const results = await nexus_db_query({
  connection: "postgresql",
  query: "SELECT * FROM users WHERE active = true",
  params: []
});

// 4. Guardar resultados
await nexus_write_file({
  path: "/tmp/users.json",
  content: JSON.stringify(results.data)
});
```

---

## 🧪 **Testing**

### **Ejecutar Tests**

```bash
# Todos los tests
npm test

# Solo unit tests
npm run test:unit

# Solo integration tests
npm run test:integration

# Con cobertura
npm run test:coverage
```

### **Escribir Tests**

```typescript
// tests/unit/tools/filesystem/read_file.test.ts
import { readFile } from '../../../../src/tools/filesystem/read_file';
import { writeFile } from '../../../../src/tools/filesystem/write_file';

describe('readFile', () => {
  it('should read a file successfully', async () => {
    // Setup
    await writeFile({
      path: '/tmp/test.txt',
      content: 'Hello, World!'
    });

    // Test
    const result = await readFile({
      path: '/tmp/test.txt'
    });

    // Assert
    expect(result.success).toBe(true);
    expect(result.data).toBe('Hello, World!');
  });

  it('should handle non-existent file', async () => {
    const result = await readFile({
      path: '/tmp/nonexistent.txt'
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
```

---

## 🐛 **Troubleshooting**

### **Problema: El servidor no inicia**

**Solución:**
1. Verifica que Node.js 18+ esté instalado: `node --version`
2. Verifica que las dependencias estén instaladas: `npm install`
3. Revisa los logs: `tail -f logs/nexus.log`

### **Problema: Las herramientas no aparecen en Claude**

**Solución:**
1. Verifica la configuración de Claude Desktop
2. Reinicia Claude Desktop
3. Verifica que el servidor esté corriendo: `ps aux | grep nexus`
4. Revisa los logs de Claude Desktop

### **Problema: Error de permisos en filesystem**

**Solución:**
1. Verifica `NEXUS_FILESYSTEM_ALLOWED_PATHS` en .env
2. Asegúrate de que el path esté en la lista permitida
3. Verifica permisos del usuario

### **Problema: Error de conexión a base de datos**

**Solución:**
1. Verifica las credenciales en .env
2. Verifica que la base de datos esté accesible
3. Verifica que el puerto sea correcto
4. Prueba la conexión manualmente: `psql -h localhost -U nexus`

### **Problema: Error de timeout en HTTP**

**Solución:**
1. Aumenta `NEXUS_HTTP_TIMEOUT` en .env
2. Verifica que la URL sea correcta
3. Verifica conectividad de red
4. Prueba con curl: `curl -I https://example.com`

---

## 📖 **Recursos Adicionales**

- [Documentación completa](./architecture.md)
- [Referencia de API](./api-reference.md)
- [Referencia de herramientas](./tools-reference.md)
- [Guía de desarrollo](./development-guide.md)
- [Ejemplos](../examples/)

---

## 💡 **Próximos Pasos**

1. **Explora las herramientas**: Prueba cada categoría de herramientas
2. **Crea workflows**: Combina múltiples herramientas para automatizar tareas
3. **Personaliza la configuración**: Ajusta el sistema a tus necesidades
4. **Contribuye**: Agrega nuevas herramientas o mejora las existentes
5. **Comparte**: Comparte tus workflows con la comunidad

---

**¿Necesitas ayuda?**
- Abre un issue en GitHub
- Únete a nuestra comunidad Discord
- Revisa la documentación

---

**Última Actualización**: 2026-04-15
**Versión**: 1.0.0-alpha
