/**
 * Finds where a quoted phrase sits among a PDF page's text pieces, so the
 * results page can draw a highlight box over the exact words. Matching
 * ignores case, spacing, line breaks, and curly vs straight quotes.
 */

export interface TextPiece {
  str: string;
}

export interface PieceRange {
  piece: number; // index into the pieces array
  from: number; // fraction of the piece's width where the match starts (0 to 1)
  to: number; // fraction where it ends
}

function norm(ch: string): string {
  if (/\s/.test(ch)) return " ";
  if ("‘’‚‛′".includes(ch)) return "'";
  if ("“”„″".includes(ch)) return '"';
  if ("‐‑‒–—―−".includes(ch)) return "-";
  return ch.toLowerCase();
}

function normQuote(q: string): string {
  return Array.from(q).map(norm).join("").replace(/ +/g, " ").trim();
}

interface Stream {
  text: string;
  owner: number[]; // piece index for each character (-1 for joining spaces)
  offset: number[]; // character offset inside that piece
}

export function buildStream(pieces: TextPiece[]): Stream {
  let text = "";
  const owner: number[] = [];
  const offset: number[] = [];
  pieces.forEach((p, pi) => {
    const chars = Array.from(p.str);
    chars.forEach((c, ci) => {
      const n = norm(c);
      if (n === " " && text.endsWith(" ")) return;
      text += n;
      owner.push(pi);
      offset.push(ci);
    });
    if (!text.endsWith(" ")) {
      text += " ";
      owner.push(-1);
      offset.push(0);
    }
  });
  return { text, owner, offset };
}

function rangesFor(stream: Stream, pieces: TextPiece[], start: number, end: number): PieceRange[] {
  const byPiece = new Map<number, { min: number; max: number }>();
  for (let i = start; i < end; i++) {
    const p = stream.owner[i];
    if (p < 0) continue;
    const o = stream.offset[i];
    const cur = byPiece.get(p);
    if (!cur) byPiece.set(p, { min: o, max: o });
    else {
      cur.min = Math.min(cur.min, o);
      cur.max = Math.max(cur.max, o);
    }
  }
  return Array.from(byPiece.entries()).map(([piece, { min, max }]) => {
    const len = Math.max(1, Array.from(pieces[piece].str).length);
    return { piece, from: min / len, to: (max + 1) / len };
  });
}

/**
 * Returns the pieces (and the part of each) covered by the quote, or null.
 * Falls back to matching the opening words when the full quote is not found.
 */
export function locateQuote(stream: Stream, pieces: TextPiece[], quote: string): PieceRange[] | null {
  const q = normQuote(quote);
  if (q.length < 3) return null;
  let at = stream.text.indexOf(q);
  let len = q.length;
  if (at === -1) {
    const words = q.split(" ");
    for (let n = Math.min(words.length - 1, 8); n >= 4; n--) {
      const head = words.slice(0, n).join(" ");
      at = stream.text.indexOf(head);
      if (at !== -1) {
        len = head.length;
        break;
      }
    }
  }
  if (at === -1) return null;
  return rangesFor(stream, pieces, at, at + len);
}
