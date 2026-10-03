// Lightspeed shops (journey 21) decision 1: a shop that keeps Lightspeed as
// its till has the workshop only — no Till, Online orders, Cycle to Work,
// Stockroom or Reports. Boards drawn inside withLightspeedShop() show that
// shop's sidebar and Settings; every other board is unchanged.
let LS = false;
export const lightspeedShop = () => LS;
export const withLightspeedShop = (fn) => { const was = LS; LS = true; try { return fn(); } finally { LS = was; } };
export const LS_HIDDEN = ['till', 'orders', 'c2w', 'stock', 'deliveries', 'stocktake', 'reports'];
