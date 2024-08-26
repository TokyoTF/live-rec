<script>
  import { listrec } from './lib/store'
  import { PlusIcon } from 'lucide-svelte'
  import ItemCam from './components/itemCam.svelte'
  import { onDestroy } from 'svelte'

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
    setTimeout(() => {
      args.reclist.map((n, i) => {
        setTimeout(() => {
          locallistrec.push({ nametag: n.nametag, provider: n.provider })
          window.electron.ipcRenderer.send('rec:add', {
            name: n.nametag,
            provider: n.provider
          })
        }, 250 * i)
      })
    }, 1300)

    setTimeout(() => {
      loadconfig = true
    }, 2300)
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

  window.electron.ipcRenderer.on('rec:add', (event, args) => {
    let selectedIndex = locallistrec.findIndex((n) =>
      n.nametag == args.data.nametag && n.provider == args.provider ? n : null
    )

    if (!locallistrec[selectedIndex].url && !locallistrec[selectedIndex].recUrl) {
      args.data.provider = args.provider
      locallistrec[selectedIndex] = args.data
      
      $listrec = locallistrec //.sort((a,b) => String(b.status).localeCompare(String(a.status)))
    }
    if (locallistrec[selectedIndex].url && loadconfig && args.data.status == "online") {
      localurl = args.data.url
      localnametag = args.data.nametag
    }
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
  })

  setInterval(() => {
    if (locallistrec.length) {
  
      locallistrec.map((v,i) => {
        setTimeout(() => {
        window.electron.ipcRenderer.send('rec:live:status', {
          nametag: v.nametag,
          type: 'checkRec',
          provider: v.provider,
          status: v.status
        })
        window.electron.ipcRenderer.send('res:status', { nametag: v.nametag, provider: v.provider })
      }, 150 * i);
      })

    }
  }, 1000 * 25)

  window.electron.ipcRenderer.on('res:status', (event, args) => {
    let selectedIndex = locallistrec.findIndex((n) =>
      n.nametag == args.nametag && n.provider == args.provider ? n : null
    )
    locallistrec[selectedIndex].status = args.data.status
    locallistrec[selectedIndex].thumb = args.data.thumb
  })

  const unsub = listrec.subscribe((v) => {
    locallistrec = v
    console.log('Update list')
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

  onDestroy(unsub)
</script>

<main>
  <input type="text" value={localrequirefolder} />
  <input type="button" on:click={SelectSaveFolder} value="save folder" />
  <input type="text" value={localrequireffmpeg} />
  <input type="button" on:click={Selectffmpeg} value="ffmpeg select" />
  <select name="suplist" bind:value={localdateformat} on:change={updatedate}>
    <option value="model-site-dd-MM-yyyy_hh-mm-ss" selected>model-site-dd-MM-yyyy_hh-mm-ss</option>
    <option value="model-site-yyyyMMdd-hhmmss">model-site-yyyyMMdd-hhmmss</option>
    <option value="model-yyyyMMdd-hhmmss">model-yyyyMMdd-hhmmss</option>
  </select>

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
