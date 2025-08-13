import util from 'node:util'
import { Logger } from '../types.js'

const defaultFormatArgs = (args: any[]) => args

const log =
  (
    {
      formatArgs = defaultFormatArgs,
    }: {
      formatArgs?: typeof defaultFormatArgs
    } = { formatArgs: defaultFormatArgs },
  ) =>
  (...args: any[]) =>
    console.log('[mcp-superassistant-proxy]', ...formatArgs(args))

const logStderr =
  (
    {
      formatArgs = defaultFormatArgs,
    }: {
      formatArgs?: typeof defaultFormatArgs
    } = { formatArgs: defaultFormatArgs },
  ) =>
  (...args: any[]) =>
    console.error('[mcp-superassistant-proxy]', ...formatArgs(args))

const noneLogger: Logger = {
  info: () => {},
  error: () => {},
  debug: () => {},
  warn: () => {},
}

const infoLogger: Logger = {
  info: log(),
  error: logStderr(),
  debug: () => {},
  warn: logStderr(),
}

const infoLoggerStdio: Logger = {
  info: logStderr(),
  error: logStderr(),
  debug: () => {},
  warn: logStderr(),
}

const debugFormatArgs = (args: any[]) =>
  args.map((arg) => {
    if (typeof arg === 'object') {
      return util.inspect(arg, {
        depth: null,
        colors: process.stderr.isTTY,
        compact: false,
      })
    }

    return arg
  })

const debugLogger: Logger = {
  info: log({ formatArgs: debugFormatArgs }),
  error: logStderr({ formatArgs: debugFormatArgs }),
  debug: log({ formatArgs: debugFormatArgs }),
  warn: logStderr({ formatArgs: debugFormatArgs }),
}

const debugLoggerStdio: Logger = {
  info: logStderr({ formatArgs: debugFormatArgs }),
  error: logStderr({ formatArgs: debugFormatArgs }),
  debug: logStderr({ formatArgs: debugFormatArgs }),
  warn: logStderr({ formatArgs: debugFormatArgs }),
}

export const getLogger = ({
  logLevel,
  outputTransport,
}: {
  logLevel: string
  outputTransport: string
}): Logger => {
  if (logLevel === 'none') {
    return noneLogger
  }

  if (logLevel === 'debug') {
    return outputTransport === 'stdio' ? debugLoggerStdio : debugLogger
  }

  // info logLevel
  return outputTransport === 'stdio' ? infoLoggerStdio : infoLogger
}
