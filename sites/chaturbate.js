import WarpClass from '../lib/tools.class'

const tool = new WarpClass()

/**
 * @param {string | Blob} nametag
 */

async function RequestApi(nametag) {
  let body = new FormData()
  body.append('room_slug', nametag)
  body.append('bandwidth', 'high')
  const Api = await fetch('https://chaturbate.com/get_edge_hls_url_ajax/', {
    method: 'POST',
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
    },
    body
  })
  return await Api.json()
}

export async function Chaturbate(nametag) {
  let resolutions = '',
    Getresolutions = ''

  const Response = await RequestApi(nametag)

  const status =
    Response.room_status == 'public'
      ? 'online'
      : Response.room_status == 'private'
        ? 'private'
        : !Response.success
          ? 'Not Exist'
          : 'offline'

  if (status == 'online') {
    Getresolutions = await fetch(Response.url, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
      }
    })
    resolutions = tool.resolutions({
      active: true,
      data: await Getresolutions.text(),
      prefixUrl: Response.url.replace('playlist.m3u8', '')
    })
  }

  return {
    nametag,
    status,
    url: Response.url,
    recUrl: Response.url,
    statusRec: false,
    resolutions,
    thumb:
      status == 'online' || status == 'private'
        ? `https://thumb.live.mmcdn.com/riw/${nametag}.jpg`
        : 'https://web.static.mmcdn.com/images/logo.svg?hash=e41cf1a9ae04'
  }
}

export async function ChaturbateUpdate(nametag) {
  const res = await RequestApi(nametag)

  const status =
    res.room_status == 'public'
      ? 'online'
      : res.room_status == 'private'
        ? 'private'
        : !res.success
          ? 'Not Exist'
          : 'offline'

  console.log('check:', nametag + '/' + status)
  return {
    status,
    thumb:
      status == 'online' || status == 'private'
        ? `https://thumb.live.mmcdn.com/riw/${nametag}.jpg`
        : 'https://web.static.mmcdn.com/images/logo.svg?hash=e41cf1a9ae04'
  }
}
