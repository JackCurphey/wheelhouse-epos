import { createContext, useContext } from 'react';
import { keepPreviousData, useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiMutate } from '@/lib/api/client.ts';
import { apiPath, type SiteAddress } from './address.ts';
import { detailIdsOf } from './filters.ts';
import type { BasketLine } from './basket.ts';
import type { TrackingTool } from './tracking.ts';

/**
 * What the customer website reads (server/routes/site.js, design 2). Every
 * answer is the shop's published content only; a switched-off or unknown
 * shop answers 404 (wb-off).
 */
export type Hours = { open: string; close: string };
export type FirstShop = {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  hours: ({ weekday: number } & Hours)[];
  /** The shop's own today, YYYY-MM-DD in its time zone: its page marks today's row. */
  todayDate: string;
  today: Hours | null;
  nextOpening: { date: string; open: string } | null;
  closures: { from: string; to: string }[];
};
/** A second shop: its name only, until Multiple sites gives it its own details (Jack's answer 1). */
export type OtherShop = { id: number; name: string };
export type ShopEntry = FirstShop | OtherShop;
export type Photo = { url: string; description: string };
export type Site = {
  name: string;
  logo: string | null;
  mainColour: string | null;
  parts: {
    headline: string;
    aboutLine: string;
    shopWords: string;
    bigPhoto: Photo | null;
    shopPhoto: Photo | null;
    workshopWords: string;
    collectionReturns: string;
    privacy: string;
  };
  shops: ShopEntry[];
  /** Each tool's kind and name; its `tool` and `id` only once the visitor's choice turns its kind on. */
  tracking: TrackingTool[];
  preview: boolean;
  canTurnOn: boolean;
  ownerNames?: string[];
};
export type Category = { id: number; name: string; parentId: number | null; path: string; products: number };
export type StockLine = { line: 'none' } | { line: 'ready' | 'sold-out'; shop: string };
export type ProductCardData = {
  id: number;
  name: string;
  brand: string | null;
  photo: string | null;
  pricePence: number;
  priceHighPence: number | null;
  /** The details every size of it shares, a measured one with its unit (server/site-products.js `sharedDetails`). */
  details?: { name: string; value: string | number; unit: string | null }[];
  stock: StockLine;
};
export type Repair = { id: number; name: string; pricePence: number | null };
export type Home = { featured: ProductCardData[]; repairs: Repair[] };

/** A detail to filter by, with its values and how many products have each (server/site-products.js `facets`). */
export type DetailFilter = { id: number; name: string; kind: string; unit: string | null; values: { value: number | string; count: number }[] };
/** One page of a category's products, the filters for it and the total (GET /api/site/products). */
export type ProductsPage = {
  category: { id: number; name: string; path: string; parentId: number | null };
  types: { id: number; name: string; products: number }[];
  products: ProductCardData[];
  total: number;
  /** Where the next page starts, or null on the last. */
  after: number | null;
  filters: {
    details: DetailFilter[];
    brands: { value: string; count: number }[];
    price: { lowPence: number; highPence: number } | null;
    /** Null with no shop chosen: the filter asks for one (wb-category-no-shop). */
    ready: { shop: string; count: number } | null;
  };
  shop: { id: number; name: string } | null;
};

export const hasDetails = (shop: ShopEntry): shop is FirstShop => 'address' in shop;

// Retrying is the query client's rule (app-shell.tsx): server and network failures, not a 4xx.
const once = { refetchOnWindowFocus: false } as const;

export function useSite(address: SiteAddress) {
  return useQuery({ queryKey: ['site', address.base], queryFn: () => apiGet<Site>(apiPath(address, '/api/site')), ...once });
}

export function useCategories(address: SiteAddress) {
  return useQuery({ queryKey: ['site', address.base, 'categories'], queryFn: () => apiGet<Category[]>(apiPath(address, '/api/site/categories')), ...once });
}

export function useHome(address: SiteAddress, shopId: number | null) {
  return useQuery({
    queryKey: ['site', address.base, 'home', shopId],
    queryFn: () => apiGet<Home>(apiPath(address, '/api/site/home', { shop: shopId == null ? null : String(shopId) })),
    ...once,
  });
}

/**
 * The site as every page needs it, provided by the shell once /api/site has
 * answered: the address, the published site, the chosen shop (one of the
 * business's shops, or null; with one shop it is always that shop), and the
 * ways to choose another.
 */
