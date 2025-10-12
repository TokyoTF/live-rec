<script>
  import { listrec, localview } from '../lib/store'
  import { PlayIcon, XIcon } from 'lucide-svelte'

  let {
    status,
    thumb,
    nametag,
    provider,
    statusRec,
    resolutions,
    timeRec
  } = $props();

  const RecAdd = (provider, nametag) => {
  
    let selectedIndex = $listrec.findIndex((n) =>
      n.nametag == nametag && n.provider == provider ? n : null
    )

    if($listrec[selectedIndex].nametag !== $localview.nametag) $localview = {recUrl: $listrec[selectedIndex].url,nametag}
  }
  let localRecUrl = $state('')

  const RecStatus = (type) => {
    let selectedIndex = $listrec.findIndex((n) =>
      n.nametag == nametag && n.provider == provider ? n : null
    )
    if (type == 'stopRec') {
      $listrec[selectedIndex].timeRec = 0
      clearInterval($listrec[selectedIndex].time_function)
      $listrec[selectedIndex].timeFormat = 0
      $listrec[selectedIndex].time_function = null
    }

    window.electron.ipcRenderer.send('rec:live:status', {
      status,
      nametag,
      type,
      provider,
      url: localRecUrl ? localRecUrl : resolutions[0].url
    })
  }

  window.electron.ipcRenderer.on('rec:auto', () => {
    RecStatus('startRec')
  })

  const RemoveRec = (rawnametag, rawprovider) => {
    let newList = []
    newList = $listrec.filter((n) => !(n.nametag == rawnametag && n.provider == rawprovider))
    $listrec = newList
    window.electron.ipcRenderer.send('rec:live:remove', {
      nametag: rawnametag,
      provider: rawprovider
    })
  }
</script>

<div class="itemcam">
  <div class="itemcam-image">
    <div class="itemcam-tags">
      <div class="itemcam-status" currentstatus={status ? status : 'loading'}>
        <span>{status ? status : 'Loading'}</span>
      </div>
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="itemcam-remove" onclick={() => RemoveRec(nametag, provider)}>
        <XIcon size={17} />
      </div>
      {#if status == 'online'}
        <div class="itemcam-play">
          <label for="rec">
            <input type="button" id="rec" class="recPlay" />
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <div onclick={() => RecAdd(provider, nametag)}>
              <PlayIcon size={35} fill={'white'} />
            </div>
          </label>
        </div>
      {/if}
    </div>
    <img src={thumb ? thumb : 'https://www.camsoda.com/assets/img/missing-img.jpg'} alt="" />
  </div>
  <div class="warp warp-column">
    <span class="tag-chatubate">{provider}</span>
    <span class="itemcam-nametag">{nametag}</span>
  </div>
  <div class="warp warp-column itemcam-recording">
    {#if status == 'online' && resolutions}
      <select class="itemcam-resolutions" bind:value={localRecUrl}>
        <option value="" disabled selected
          >default/{resolutions[0].resolution.width + 'x' + resolutions[0].resolution.height}
          {#if resolutions[0].fps}
            {resolutions[0].fps}fps
          {/if}</option
        >
        {#each resolutions as res}
          <option value={res.url}
            >{res.resolution.width + 'x' + res.resolution.height}
            {#if res.fps}{res.fps}fps{/if}</option
          >
        {/each}
      </select>
      {#if status == 'online'}
        <input
          type="button"
          name="rec"
          curretState={!statusRec ? 'startRec' : 'stopRec'}
          onclick={() => RecStatus(!statusRec ? 'startRec' : 'stopRec')}
          value={!statusRec ? 'Start REC' : 'Stop REC'}
        />
        {#if statusRec}
          <p class="update_time">
            Rec Time: {timeRec ? timeRec : '0 s'}
          </p>
        {/if}
      {/if}
    {/if}
  </div>
</div>
