/**
 * Auto-detect provider and nametag from a URL or plain text input.
 */
import { getDOMAIN_TO_PROVIDER } from './store.js'

/**
 * Parse user input — could be a full URL or just a nametag.
 *
 * @param {string} input - URL like "https://chaturbate.com/modelname" or plain "modelname"
 * @returns {{ provider: string|null, nametag: string, isUrl: boolean }}
 */
export function parseStreamInput(input) {
  const trimmed = input.trim()

  // Try parsing as URL
  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
    const hostname = url.hostname.replace(/^www\./, '')

    // Check if hostname matches a known provider
    for (const [domain, provider] of Object.entries(getDOMAIN_TO_PROVIDER())) {

      if (hostname === domain || hostname.endsWith(`.${domain}`)) {
        // Extract nametag from path (first non-empty segment)
        const pathSegments = url.pathname.split('/').filter(Boolean)
        const nametag = pathSegments[0] || ''

        return { provider, nametag, isUrl: true }
      }
    }
  } catch {
    // Not a valid URL, treat as plain nametag
  }

  // Plain text — treat as nametag, provider must be selected manually
  return { provider: null, nametag: trimmed, isUrl: false }
}