export type SiteContextValue = {
  address: SiteAddress;
  site: Site;
  chosen: ShopEntry | null;
  several: boolean;
  /** Choose the shop to collect from: sets the wh_shop cookie (design 4) and every page follows. */
  choose: (id: number) => void;
  /**
   * Open "Which shop will you collect from?" (wb-choose-shop); focus goes back
   * to `opener` when it closes. `onChosen` runs once a shop is chosen, and the
   * box says it will add to the basket (on-choose-shop).
   */
  openChooser: (opener: HTMLElement, onChosen?: (id: number) => void) => void;
  /** What's in the basket (the wh_basket cookie, task 11.5). */
  basket: BasketLine[];
  /** Change the basket: writes the cookie, and every page follows. */
  setBasket: (lines: BasketLine[]) => void;
};
export const SiteContext = createContext<SiteContextValue | null>(null);

export function useSiteContext(): SiteContextValue {
  const value = useContext(SiteContext);
  if (!value) throw new Error('useSiteContext outside the website shell');
  return value;
}

/** One line of POST /api/site/basket (server/online-orders/basket.js): `name` is null for a product no longer sold. */
export type BasketAnswerLine = {
  productId: number;
  name: string | null;
  code: string | null;
  size: string | null;
  colour: string | null;
  photo: string | null;
  pricePence: number | null;
  qty: number;
  linePence: number;
  stock: PageStock | null;
  note: string | null;
  gone: boolean;
};
export type BasketAnswer = {
  taking: boolean;
  notTaking: string | null;
  shop: { id: number; name: string } | null;
  lines: BasketAnswerLine[];
  count: number;
  totalPence: number;
  changed: string | null;
  blocked: string | null;
};

const askBasket = (address: SiteAddress, shopId: number | null, lines: BasketLine[]) =>
  apiMutate<BasketAnswer>(apiPath(address, '/api/site/basket'), { shop: shopId, lines });

/**
 * The basket priced by the server for these lines and this shop. `ask: false`
 * only reads an answer already had (the header's count), never asking.
 */
export function useBasket(address: SiteAddress, shopId: number | null, lines: BasketLine[], ask = true) {
  return useQuery({
    queryKey: ['site', address.base, 'basket', shopId, lines.map((l) => `${l.productId}:${l.qty}`).join('.')],
    queryFn: () => askBasket(address, shopId, lines),
    enabled: ask && lines.length > 0,
    placeholderData: ask ? keepPreviousData : undefined,
    ...once,
  });
}

/** Whether the shop takes online orders now (design 2), asked with an empty basket. */
export function useTaking(address: SiteAddress) {
  return useQuery({ queryKey: ['site', address.base, 'taking'], queryFn: () => askBasket(address, null, []), select: (a) => a.taking, ...once });
}

const detailIdsKey = (address: SiteAddress, categoryId: number) => ['site', address.base, 'detail-ids', categoryId] as const;
const productsPath = (address: SiteAddress, params: URLSearchParams) => apiPath(address, '/api/site/products', params);

/**
 * A category's details by their names in the address, learned from an
 * answer: every answer for the category fills it in, and an address naming
 * details before any answer has come asks once without them (`needed`).
 */
export function useDetailIds(address: SiteAddress, categoryId: number, needed: boolean) {
  return useQuery({
    queryKey: detailIdsKey(address, categoryId),
    queryFn: async () => detailIdsOf((await apiGet<ProductsPage>(productsPath(address, new URLSearchParams({ category: String(categoryId) })))).filters.details),
    enabled: needed,
    staleTime: Infinity,
    ...once,
  });
}

/**
 * A category's products six at a time, Show more asking for the next six
 * with `after` (design 2). `params` is null until the details' ids are known.
 * While new filters are asked for, the last answer for the same category
 * stays on the page, so the filters don't vanish under the customer's hand.
 */
export function useCategoryProducts(address: SiteAddress, categoryId: number, params: URLSearchParams | null) {
  const client = useQueryClient();
  return useInfiniteQuery({
    queryKey: ['site', address.base, 'products', categoryId, params?.toString() ?? null],
    queryFn: async ({ pageParam }) => {
      const p = new URLSearchParams(params ?? undefined);
      if (pageParam) p.set('after', String(pageParam));
      const page = await apiGet<ProductsPage>(productsPath(address, p));
      client.setQueryData(detailIdsKey(address, categoryId), detailIdsOf(page.filters.details));
      return page;
    },
    initialPageParam: 0,
    getNextPageParam: (last: ProductsPage) => last.after ?? undefined,
    enabled: params !== null,
    placeholderData: (previous) => (previous?.pages[0]?.category.id === categoryId ? previous : undefined),
    ...once,
  });
}

/** A product page's stock line (server/site-products.js `pageStock`, design 3). */
export type PageStock = { line: 'none' } | { line: 'ready'; shop: string; qty: number } | { line: 'elsewhere'; shop: string; at: string } | { line: 'sold-out'; shop: string };
/** GET /api/site/products/:id: a product with sizes has `stock: null` and a line for each of its items. */
export type Product = {
  id: number;
  name: string;
  brand: string | null;
  description: string;
  pricePence: number;
  priceHighPence: number | null;
  category: { id: number; name: string; path: string } | null;
  photos: string[];
  specifications: { name: string; value: string | number; unit: string | null }[];
  sizes: string[];
  colours: string[];
  items: { id: number; size: string | null; colour: string | null; pricePence: number; stock: PageStock }[];
  stock: PageStock | null;
};

