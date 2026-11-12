import { createContext, useContext } from 'react';
import { keepPreviousData, useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client.ts';
import { apiPath, type SiteAddress } from './address.ts';
import { detailIdsOf } from './filters.ts';

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
  tracking: { kind: string; name: string }[];
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
 * answered: the address, the published site, and the chosen shop (one of the
 * business's shops, or null; with one shop it is always that shop).
 */
export type SiteContextValue = { address: SiteAddress; site: Site; chosen: ShopEntry | null; several: boolean };
export const SiteContext = createContext<SiteContextValue | null>(null);

export function useSiteContext(): SiteContextValue {
  const value = useContext(SiteContext);
  if (!value) throw new Error('useSiteContext outside the website shell');
  return value;
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

/** The first page for filters not yet applied: the phone Filter panel's "Show [n] products" (design 6). */
export function useProductsPreview(address: SiteAddress, params: URLSearchParams, enabled: boolean) {
  return useQuery({
    queryKey: ['site', address.base, 'products-preview', params.toString()],
    queryFn: () => apiGet<ProductsPage>(productsPath(address, params)),
    enabled,
    placeholderData: keepPreviousData,
    ...once,
  });
}
