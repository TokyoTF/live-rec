# Live Rec v1.0.8 🎥 <img src="https://github.com/user-attachments/assets/2978fd6b-6846-4ebb-9eb6-6e2b5386fd10" width="40" align="right"/>

> A powerful, minimalist tool to record live streams from various platforms with ease.

[![Electron][Electron]][Electron-url] [![Svelte][Svelte]][Svelte-url] [![Vite][Vite]][Vite-url]

> [!NOTE]
> **FFmpeg**: You need ffmpeg. [Download here](https://github.com/BtbN/FFmpeg-Builds/releases).

> [!NOTE]
> This application does not allow the recording of private shows.

## 🌟 Key Features

- 🚀 **Automatic Recording**: Automatically start recording when your favorite models go online.
- 🎯 **Mini Player**: Floating, draggable preview window with real-time recording stats (Bitrate, FPS, Codec).
- 📂 **Smart Organization**: Automatic folder creation per model or provider (Customizable).
- ⚙️ **Advanced Settings**:
  - Custom FFmpeg parameters for power users.
  - Periodic status checks with adjustable intervals.
  - Max recording duration limits.
  - System tray support for background operation.
- 📊 **Recording Stats**: Track recording time, bitrate, and resolution in real-time.

---

## 🧩 Sites support

| Site | Status |
| :--- | :---: |
| **Bongacams** | ✅ |
| **Chaturbate** | ✅ |
| **Dreamcam** | ❌ |
| **Cam4** | ✅ |
| **Stripchat** | ✅ |

## 🧩 Platform support

| Platform | Status |
| :--- | :---: |
| Windows | ✅ |
| Linux | 🚧 |
| Mac | 🚧 |

---

## 🛠️ Prerequisites

- **FFmpeg**: You Need FFmpeg :O [Download here](https://github.com/BtbN/FFmpeg-Builds/releases).
- **Node.js / Bun**: For development and building.

---

## ❓ Why MKV?

> [!TIP]
> We use **MKV** as the default format because it is more resilient. If a recording is interrupted or a segment gets corrupted, the rest of the file remains playable. In contrast, MP4 files often become completely unreadable if not finalized correctly.

---

## 🔧 Troubleshooting

If you encounter issues with `config.json` (located at `Documents/live-rec/config.json`):

1. Backup your current `reclist`.
2. Delete the `config.json` file.
3. Restart the app to generate a fresh configuration.
4. Restore your `reclist` into the new file.

---

> Built with ❤️ using [Electron Vite](https://electron-vite.org/) template.

<!-- MARKDOWN LINKS & IMAGES -->
[Electron]: https://img.shields.io/badge/Electron-47848F?style=for-the-badge&logo=electron&logoColor=white
[Electron-url]: https://electronjs.org/
[Svelte]: https://img.shields.io/badge/Svelte-4A4A55?style=for-the-badge&logo=svelte&logoColor=FF3E00
[Svelte-url]: https://svelte.dev/
[Vite]: https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white
[Vite-url]: https://vitejs.dev/
