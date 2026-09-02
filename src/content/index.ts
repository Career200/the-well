import type { ContentPack } from "../core/content.js";
import { objects } from "./objects.js";
import { people } from "./people.js";
import { scenes } from "./scenes.js";
import { belowProse, belowSubjects } from "./below.js";
import { coda } from "./coda.js";

export const pack: ContentPack = {
  people,
  objects,
  scenes,
  well: { attention: 0.1, dread: 0 },
  coda,
  below: belowSubjects,
  belowProse,
  ambient: [
    "Nothing happens. The stone sweats. Above, the light moves a hand-width and stops.",
    "A beetle comes down the wall, considers you, and goes back up.",
    "The water shifts on its own, once, and is still.",
    "Far off, a dog barks, and then somebody shouting at it.",
    "You hear rain. It never touches you.",
    "Footsteps on the track, rushed ones. In a second, the sound disappears.",
    "The rope moves in its groove above you. It is only the wind.",
    "The light blinks and goes yellow along one edge. That is the whole of this afternoon.",
    "Something small falls in and does not come up the surface of the water. The only thing today, and not worth watching."
  ],

  readout: {
    beliefs: {
      haunted: "Somebody says a prayer over the water before they draw it.",
      mystery:
        "Somebody drops a stone in and count. They do it three times, and get it different each time.",
      tragedy:
        "There are flowers on the rim for a long time. When they die, new ones appear.",
      danger:
        "You hear fotsteps approach, then nothing, and then they leave. They didn't date get closer."
    },
    attention: [
      "Three people came up to the rim today. One of them drew water.",
      "There is somebody at the rim most of the day now."
    ],
    dread: [
      "The bucket comes down faster than it used to and goes up before it is full.",
      "Two came for water. Neither would work the winch, and they went down to the stream instead."
    ]
  },

  noticing: {
    veiled: "The dark has one more thing in it than it had.",
    plain: "Something down here has come clear enough to look at.",
    named: "You're seeing clearer now."
  },

  hiding: [
    "You pull the coat over yourself. Somebody is at the rim above you and you do not look up.",
    "You stay under the coat until the noise above has stopped."
  ]
};