export function useProduct(address: SiteAddress, id: number, shopId: number | null) {
  return useQuery({
    queryKey: ['site', address.base, 'product', id, shopId],
    queryFn: () => apiGet<Product>(apiPath(address, `/api/site/products/${id}`, { shop: shopId == null ? null : String(shopId) })),
    enabled: id > 0,
    // Choosing another shop keeps the page (its size and "Added …") while the new stock line comes.
    placeholderData: (previous) => (previous?.id === id ? previous : undefined),
    ...once,
  });
}

/** GET /api/site/suggest: a few of each kind, from the second letter (server/site-products.js `suggestAnswer`). */
export type Suggestions = {
  products: { id: number; name: string; code: string | null; pricePence: number; stock: StockLine }[];
  repairs: Repair[];
  categories: { id: number; name: string; path: string }[];
  pages: { key: string; name: string }[];
};

/**
 * Suggestions for words already waited on (search.tsx asks 250 ms after the
 * last key). Each answer is kept under its own words, so a late answer for
 * older words can never take the place of the newer one's.
 */
export function useSuggestions(address: SiteAddress, q: string, shopId: number | null) {
  return useQuery({
    queryKey: ['site', address.base, 'suggest', q, shopId],
    queryFn: () => apiGet<Suggestions>(apiPath(address, '/api/site/suggest', { q, shop: shopId == null ? null : String(shopId) })),
    enabled: q.trim().length >= 2,
    // The list keeps the last answer while the next loads, so it doesn't flicker as the customer types.
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    ...once,
  });
}

/** One page of search results (GET /api/site/search): the products as /products answers them, the repairs and pages that match, and a measurement read as a category and a detail. */
export type SearchPage = Omit<ProductsPage, 'category' | 'types' | 'filters'> & {
  filters: ProductsPage['filters'] & { categories: { id: number; name: string; count: number }[] };
  repairs: Repair[];
  pages: { key: string; name: string }[];
  measure: { category: { id: number; name: string }; detail: { id: number; name: string; unit: string | null }; value: number } | null;
};

const searchPath = (address: SiteAddress, params: URLSearchParams) => apiPath(address, '/api/site/search', params);
const searchIdsKey = (address: SiteAddress, q: string, categoryId: number | null) => ['site', address.base, 'search-detail-ids', q, categoryId] as const;

/** The details' ids by their names in the address for a search, as useDetailIds does for a category. */
export function useSearchDetailIds(address: SiteAddress, q: string, categoryId: number | null, needed: boolean) {
  return useQuery({
    queryKey: searchIdsKey(address, q, categoryId),
    queryFn: async () => {
      const p = new URLSearchParams({ q });
      if (categoryId !== null) p.set('category', String(categoryId));
      return detailIdsOf((await apiGet<SearchPage>(searchPath(address, p))).filters.details);
    },
    enabled: needed,
    staleTime: Infinity,
    ...once,
  });
}

/** Search results six at a time, as useCategoryProducts; the last answer stays while new words or filters load. */
export function useSearchProducts(address: SiteAddress, q: string, categoryId: number | null, params: URLSearchParams | null) {
  const client = useQueryClient();
  return useInfiniteQuery({
    queryKey: ['site', address.base, 'search', q, params?.toString() ?? null],
    queryFn: async ({ pageParam }) => {
      const p = new URLSearchParams(params ?? undefined);
      if (pageParam) p.set('after', String(pageParam));
      const page = await apiGet<SearchPage>(searchPath(address, p));
      client.setQueryData(searchIdsKey(address, q, categoryId), detailIdsOf(page.filters.details));
      return page;
    },
    initialPageParam: 0,
    getNextPageParam: (last: SearchPage) => last.after ?? undefined,
    enabled: params !== null,
    // New words too: the results page keeps the last list, not a blank page, until the new answer arrives.
    placeholderData: keepPreviousData,
    ...once,
  });
}

/** The first page for filters not yet applied, on either page: the phone Filter panel's "Show [n] products" (design 6). */
export function useListPreview<T>(address: SiteAddress, path: '/api/site/products' | '/api/site/search', params: URLSearchParams, enabled: boolean) {
  return useQuery({
    queryKey: ['site', address.base, `${path}-preview`, params.toString()],
    queryFn: () => apiGet<T>(apiPath(address, path, params)),
    enabled,
    placeholderData: keepPreviousData,
    ...once,
  });
}
