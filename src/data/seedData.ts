import type { StoreProduct, GiveawayCampaign, UtilityProduct } from '../types/game';
import type { InventoryItem } from '../admin/types/adminTypes';
import utilitiesData from './utilities.json';
import giveawaysData from './giveaways.json';

/**
 * Default Seed Collections:
 * Kept strictly empty for store products and inventory so that all browsers reflect 100% genuine data fetched from Cloudflare D1.
 * Utilities and Giveaways fallback to json so offline / initial load matches 100% authoritative catalog.
 */
export const DEFAULT_STORE_PRODUCTS: StoreProduct[] = [];
export const DEFAULT_GIVEAWAYS: GiveawayCampaign[] = giveawaysData as unknown as GiveawayCampaign[];
export const DEFAULT_INVENTORY: InventoryItem[] = [];
export const DEFAULT_UTILITY_PRODUCTS: UtilityProduct[] = utilitiesData as unknown as UtilityProduct[];
