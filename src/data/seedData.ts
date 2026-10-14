import type { StoreProduct, GiveawayCampaign, UtilityProduct } from '../types/game';
import type { InventoryItem } from '../admin/types/adminTypes';
import utilitiesData from './utilities.json';
import giveawaysData from './giveaways.json';
import storeProductsData from './storeProducts.json';

/**
 * Default Seed Collections:
 * Bundled offline/baseline catalogs for Utilities, Store Products and Giveaways so that
 * all browsers (clean or returning) reflect 100% consistent data instantly at 0ms.
 */
export const DEFAULT_STORE_PRODUCTS: StoreProduct[] = storeProductsData as unknown as StoreProduct[];
export const DEFAULT_GIVEAWAYS: GiveawayCampaign[] = giveawaysData as unknown as GiveawayCampaign[];
export const DEFAULT_INVENTORY: InventoryItem[] = [];
export const DEFAULT_UTILITY_PRODUCTS: UtilityProduct[] = utilitiesData as unknown as UtilityProduct[];

