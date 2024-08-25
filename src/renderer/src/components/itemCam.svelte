<script>
  import { listrec } from '../lib/store'
  import { PlayIcon, XIcon } from 'lucide-svelte'

  export let status, thumb, nametag, provider, statusRec, recUrl, resolutions
  const RecAdd = (provider, nametag) => {
    window.electron.ipcRenderer.send('rec:add', { name: nametag, provider: provider })
  }
  let localRecUrl = ''
  const RecStatus = (type) => {
    window.electron.ipcRenderer.send('rec:live:status', {
      status,
      nametag,
      type,
      provider,
      url: localRecUrl ? localRecUrl : recUrl
    })
  }

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
      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div class="itemcam-remove" on:click={() => RemoveRec(nametag, provider)}>
        <XIcon size={18} />
      </div>
      {#if status == 'online'}
        <div class="itemcam-play">
          <label for="rec">
            <input type="button" id="rec" class="recPlay" />
            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <div on:click={() => RecAdd(provider, nametag)}><PlayIcon size={30} /></div>
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
            >{res.resolution.width + 'x' + res.resolution.height} {#if res.fps}{res.fps}fps{/if}</option
          >
        {/each}
      </select>
      {#if status == 'online'}
        <input
          type="button"
          name="rec"
          curretState={!statusRec ? 'startRec' : 'stopRec'}
          on:click={() => RecStatus(!statusRec ? 'startRec' : 'stopRec')}
          value={!statusRec ? 'Start REC' : 'Stop REC'}
        />
      {/if}
    {/if}
  </div>
</div>
