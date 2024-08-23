//{url: "stream/hello", version: "0.0.1"}
//{quality: "test", url: "stream/play", version: "0.0.1"}

/**
 * @param {string | Blob} nametag
 */

async function RequestApi(nametag) {
  const Api = await fetch(
    'https://bss.dreamcamtrue.com/api/clients/v1/broadcasts/models/' +
      nametag +
      '?show-hidden=true&stream-types=video2D,video3D&partnerId=dreamcam_oauth2',
    {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
      }
    }
  )
  return await Api.json()
}

export async function Dreamcam(nametag) {
  let resolutions = ''

  const Response = await RequestApi(nametag)

  const RawM3u8 = Response.streams[1]

  const status =
    Response.broadcastStatus == 'public'
      ? 'online'
      : Response.broadcastStatus == 'private'
        ? 'private'
        : Response.message == 'Not Found'
          ? 'not exists'
          : 'offline'

  if (status == 'online') {
    resolutions = [
      {
        resolution: { width: RawM3u8.resolutionInfo.width, height: RawM3u8.resolutionInfo.height },
        url: RawM3u8.url,
        fps: 30
      }
    ]
  }

  return {
    nametag,
    status,
    url: RawM3u8.url,
    recUrl: RawM3u8.url,
    statusRec: false,
    resolutions,
    thumb:
      status == 'online' || status == 'private'
        ? Response.thumbnailsUrl.preview2D
        : Response.modelProfilePhotoUrl
  }
}

export async function DreamcamUpdate(nametag) {
  const res = await RequestApi(nametag)

  const status =
    res.broadcastStatus == 'public'
      ? 'online'
      : res.broadcastStatus == 'private'
        ? 'private'
        : res.message == 'Not Found'
          ? 'not exists'
          : 'offline'

  console.log('check:', nametag + '/' + status)
  return {
    status,
    thumb:
      status == 'online' || status == 'private'
        ? res.thumbnailsUrl.preview2D
        : res.modelProfilePhotoUrl
  }
}
