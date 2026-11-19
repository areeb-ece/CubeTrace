// Reads and writes move notation. Never guesses: text it can't read exactly is refused
// with a NotationError that says where, what's wrong and what to type instead.
//
//   faces     U D L R F B          suffixes  '  2  2'   (’ and ′ read as ')
//   wide      Rw … or r u l d f b   slices    M E S      rotations  x y z
//   groups    (R U R' U')3          comments  // to the end of the line
import { move, moveText, BASE } from "./moves.js";

export class NotationError extends Error {
  constructor(at, message) { super(message); this.name = "NotationError"; this.at = at; }
}

const PRIMES = "'’′`";

/**
 * Text → { moves, spans }. moves is the flat list (groups expanded); spans[i] is the
 * [start, end) of the text that wrote moves[i].
 */
export function parse(text) {
  let i = 0;
  const n = text.length;
  const skip = () => {
    for (;;) {
      while (i < n && /\s/.test(text[i])) i++;
      if (text.startsWith("//", i)) { while (i < n && text[i] !== "\n") i++; continue; }
      return;
    }
  };
  function count() {
    const s = i;
    while (i < n && /\d/.test(text[i])) i++;
    return s === i ? 1 : Number(text.slice(s, i));
  }
  function seq(depth) {
    const moves = [], spans = [];
    for (;;) {
      skip();
      if (i >= n) {
        if (depth) throw new NotationError(n, "A bracket ( is never closed: add a ) after the moves it repeats.");
        return { moves, spans };
      }
      const c = text[i], start = i;
      if (c === ")") {
        if (!depth) throw new NotationError(i, "This ) has no ( before it. Remove it, or add the ( where the group starts.");
        return { moves, spans };
      }
      if (c === "(") {
        i++;
        const inner = seq(depth + 1);
        i++; // the )
        if (PRIMES.includes(text[i])) throw new NotationError(i, "A whole group can't be primed here. Write the inverse moves out instead.");
        const times = count();
        if (times < 1 || times > 999) throw new NotationError(start, `A group can repeat 1 to 999 times, not ${times}.`);
        if (!inner.moves.length) throw new NotationError(start, "This group ( ) has no moves in it.");
        for (let k = 0; k < times; k++) { moves.push(...inner.moves); spans.push(...inner.spans); }
        continue;
      }
      if (c === "[" || c === "]") throw new NotationError(i, "Square brackets aren't read here. Write a commutator [A, B] out as A B A' B'.");
      let name = c;
      if (!(name in BASE)) {
        if ("XYZ".includes(c)) throw new NotationError(i, `"${c}": rotations are written in lower case, ${c.toLowerCase()}.`);
        if ("mes".includes(c)) throw new NotationError(i, `"${c}": slices are written in capitals, ${c.toUpperCase()}.`);
        throw new NotationError(i, `"${c}" isn't a move. Faces are U D L R F B, slices M E S, rotations x y z, wide moves Rw or r.`);
      }
      i++;
      let w = false;
      if (text[i] === "w") {
        if (!"UDLRFB".includes(name)) throw new NotationError(start, `"${name}w" isn't a move: only the six faces have wide turns (Rw, or r).`);
        name = name.toLowerCase(); w = true; i++;
      }
      let amount = 1;
      if (text[i] === "2") {
        i++; amount = 2;
        if (PRIMES.includes(text[i])) { i++; amount = -2; }
      } else if (PRIMES.includes(text[i])) {
        i++; amount = -1;
        if (text[i] === "2") throw new NotationError(start, `"${text.slice(start, i + 1)}" is ambiguous. Write ${text.slice(start, i - 1)}2 for a half turn.`);
      }
      if (/\d/.test(text[i] || "")) throw new NotationError(i, `"${text.slice(start, i + 1)}": a move turns once (no suffix), twice (2) or back (').`);
      if (/[A-Za-z]/.test(text[i] || "") && !(text[i] in BASE)) throw new NotationError(i, `"${text[i]}" isn't a move. Faces are U D L R F B, slices M E S, rotations x y z, wide moves Rw or r.`);
      moves.push(move(name, amount, w));
      spans.push([start, i]);
    }
  }
  return seq(0);
}

export const parseMoves = (text) => parse(text).moves;
export const format = (moves) => moves.map(moveText).join(" ");
