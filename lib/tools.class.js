import { Parser } from 'm3u8-parser'
import ffmpeg from 'fluent-ffmpeg'
import dateFormat from 'date-format'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'path'

let recordings = []

const FolderMain = path.resolve(process.env.USERPROFILE, 'Documents', 'live-rec')

export default class Sites {
  constructor() {}

  FileDate(nametag, provider, dateformat) {
    let originalformat = String(dateformat).replace('model-', '').replace('site-', '').trim()
    let model = String(dateformat).includes('model-') ? nametag + '-' : ''
    let site = String(dateformat).includes('site-') ? provider + '-' : ''
    //model-site-dd-MM-yyyy_hh-mm-ss
    //model-site-YYYYMMdd-HHMMss
    //model-YYYYMMdd-HHMMss

    const date = dateFormat(originalformat, new Date())
    return `${model}${site}${date}`
  }

  async recInit(info) {
    const command = new ffmpeg()
    const config = this.loadjson()

    command
      .setFfmpegPath(config.ffmpegselect)
      .addOptions('-c', 'copy', '-reconnect', '1', '-reconnect_delay_max', '0')
      .output(
        `${config.savefolder}/${this.FileDate(info.nametag, info.provider, info.dateformat)}.mkv`
      )
      .on('start', function () {
        console.log(`Start rec/${info.nametag}-${info.provider}`)
      })
      .on('error', function (r) {
        console.log('error', r)
      })
      .on('end', function () {
        console.log('Processing finished !')
      })

    recordings.push({
      nametag: info.nametag,
      provider: info.provider,
      objectFFmpeg: command,
      recording: false
    })
    return await command
  }

  async rec(nametag, type, url, status, provider, dateformat) {
    try {
      let selectedIndex = recordings.findIndex((n) =>
        n.nametag == nametag && n.provider == provider ? n : null
      )

      if (recordings[selectedIndex] && recordings[selectedIndex].recording) {
        console.log(
          'ffmpeg:',
          type + '-' + nametag,
          'recStatus:',
          recordings[selectedIndex].recording,
          'status:',
          status
        )
      }

      if (
        recordings[selectedIndex] &&
        !recordings[selectedIndex].recording &&
        type == 'startRec' &&
        url &&
        status == 'online'
      ) {
        console.log('ffmpeg:', url)
        let command = this.recInit({ provider, nametag, dateformat })
        recordings[selectedIndex].objectFFmpeg = await command
        recordings[selectedIndex].recording = true
        recordings[selectedIndex].objectFFmpeg.input(url)
        setTimeout(() => {
          recordings[selectedIndex].objectFFmpeg.run()
        }, 2000)
      } else if (
        recordings[selectedIndex] &&
        recordings[selectedIndex].recording &&
        type == 'stopRec'
      ) {
        recordings[selectedIndex].recording = false
        recordings[selectedIndex].objectFFmpeg.kill()
      } else if (
        recordings[selectedIndex] &&
        recordings[selectedIndex].recording &&
        type == 'checkRec' &&
        (status == 'offline' || status == 'private')
      ) {
        console.log('ffmpeg:rec', 'offline')
        recordings[selectedIndex].recording = false
        recordings[selectedIndex].objectFFmpeg.kill()
      }
      return recordings[selectedIndex] ? recordings[selectedIndex].recording : false
    } catch (error) {
      console.log('error:', error)
    }
  }

  removeRec(nametag, provider) {
    let selectedIndex = recordings.findIndex((n) =>
      n.nametag == nametag && n.provider == provider ? n : null
    )

    if (recordings[selectedIndex] && recordings[selectedIndex].recording) {
      recordings[selectedIndex].recording = false
      recordings[selectedIndex].objectFFmpeg.kill()
    }
    recordings = recordings.filter((n) => !(n.nametag == nametag && n.provider == provider))
    this.modifyjson({ raw: { name: 'reclistremove', value: { nametag, provider } } })
  }

  /**
   * @param {object} m3u8
   */

  resolutions(m3u8) {
    let object = {}
    object.resolutions = []
    if (m3u8.active) {
      let parser = new Parser()
      parser.push(m3u8.data)
      parser.end()

      let formatParse = parser.manifest.playlists
      for (let index = 0; index < formatParse.length; index++) {
        const el = formatParse[index]
        let format = {
          resolution: el.attributes.RESOLUTION,
          url: !m3u8.prefixUrl.directurl ? m3u8.prefixUrl + el.uri : m3u8.prefixUrl.directurl,
          fps: el.attributes['FRAME-RATE']
            ? el.attributes['FRAME-RATE']
            : el.attributes.NAME
              ? Number(el.attributes.NAME.replace('FPS:', '')).toFixed(0)
              : ''
        }
        object.resolutions.push(format)
        object.resolutions.sort((a, b) => b.resolution.height - a.resolution.height)
      }
    }
    return object.resolutions
  }

  headersDefault(extra) {
    let object = extra ? extra : {}
    object['User-Agent'] =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

    return JSON.stringify(object)
  }

  loadjson() {
    const config = readFileSync(FolderMain + '/config.json', { encoding: 'utf8', flag: 'r' })
    const CurrentConfig = JSON.parse(config)

    return CurrentConfig
  }

  modifyjson(args) {
    const config = readFileSync(FolderMain + '/config.json', { encoding: 'utf8', flag: 'r' })
    const CurrentConfig = JSON.parse(config)

    if (args.raw.name == 'reclist') {
      let selectedIndex = CurrentConfig.reclist.findIndex((n) =>
        n.nametag == args.raw.value.nametag && n.provider == args.raw.value.provider ? n : null
      )
      if (!CurrentConfig.reclist[selectedIndex]) {
        CurrentConfig.reclist.push(args.raw.value)
      }
    } else if (args.raw.name == 'reclistremove') {
      CurrentConfig.reclist = CurrentConfig.reclist.filter(
        (n) => !(n.nametag == args.raw.value.nametag && n.provider == args.raw.value.provider)
      )
    } else {
      CurrentConfig[args.raw.name] = args.raw.value
    }

    writeFileSync(FolderMain + '/config.json', JSON.stringify(CurrentConfig, null, ' '))
  }
}
