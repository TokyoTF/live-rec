<script>
  import { PlayIcon } from 'lucide-svelte'
  export let status, thumb, nametag, provider, statusRec, recUrl, resolutions
  const RecAdd = (providerDirect, nametagDirect) => {
    window.electron.ipcRenderer.send('rec:add', { name: nametagDirect, provider: providerDirect })
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
</script>

<div class="itemcam">
  <div class="itemcam-image">
    <div class="itemcam-tags">
      <div class="itemcam-status" currentstatus={status}>
        <span>{status}</span>
      </div>

      <div class="itemcam-play">
        <label for="rec">
          <input type="button" id="rec" class="recPlay" />
          <!-- svelte-ignore a11y-no-static-element-interactions -->
          <!-- svelte-ignore a11y-click-events-have-key-events -->
          <div on:click={() => RecAdd(provider, nametag)}><PlayIcon size={30} /></div>
        </label>
      </div>
    </div>
    <img src={thumb ? thumb : 'https://www.camsoda.com/assets/img/missing-img.jpg'} alt="" />
  </div>
  <div class="warp warp-column">
    <span class="tag-chatubate">{provider}</span>
    <span class="itemcam-nametag">{nametag}</span>
  </div>
  <div class="warp warp-column itemcam-recording">
    {#if status == 'online'}
      <select class="itemcam-resolutions" bind:value={localRecUrl}>
        <option value="" disabled selected
          >default/{resolutions[0].resolution.width + 'x' + resolutions[0].resolution.height}
          {resolutions[0].fps}fps</option
        >
        {#each resolutions as res}
          <option value={res.url}
            >{res.resolution.width + 'x' + res.resolution.height} {res.fps}fps</option
          >
        {/each}
      </select>
      {#if status == 'online'}
        <input
          type="button"
          name="rec"
          on:click={() => RecStatus(!statusRec ? 'startRec' : 'stopRec')}
          value={!statusRec ? 'Start REC' : 'Stop REC'}
        />
      {/if}
    {/if}
  </div>
</div>
