import { Bongacams, BongacamsUpdate } from '../sites/bongacams.js'
import { Camsoda, CamsodaUpdate } from '../sites/camsoda.js'
import { Chaturbate, ChaturbateUpdate } from '../sites/chaturbate.js'
import { Dreamcam, DreamcamUpdate } from '../sites/dreamcam.js'
import { Cam4, Cam4Update } from '../sites/cam4.js'
import { Stripchat, StripchatUpdate } from '../sites/stripchat.js'

export const ListSites = {
  chaturbate: {
    extract: Chaturbate,
    update: ChaturbateUpdate
  },
  camsoda: {
    extract: Camsoda,
    update: CamsodaUpdate
  },
  cam4: {
    extract: Cam4,
    update: Cam4Update
  },
  bongacams: {
    extract: Bongacams,
    update: BongacamsUpdate
  },
  stripchat: {
    extract: Stripchat,
    update: StripchatUpdate
  },
  dreamcam: {
    extract: Dreamcam,
    update: DreamcamUpdate
  }
}
