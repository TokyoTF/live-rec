import WarpClass from '../lib/tools.class.js'

const tool = new WarpClass()
/**
 * @param {string} nametag
 */

async function RequestApi(nametag) {
  const Api = await fetch('https://stripchat.com/api/vr/v2/models/username/' + nametag, {
    method: 'GET',
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
    }
  })
  return await Api.json()
}

export async function Stripchat(nametag) {
  let resolutions = '',
    Getresolutions = '',
    status = ''

  const Response = await RequestApi(nametag)

  status =
    Response.model.status == 'public'
      ? 'online'
      : Response.model.status == 'groupShow' ||
          Response.model.status == 'private' ||
          Response.model.status == 'p2p'
        ? 'private'
        : Response.model.status == 'off' || Response.model.status == 'idle'
          ? 'offline'
          : 'not exist'

  const RawM3u8 = `https://edge-hls.doppiocdn.live/hls/${Response.streamName}/master/${Response.streamName}_auto.m3u8`

  if (status == 'online' && RawM3u8) {
    Getresolutions = await fetch(RawM3u8, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
      }
    })
    if (Getresolutions.status == 200) {
      resolutions = tool.resolutions({
        active: true,
        data: await Getresolutions.text(),
        prefixUrl: { directurl: RawM3u8 }
      })
    } else {
      status = 'offline'
    }
  }
  return {
    nametag,
    status,
    url: RawM3u8,
    recUrl: RawM3u8,
    statusRec: false,
    resolutions,
    thumb:
      status == 'online' || status == 'private'
        ? 'https://img.strpst.com/thumbs/' +
          (new Date().getTime().toString().slice(0, -3) - 40) +
          '/' +
          Response.model.id +
          '_webp'
        : ''
  }
}

export async function StripchatUpdate(nametag) {
  const res = await RequestApi(nametag)

  const status =
    res.model.status == 'public'
      ? 'online'
      : res.model.status == 'groupShow' ||
          res.model.status == 'private' ||
          res.model.status == 'p2p'
        ? 'private'
        : res.model.status == 'off' || res.model.status == 'idle'
          ? 'offline'
          : 'not exist'

  console.log('check:', nametag + '/' + status)
  return {
    status,
    thumb:
      status == 'online' || status == 'private'
        ? 'https://img.strpst.com/thumbs/' +
          (new Date().getTime().toString().slice(0, -3) - 40) +
          '/' +
          res.model.id +
          '_webp'
        : ''
  }
}
