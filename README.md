> [!WARNING]  
> This project is partially abandoned, due to lack of time.

# Live Rec v1.0.8 <img src="https://github.com/user-attachments/assets/2978fd6b-6846-4ebb-9eb6-6e2b5386fd10" width="40"/>

### 🎥 Record live streams from adult websites

## 📋 Prerequisites

- [FFmpeg](https://github.com/BtbN/FFmpeg-Builds/releases) installed on your system

## 🌟 Main Features

### Supported Sites
| Platform | Status |
|------------|---------|
| Bongacams | ✅ |
| Camsoda | ❌ |
| Chaturbate | ✅ |
| Dreamcam | ✅ |
| Stripchat | ❌ |
| Cam4 | ✅ |

### Operating Systems
| OS | Support |
|----|---------|
| Windows | ✅ |
| Linux | 🚧 |
| Mac | 🚧 |

## 🛠️ Features

### Implemented
- ✅ Automatic recording
- ✅ Recording time
- ✅ Sort by status and update

### Under Development
- 🚧 Automatic folder creation (by user or provider)
- 🚧 Command line interface
- 🚧 Notifications
- 🚧 More file extensions

## ⚠️ Limitations
- Private shows recording not supported
- ¿Why is only MKV supported and not mp4? 
`Because if a segment of MP4 files gets corrupted, it can corrupt the entire file or affect the overall playback, while in MKV files, if a segment gets corrupted, only that segment gets corrupted and you can watch the rest without any problem.`

## 💡 Troubleshooting

If you have issues with `config.json` location (documents/live-rec/config.json):

1. Backup your current `reclist`
2. Delete the `config.json` file
3. Let a new one generate
4. Paste your backed up `reclist` into the new file

## 🔧 Technologies Used

[![Electron][Electron]][Electron-url] [![Svelte][Svelte]][Svelte-url] [![Vite][Vite]][Vite-url]


> Based on [Electron Vite](https://electron-vite.org/) template

## 🚧 Developer Note
> We are working on optimizing the code, as currently everything is in App.svelte.

<!-- MARKDOWN LINKS & IMAGES -->
[Electron]: https://img.shields.io/badge/Electron-47848F?style=for-the-badge&logo=electron&logoColor=white
[Electron-url]: https://electronjs.org/
[Svelte]: https://img.shields.io/badge/Svelte-4A4A55?style=for-the-badge&logo=svelte&logoColor=FF3E00
[Svelte-url]: https://svelte.dev/
[Vite]: https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white
[Vite-url]: https://vitejs.dev/