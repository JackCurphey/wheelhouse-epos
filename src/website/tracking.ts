/**
 * Loads a tracking tool once the visitor has said yes to its kind
 * (openspec/changes/website-browse, design 4). The site answer carries a
 * tool's ID only after that choice (server/routes/site.js), so a tool with no
 * ID is never loaded. Each loader is the tool's own published snippet:
 *
 * - Google Analytics: the Google tag, https://developers.google.com/tag-platform/gtagjs/install
 *   (gtm.js with the tag ID; the snippet no longer calls gtag('config')).
 * - Meta (Facebook) Pixel: https://developers.facebook.com/docs/meta-pixel/get-started
 *   (the fbq loader of fbevents.js, then init and PageView), written out
 *   readably; the <noscript> image is left out, as the page needs script anyway.
 *
 * Microsoft Clarity and TikTok are not loaded yet: their snippets are only
 * shown inside each account's own setup page (decided while building).
 */
export type TrackingTool = { kind: string; name: string; tool?: string; id?: string };

type Loader = (id: string) => void;
type Queue = ((...args: unknown[]) => void) & { queue?: unknown[][]; push?: unknown; loaded?: boolean; version?: string; callMethod?: (...args: unknown[]) => void };
type TrackingWindow = Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void; fbq?: Queue; _fbq?: Queue };

function addScript(tool: string, src: string) {
  const script = document.createElement('script');
  script.async = true;
  script.src = src;
  script.dataset.whTool = tool;
  document.head.appendChild(script);
}

const LOADERS: Record<string, Loader> = {
  google_analytics(id) {
    const w = window as TrackingWindow;
    w.dataLayer = w.dataLayer || [];
    // The snippet's own gtag: it pushes its arguments object, as the tag expects.
    // eslint-disable-next-line prefer-rest-params -- the tag reads an arguments object, not an array
    w.gtag = function gtag() { (w.dataLayer as unknown[]).push(arguments); };
    w.gtag('js', new Date());
    addScript('google_analytics', `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(id)}`);
  },
  meta_pixel(id) {
    const w = window as TrackingWindow;
    if (!w.fbq) {
      const n: Queue = function fbq(...args: unknown[]) {
        if (n.callMethod) n.callMethod(...args);
        else n.queue!.push(args);
      };
      if (!w._fbq) w._fbq = n;
      n.push = n;
      n.loaded = true;
      n.version = '2.0';
      n.queue = [];
      w.fbq = n;
      addScript('meta_pixel', 'https://connect.facebook.net/en_US/fbevents.js');
    }
    w.fbq('init', id);
    w.fbq('track', 'PageView');
  },
};

/** Loads each tool that has an ID and a loader, once per page. */
export function loadTools(tools: TrackingTool[]) {
  for (const t of tools) {
    if (!t.tool || !t.id || !Object.hasOwn(LOADERS, t.tool)) continue;
    // A known key only from here, so it is safe inside the selector.
    if (document.querySelector(`script[data-wh-tool="${t.tool}"]`)) continue;
    LOADERS[t.tool](t.id);
  }
}
