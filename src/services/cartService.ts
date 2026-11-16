/**
 * Multi-Store Marketplace Shopping Cart Service (Giai đoạn 2 Sàn TMĐT số)
 * Quản lý giỏ hàng đa gian hàng, gom nhóm theo người bán và đồng bộ sự kiện wcg_cart_updated.
 */

export interface CartItem {
  productId: string;
  productName: string;
  priceCore: number;
  sellerId: string;
  sellerName: string;
  sellerSlug?: string;
  sellerAvatar?: string;
  gameSlug?: string;
  gameName?: string;
  coverUrl?: string;
  addedAt: string;
  variantId?: string;
  variantName?: string;
  attributes?: Record<string, string>;
  quantity?: number;
}

export interface StoreCartGroup {
  sellerId: string;
  sellerName: string;
  sellerSlug?: string;
  sellerAvatar?: string;
  items: CartItem[];
  subtotal: number;
}

class CartService {
  private readonly STORAGE_KEY = 'wcg_marketplace_cart_v1';

  public getCart(): CartItem[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private saveCart(items: CartItem[]): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(items));
      window.dispatchEvent(new CustomEvent('wcg_cart_updated', { detail: { items, count: items.length } }));
    } catch (err) {
      console.error('[CartService save error]', err);
    }
  }

  public addToCart(item: Omit<CartItem, 'addedAt'>): { success: boolean; message: string; count: number } {
    const cart = this.getCart();
    
    // Kiểm tra trùng sản phẩm hoặc biến thể trong giỏ hàng
    const existingIndex = cart.findIndex(
      (i) => i.productId === item.productId && (item.variantId ? i.variantId === item.variantId : true)
    );
    if (existingIndex >= 0) {
      const variantSuffix = item.variantName ? ` (${item.variantName})` : '';
      return {
        success: false,
        message: `Sản phẩm "${item.productName}${variantSuffix}" đã có trong giỏ hàng.`,
        count: cart.length,
      };
    }

    const newItem: CartItem = {
      ...item,
      quantity: item.quantity || 1,
      addedAt: new Date().toISOString(),
    };

    cart.push(newItem);
    this.saveCart(cart);

    const variantSuffix = item.variantName ? ` (${item.variantName})` : '';
    return {
      success: true,
      message: `Đã thêm "${item.productName}${variantSuffix}" vào giỏ hàng!`,
      count: cart.length,
    };
  }

  public removeFromCart(productId: string, variantId?: string): CartItem[] {
    const cart = this.getCart().filter(
      (i) => !(i.productId === productId && (variantId ? i.variantId === variantId : true))
    );
    this.saveCart(cart);
    return cart;
  }

  public removeStoreFromCart(sellerId: string): CartItem[] {
    const cart = this.getCart().filter((i) => i.sellerId !== sellerId);
    this.saveCart(cart);
    return cart;
  }

  public clearCart(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(this.STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('wcg_cart_updated', { detail: { items: [], count: 0 } }));
  }

  public getCartCount(): number {
    return this.getCart().length;
  }

  public getCartTotal(): number {
    return this.getCart().reduce((sum, item) => sum + (Number(item.priceCore) || 0), 0);
  }

  public getGroupedBySeller(): StoreCartGroup[] {
    const cart = this.getCart();
    const map = new Map<string, StoreCartGroup>();

    for (const item of cart) {
      const sId = item.sellerId || 'unknown';
      if (!map.has(sId)) {
        map.set(sId, {
          sellerId: sId,
          sellerName: item.sellerName || 'Gian Hàng',
          sellerSlug: item.sellerSlug,
          sellerAvatar: item.sellerAvatar,
          items: [],
          subtotal: 0,
        });
      }
      const group = map.get(sId)!;
      group.items.push(item);
      group.subtotal += Number(item.priceCore) || 0;
    }

    return Array.from(map.values());
  }
}

export const cartService = new CartService();
