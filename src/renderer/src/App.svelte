<script>
  import { listrec, localview, localname } from './lib/store'
  import { PlusIcon } from 'lucide-svelte'
  import ItemCam from './components/itemCam.svelte'
  import { onDestroy } from 'svelte'
  import time from 'humanize-duration'

  import 'vidstack/player/styles/base.css'
  import 'vidstack/player/styles/plyr/theme.css'

  import 'vidstack/player'
  import 'vidstack/player/layouts/plyr'
  import 'vidstack/player/ui'

  let localurl = ''
  let localnametag = ''
  let locallistrec = []
  let localrequireffmpeg = ''
  let localrequirefolder = ''
  let localdateformat = 'model-site-dd-MM-yyyy_hh-mm-ss'
  let loadconfig = false
  let localorderbystatus = false
  let localautorec = true
  let time_set = time.humanizer({
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

  window.electron.ipcRenderer.send('Load:config')

  const RecAdd = (provider, nametag) => {
    window.electron.ipcRenderer.send('rec:add', {
      name: nametag,
      provider: provider
    })
  }

  window.electron.ipcRenderer.on('Load:config', (event, args) => {
    localrequireffmpeg = args.ffmpegselect
    localrequirefolder = args.savefolder
    localdateformat = args.dateformat
    localorderbystatus = args.orderby == 'status' ? true : false
    localautorec = args.autorec
    if (!args.reclist.length) {
      loadconfig = true
    } else {
      setTimeout(() => {
        args.reclist.map((n, i) => {
          setTimeout(() => {
            if (i + 1 !== args.reclist.length) {
              locallistrec.push({ nametag: n.nametag, provider: n.provider })
              window.electron.ipcRenderer.send('rec:add', {
                name: n.nametag,
                provider: n.provider
              })
            } else if (i + 1 == args.reclist.length) {
              locallistrec.push({ nametag: n.nametag, provider: n.provider })
              loadconfig = true
              window.electron.ipcRenderer.send('rec:add', {
                name: n.nametag,
                provider: n.provider
              })
            }
          }, 600 * i)
        })
      }, 1100)
    }
  })

  const changePost = (input) => {
    let selProvider = input.target[0].options[input.target[0].selectedIndex].value
    let NameTag = String(input.target[1].value)
    let selectedIndex = locallistrec.findIndex((n) =>
      n.nametag == NameTag && n.provider == selProvider ? n : null
    )
    //dvr = selProvider.includes('dreamcam') ? true : false

    if (!locallistrec[selectedIndex] && NameTag && selProvider) {
      locallistrec.push({ nametag: NameTag, provider: selProvider })
      listrec.update((n) => (locallistrec = n))
      window.electron.ipcRenderer.send('Modify:config', {
        name: 'reclist',
        value: { nametag: NameTag, provider: selProvider }
      })
      RecAdd(selProvider, NameTag)
    }
  }

  const changeStatusBy = (event) => {
    console.log('change order by', localorderbystatus)
    if (event) {
      localorderbystatus = !localorderbystatus
      setTimeout(() => (event.target.checked = localorderbystatus), 0)
    }

    $listrec = localorderbystatus
      ? locallistrec.sort(
          (a, b) =>
            'onlineprivateofflinenotexist'.indexOf(String(a.status)) -
            'onlineprivateofflinenotexist'.indexOf(String(b.status))
        )
      : locallistrec.sort(
          (a, b) =>
            'onlineprivateofflinenotexist'.indexOf(String(b.status)) -
            'onlineprivateofflinenotexist'.indexOf(String(a.status))
        )
  }

  window.electron.ipcRenderer.on('rec:add', (event, args) => {
    let selectedIndex = locallistrec.findIndex((n) =>
      n.nametag == args.data.nametag && n.provider == args.provider ? n : null
    )

    $listrec = locallistrec

    if (!locallistrec[selectedIndex].url && !locallistrec[selectedIndex].recUrl) {
      args.data.provider = args.provider
      locallistrec[selectedIndex] = args.data
      localorderbystatus ? changeStatusBy() : ''

      if (args.data.url && args.data.recUrl && args.data.status == 'online' && localautorec) {
        window.electron.ipcRenderer.send('rec:auto')
      }
    }

    setTimeout(() => {
      if (locallistrec[selectedIndex].url && loadconfig && args.data.status == 'online') {
        $localview = args.data.url
        $localname = args.data.nametag
      }
    }, 1100)
  })

  window.electron.ipcRenderer.on('Select:Folder', (event, args) => {
    if (args.ffmpeg) localrequireffmpeg = args.ffmpeg
    if (args.svfolder) localrequirefolder = args.svfolder
  })

  window.electron.ipcRenderer.on('rec:live:status', (event, args) => {
    let selectedIndex = locallistrec.findIndex((n) =>
      n.nametag == args.nametag && n.provider == args.provider ? n : null
    )

    locallistrec[selectedIndex].statusRec = args.status
    locallistrec[selectedIndex].realtime = args.realtime
  })

  setInterval(() => {
    if (locallistrec.length && loadconfig) {
      locallistrec.map((v, i) => {
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
    if (loadconfig) {
      locallistrec.map((n) => {
        if (n.status == 'online' && n.statusRec && n.realtime) {
          n.timeRec = n.timeRec + 1000
          n.timeFormat = time_set(n.timeRec - 1000, {
            units: ['h', 'm', 's'],
            serialComma: false
          })
        } else if (n.status == 'online' && n.statusRec && !n.realtime) {
          window.electron.ipcRenderer.send('rec:live:status', {
            nametag: n.nametag,
            type: 'realtimeRec',
            provider: n.provider,
            status: n.status
          })
        }
      })
      $listrec = locallistrec
    }
  }, 1000)

  window.electron.ipcRenderer.on('res:status', (event, args) => {
    let selectedIndex = locallistrec.findIndex((n) =>
      n.nametag == args.nametag && n.provider == args.provider ? n : null
    )
    locallistrec[selectedIndex].status = args.data.status
    locallistrec[selectedIndex].thumb = args.data.thumb

    if (
      (locallistrec[selectedIndex].status == 'private' ||
        locallistrec[selectedIndex].status == 'offline') &&
      args.data.status == 'online'
    ) {
      window.electron.ipcRenderer.send('rec:recovery', {
        name: n.nametag,
        provider: n.provider
      })
    }
    localorderbystatus ? changeStatusBy() : ''
  })

  window.electron.ipcRenderer.on('rec:recovery', (event, args) => {
    let selectedIndex = locallistrec.findIndex((n) =>
      n.nametag == args.data.nametag && n.provider == args.provider ? n : null
    )
    args.data.provider = args.provider
    locallistrec[selectedIndex] = args.data
    if (args.data.status == 'online' && localautorec) {
      window.electron.ipcRenderer.send('rec:auto')
    }
    $listrec = locallistrec
  })

  const unsub = listrec.subscribe((v) => {
    locallistrec = v
    console.log('Update:list')
  })

  const unsublocalview = localview.subscribe((v) => {
    localurl = v
    console.log('Update:view')
  })
  const unsublocalnametag = localname.subscribe((v) => {
    localnametag = v
    console.log('Update:nametag')
  })

  const SelectSaveFolder = () =>
    window.electron.ipcRenderer.send('Select:Folder', { type: 'folder' })
  const Selectffmpeg = () => window.electron.ipcRenderer.send('Select:Folder', { type: 'file' })

  const updatedate = () => {
    window.electron.ipcRenderer.send('Modify:config', {
      name: 'dateformat',
      value: localdateformat
    })
  }

  const updateAutoRec = (event) => {
    console.log('AutoRec:', localautorec)
    if (event) {
      localautorec = !localautorec
      setTimeout(() => (event.target.checked = localautorec), 0)
    }
    window.electron.ipcRenderer.send('Modify:config', {
      name: 'autorec',
      value: localautorec
    })
  }

  onDestroy(unsub)
  onDestroy(unsublocalnametag)
  onDestroy(unsublocalview)
</script>

<main>
  <input type="text" value={localrequirefolder} class="global_input" />
  <button class="global_input_button" on:click={SelectSaveFolder}>save folder</button>
  <input type="text" value={localrequireffmpeg} class="global_input" />
  <button class="global_input_button" on:click={Selectffmpeg}>ffmpeg select</button>

  <form on:submit|preventDefault={changePost} class="main-form">
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
    <select name="suplist" bind:value={localdateformat} on:change={updatedate}>
      <option value="model-site-dd-MM-yyyy_hh-mm-ss" selected>model-site-dd-MM-yyyy_hh-mm-ss</option
      >
      <option value="model-site-yyyyMMdd-hhmmss">model-site-yyyyMMdd-hhmmss</option>
      <option value="model-yyyyMMdd-hhmmss">model-yyyyMMdd-hhmmss</option>
    </select>

    <label for="label_check_orderby" class="label_checkbox">
      <input
        type="checkbox"
        id="label_check_orderby"
        on:click|preventDefault={changeStatusBy}
        checked={localorderbystatus}
      />

      <div class="check_orderby">Order By Status</div>
    </label>
    <label class="autorec">
      <input
        type="checkbox"
        name="autorec"
        on:change|preventDefault={updateAutoRec}
        checked={localautorec}
      />
      <span>Auto Rec</span>
    </label>
  </form>

  <div class="warp justify-content-bet">
    <div class="warp warp-column scroll">
      <div class={!loadconfig ? 'spinner' : ''}></div>
      {#each locallistrec as item}
        {#if item.nametag}
          <ItemCam
            nametag={item.nametag}
            recUrl={item.recUrl}
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
      <span>{localnametag}</span>
      <media-player
        liveEdgeTolerance={0}
        volume={0.2}
        src={localurl ? localurl : ''}
        crossOrigin={true}
        streamType={'live'}
      >
        <media-provider></media-provider>
        <media-plyr-layout></media-plyr-layout>
      </media-player>
    </div>
  </div>
</main>
