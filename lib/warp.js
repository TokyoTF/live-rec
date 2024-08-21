import { Bongacams, BongacamsUpdate } from '../sites/bongacams.js'
import { Camsoda, CamsodaUpdate } from '../sites/camsoda.js'
import { Chaturbate, ChaturbateUpdate } from '../sites/chaturbate.js'
import { Dreamcam, DreamcamUpdate } from '../sites/dreamcam.js'

export const ListSites = {
  chaturbate: {
    extract: Chaturbate,
    update: ChaturbateUpdate
  },
  camsoda: {
    extract: Camsoda,
    update: CamsodaUpdate
  },
  bongacams: {
    extract: Bongacams,
    update: BongacamsUpdate
  },
  dreamcam: {
    extract: Dreamcam,
    update: DreamcamUpdate
  }
}
