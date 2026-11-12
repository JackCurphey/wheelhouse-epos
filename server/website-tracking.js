// The website's tracking tools (openspec/changes/website-management,
// design 5): the fixed list, and what the Website page and customers' browsers
// are told about them. Saving lives in server/website.js with the rest of the draft.

// The fixed list, in the drawn order (website.mjs TOOLS). The ID checks were
// looked up on each company's own help pages on 12 Nov 2026 (task 4.1):
// - Google Analytics: "'G-' followed by a combination of numbers and letters",
//   https://support.google.com/analytics/answer/12270356
// - Microsoft Clarity: no format is given; the project ID is the part of the
//   project's address after /projects/view/,
//   https://learn.microsoft.com/en-us/clarity/third-party-integrations/google-tag-manager
// - Meta Pixel: no format is given, only `fbq('init', '{your-pixel-id-goes-here}')`,
//   https://developers.facebook.com/documentation/meta-pixel/get-started
// - TikTok Pixel: no format is given,
//   https://ads.tiktok.com/help/article/how-to-create-and-access-tiktok-pixel-id
// So those three only check for letters and numbers, nothing pasted around
// them (decided while building 7). No pasted code is accepted (decision 6).
const LETTERS_AND_NUMBERS = /^[A-Za-z0-9]+$/;
export const TRACKING_TOOLS = [
  { key: 'google_analytics', name: 'Google Analytics', kind: 'Statistics', idCheck: /^G-[A-Za-z0-9]+$/,
    idHelp: 'From your Google Analytics account. It starts with G-',
    idProblem: 'That doesn’t look like a Google Analytics ID. It starts with G- and is in your Google Analytics settings.' },
  { key: 'microsoft_clarity', name: 'Microsoft Clarity', kind: 'Statistics', idCheck: LETTERS_AND_NUMBERS,
    idHelp: '[Where to find it in Clarity]', idProblem: 'That doesn’t look like a Microsoft Clarity ID. [Where to find it in Clarity]' },
  { key: 'meta_pixel', name: 'Meta (Facebook) Pixel', kind: 'Marketing', idCheck: LETTERS_AND_NUMBERS,
    idHelp: '[Where to find it in Meta]', idProblem: 'That doesn’t look like a Meta Pixel ID. [Where to find it in Meta]' },
  { key: 'tiktok_pixel', name: 'TikTok Pixel', kind: 'Marketing', idCheck: LETTERS_AND_NUMBERS,
    idHelp: '[Where to find it in TikTok]', idProblem: 'That doesn’t look like a TikTok Pixel ID. [Where to find it in TikTok]' },
];
export const TOOL_BY_KEY = new Map(TRACKING_TOOLS.map((t) => [t.key, t]));

export const savedTool = (content, key) => (content?.tracking || []).find((t) => t.tool === key);

/** The four tools as the Tracking tools screen shows them. */
export function trackingList(content) {
  return TRACKING_TOOLS.map((tool) => {
    const saved = savedTool(content, tool.key);
    const id = saved?.id || '';
    const right = tool.idCheck.test(id);
    return {
      tool: tool.key, name: tool.name, kind: tool.kind, idHelp: tool.idHelp, id, on: !!saved?.on,
      // On but not usable yet: no ID, or one that doesn't look right.
      waiting: !!saved?.on && !right,
      idProblem: id && !right ? tool.idProblem : null,
    };
  });
}

/** What customers' browsers may load: tools on with a right ID, each with its kind. */
export function liveTracking(content) {
  return trackingList(content).filter((t) => t.on && !t.waiting).map((t) => ({ tool: t.tool, kind: t.kind, id: t.id }));
}
