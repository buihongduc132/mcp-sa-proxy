import { readFileSync } from 'fs'
import { z } from 'zod'

export const McpServerConfigSchema = z.object({
  name: z.string().optional(),
  type: z.enum(['stdio', 'sse', 'streamable-http']).optional(),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  url: z.string().optional(),
  env: z.record(z.string()).optional(),
  headers: z.record(z.string()).optional(),
})

export const ConfigSchema = z.object({
  mcpServers: z.record(z.string(), McpServerConfigSchema),
})

export type McpServerConfig = z.infer<typeof McpServerConfigSchema>
export type Config = z.infer<typeof ConfigSchema>

export function detectServerType(
  config: McpServerConfig,
): 'stdio' | 'sse' | 'streamable-http' {
  if (config.type) {
    return config.type
  }

  if (config.url) {
    // Auto-detect based on URL path
    try {
      const url = new URL(config.url)
      if (url.pathname.endsWith('/mcp') || url.pathname.includes('/mcp')) {
        return 'streamable-http'
      } else if (
        url.pathname.endsWith('/sse') ||
        url.pathname.includes('/sse')
      ) {
        return 'sse'
      } else {
        // Default to streamable-http for unrecognized HTTP endpoints
        return 'streamable-http'
      }
    } catch {
      return 'streamable-http'
    }
  }

  if (config.command) {
    return 'stdio'
  }

  throw new Error(
    `Cannot detect server type for ${config.name}. Please specify type explicitly.`,
  )
}

export function loadConfig(configPath: string): Config {
  try {
    const configContent = readFileSync(configPath, 'utf8')
    const configData = JSON.parse(configContent)
    return ConfigSchema.parse(configData)
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error(`Invalid JSON in config file: ${err.message}`)
    }
    if (err instanceof z.ZodError) {
      throw new Error(
        `Invalid config format: ${err.errors.map((e) => e.message).join(', ')}`,
      )
    }
    throw new Error(`Failed to load config: ${err}`)
  }
}
