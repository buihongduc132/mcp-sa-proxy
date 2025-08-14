import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { stdioToSse } from './gateways/stdioToSse.js'
import { sseToStdio } from './gateways/sseToStdio.js'
import { sseToSse } from './gateways/sseToSse.js'
import { sseToWs } from './gateways/sseToWs.js'
import { stdioToWs } from './gateways/stdioToWs.js'
import { streamableHttpToStdio } from './gateways/streamableHttpToStdio.js'
import { streamableHttpToSse } from './gateways/streamableHttpToSse.js'
import { configToSse } from './gateways/configToSse.js'
import { configToWs } from './gateways/configToWs.js'
import { configToStreamableHttp } from './gateways/configToStreamableHttp.js'
import { headers } from './lib/headers.js'
import { corsOrigin } from './lib/corsOrigin.js'
import { getLogger } from './lib/getLogger.js'
import { stdioToStatelessStreamableHttp } from './gateways/stdioToStatelessStreamableHttp.js'
import { stdioToStatefulStreamableHttp } from './gateways/stdioToStatefulStreamableHttp.js'

const gatewayMap = {
  'stdio-sse': stdioToSse,
  'stdio-ws': stdioToWs,
  'stdio-streamableHttp': stdioToStatelessStreamableHttp,
  'stdio-streamableHttp-stateful': stdioToStatefulStreamableHttp,
  'sse-stdio': sseToStdio,
  'sse-sse': sseToSse,
  'sse-ws': sseToWs,
  'streamableHttp-stdio': streamableHttpToStdio,
  'streamableHttp-sse': streamableHttpToSse,
  'config-sse': configToSse,
  'config-ws': configToWs,
  'config-streamableHttp': configToStreamableHttp,
}

export async function main() {
  const argv = yargs(hideBin(process.argv))
    .option('stdio', {
      type: 'string',
      description: 'Command to run an MCP server over Stdio',
    })
    .option('sse', {
      type: 'string',
      description: 'SSE URL to connect to',
    })
    .option('streamableHttp', {
      type: 'string',
      description: 'Streamable HTTP URL to connect to',
    })
    .option('config', {
      type: 'string',
      description: 'Path to configuration file with multiple MCP servers',
    })
    .option('outputTransport', {
      type: 'string',
      choices: ['stdio', 'sse', 'ssetosse', 'ws', 'streamableHttp'],
      default: () => {
        const args = hideBin(process.argv)

        if (args.includes('--stdio')) return 'sse'
        if (args.includes('--sse')) return 'stdio'
        if (args.includes('--streamableHttp')) return 'stdio'
        if (args.includes('--config')) return 'sse'

        return undefined
      },
      description:
        'Transport for output. Default is "sse" when using --stdio or --config and "stdio" when using --sse or --streamableHttp.',
    })
    .option('port', {
      type: 'number',
      default: 3006,
      description:
        '(stdio→SSE, stdio→WS, stdio→StreamableHttp, SSE→SSE, SSE→WS, config→SSE, config→WS, config→StreamableHttp) Port for output MCP server',
    })
    .option('host', {
      type: 'string',
      default: 'localhost',
      description:
        '(stdio→SSE, stdio→WS, stdio→StreamableHttp, SSE→SSE, SSE→WS, config→SSE, config→WS, config→StreamableHttp) Host to bind to. Use "0.0.0.0" to bind to all interfaces.',
    })
    .option('baseUrl', {
      type: 'string',
      default: '',
      description:
        '(stdio→SSE, SSE→SSE, config→SSE) Base URL for output MCP server',
    })
    .option('ssePath', {
      type: 'string',
      default: '/sse',
      description:
        '(stdio→SSE, SSE→SSE, config→SSE) Path for SSE subscriptions',
    })
    .option('messagePath', {
      type: 'string',
      default: '/message',
      description:
        '(stdio→SSE, stdio→WS, SSE→SSE, SSE→WS, config→SSE, config→WS) Path for messages',
    })
    .option('streamableHttpPath', {
      type: 'string',
      default: '/mcp',
      description:
        '(stdio→StreamableHttp, config→StreamableHttp) Path for StreamableHttp',
    })
    .option('logLevel', {
      choices: ['debug', 'info', 'none'] as const,
      default: 'info',
      description: 'Logging level',
    })
    .option('cors', {
      type: 'array',
      description:
        'Configure CORS origins. CORS is enabled by default allowing all origins (*). Use --cors with no values to explicitly allow all origins, or supply one or more allowed origins (e.g. --cors "http://example.com" or --cors "/example\\.com$/" for regex matching).',
    })
    .option('healthEndpoint', {
      type: 'array',
      default: [],
      description:
        'One or more endpoints returning "ok", e.g. --healthEndpoint /healthz --healthEndpoint /readyz',
    })
    .option('header', {
      type: 'array',
      default: [],
      description:
        'Headers to be added to the request headers, e.g. --header "x-user-id: 123"',
    })
    .option('oauth2Bearer', {
      type: 'string',
      description:
        'Authorization header to be added, e.g. --oauth2Bearer "some-access-token" adds "Authorization: Bearer some-access-token"',
    })
    .option('stateful', {
      type: 'boolean',
      default: false,
      description:
        'Whether the server is stateful. Only supported for stdio→StreamableHttp and config→StreamableHttp.',
    })
    .option('sessionTimeout', {
      type: 'number',
      description:
        'Session timeout in milliseconds. Only supported for stateful stdio→StreamableHttp and config→StreamableHttp. If not set, the session will only be deleted when client transport explicitly terminates the session.',
    })
    .option('wsPingInterval', {
      type: 'number',
      default: 25000,
      description:
        'WebSocket ping interval in milliseconds. Default is 25000 (25 seconds). Set to 0 to disable ping/pong keep-alive.',
    })
    .option('wsPongTimeout', {
      type: 'number',
      default: 5000,
      description:
        'WebSocket pong timeout in milliseconds. Default is 5000 (5 seconds). Time to wait for pong response after sending ping.',
    })
    .help()
    .parseSync()

  const logger = getLogger({
    logLevel: argv.logLevel,
    outputTransport: argv.outputTransport as string,
  })

  const inputTransport = argv.stdio
    ? 'stdio'
    : argv.sse
    ? 'sse'
    : argv.streamableHttp
    ? 'streamableHttp'
    : 'config'

  const outputTransport = argv.outputTransport

  let gatewayKey = `${inputTransport}-${outputTransport}`
  if (inputTransport === 'stdio' && outputTransport === 'streamableHttp' && argv.stateful) {
    gatewayKey = 'stdio-streamableHttp-stateful'
  }

  const gateway = gatewayMap[gatewayKey as keyof typeof gatewayMap]

  if (gateway) {
    logger.info('Starting...')
    logger.info('Starting mcp-superassistant-proxy ...')
    logger.info(`  - inputTransport: ${inputTransport}`)
    logger.info(`  - outputTransport: ${outputTransport}`)

    const args = {
      logger,
      corsOrigin: corsOrigin({ argv }),
      healthEndpoints: argv.healthEndpoint as string[],
      headers: headers({
        argv,
        logger,
      }),
      ...argv,
      configPath: argv.config,
    }

    try {
      await gateway(args as any)
    } catch (err) {
      logger.error('Fatal error:', err)
      process.exit(1)
    }
  } else {
    logger.error(`Error: ${inputTransport}→${outputTransport} not supported`)
    process.exit(1)
  }
}
