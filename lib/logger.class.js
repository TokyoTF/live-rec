import dateFormat from 'date-format'
import { appendFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

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

const FolderMain = resolve(process.env.USERPROFILE, 'Documents', 'live-rec')
const LogFile = resolve(FolderMain, 'log.txt')

if (!existsSync(FolderMain)) {
  mkdirSync(FolderMain, { recursive: true })
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

  static #writeToFile(message) {
    try {
      appendFileSync(LogFile, message + '\n')
    } catch (err) {
      console.error('Failed to write to log file:', err)
    }
  }

  static #getTime() {
    return `${colors.dim}[${dateFormat('hh:mm:ss', new Date())}]${colors.reset}`
  }

  static #getPlainTime() {
    return `[${dateFormat('hh:mm:ss', new Date())}]`
  }

  static info(...args) {
    const msg = `${this.#getPlainTime()} [INFO] ${args.join(' ')}`
    console.log(`${this.#getTime()} ${this.#symbols.info} ${colors.fg.blue}[INFO]${colors.reset}`, ...args)
    this.#writeToFile(msg)
  }

  static success(...args) {
    const msg = `${this.#getPlainTime()} [SUCCESS] ${args.join(' ')}`
    console.log(`${this.#getTime()} ${this.#symbols.success} ${colors.fg.green}[SUCCESS]${colors.reset}`, ...args)
    this.#writeToFile(msg)
  }

  static warn(...args) {
    const msg = `${this.#getPlainTime()} [WARN] ${args.join(' ')}`
    console.warn(`${this.#getTime()} ${this.#symbols.warn} ${colors.fg.yellow}[WARN]${colors.reset}`, ...args)
    this.#writeToFile(msg)
  }

  static error(...args) {
    const msg = `${this.#getPlainTime()} [ERROR] ${args.join(' ')}`
    console.error(`${this.#getTime()} ${this.#symbols.error} ${colors.fg.red}[ERROR]${colors.reset}`, ...args)
    this.#writeToFile(msg)
  }

  static check(...args) {
    const msg = `${this.#getPlainTime()} [CHECK] ${args.join(' ')}`
    console.log(`${this.#getTime()} ${this.#symbols.check} ${colors.fg.cyan}[CHECK]${colors.reset}`, ...args)
    this.#writeToFile(msg)
  }

  static start(...args) {
    const msg = `${this.#getPlainTime()} [START] ${args.join(' ')}`
    console.log(`${this.#getTime()} ${this.#symbols.start} ${colors.fg.green}[START]${colors.reset}`, ...args)
    this.#writeToFile(msg)
  }

  static stop(...args) {
    const msg = `${this.#getPlainTime()} [STOP] ${args.join(' ')}`
    console.log(`${this.#getTime()} ${this.#symbols.stop} ${colors.fg.red}[STOP]${colors.reset}`, ...args)
    this.#writeToFile(msg)
  }

  static ffmpeg(...args) {
    const msg = `${this.#getPlainTime()} [FFMPEG] ${args.join(' ')}`
    console.log(`${this.#getTime()} ${this.#symbols.ffmpeg} ${colors.fg.magenta}[FFMPEG]${colors.reset}`, ...args)
    this.#writeToFile(msg)
  }

  static config(...args) {
    const msg = `${this.#getPlainTime()} [CONFIG] ${args.join(' ')}`
    console.log(`${this.#getTime()} ${this.#symbols.config} ${colors.fg.yellow}[CONFIG]${colors.reset}`, ...args)
    this.#writeToFile(msg)
  }

  static log(...args) {
    const msg = `${this.#getPlainTime()} [LOG] ${args.join(' ')}`
    console.log(`${this.#getTime()} ${this.#symbols.info} ${colors.fg.white}[LOG]${colors.reset}`, ...args)
    this.#writeToFile(msg)
  }
  static remove(...args) {
    const msg = `${this.#getPlainTime()} [REMOVE] ${args.join(' ')}`
    console.log(`${this.#getTime()} ${this.#symbols.remove} ${colors.fg.red}[REMOVE]${colors.reset}`, ...args)
    this.#writeToFile(msg)
  }
}

export default Logger
