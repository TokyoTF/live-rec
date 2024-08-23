import WarpClass from '../lib/tools.class.js'

const tool = new WarpClass()
/**
 * @param {string} nametag
 */

async function RequestApi(nametag) {
  const Api = await fetch('https://webchat.cam4.com/requestAccess?roomname=' + nametag, {
    method: 'POST',
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
    }
  })
  return await Api.json()
}

export async function Cam4(nametag) {
  let resolutions = '',
    Getresolutions = '',
    status = ''

  const Response = await RequestApi(nametag)

  status =
    Response.status == 'success'
      ? 'online'
      : Response.privateStream || Response.privateRoom
        ? 'private'
        : Response.status == 'roomOffline'
          ? 'offline'
          : 'not exist'

  const Response_streaminfo = await fetch(
    'https://cam4.com/rest/v1.0/profile/' + nametag + '/streamInfo'
  )

  let Response_streamdata
  let RawM3u8
  if (Response_streaminfo.status == 200) {
    Response_streamdata = await Response_streaminfo.json()
    RawM3u8 = Response_streamdata.cdnURL
  } else if (Response_streaminfo.status == 204) {
    status = 'offline'
  }

  if (status == 'online' && RawM3u8 && Response_streaminfo.status == 200) {
    Getresolutions = await fetch(RawM3u8, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
      }
    })
    if (Getresolutions.status == 200) {
        let formatUrl = RawM3u8.slice(0, RawM3u8.indexOf('playlist.m3u8'))

      resolutions = tool.resolutions({
        active: true,
        data: await Getresolutions.text(),
        prefixUrl: formatUrl
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
        ? 'https://snapshots.xcdnpro.com/thumbnails/' + nametag
        : ''
  }
}

export async function Cam4Update(nametag) {
  const res = await RequestApi(nametag)

  const status =
    res.status == 'success'
      ? 'online'
      : res.privateStream || res.privateRoom
        ? 'private'
        : res.status == 'roomOffline'
          ? 'offline'
          : 'not exist'

  console.log('check:', nametag + '/' + status)
  return {
    status,
    thumb:
      status == 'online' || status == 'private'
        ? 'https://snapshots.xcdnpro.com/thumbnails/' + nametag
        : ''
  }
}
