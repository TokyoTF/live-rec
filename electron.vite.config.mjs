import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { vite as vidstack } from 'vidstack/plugins'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@': resolve('src/renderer/src'),
        '@lib': resolve('src/renderer/src/lib'),
        '@components': resolve('src/renderer/src/components'),
        '@assets': resolve('src/renderer/src/assets'),
        '@pages': resolve('src/renderer/src/pages')
      }
    },
    plugins: [svelte(), vidstack({ include: /player\// }), tailwindcss()]
  }
})
