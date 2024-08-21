import { Parser } from 'm3u8-parser'
import ffmpeg from 'fluent-ffmpeg'
import dateFormat from 'date-format'

const recordings = []
let savefolder = ''
let ffmpegselect = ''
export default class Sites {
  constructor() {}

  FileDate(nametag, provider) {
    const date = dateFormat('dd-MM-yyyy_hh-mm-ss', new Date())

    return `${nametag}-${provider}-${date}`
  }

  recInit(info) {
    const command = new ffmpeg()
    savefolder = info.savefolder
    ffmpegselect = info.ffmpegselect

    command
      .setFfmpegPath(ffmpegselect)
      .addOptions('-live_start_index', '0', '-c', 'copy', '-hls_time', '1', '-hls_list_size', '3')

      .output(`${savefolder}/${this.FileDate(info.nametag, info.provider)}.mkv`)
      .on('start', function () {
        console.log(`Start rec/${info.nametag}-${info.provider}`)
      })
      .on('error', function (r) {
        console.log('error', r)
      })
      .on('end', function () {
        console.log('Processing finished !')
      })

    recordings[info.nametag] = { objectFFmpeg: command, recording: false }
  }

  rec(nametag, type, url, status, provider) {
    console.log(
      'ffmpeg:',
      type + '-' + nametag,
      'recStatus:',
      recordings[nametag].recording,
      'status:',
      status
    )
    if (!recordings[nametag].recording && type == 'startRec' && url && status == 'online') {
      console.log('ffmpeg:', url)
      this.recInit({ provider, nametag, savefolder, ffmpegselect })
      recordings[nametag].recording = true
      recordings[nametag].objectFFmpeg.input(url)
      recordings[nametag].objectFFmpeg.run()
      console.log(recordings[nametag].objectFFmpeg)
    } else if (recordings[nametag].recording && type == 'stopRec') {
      recordings[nametag].recording = false
      recordings[nametag].objectFFmpeg.kill()
    } else if (
      recordings[nametag].recording &&
      type == 'checkRec' &&
      (status == 'offline' || status == 'private')
    ) {
      console.log('ffmpeg:rec', 'offline')
      recordings[nametag].recording = false
      recordings[nametag].objectFFmpeg.kill()
    }
    return recordings[nametag].recording
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
          url: m3u8.prefixUrl + el.uri,
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
}
