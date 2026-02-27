<script>
  import {
    ffmpegPath, saveFolder, nasPath, dateFormat,
    autoRec, autoCreateFolder, effectiveSavePath, showStats,
    viewMode, notifications, groupBy,
    selectFolder, selectFFmpeg, setDateFormat, setAutoRec,
    setAutoCreateFolder, setNasPath, setShowStats,
    setViewMode, setNotifications, setGroupBy,
    pollInterval, setPollInterval, offlinePollInterval, setOfflinePollInterval, maxRecDuration, setMaxRecDuration,
    ffmpegParams, setFfmpegParams, minimizeToTray, setMinimizeToTray,
    proxyList, selectProxyList,
    recFormat, setRecFormat, openSaveFolder,
    pauseForPrivate, setPauseForPrivate,
    useragent, setUserAgent,
    recQuality, setRecQuality,
    extBranch, setExtBranch,
    orderByStatus, setOrderByStatus,
    isSettingsOpen, closeSettings,
    isDev, devmode, setDevMode, syncDevExtensions,
    DATE_FORMATS, providers
  } from '@lib/store.js'
  import {
    FolderIcon, FileIcon, ServerIcon, SaveIcon,
    LayoutGrid, LayoutList, Bell, Layers, XIcon,
    CpuIcon, TimerIcon, Minimize2Icon, RefreshCcwIcon, GlobeIcon, UserIcon,
    GitBranchIcon, CodeIcon
  } from 'lucide-svelte'
</script>

