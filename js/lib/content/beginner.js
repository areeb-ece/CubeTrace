// The beginner layer-by-layer method in seven steps. White on U for steps 1 and 2; then
// the cube turns over (z2: yellow comes up and green stays in front, the way CFOP holds
// it) for steps 3 to 7. Every algorithm here is written as parts, each with its role
// and a one-line caption; the parts joined are the algorithm.
//   role: setup | undo (the pair share `pair`) | trigger | insert | null
// tests/content.test.js plays every case and checks it reaches its goal and only
// touches what its step may touch.

const p = (moves, role, caption, pair) => ({ moves, role, caption, ...(pair !== undefined ? { pair } : {}) });

export const BEGINNER = {
  id: "beginner",
  name: "Beginner",
  steps: [
    {
      id: "white-cross", name: "White cross", holding: "whiteUp", roles: "white-cross", goal: "white-cross",
      intro: "Put the four white edges round the white centre, each with its other colour matching the centre beside it. No algorithm: these examples show the four places an edge can be.",
      cases: [
        { id: "wc-down", name: "Below its place, white down", parts: [p("F2", null, "A half turn of the front lifts it straight up, white side on top.")] },
        { id: "wc-down-away", name: "In the bottom layer, elsewhere", parts: [p("D", null, "Turn the bottom layer until the edge is under its place; the white layer above doesn't move."), p("F2", null, "Then lift it up with a half turn.")] },
        { id: "wc-middle", name: "In the middle layer", parts: [p("F", null, "One turn of the front carries it up into place.")] },
        { id: "wc-flipped", name: "In place but flipped", parts: [p("U", "setup", "Move the cross aside so the next turns can't knock a solved edge out.", 0), p("L", null, "Take the edge down into the middle layer, flipping it…"), p("U'", "undo", "…bring the cross back…", 0), p("F", null, "…and lift the edge up the right way round.")] },
      ],
    },
    {
      id: "white-corners", name: "White corners", holding: "whiteUp", roles: "white-corners", goal: "white-corners",
      intro: "Bring a white corner below its slot (under the up-front-right corner), then repeat R' D' R D until it is in, white on top. The bottom layer isn't solved yet, so it doesn't matter what the repeats do to it.",
      cases: [
        { id: "wco-right", name: "White facing right", parts: [p("R' D' R D", "trigger", "Once: the slot opens, the corner rises into it and turns a third of a turn.")] },
        { id: "wco-down", name: "White facing down", parts: [p("R' D' R D", "trigger", "Each repeat turns the corner a third of a turn…"), p("R' D' R D", "trigger", "…so white facing down takes three…"), p("R' D' R D", "trigger", "…and the third one puts it in.")] },
        { id: "wco-front", name: "White facing front", parts: [p("R' D' R D", "trigger", "Five repeats: white comes round the corner one third at a time."), p("R' D' R D", "trigger", ""), p("R' D' R D", "trigger", ""), p("R' D' R D", "trigger", ""), p("R' D' R D", "trigger", "The fifth sets it in place.")] },
      ],
      also: "The same four moves finish the cube in step 7, twisting the last corners.",
    },
    {
      id: "second-layer", name: "Second layer", holding: "yellowUp", turnOver: "z2", roles: "second-layer", goal: "second-layer",
      intro: "Turn the cube over: yellow up, green still in front. Find a top edge with no yellow, line its front colour up with its centre, then send it right or left.",
      cases: [
        { id: "sl-right", name: "Edge goes right", mirror: "sl-left", parts: [p("U R U' R'", "insert", "Take the edge away and lift the right slot's corner up beside it…"), p("U' F' U F", "insert", "…then bring the corner back down, carrying the edge into the slot.")] },
        { id: "sl-left", name: "Edge goes left", mirror: "sl-right", parts: [p("U' L' U L", "insert", "The mirror image: lift the left slot's corner…"), p("U F U' F'", "insert", "…and bring it back down with the edge.")] },
      ],
    },
    {
      id: "yellow-cross", name: "Yellow cross", holding: "yellowUp", roles: "yellow-cross", goal: "yellow-cross",
      intro: "Only whether yellow faces up matters now. One algorithm, F R U R' U' F', turns a line into the cross and an L into a line.",
      cases: [
        { id: "yc-line", name: "Line, held left to right", goal: "yellow-cross", parts: [p("F", "setup", "Tip the front face so the line's ends join the turning layer…", 0), p("R U R' U'", "trigger", "…flip two edges with the sexy move…"), p("F'", "undo", "…and tip it back.", 0)] },
        { id: "yc-l", name: "L, held at the back and left", goal: "yellow-cross", parts: [p("F R U R' U' F'", "trigger", "Once turns the L into a line, held left to right…"), p("F R U R' U' F'", "trigger", "…so once more finishes the cross.")] },
        { id: "yc-dot", name: "Dot", goal: "yellow-two", from: "F R U R' U' F' f R U R' U' f'", parts: [p("F R U R' U' F'", "trigger", "From a dot, once gives an L or a line; carry on from that case.")] },
      ],
      also: "This is also the first look of 2-look OLL in CFOP.",
    },
    {
      id: "yellow-edges", name: "Yellow edges", holding: "yellowUp", roles: "yellow-edges", goal: "yellow-edges",
      intro: "Turn U until two adjacent edges match their centres. Hold those at the back and right; the algorithm swaps the front and left edges.",
      cases: [
        { id: "ye-swap", name: "Front and left swapped", parts: [p("R U R' U R U2 R'", "trigger", "Sune moves the top layer's edges round while every lower piece comes back…"), p("U", null, "…and one U turn lines the four edges up.")] },
      ],
    },
    {
      id: "yellow-corners", name: "Place yellow corners", holding: "yellowUp", roles: "yellow-corners", goal: "corners-placed",
      intro: "Find a corner in its right place, twisted or not, and hold it at up-front-right. The algorithm cycles the other three; repeat if they need another turn.",
      cases: [
        { id: "ycp-cycle", name: "Three corners to cycle", parts: [p("U R U' L'", null, "Swap pieces round the top while the left and right sides are borrowed…"), p("U R' U' L", null, "…and undo the borrowing: three corners have moved one step.")] },
      ],
    },
    {
      id: "yellow-twist", name: "Twist yellow corners", holding: "yellowUp", roles: "yellow-corners", goal: "solved",
      intro: "Hold a twisted corner at up-front-right and repeat R' D' R D until yellow is up: two or four times. Then turn only U to bring the next twisted corner to the same place. Never turn the whole cube: the lower two layers look broken until the last corner is done.",
      cases: [
        { id: "yt-right", name: "Yellow facing right", goal: "corner-ufr", from: "(R' D' R D)2 U (R' D' R D)4 U'", parts: [p("R' D' R D", "trigger", "Each repeat twists the corner a third of a turn and borrows pieces from the lower layers…"), p("R' D' R D", "trigger", "…two repeats here; the lower layers are paid back when the last corner is done.")] },
        { id: "yt-front", name: "Yellow facing front", goal: "corner-ufr", from: "(R' D' R D)4 U (R' D' R D)2 U'", parts: [p("R' D' R D", "trigger", "Four repeats: the corner needs two thirds of a turn the other way."), p("R' D' R D", "trigger", ""), p("R' D' R D", "trigger", ""), p("R' D' R D", "trigger", "Yellow is up; now only U.")] },
        { id: "yt-two", name: "Two corners twisted", parts: [p("(R' D' R D)2", "trigger", "The first corner: two repeats. The lower layers are now out of place…"), p("U", null, "…bring the second corner to the same spot with U alone…"), p("(R' D' R D)4", "trigger", "…four repeats twist it the other way and give the lower layers back…"), p("U'", null, "…and U' lines the top up.")] },
      ],
      also: "The same four moves as step 2: there they put a corner in, here they only twist one.",
    },
  ],
};
