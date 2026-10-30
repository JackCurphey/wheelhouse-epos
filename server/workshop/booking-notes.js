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

export function bookingNotes({ bikeNote, questionAnswers, description }) {
  const lines = [];
  if (bikeNote) lines.push(`Bike (customer's words): ${bikeNote}`);
  for (const entry of questionAnswers ?? []) {
    const line = answerNoteLine(entry);
    if (line) lines.push(line);
  }
  if (description) lines.push(`Customer's description: ${description}`);
  return lines.join('\n');
}

const wipe = (v) => (v === null || v === undefined || v === '' ? v : REMOVED);

/** Their answers with every answer and every word they typed replaced; the shop's questions stay. */
export const wipedAnswers = (answers) => (Array.isArray(answers)
  ? answers.map((a) => ({ ...a, answer: wipe(a.answer), ...(a.text ? { text: REMOVED } : {}) }))
  : answers);

/**
 * A job's or its order's notes with the lines the booking wrote from their
 * words replaced, line by line; anything else (what staff typed) stays. A
 * line staff have since edited no longer matches, and stays as they left it.
 */
export function wipedNotes(notes, { bikeNote, questionAnswers, description }) {
  if (!notes) return notes;
  const was = bookingNotes({ bikeNote, questionAnswers, description }).split('\n').filter(Boolean);
  const now = bookingNotes({ bikeNote: wipe(bikeNote), questionAnswers: wipedAnswers(questionAnswers), description: wipe(description) }).split('\n').filter(Boolean);
  return notes.split('\n').map((line) => {
    const i = was.indexOf(line);
    return i >= 0 ? now[i] : line;
  }).join('\n');
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
