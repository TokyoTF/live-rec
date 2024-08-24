<script>
  import { listrec } from './lib/store'
  import { PlusIcon } from 'lucide-svelte'
  import ItemCam from './components/itemCam.svelte'
  import { onDestroy } from 'svelte'

  let localurl = ''
  let localnametag = ''
  let locallistrec = []
  let localrequireffmpeg = ''
  let localrequirefolder = ''
  let loadconfig = false

  import 'vidstack/player/styles/base.css'
  import 'vidstack/player/styles/plyr/theme.css'

  import 'vidstack/player'
  import 'vidstack/player/layouts/plyr'
  import 'vidstack/player/ui'

  window.electron.ipcRenderer.send('Load:config')

  const RecAdd = (provider, nametag) => {
    window.electron.ipcRenderer.send('rec:add', { name: nametag, provider: provider })
  }

  window.electron.ipcRenderer.on('Load:config', (event, args) => {
    localrequireffmpeg = args.ffmpegselect
    localrequirefolder = args.savefolder
    
    setTimeout(() => {
      args.reclist.map((n) => {
        locallistrec.push({ nametag: n.nametag, provider: n.provider })
        window.electron.ipcRenderer.send('rec:add', { name: n.nametag, provider: n.provider })
      })
    }, 2000)

    setTimeout(() => {
      loadconfig = true
    }, 3000)

  })

  const changePost = (input) => {
    let selProvider = input.target[0].options[input.target[0].selectedIndex].value
    let NameTag = String(input.target[1].value)
    let selectedIndex = locallistrec.findIndex((n) =>
      n.nametag == NameTag && n.provider == selProvider ? n : null
    )
    //dvr = selProvider.includes('dreamcam') ? true : false

    if (!locallistrec[selectedIndex]) {
      locallistrec.push({ nametag: NameTag, provider: selProvider })
      listrec.update((n) => (locallistrec = n))
      window.electron.ipcRenderer.send('Modify:config', { nametag: NameTag, provider: selProvider })
      RecAdd(selProvider, NameTag)
    }
  }

  window.electron.ipcRenderer.on('rec:add', (event, args) => {
    let selectedIndex = locallistrec.findIndex((n) =>
      n.nametag == args.data.nametag && n.provider == args.provider ? n : null
    )
    console.log("url1",locallistrec[selectedIndex])
    if (!locallistrec[selectedIndex].url && !locallistrec[selectedIndex].recUrl) {
      args.data.provider = args.provider
      locallistrec[selectedIndex] = args.data
      localurl = args.data.url
      localnametag = args.data.nametag
      $listrec = locallistrec
      listrec.update((n) => (locallistrec = n))
    } else if (locallistrec[selectedIndex].url) {
      localurl = args.data.url
      localnametag = args.data.nametag
    }
    console.log(locallistrec[selectedIndex])
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
      locallistrec.map((v) => {
        window.electron.ipcRenderer.send('rec:live:status', {
          nametag: v.nametag,
          type: 'checkRec',
          provider: v.provider,
          status: v.status
        })
        window.electron.ipcRenderer.send('res:status', { nametag: v.nametag, provider: v.provider })
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

  onDestroy(unsub)
</script>

<main>
  <input type="text" value={localrequirefolder} />
  
  <input type="button" on:click={SelectSaveFolder} value="save folder" />
  <input type="text" value={localrequireffmpeg} />
  <input type="button" on:click={Selectffmpeg} value="ffmpeg select" />
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
    <div class="warp warp-column">
      <div class={!loadconfig ? "spinner" : ""}></div>
      {#each locallistrec as item}
        {#if item}
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
      {localnametag}
      <media-player
        liveEdgeTolerance={2}
        volume={0.2}
        src={localurl}
        crossOrigin={true}
        streamType={'live'}
      >
        <media-provider></media-provider>
        <media-plyr-layout></media-plyr-layout>
      </media-player>
    </div>
  </div>
</main>
