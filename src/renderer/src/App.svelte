<script>
  import { listrec, localview } from './lib/store'
  import { PlusIcon } from 'lucide-svelte'
  import ItemCam from './components/itemCam.svelte'
  import { onDestroy } from 'svelte'
  import time from 'humanize-duration'

  import 'vidstack/player/styles/base.css'
  import 'vidstack/player/styles/plyr/theme.css'
  import 'vidstack/player'
  import 'vidstack/player/layouts/plyr'
  import 'vidstack/player/ui'

  const initialState = {
    url: '',
    nametag: '',
    recLoad: 0,
    recLoading: false,
    listrec: [],
    requireffmpeg: '',
    requirefolder: '',
    dateformat: 'model-site-dd-MM-yyyy_hh-mm-ss',
    loadconfig: false,
    orderbystatus: false,
    autorec: true
  }

  let state = { ...initialState }

  const timeFormatter = time.humanizer({
    language: 'shortEn',
    languages: {
      shortEn: {
        y: () => 'y',
        mo: () => 'mo',
        w: () => 'w',
        d: () => 'd',
        h: () => 'h',
        m: () => 'm',
        s: () => 's',
        ms: () => 'ms'
      }
    }
  })

  const initializeApp = () => {
    window.electron.ipcRenderer.send('Load:config')
  }

  const handleConfigLoad = (args) => {

    state = {
      ...state,
      requireffmpeg: args.ffmpegselect,
      requirefolder: args.savefolder,
      dateformat: args.dateformat,
      orderbystatus: args.orderby === 'status',
      autorec: args.autorec
    }

    if (!args.reclist.length) {
      state.loadconfig = true
      return
    }
    state.listrec = []
    listrec.update((n) => (state.listrec = n))
    loadRecordingList(args.reclist)
  }

  window.electron.ipcRenderer.on('Load:config', (event, args) => {
    handleConfigLoad(args)
  })

  const loadRecordingList = (reclist) => {
    const delay = 650
    const initialDelay = 1100

    setTimeout(() => {
      reclist.forEach((item, index) => {
        setTimeout(() => {
          addRecordingItem(item, index === reclist.length - 1)
        }, delay * index)
      })
    }, initialDelay)
  }

  const addRecordingItem = (item, isLast) => {
    state.listrec.push({
      nametag: item.nametag,
      provider: item.provider
    })

    if (isLast) {
      state.loadconfig = true
    }

    window.electron.ipcRenderer.send('rec:add', {
      name: item.nametag,
      provider: item.provider
    })
  }

  const handleFormSubmit = (event) => {
    const form = event.target
    const provider = form[0].options[form[0].selectedIndex].value
    const nametag = String(form[1].value)

    if (!isValidSubmission(provider, nametag)) return

    addNewRecording(provider, nametag)
  }

  // on change form any option or checkbox save modify:config
  const handleFormChange = (event) => {
    const form = event.target.form
    const dateformat = form[3].options[form[3].selectedIndex].value
    const orderby = form[4].checked ? 'status' : 'none'
    const autorec = form[5].checked

    window.electron.ipcRenderer.send('Modify:config', {
      name: 'raw',
      value: [
        { name: 'autorec', value: autorec },
        { name: 'orderby', value: orderby },
        { name: 'dateformat', value: dateformat }
      ]
    })
  }

  const isValidSubmission = (provider, nametag) => {
    const exists = state.listrec.find(
      (item) => item.nametag === nametag && item.provider === provider
    )
    return !exists && nametag && provider
  }

  const addNewRecording = (provider, nametag) => {
    const newItem = { nametag, provider }
    state.listrec.push(newItem)
    listrec.update((n) => (state.listrec = n))

    window.electron.ipcRenderer.send('Modify:config', {
      name: 'reclist',
      value: newItem
    })

    window.electron.ipcRenderer.send('rec:add', {
      name: nametag,
      provider
    })
  }

  const updateOrderBy = (event) => {
    if (event) {
      state.orderbystatus = !state.orderbystatus
      setTimeout(() => (event.target.checked = state.orderbystatus), 0)
    }

    $listrec = sortRecordingList(state.listrec, state.orderbystatus)
  }

  const sortRecordingList = (list, ascending) => {
    const statusOrder = 'onlineprivateofflinenotexist'
    return list.sort((a, b) => {
      const comparison =
        statusOrder.indexOf(String(a.status)) - statusOrder.indexOf(String(b.status))
      return ascending ? comparison : -comparison
    })
  }

  window.electron.ipcRenderer.on('rec:add', (event, args) => {
    const index = state.listrec.findIndex(
      (item) => item.nametag === args.data.nametag && item.provider === args.provider
    )

    if (index !== -1) {
      state.listrec[index] = {
        ...state.listrec[index],
        statusRec: args.data.statusRec,
        recUrl: args.data.recUrl,
        url: args.data.url,
        thumb: args.data.thumb,
        timeRec: args.data.timeRec ? args.data.timeRec : 0,
        status: args.data.status,
        resolutions: args.data.resolutions,
        timeFormat: args.data.timeRec ? timeFormatter(args.data.timeRec, { largest: 2 }) : '0 s'
      }
    }

    listrec.update((n) => (state.listrec = n))
    updateOrderBy()

    if (
      !state.recLoading &&
      state.listrec.length - 1 == state.recLoad &&
      state.loadconfig &&
      args.data.status == 'online'
    ) {
      state.recLoading = true
      localview.set({ recUrl: args.data.recUrl, nametag: args.data.nametag })
    }
    !state.recLoading && state.recLoad++
  })

  window.electron.ipcRenderer.on('rec:live:status', (event, args) => {
    const index = state.listrec.findIndex(
      (item) => item.nametag === args.nametag && item.provider === args.provider
    )

    if (index !== -1) {
      state.listrec[index] = {
        ...state.listrec[index],
        statusRec: args.status,
        realtime: args.realtime
      }
    }
  })

  window.electron.ipcRenderer.on('res:status', (event, args) => {
    const index = state.listrec.findIndex(
      (item) => item.nametag === args.nametag && item.provider === args.provider
    )

    state.listrec[index].status = args.data.status
    state.listrec[index].thumb = args.data.thumb

    if (index !== -1) {
      state.listrec[index] = {
        ...state.listrec[index],
        thumb: args.data.thumb,
        status: args.data.status
      }
    }

    if (
      (state.listrec[index].status == 'private' || state.listrec[index].status == 'offline') &&
      args.data.status == 'online'
    ) {
      window.electron.ipcRenderer.send('rec:recovery', {
        name: n.nametag,
        provider: n.provider
      })
    }

    updateOrderBy()
  })

  setInterval(() => {
    if (state.listrec.length && state.loadconfig && state.recLoading) {
      state.listrec.map((v, i) => {
        setTimeout(() => {
          window.electron.ipcRenderer.send('rec:live:status', {
            nametag: v.nametag,
            type: 'checkRec',
            provider: v.provider,
            status: v.status
          })
          window.electron.ipcRenderer.send('res:status', {
            nametag: v.nametag,
            provider: v.provider
          })
        }, 600 * i)
      })
    }
  }, 1000 * 50)

  setInterval(() => {
    if (state.loadconfig && state.recLoading) {
      state.listrec.map((n) => {
        if (n.status == 'online' && n.statusRec && n.realtime) {
          const index = state.listrec.findIndex(
            (item) => item.nametag === n.nametag && item.provider === n.provider
          )
          state.listrec[index] = {
            ...state.listrec[index],
            timeRec: n.timeRec + 1000,
            timeFormat: timeFormatter(n.timeRec, { largest: 2 })
          }

          listrec.update((n) => (state.listrec = n))
        } else if (n.status == 'online' && n.statusRec && !n.realtime) {
          window.electron.ipcRenderer.send('rec:live:status', {
            nametag: n.nametag,
            type: 'realtimeRec',
            provider: n.provider,
            status: n.status
          })
        }
      })
    }
  }, 1000)

  window.electron.ipcRenderer.on('rec:recovery', (event, args) => {
    const index = state.listrec.findIndex(
      (item) => item.nametag === args.data.nametag && item.provider === args.provider
    )

    args.data.provider = args.provider
    state.listrec[index] = {
      ...state.listrec[index],
      nametag: args.data.nametag,
      status: args.data.status,
      url: args.data.url,
      recUrl: args.data.recUrl,
      statusRec: args.data.statusRec,
      timeRec: args.data.timeRec,
      resolutions: args.data.resolutions,
      thumb: args.data.thumb
    }

    if (args.data.status == 'online' && state.listrec) {
      window.electron.ipcRenderer.send('rec:auto')
    }
    listrec.update((n) => (state.listrec = n))
    updateOrderBy()
  })

  window.electron.ipcRenderer.on('Select:Folder', (event, args) => {
    if (args.ffmpeg) state.requireffmpeg = args.ffmpeg
    if (args.svfolder) state.requirefolder = args.svfolder
  })

  const subscriptions = [
    listrec.subscribe((newreclist) => {
      state.listrec = newreclist
    }),
    localview.subscribe(({ recUrl, nametag }) => {
      state.url = recUrl
      state.nametag = nametag
    })
  ]

  onDestroy(() => {
    subscriptions.forEach((unsub) => unsub())
  })

  initializeApp()
