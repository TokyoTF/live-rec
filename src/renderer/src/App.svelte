<script>
  import { listrec, listinfo } from './lib/store'
  import ItemCam from './components/itemCam.svelte'
  import { onDestroy } from 'svelte'
  const SPANISH = {
    'Current time': '',
    'Disable captions': '',
    'Enable captions': '',
    'Enter Fullscreen': 'Pantalla completa',
    'Enter PiP': 'PiP',
    'Exit Fullscreen': 'Salir de pantalla completa',
    'Exit PiP': '',
    'Go back to previous menu': '',
    Ad: '',
    AirPlay: '',
    All: 'Todo',
    Audio: 'Audio',
    Auto: 'Automatico',
    Buffered: '',
    Captions: '',
    Default: '',
    Disabled: 'Desactivar',
    Download: '',
    Duration: 'Duracion',
    Enabled: 'Activar',
    End: '',
    Forward: '',
    LIVE: 'En Vivo',
    Loop: 'Bucle',
    Mute: 'Silenciar',
    Normal: 'Normal',
    Pause: 'Pausar',
    Play: 'Reproducir',
    Played: 'Reproduciendo',
    Quality: 'Calidad',
    Reset: '',
    Restart: '',
    Rewind: '',
    Seek: '',
    Settings: 'Configuracion',
    Speed: 'Velocidad',
    Start: '',
    Unmute: 'Desilenciar',
    Volume: 'Volumen'
  }
  let localurl = ''
  let localnametag = ''
  let locallistrec = []
  let locallistinfo = {}
  let localrequireffmpeg = ''
  let localrequirefolder = ''

  import 'vidstack/player/styles/base.css'
  import 'vidstack/player/styles/plyr/theme.css'

  import 'vidstack/player'
  import 'vidstack/player/layouts/plyr'
  import 'vidstack/player/ui'

  const RecAdd = (provider, nametag) => {
    window.electron.ipcRenderer.send('rec:add', { name: nametag, provider: provider })
  }

  const changePost = (input) => {
    let selProvider = input.target[0].options[input.target[0].selectedIndex].value
    let NameTag = input.target[1].value
    //dvr = selProvider.includes('dreamcam') ? true : false
    if (!locallistinfo[NameTag]) {
      locallistrec.push({ nametag: NameTag, provider: selProvider })
      listrec.update((n) => (locallistrec = n))
      RecAdd(selProvider, NameTag)
    }
  }

  window.electron.ipcRenderer.on('rec:add', (event, args) => {
    if (!locallistinfo[args.nametag]) {
      localurl = args.url
      localnametag = args.nametag
      locallistinfo[args.nametag] = args
      listrec.update((n) => (locallistrec = n))
      listinfo.update((n) => (locallistinfo = n))
    } else if (locallistinfo[args.nametag]) {
      localurl = args.url
      localnametag = args.nametag
    }
  })

  window.electron.ipcRenderer.on('Select:Folder', (event, args) => {
    if(args.ffmpeg){
      localrequireffmpeg = args.ffmpeg
    }else if(args.svfolder){
      localrequirefolder = args.svfolder
    }
  })

  window.electron.ipcRenderer.on('rec:live', (event, args) => {
    locallistinfo[args.nametag] = args
    listinfo.update((n) => (locallistinfo = n))
  })

  window.electron.ipcRenderer.on('rec:live:status', (event, args) => {
    locallistinfo[args.nametag].statusRec = args.status
  })

  setInterval(() => {
    if (locallistrec.length) {
      locallistrec.map((v) => {
        window.electron.ipcRenderer.send('rec:live:status', {
          nametag: v.nametag,
          type: 'checkRec',
          status: locallistinfo[v.nametag].status
        })
        window.electron.ipcRenderer.send('res:status', { nametag: v.nametag, provider: v.provider })
      })
    }
  }, 1000 * 25)

  window.electron.ipcRenderer.on('res:status', (event, args) => {
    locallistinfo[args.nametag].status = args.data.status
    locallistinfo[args.nametag].thumb = args.data.thumb
    listinfo.update((n) => (locallistinfo = n))
  })

  const unsubinfo = listinfo.subscribe((v) => {
    locallistinfo = v
    console.log('Update list')
  })

  const unsub = listrec.subscribe((v) => {
    locallistrec = v
    console.log('Update list')
  })

  const SelectSaveFolder = () =>
    window.electron.ipcRenderer.send('Select:Folder', { type: 'folder' })
  const Selectffmpeg = () => window.electron.ipcRenderer.send('Select:Folder', { type: 'file' })

  onDestroy(unsubinfo)
  onDestroy(unsub)
</script>

<main>
  <input type="text" value={localrequirefolder} />

  <input type="button" on:click={SelectSaveFolder} value="save folder" />
  <input type="text" value={localrequireffmpeg} />
  <input type="button" on:click={Selectffmpeg} value="ffmpeg select" />
  <form on:submit|preventDefault={changePost}>
    <select>
      <option value="chaturbate" selected>chaturbate</option>
      <option value="camsoda">camsoda</option>
      <option value="bongacams">bongacams</option>
      <option value="dreamcam">dreamcam</option>
    </select>
    <input type="text" placeholder="nametag" />
    <button type="submit">Add</button>
  </form>
  <div class="warp justify-content-bet">
    <div class="warp warp-flex">
      {#each locallistrec as item}
        {#if locallistinfo[item.nametag]}
          <ItemCam
            nametag={item.nametag}
            recUrl={locallistinfo[item.nametag].recUrl}
            statusRec={locallistinfo[item.nametag].statusRec}
            thumb={locallistinfo[item.nametag].thumb}
            provider={item.provider}
            status={locallistinfo[item.nametag].status}
            resolutions={locallistinfo[item.nametag].resolutions}
          />
        {/if}
      {/each}
    </div>
    <div class="mini-player">
      {localnametag}
      <media-player volume={0.2} src={localurl} crossOrigin={true} streamType={'live'}>
        <media-provider></media-provider>
        <media-plyr-layout translations={SPANISH}></media-plyr-layout>
      </media-player>
    </div>
  </div>
</main>
