import { Parser } from 'm3u8-parser'
import ffmpeg from 'fluent-ffmpeg'
import dateFormat from 'date-format'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'path'

let recordings = []

const FolderMain = path.resolve(process.env.USERPROFILE, 'Documents', 'live-rec')

export default class Sites {
  constructor() {}

  FileDate(nametag, provider) {
    const date = dateFormat('dd-MM-yyyy_hh-mm-ss', new Date())

    return `${nametag}-${provider}-${date}`
  }

  recInit(info) {
    const command = new ffmpeg()
    const config = this.loadjson()
    command
      .setFfmpegPath(config.ffmpegselect)
      .addOptions(
        /*'-live_start_index', '0',*/ '-c',
        'copy',
        '-hls_time',
        '1',
        '-hls_list_size',
        '3'
      )

      .output(`${config.savefolder}/${this.FileDate(info.nametag, info.provider)}.mkv`)
      .on('start', function () {
        console.log(`Start rec/${info.nametag}-${info.provider}`)
      })
      .on('error', function (r) {
        console.log('error', r)
      })
      .on('end', function () {
        console.log('Processing finished !')
      })

    console.log(info)

    recordings.push({
      nametag: info.nametag,
      provider: info.provider,
      objectFFmpeg: command,
      recording: false
    })
  }

  rec(nametag, type, url, status, provider) {
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

    if (!recordings[selectedIndex].recording && type == 'startRec' && url && status == 'online') {
      console.log('ffmpeg:', url)
      this.recInit({ provider, nametag })
      recordings[selectedIndex].recording = true
      recordings[selectedIndex].objectFFmpeg.input(url)
      recordings[selectedIndex].objectFFmpeg.run()
    } else if (recordings[selectedIndex].recording && type == 'stopRec') {
      recordings[selectedIndex].recording = false
      recordings[selectedIndex].objectFFmpeg.kill()
    } else if (
      recordings[selectedIndex].recording &&
      type == 'checkRec' &&
      (status == 'offline' || status == 'private')
    ) {
      console.log('ffmpeg:rec', 'offline')
      recordings[selectedIndex].recording = false
      recordings[selectedIndex].objectFFmpeg.kill()
    }
    return recordings[selectedIndex].recording
  }

  removeRec(nametag, provider) {
    let selectedIndex = recordings.findIndex((n) =>
      n.nametag == nametag && n.provider == provider ? n : null
    )
    if (recordings[selectedIndex].recording) {
      recordings[selectedIndex].recording = false
      recordings[selectedIndex].objectFFmpeg.kill()
    }
    recordings = recordings.filter((n) => n.nametag !== nametag && n.provider !== provider)
  }

  /**
   *
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
          url: m3u8.prefixUrl ? m3u8.prefixUrl : '' + el.uri,
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
    } else {
      CurrentConfig[args.raw.name] = args.raw.value
    }

    writeFileSync(FolderMain + '/config.json', JSON.stringify(CurrentConfig, null, ' '))
  }
}
