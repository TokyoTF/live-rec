import WarpClass from '../lib/tools.class.js'

const tool = new WarpClass()

/**
 * @param {string} nametag
 */

async function RequestApi(nametag) {
  const Api = await fetch('https://www.camsoda.com/api/v1/chat/react/' + nametag, {
    method: 'GET',
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
    }
  })
  return await Api.json()
}

export async function Camsoda(nametag) {
  let resolutions = '',
    Getresolutions = '',
    status = '',
    RawM3u8

  const Response = await RequestApi(nametag)

  status =
    Response.stream.stream_name && Response.stream.edge_servers.length
      ? 'online'
      : Response.stream.stream_name &&
          Response.stream.private_servers &&
          Response.stream.private_servers.length
        ? 'private'
        : Response.stream.message == 'No broadcaster found'
          ? 'Not Exist'
          : 'offline'

  RawM3u8 =
    Response.stream.stream_name && Response.stream.edge_servers.length
      ? `https://${Response.stream.edge_servers[0]}/${Response.stream.stream_name}_v1/index.m3u8?token=${Response.stream.token}`
      : ''

  if (status == 'online' && RawM3u8) {
    Getresolutions = await fetch(RawM3u8, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
      }
    })
    if (Getresolutions.status == 200) {
      let formatUrl = RawM3u8.slice(0, RawM3u8.indexOf('index.m3u8'))

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
        ? Response.user.profilePictureUrl
        : Response.user.offlinePictureUrl
  }
}

export async function CamsodaUpdate(nametag) {
  const res = await RequestApi(nametag)

  const status =
    res.stream.stream_name && res.stream.edge_servers.length
      ? 'online'
      : res.stream.stream_name && res.stream.private_servers && res.stream.private_servers.length
        ? 'private'
        : res.stream.message == 'No broadcaster found'
          ? 'Not Exist'
          : 'offline'

  console.log('check:', nametag + '/' + status)
  return {
    status,
    thumb:
      status == 'online' || status == 'private'
        ? res.user.profilePictureUrl
        : res.user.offlinePictureUrl
  }
}
