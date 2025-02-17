import WarpClass from '../lib/tools.class'

const tool = new WarpClass()

/**
 * @param {string | Blob} nametag
 */

async function RequestApi(nametag) {
  let body = new FormData()
  body.append('args[]', nametag)
  body.append('method', 'getRoomData')

  const Api = await fetch('https://bongacams.net/tools/amf.php', {
    method: 'POST',
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
    },
    body: body
  })
  return await Api.json()
}

export async function Bongacams(nametag) {
  let resolutions = '',
    Getresolutions = '',
    status,
    RawM3u8

  const Response = await RequestApi(nametag)

  status =
    Response.localData.videoServerUrl &&
    Response.performerData.showType == 'public' &&
    !Response.performerData.isAway &&
    Response.performerData.isOnline
      ? 'online'
      : (Response.localData.videoServerUrl &&
            Response.performerData.showType == 'private' &&
            Response.performerData.isOnline) ||
          (Response.localData.videoServerUrl &&
            Response.performerData.isAway &&
            Response.performerData.isOnline)
        ? 'private'
        : Response.status == 'error'
          ? 'user not exist'
          : 'offline'

  RawM3u8 =
    'https:' +
    Response.localData.videoServerUrl +
    '/hls/stream_' +
    Response.performerData.username +
    '/playlist.m3u8'

  if (status == 'online') {
    Getresolutions = await fetch(RawM3u8, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
      }
    })

    resolutions = tool.resolutions({
      active: true,
      data: await Getresolutions.text(),
      prefixUrl: RawM3u8.replace('playlist.m3u8', '')
    })
  }
  return {
    nametag,
    status,
    url: RawM3u8,
    recUrl: RawM3u8,
    statusRec: false,
    timeRec:0,
    resolutions,
    thumb:
      status == 'online' || status == 'private'
        ? `https://mobile-edge${Response.localData.vsid}.bcvcdn.com/stream_${Response.performerData.username}.jpg`
        : ''
  }
}

export async function BongacamsUpdate(nametag) {
  const res = await RequestApi(nametag)

  const status =
    res.localData.videoServerUrl &&
    res.performerData.showType == 'public' &&
    !res.performerData.isAway &&
    res.performerData.isOnline
      ? 'online'
      : (res.localData.videoServerUrl &&
            res.performerData.showType == 'private' &&
            res.performerData.isOnline) ||
          (res.localData.videoServerUrl && res.performerData.isAway && res.performerData.isOnline)
        ? 'private'
        : res.status == 'error'
          ? 'user not exist'
          : 'offline'

  console.log('check:', nametag + '/' + status)
  return {
    status,
    thumb:
      status == 'online' || status == 'private'
        ? `https://mobile-edge${res.localData.vsid}.bcvcdn.com/stream_${res.performerData.username}.jpg`
        : ''
  }
}