{#if $isSettingsOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fixed inset-0 z-999 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onclick={closeSettings}>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="bg-surface-900 border border-white/10 rounded-2xl shadow-2xl shadow-black/60 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
      onclick={(e) => e.stopPropagation()}
    >
      <!-- Modal Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-surface-800">
        <h2 class="text-base font-semibold text-white/90">Settings</h2>
        <button
          class="p-1.5 rounded-lg hover:bg-surface-600 text-white/40 hover:text-white/70 transition-all cursor-pointer"
          onclick={closeSettings}
        >
          <XIcon size={18} />
        </button>
      </div>

      <div class="flex-1 overflow-y-auto p-6 space-y-6">
        <!-- ═══ Paths Section ═══ -->
        <section class="space-y-3">
          <h3 class="text-xs font-semibold text-white/40 uppercase tracking-wider">Paths</h3>
          <div class="space-y-2">
            <!-- Save Folder -->
            <div class="flex items-center gap-3 p-3 rounded-xl bg-surface-800/80 border border-white/5">
              <FolderIcon size={16} class="text-accent-400 shrink-0" />
              <div class="flex-1 min-w-0">
                <p class="text-[11px] text-white/40 mb-0.5">Save Folder</p>
                <p class="text-xs text-white/70 truncate">{$saveFolder || 'Not set'}</p>
              </div>
              <div class="flex items-center gap-2">
                <button
                  class="px-4 py-1.5 rounded-full bg-surface-700 hover:bg-surface-600 border border-white/8 text-xs font-medium text-white/70 hover:text-white/90 transition-all cursor-pointer"
                  onclick={openSaveFolder}
                >
                  Open
                </button>
                <button
                  class="px-4 py-1.5 rounded-full bg-surface-700 hover:bg-surface-600 border border-white/8 text-xs font-medium text-white/70 hover:text-white/90 transition-all cursor-pointer"
                  onclick={selectFolder}
                >
                  Browse
                </button>
              </div>
            </div>

            <!-- FFmpeg Path -->
            <div class="flex items-center gap-3 p-3 rounded-xl bg-surface-800/80 border border-white/5">
              <FileIcon size={16} class="text-cyan-400 shrink-0" />
              <div class="flex-1 min-w-0">
                <p class="text-[11px] text-white/40 mb-0.5">FFmpeg Binary</p>
                <p class="text-xs text-white/70 truncate">{$ffmpegPath || 'Not set'}</p>
              </div>
              <button
                class="px-4 py-1.5 rounded-full bg-surface-700 hover:bg-surface-600 border border-white/8 text-xs font-medium text-white/70 hover:text-white/90 transition-all cursor-pointer"
                onclick={selectFFmpeg}
              >
                Select
              </button>
            </div>
          </div>
        </section>

        <!-- ═══ NAS / Network Storage ═══ -->
        <section class="space-y-3">
          <h3 class="text-xs font-semibold text-white/40 uppercase tracking-wider">Network Storage (NAS)</h3>
          <div class="p-3 rounded-xl bg-surface-800/80 border border-white/5 space-y-2">
            <div class="flex items-center gap-3">
              <ServerIcon size={16} class="text-purple-400 shrink-0" />
              <div class="flex-1">
                <p class="text-[11px] text-white/40 mb-1">NAS / Network Path</p>
                <input
                  type="text"
                  value={$nasPath}
                  oninput={(e) => setNasPath(e.target.value)}
                  placeholder="\\NAS\recordings or /mnt/nas/recordings"
                  class="w-full px-4 py-2 rounded-xl bg-surface-700 border border-white/8 text-xs text-white/80 placeholder-white/25 outline-none focus:border-accent-500/50 focus:ring-1 focus:ring-accent-500/20 transition-all"
                />
              </div>
            </div>
            <p class="text-[10px] text-white/30 pl-7">
              When set, recordings save to this path instead of the local save folder.
              Active path: <span class="text-white/50">{$effectiveSavePath || 'None'}</span>
            </p>
          </div>
        </section>

        <!-- ═══ Recording Preferences ═══ -->
        <section class="space-y-3">
          <h3 class="text-xs font-semibold text-white/40 uppercase tracking-wider">Recording</h3>
          <div class="space-y-2">
            <!-- Date Format -->
            <div class="flex items-center gap-3 p-3 rounded-xl bg-surface-800/80 border border-white/5">
              <SaveIcon size={16} class="text-yellow-400 shrink-0" />
              <div class="flex-1">
                <p class="text-[11px] text-white/40 mb-1">File name Format</p>
                <select
                  value={$dateFormat}
                  onchange={(e) => setDateFormat(e.target.value)}
                  class="w-full px-4 py-2 rounded-xl bg-surface-700 border border-white/8 text-xs text-white/80 outline-none focus:border-accent-500/50 transition-all cursor-pointer"
                >
                  {#each DATE_FORMATS as fmt}
                    <option value={fmt.value}>{fmt.label}</option>
                  {/each}
                </select>
              </div>
            </div>

            <!-- Format Selection -->
            <div class="flex items-center gap-3 p-3 rounded-xl bg-surface-800/80 border border-white/5">
              <SaveIcon size={16} class="text-green-400 shrink-0" />
              <div class="flex-1">
                <p class="text-[11px] text-white/40 mb-1">Recording Format</p>
                <select
                  value={$recFormat}
                  onchange={(e) => setRecFormat(e.target.value)}
                  class="w-full px-4 py-2 rounded-xl bg-surface-700 border border-white/8 text-xs text-white/80 outline-none focus:border-accent-500/50 transition-all cursor-pointer"
                >
                  <option value="mkv">MKV (Recommended)</option>
                  <option value="mp4">MP4</option>
                  <option value="ts">TS</option>
                </select>
              </div>
            </div>

            <!-- Toggles -->
            <div class="grid grid-cols-2 gap-2">
              <label class="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-800/80 border border-white/5 cursor-pointer group hover:bg-surface-700/50 transition-all">
                <div>
                  <p class="text-xs text-white/70 group-hover:text-white/90 transition-colors">Auto Recording</p>
                  <p class="text-[10px] text-white/30">Start recording when online</p>
                </div>
                <div class="switch">
                  <input
                    type="checkbox"
                    checked={$autoRec}
                    onchange={(e) => setAutoRec(e.target.checked)}
                  />
                  <span class="slider"></span>
                </div>
              </label>

              {#if $autoRec}
              <div class="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-800/80 border border-white/5">
                <div>
                  <p class="text-xs text-white/70">Recording Quality</p>
                  <p class="text-[10px] text-white/30">Stream quality for Auto Recording</p>
                </div>
                <select
                  value={$recQuality}
                  onchange={(e) => setRecQuality(e.target.value)}
                  class="px-3 py-1.5 rounded-lg bg-surface-700 border border-white/8 text-xs text-white/80 outline-none focus:border-accent-500/50 transition-all cursor-pointer"
                >
                  <option value="best">Best</option>
                  <option value="optimal">Optimal</option>
                  <option value="lowest">Lowest</option>
                </select>
              </div>
              {/if}

              <label class="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-800/80 border border-white/5 cursor-pointer group hover:bg-surface-700/50 transition-all">
                <div>
                  <p class="text-xs text-white/70 group-hover:text-white/90 transition-colors">Order by Status</p>
                  <p class="text-[10px] text-white/30">Sort online cams first</p>
                </div>
                <div class="switch">
                  <input
                    type="checkbox"
                    checked={$orderByStatus}
                    onchange={(e) => setOrderByStatus(e.target.checked)}
                  />
                  <span class="slider"></span>
                </div>
              </label>

              <label class="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-800/80 border border-white/5 cursor-pointer group hover:bg-surface-700/50 transition-all">
                <div>
                  <p class="text-xs text-white/70 group-hover:text-white/90 transition-colors">Pause on Private</p>
                  <p class="text-[10px] text-white/30">Pause recording instead of stopping</p>
                </div>
                <div class="switch">
                  <input
                    type="checkbox"
                    checked={$pauseForPrivate}
                    onchange={(e) => setPauseForPrivate(e.target.checked)}
                  />
                  <span class="slider"></span>
                </div>
              </label>

              <label class="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-800/80 border border-white/5 cursor-pointer group hover:bg-surface-700/50 transition-all">
                <div>
                  <p class="text-xs text-white/70 group-hover:text-white/90 transition-colors">Auto Create Folder</p>
                  <p class="text-[10px] text-white/30">Subfolder by Date and Model</p>
                </div>
                <div class="switch">
                  <input
                    type="checkbox"
                    checked={$autoCreateFolder}
                    onchange={(e) => setAutoCreateFolder(e.target.checked)}
                  />
                  <span class="slider"></span>
                </div>
              </label>

              <label class="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-800/80 border border-white/5 cursor-pointer group hover:bg-surface-700/50 transition-all">
                <div>
                  <p class="text-xs text-white/70 group-hover:text-white/90 transition-colors">Show Recording Stats</p>
                  <p class="text-[10px] text-white/30">Display bitrate, fps, etc.</p>
                </div>
                <div class="switch">
                  <input
                    type="checkbox"
                    checked={$showStats}
                    onchange={(e) => setShowStats(e.target.checked)}
                  />
                  <span class="slider"></span>
                </div>
              </label>
            </div>
          </div>
        </section>

        <!-- ═══ Interface Section ═══ -->
        <section class="space-y-3 pb-6">
          <h3 class="text-xs font-semibold text-white/40 uppercase tracking-wider">Interface</h3>
          <div class="space-y-2">
            <!-- Default View Mode -->
            <div class="flex items-center gap-3 p-3 rounded-xl bg-surface-800/80 border border-white/5">
              <LayoutGrid size={16} class="text-indigo-400 shrink-0" />
              <div class="flex-1">
                <p class="text-[11px] text-white/40 mb-1">Default View Mode</p>
                <div class="flex items-center gap-2">
                  <button
                    class="flex-1 px-4 py-2 rounded-full border text-xs font-medium transition-all cursor-pointer {$viewMode === 'grid' ? 'bg-accent-500 text-white border-accent-400' : 'bg-surface-700 border-surface-600 text-white/70 hover:bg-surface-600'}"
                    onclick={() => setViewMode('grid')}
                  >
                    <div class="flex items-center justify-center gap-2">
                      <LayoutGrid size={14} />
                      Grid
                    </div>
                  </button>
                  <button
                    class="flex-1 px-4 py-2 rounded-full border text-xs font-medium transition-all cursor-pointer {$viewMode === 'list' ? 'bg-accent-500 text-white border-accent-400' : 'bg-surface-700 border-surface-600 text-white/70 hover:bg-surface-600'}"
                    onclick={() => setViewMode('list')}
                  >
                    <div class="flex items-center justify-center gap-2">
                      <LayoutList size={14} />
                      List
                    </div>
                  </button>
                </div>
              </div>
            </div>

            <!-- Grouping -->
            <div class="flex items-center gap-3 p-3 rounded-xl bg-surface-800/80 border border-white/5">
              <Layers size={16} class="text-orange-400 shrink-0" />
              <div class="flex-1">
                <p class="text-[11px] text-white/40 mb-1">Group Cameras By</p>
                <div class="flex items-center gap-2">
                  <button
                    class="flex-1 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer {$groupBy === 'none' ? 'bg-accent-500/15 border-accent-500/30 text-accent-400' : 'bg-surface-700 border-white/8 text-white/50 hover:text-white/70'}"
                    onclick={() => setGroupBy('none')}
                  >
                    None
                  </button>
                  <button
                    class="flex-1 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer {$groupBy === 'site' ? 'bg-accent-500/15 border-accent-500/30 text-accent-400' : 'bg-surface-700 border-white/8 text-white/50 hover:text-white/70'}"
                    onclick={() => setGroupBy('site')}
                  >
                    Site
                  </button>
                  <button
                    class="flex-1 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer {$groupBy === 'group' ? 'bg-accent-500/15 border-accent-500/30 text-accent-400' : 'bg-surface-700 border-white/8 text-white/50 hover:text-white/70'}"
                    onclick={() => setGroupBy('group')}
                  >
                    Custom
                  </button>
                </div>
              </div>
            </div>

            <!-- Toggles -->
            <div class="grid grid-cols-2 gap-2">
              <label class="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-800/80 border border-white/5 cursor-pointer group hover:bg-surface-700/50 transition-all">
                <div class="flex items-center gap-2.5">
                  <Bell size={14} class="text-blue-400 shrink-0" />
                  <div>
                    <p class="text-xs text-white/70 group-hover:text-white/90 transition-colors">Notifications</p>
                    <p class="text-[10px] text-white/30">Desktop alerts for events</p>
                  </div>
                </div>
                <div class="switch">
                  <input
                    type="checkbox"
                    checked={$notifications}
                    onchange={(e) => setNotifications(e.target.checked)}
                  />
                  <span class="slider"></span>
                </div>
              </label>

              <label class="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-800/80 border border-white/5 cursor-pointer group hover:bg-surface-700/50 transition-all">
                <div class="flex items-center gap-2.5">
                  <Minimize2Icon size={14} class="text-pink-400 shrink-0" />
                  <div>
                    <p class="text-xs text-white/70 group-hover:text-white/90 transition-colors">Close to Tray (X)</p>
                    <p class="text-[10px] text-white/30">Keep running in tray when closed</p>
                  </div>
                </div>
                <div class="switch">
                  <input
                    type="checkbox"
                    checked={$minimizeToTray}
                    onchange={(e) => setMinimizeToTray(e.target.checked)}
                  />
                  <span class="slider"></span>
                </div>
              </label>
            </div>

            <!-- Poll Interval -->
            <div class="flex items-center gap-3 p-3 rounded-xl bg-surface-800/80 border border-white/5">
              <RefreshCcwIcon size={16} class="text-emerald-400 shrink-0" />
              <div class="flex-1">
                <p class="text-[11px] text-white/40 mb-1">Online Check Interval (seconds)</p>
                <div class="flex items-center gap-3">
                  <input
                    type="range"
                    min="10"
                    max="120"
                    step="5"
                    value={$pollInterval / 1000}
                    oninput={(e) => setPollInterval(parseInt(e.target.value) * 1000)}
                    class="flex-1 h-1.5 bg-surface-600 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                  <span class="text-xs font-mono text-emerald-400 w-8 text-right">{$pollInterval / 1000}s</span>
                </div>
              </div>
            </div>

            <!-- Offline Poll Interval -->
            <div class="flex items-center gap-3 p-3 rounded-xl bg-surface-800/80 border border-white/5">
              <GlobeIcon size={16} class="text-orange-400 shrink-0" />
              <div class="flex-1">
                <p class="text-[11px] text-white/40 mb-1">Offline Cams Check Interval (seconds)</p>
                <div class="flex items-center gap-3">
                  <input
                    type="range"
                    min="10"
                    max="600"
                    step="10"
                    value={$offlinePollInterval / 1000}
                    oninput={(e) => setOfflinePollInterval(parseInt(e.target.value) * 1000)}
                    class="flex-1 h-1.5 bg-surface-600 rounded-lg appearance-none cursor-pointer accent-orange-500"
                  />
                  <span class="text-xs font-mono text-orange-400 w-8 text-right">{$offlinePollInterval / 1000}s</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- ═══ Network Proxy Section ═══ -->
        <section class="space-y-3">
          <h3 class="text-xs font-semibold text-white/40 uppercase tracking-wider">Network Proxy</h3>
          <div class="space-y-2">
            <!-- Proxy List File Selection -->
            <div class="flex items-center gap-3 p-3 rounded-xl bg-surface-800/80 border border-white/5">
              <FileIcon size={16} class="text-indigo-400 shrink-0" />
              <div class="flex-1 min-w-0">
                <p class="text-[11px] text-white/40 mb-0.5">Proxy List (.txt)</p>
                <p class="text-xs text-white/70 truncate">{$proxyList || 'Not set'}</p>
              </div>
              <button
                class="px-4 py-2 rounded-full bg-surface-700 hover:bg-surface-600 border border-white/8 text-xs font-medium text-white/70 hover:text-white/90 transition-all cursor-pointer"
                onclick={selectProxyList}
              >
                Select
              </button>
            </div>
          </div>
        </section>

        <!-- ═══ Advanced Section ═══ -->
        <section class="space-y-3 pb-6">
          <h3 class="text-xs font-semibold text-white/40 uppercase tracking-wider">Advanced</h3>
          <div class="space-y-2">
            <!-- Max Recording Duration -->
            <div class="flex items-center gap-3 p-3 rounded-xl bg-surface-800/80 border border-white/5">
              <TimerIcon size={16} class="text-red-400 shrink-0" />
              <div class="flex-1">
                <p class="text-[11px] text-white/40 mb-1">Max Recording Duration (minutes)</p>
                <div class="flex items-center gap-3">
                  <input
                    type="number"
                    min="0"
                    placeholder="0 = No limit"
                    value={$maxRecDuration || ''}
                    oninput={(e) => setMaxRecDuration(parseInt(e.target.value) || 0)}
                    class="w-24 px-4 py-2 rounded-xl bg-surface-700 border border-surface-600 text-xs text-white/80 outline-none focus:border-red-500 transition-all font-mono"
                  />
                  <p class="text-[10px] text-white/30">Auto-stop recording after this time.</p>
                </div>
              </div>
            </div>

            <!-- Custom FFmpeg Parameters -->
            <div class="flex items-center gap-3 p-3 rounded-xl bg-surface-800/80 border border-white/5">
              <CpuIcon size={16} class="text-cyan-400 shrink-0" />
              <div class="flex-1">
                <p class="text-[11px] text-white/40 mb-1">Custom FFmpeg Parameters</p>
                <input
                  type="text"
                  value={$ffmpegParams}
                  oninput={(e) => setFfmpegParams(e.target.value)}
                  placeholder="-c:v copy -c:a copy"
                  class="w-full px-4 py-2 rounded-xl bg-surface-700 border border-surface-600 text-xs text-white/80 placeholder-white/25 outline-none focus:border-cyan-500 transition-all font-mono"
                />
              </div>
            </div>

            <!-- Custom User Agent -->
            <div class="flex items-center gap-3 p-3 rounded-xl bg-surface-800/80 border border-white/5">
              <UserIcon size={16} class="text-amber-400 shrink-0" />
              <div class="flex-1">
                <p class="text-[11px] text-white/40 mb-1">Custom User Agent</p>
                <input
                  type="text"
                  value={$useragent}
                  oninput={(e) => setUserAgent(e.target.value)}
                  placeholder="Mozilla/5.0 ..."
                  class="w-full px-4 py-2 rounded-xl bg-surface-700 border border-surface-600 text-xs text-white/80 placeholder-white/25 outline-none focus:border-amber-500 transition-all font-mono"
                />
                <p class="text-[10px] text-white/30 mt-1">Used for web requests and FFmpeg streams.</p>
              </div>
            </div>

            <!-- Extension Branch -->
            <div class="flex items-center gap-3 p-3 rounded-xl bg-surface-800/80 border border-white/5">
              <GitBranchIcon size={16} class="text-purple-400 shrink-0" />
              <div class="flex-1">
                <p class="text-[11px] text-white/40 mb-1">Extension Branch</p>
                <select
                  value={$extBranch}
                  onchange={(e) => setExtBranch(e.target.value)}
                  class="w-full px-4 py-2 rounded-xl bg-surface-700 border border-surface-600 text-xs text-white/80 outline-none focus:border-purple-500 transition-all cursor-pointer"
                >
                  <option value="main">Main (Stable)</option>
                  <option value="dev">Dev (Experimental)</option>
                </select>
                <p class="text-[10px] text-white/30 mt-1">Branch used for extension updates from GitHub.</p>
              </div>
            </div>
          </div>
        </section>

        <!-- ═══ Developer Section (Debug only) ═══ -->
        {#if $isDev}
        <section class="space-y-3 pb-6">
          <h3 class="text-xs font-semibold text-accent-400 uppercase tracking-wider">Developer Settings</h3>
          <div class="space-y-2">
            <label class="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-800/80 border border-accent-500/20 cursor-pointer group hover:bg-surface-700/50 transition-all">
              <div class="flex items-center gap-2.5">
                <CodeIcon size={14} class="text-accent-400 shrink-0" />
                <div>
                  <p class="text-xs text-white/70 group-hover:text-white/90 transition-colors">Dev Mode Extensions</p>
                  <p class="text-[10px] text-white/30">Load from Documents/live-rec/extensions in development</p>
                </div>
              </div>
              <div class="switch">
                <input
                  type="checkbox"
                  checked={$devmode}
                  onchange={(e) => setDevMode(e.target.checked)}
                />
                <span class="slider"></span>
              </div>
            </label>

            <button
              class="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-surface-800/80 border border-white/5 text-xs font-medium text-white/70 hover:bg-surface-700 hover:text-white transition-all cursor-pointer"
              onclick={syncDevExtensions}
            >
              <RefreshCcwIcon size={14} />
              Sync Extensions from Project
            </button>
          </div>
        </section>
        {/if}
      </div>
    </div>
  </div>
{/if}
