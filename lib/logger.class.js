import dateFormat from 'date-format'

const colors = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  fg: {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
  }
}

class Logger {
  static #symbols = {
    info: 'ℹ️',
    success: '✅',
    warn: '⚠️',
    error: '❌',
    check: '🔍',
    start: '🚀',
    stop: '🛑',
    reload: '🔄',
    remove: '🗑️',
    ffmpeg: '🎥',
    config: '⚙️'
  }

  static #getTime() {
    return `${colors.dim}[${dateFormat('hh:mm:ss', new Date())}]${colors.reset}`
  }

  static info(...args) {
    console.log(`${this.#getTime()} ${this.#symbols.info} ${colors.fg.blue}[INFO]${colors.reset}`, ...args)
  }

  static success(...args) {
    console.log(`${this.#getTime()} ${this.#symbols.success} ${colors.fg.green}[SUCCESS]${colors.reset}`, ...args)
  }

  static warn(...args) {
    console.warn(`${this.#getTime()} ${this.#symbols.warn} ${colors.fg.yellow}[WARN]${colors.reset}`, ...args)
  }

  static error(...args) {
    console.error(`${this.#getTime()} ${this.#symbols.error} ${colors.fg.red}[ERROR]${colors.reset}`, ...args)
  }

  static check(...args) {
    console.log(`${this.#getTime()} ${this.#symbols.check} ${colors.fg.cyan}[CHECK]${colors.reset}`, ...args)
  }

  static start(...args) {
    console.log(`${this.#getTime()} ${this.#symbols.start} ${colors.fg.green}[START]${colors.reset}`, ...args)
  }

  static stop(...args) {
    console.log(`${this.#getTime()} ${this.#symbols.stop} ${colors.fg.red}[STOP]${colors.reset}`, ...args)
  }

  static ffmpeg(...args) {
    console.log(`${this.#getTime()} ${this.#symbols.ffmpeg} ${colors.fg.magenta}[FFMPEG]${colors.reset}`, ...args)
  }

  static config(...args) {
    console.log(`${this.#getTime()} ${this.#symbols.config} ${colors.fg.yellow}[CONFIG]${colors.reset}`, ...args)
  }

  static log(...args) {
    console.log(`${this.#getTime()} ${this.#symbols.info} ${colors.fg.white}[LOG]${colors.reset}`, ...args)
  }
  static remove(...args) {
    console.log(`${this.#getTime()} ${this.#symbols.remove} ${colors.fg.red}[REMOVE]${colors.reset}`, ...args)
  }
}

export default Logger
