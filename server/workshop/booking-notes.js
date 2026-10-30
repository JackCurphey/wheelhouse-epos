// What an online booking writes from the customer's own words (piece 9), and
// how deleting their details replaces those words with "[removed]" (Jack, 30
// Oct, answer 4: "Wipe their words"; openspec/changes/delete-account design 5).

export const REMOVED = '[removed]';

// Staff see an online booking only through the job's Notes (piece 9): the
// bike note, each answered question, and the description, in that order,
// leaving out any part that is empty. A choice question's line names the
// choice (or "I'm not sure") and, when the customer also typed words,
// appends them after " - "; a question answered by words alone shows the
// words on their own. A free-text question's line is just its answer.
export function answerNoteLine({ wording, kind, answer, text }) {
  if (kind === 'text') return answer ? `${wording} ${answer}` : null;
  const choiceOrNotSure = answer && typeof answer === 'object' && answer.notSure ? "I'm not sure" : answer;
  const words = text || null;
  const value = choiceOrNotSure && words ? `${choiceOrNotSure} - ${words}` : choiceOrNotSure || words;
  return value ? `${wording} ${value}` : null;
}

// The booking's parts of the notes, in order. A part can run over several
// lines when what they wrote did.
function bookingParts({ bikeNote, questionAnswers, description }) {
  const parts = [];
  if (bikeNote) parts.push(`Bike (customer's words): ${bikeNote}`);
  for (const entry of questionAnswers ?? []) {
    const line = answerNoteLine(entry);
    if (line) parts.push(line);
  }
  if (description) parts.push(`Customer's description: ${description}`);
  return parts;
}

export function bookingNotes(said) {
  return bookingParts(said).join('\n');
}

const wipe = (v) => (v === null || v === undefined || v === '' ? v : REMOVED);

/** Their answers with every answer and every word they typed replaced; the shop's questions stay. */
export const wipedAnswers = (answers) => (Array.isArray(answers)
  ? answers.map((a) => ({ ...a, answer: wipe(a.answer), ...(a.text ? { text: REMOVED } : {}) }))
  : answers);

/**
 * A job's or its order's notes with each part the booking wrote from their
 * words replaced as a whole, however many lines it ran over, by its one
 * "[removed]" line, in order; anything else (what staff typed) stays. A part
 * staff have since edited no longer matches, and stays as they left it
 * (re-review: matching line by line drifted when their words had line breaks).
 */
export function wipedNotes(notes, { bikeNote, questionAnswers, description }) {
  if (!notes) return notes;
  const was = bookingParts({ bikeNote, questionAnswers, description });
  const now = bookingParts({ bikeNote: wipe(bikeNote), questionAnswers: wipedAnswers(questionAnswers), description: wipe(description) });
  let out = notes;
  let from = 0;
  was.forEach((part, i) => {
    // A whole part only: starting a line and ending one.
    for (let at = out.indexOf(part, from); at >= 0; at = out.indexOf(part, at + 1)) {
      const end = at + part.length;
      if ((at === 0 || out[at - 1] === '\n') && (end === out.length || out[end] === '\n')) {
        out = out.slice(0, at) + now[i] + out.slice(end);
        from = at + now[i].length;
        return;
      }
    }
  });
  return out;
}

/**
 * "Online booking: [services] - [their description]" (cut to 200 characters)
 * with the description replaced; any other title stays.
 */
export function wipedTitle(title, description) {
  if (!title || !description || !title.startsWith('Online booking: ')) return title;
  const tail = ` - ${description}`;
  for (let at = title.indexOf(' - '); at >= 0; at = title.indexOf(' - ', at + 1)) {
    if (tail.startsWith(title.slice(at))) return `${title.slice(0, at)} - ${REMOVED}`;
  }
  return title;
}
