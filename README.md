<div align="center">

# <img src="https://github.com/user-attachments/assets/2978fd6b-6846-4ebb-9eb6-6e2b5386fd10" width="48" /> Live Rec

### *Record live streams from your favorite platforms — automatically.*

[![Electron][Electron-badge]][Electron-url]
[![Svelte][Svelte-badge]][Svelte-url]
[![Vite][Vite-badge]][Vite-url]
[![License: MIT][license-badge]](#)

<br/>

[![Windows][windows-badge]](#)
[![Camsoda][camsoda-badge]](#sites-supported)
[![Chaturbate][chaturbate-badge]](#sites-supported)

</div>

---

## About

**Live Rec** is a desktop application built with Electron that automatically monitors and records live streams from multiple cam platforms. It runs in the system tray, detects when models go online, and starts recording — no manual intervention needed.

<details>
<summary><b>Why use Live Rec?</b></summary>
<br>

- **Set it and forget it** — add models to your list and the app handles the rest.
- **Resilient recordings** — MKV format means partial files are still playable.
- **Multi-platform** — supports several sites from a single interface.
- **Smart splitting** — automatically concatenates segments after private/public transitions.

</details>

---

## Features

<table>
<tr>
<td width="50%">

### Core

- **Auto Recording** — starts when models go live
- **Manual Recording** — one-click start/stop
- **Auto Resume** — reconnects after disconnections
- **System Tray** — runs in background

</td>
<td width="50%">

### Tools

- **Mini Player** — floating preview with stats
- **Recording Stats** — codec, bitrate, FPS, resolution
- **Session Stats** — tracks daily/total recordings
- **Smart Folders** — auto-organized by model & date

</td>
</tr>
<tr>
<td>

### Settings

- Custom FFmpeg parameters
- Adjustable status check intervals
- Max recording file size (auto-split)
- Pause on private shows

</td>
<td>

### Advanced

- Local proxy for Camsoda streams
- Cloudflare bypass for protected sites
- Configurable date formats
- Auto-delete old recordings

</td>
</tr>
</table>

---

## Sites Supported

| Site | Status | Auto-Record | Notes |
|:---|:---:|:---:|:---|
| **Bongacams** | ✅ | ✅ | — |
| **Cam4** | ✅ | ✅ | — |
| **Camsoda** | ✅ | ✅ | Uses local proxy for stream rewriting |
| **Chaturbate** | ✅ | ✅ | Uses local proxy (CBProxy) |
| **Dreamcam** | ❌ | — | Not implemented |
| **Stripchat** | ✅ | ✅ | — |

## Platform Support

| Platform | Status |
|:---|:---:|
| <img src="https://cdn-icons-png.flaticon.com/512/220/220215.png" width="16"/> Windows | ✅ |
| <img src="https://cdn-icons-png.flaticon.com/512/220/220221.png" width="16"/> Linux | 🚧 |
| <img src="https://cdn-icons-png.flaticon.com/512/220/220213.png" width="16"/> macOS | 🚧 |

---

## Prerequisites

> [!IMPORTANT]
> You **must** have FFmpeg installed and available in your system PATH.

1. Download FFmpeg from [BtbN Builds](https://github.com/BtbN/FFmpeg-Builds/releases) (latest `git-master` build recommended)
2. Extract and add the `bin` folder to your system PATH
3. Verify installation: `ffmpeg -version`

<details>
<summary><b>Development Requirements</b></summary>

- [Node.js](https://nodejs.org/) 18+ or [Bun](https://bun.sh/)
- npm, yarn, or bun package manager

</details>

---

## Installation

```bash
# Clone the repository
git clone https://github.com/TokyoTF/live-rec.git
cd live-rec

# Install dependencies
npm install

# Start in development mode
npm run dev

# Build for production
npm run build
```

---

## Configuration

The app stores its configuration at `Documents/live-rec/config.json`.

<details>
<summary><b>Key Configuration Options</b></summary>

| Key | Type | Description |
|:---|:---|:---|
| `savefolder` | `string` | Base path for recordings |
| `recformat` | `string` | Output format (`mkv` recommended) |
| `dateformat` | `string` | Filename date format |
| `autocreatefolder` | `boolean` | Auto-create subfolders |
| `maxrecfilesize` | `number` | Max file size in MB before split |
| `pauseforprivate` | `boolean` | Pause recording during private shows |
| `useragent` | `string` | Custom User-Agent for requests |
| `ffmpegselect` | `string` | Path to ffmpeg binary |

</details>

---

## Why MKV?

> [!TIP]
> MKV is the default format because it is **resilient**. If a recording is interrupted — whether by a network drop, a crash, or a model going private — the file remains playable. MP4 files, in contrast, often become completely unreadable if not finalized correctly.

---

## Troubleshooting

<details>
<summary><b>Reset configuration</b></summary>

If you encounter issues with `config.json`:

1. Back up your current `reclist` array
2. Delete `Documents/live-rec/config.json`
3. Restart the app to generate a fresh config
4. Restore your `reclist` into the new file

</details>

<details>
<summary><b>Recording fails to start</b></summary>

- Verify FFmpeg is installed: `ffmpeg -version`
- Check the `config.json` has a valid `ffmpegselect` path
- Ensure the save folder exists and is writable

</details>

<details>
<summary><b>Camsoda not recording</b></summary>

Camsoda uses a local proxy to rewrite stream URLs. If recording fails:

- Check that port `19337` is not in use by another process
- Ensure Cloudflare cookies are being captured correctly

</details>

---

<div align="center">

**Built with ❤️ using [Electron Vite](https://electron-vite.org/)**

</div>

<!-- MARKDOWN LINKS & IMAGES -->
[Electron-badge]: https://img.shields.io/badge/Electron-47848F?style=flat-square&logo=electron&logoColor=white&labelColor=47848F
[Electron-url]: https://electronjs.org/
[Svelte-badge]: https://img.shields.io/badge/Svelte-FF3E00?style=flat-square&logo=svelte&logoColor=white&labelColor=FF3E00
[Svelte-url]: https://svelte.dev/
[Vite-badge]: https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white&labelColor=646CFF
[Vite-url]: https://vitejs.dev/
[license-badge]: https://img.shields.io/badge/License-MIT-green?style=flat-square
[windows-badge]: https://img.shields.io/badge/Windows-0078D4?style=flat-square&logo=windows&logoColor=white
[camsoda-badge]: https://img.shields.io/badge/Camsoda-ec4899?style=flat-square
[chaturbate-badge]: https://img.shields.io/badge/Chaturbate-f4731f?style=flat-square