</script>

<main>
  <div class="config-section">
    <input type="text" value={state.requirefolder} class="global_input" />
    <button
      class="global_input_button"
      on:click={() => window.electron.ipcRenderer.send('Select:Folder', { type: 'folder' })}
    >
      save folder
    </button>

    <input type="text" value={state.requireffmpeg} class="global_input" />
    <button
      class="global_input_button"
      on:click={() => window.electron.ipcRenderer.send('Select:Folder', { type: 'file' })}
    >
      ffmpeg select
    </button>
  </div>

  <form on:submit|preventDefault={handleFormSubmit} on:change={handleFormChange} class="main-form">
    <select name="suplist">
      <option value="chaturbate" selected>chaturbate</option>
      <option value="stripchat">stripchat</option>
      <option value="camsoda">camsoda</option>
      <option value="cam4">cam4</option>
      <option value="bongacams">bongacams</option>
      <option value="dreamcam">dreamcam</option>
    </select>
    <input type="text" placeholder="nametag" />
    <button type="submit"><PlusIcon color={'#8b8b8b'} size={20} /></button>
    <select name="suplist" bind:value={state.dateformat}>
      <option value="model-site-dd-MM-yyyy_hh-mm-ss" selected>model-site-dd-MM-yyyy_hh-mm-ss</option
      >
      <option value="model-site-yyyyMMdd-hhmmss">model-site-yyyyMMdd-hhmmss</option>
      <option value="model-yyyyMMdd-hhmmss">model-yyyyMMdd-hhmmss</option>
    </select>

    <label for="label_check_orderby" class="label_checkbox">
      <input
        type="checkbox"
        id="label_check_orderby"
        on:click={updateOrderBy}
        checked={state.orderbystatus}
      />

      <div class="check_orderby">Order By Status</div>
    </label>
    <label class="autorec">
      <input type="checkbox" name="autorec" checked={state.autorec} />
      <span>Auto Rec</span>
    </label>
  </form>

  <div class="warp justify-content-bet">
    <div class="warp warp-column scroll">
      <div class={!state.loadconfig ? 'spinner' : ''}></div>
      {#each state.listrec as item}
        {#if item.nametag}
          <ItemCam
            nametag={item.nametag}
            statusRec={item.statusRec}
            thumb={item.thumb}
            provider={item.provider}
            status={item.status}
            resolutions={item.resolutions}
            timeRec={item.timeFormat}
          />
        {/if}
      {/each}
    </div>
    <div class="mini-player">
      <span>{state.nametag ? state.nametag : 'Loading'}</span>
      <media-player
        liveEdgeTolerance={0}
        volume={0.2}
        src={state.url ? state.url : ''}
        crossOrigin={true}
        streamType={'live'}
      >
        <media-provider></media-provider>
        <media-plyr-layout></media-plyr-layout>
      </media-player>
    </div>
  </div>
</main>
