import { createContext, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client.ts';
import { apiPath, type SiteAddress } from './address.ts';

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

export const hasDetails = (shop: ShopEntry): shop is FirstShop => 'address' in shop;

const once = { retry: false, refetchOnWindowFocus: false } as const;

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
