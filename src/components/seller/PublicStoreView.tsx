import React, { useState, useEffect } from 'react';
import {
  Store,
  ShieldCheck,
  Clock,
  Package,
  Coins,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  ChevronRight,
  Sparkles,
  ShoppingBag,
  X,
  PauseCircle,
  Info,
  ShoppingCart,
  Star,
} from 'lucide-react';
import { dataService } from '../../services/dataService';
import { cartService } from '../../services/cartService';

interface PublicStoreViewProps {
  slug: string;
  currentUser: any;
  onOpenLogin: () => void;
  onNavigateHome: () => void;
  onOpenProfile?: () => void;
  onOpenCart?: () => void;
}

export const PublicStoreView: React.FC<PublicStoreViewProps> = ({
  slug,
  currentUser,
  onOpenLogin,
  onNavigateHome,
  onOpenProfile,
  onOpenCart,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [store, setStore] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [isVacation, setIsVacation] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [cartToast, setCartToast] = useState<{ message: string; success: boolean } | null>(null);

  // Ratings State (§A)
  const [ratingsData, setRatingsData] = useState<{ avg_stars: number | null; total_ratings: number; ratings: any[] }>({
    avg_stars: null,
    total_ratings: 0,
    ratings: [],
  });

  // Purchase Modal State
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [purchasing, setPurchasing] = useState<boolean>(false);
  const [purchasedOrder, setPurchasedOrder] = useState<any>(null);
  const [purchaseError, setPurchaseError] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  const getAuthToken = () => {
    return localStorage.getItem('wcg_auth_token') || sessionStorage.getItem('wcg_auth_token') || '';
  };

  const getHeaders = () => {
    const token = getAuthToken();
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  };

  // Fetch Store & Products
  useEffect(() => {
    const fetchStoreData = async () => {
      setLoading(true);
      setErrorMsg('');
      try {
        const storeRes = await fetch(`/api/stores/${encodeURIComponent(slug)}`);
        const storeData = await storeRes.json();
        if (!storeData.success) {
          setErrorMsg(storeData.error || 'Gian hàng không tồn tại hoặc đã ngừng hoạt động.');
          setLoading(false);
          return;
        }

        setStore(storeData.store);
        setIsVacation(Boolean(storeData.store.is_vacation));

        const prodsRes = await fetch(`/api/stores/${encodeURIComponent(slug)}/products`);
        const prodsData = await prodsRes.json();
        if (prodsData.success) {
          setProducts(prodsData.products || []);
          if (prodsData.is_vacation) setIsVacation(true);
        }

        // Tải đánh giá gian hàng (§A)
        try {
          const ratingsRes = await fetch(`/api/stores/${encodeURIComponent(slug)}/ratings`);
          const ratingsJson = await ratingsRes.json();
          if (ratingsJson.success) {
            setRatingsData({
              avg_stars: ratingsJson.avg_stars,
              total_ratings: ratingsJson.total_ratings || 0,
              ratings: ratingsJson.ratings || [],
            });
          }
        } catch {
          // Bỏ qua lỗi đánh giá phụ
        }
      } catch {
        setErrorMsg('Không thể kết nối đến máy chủ.');
      } finally {
        setLoading(false);
      }
    };

    if (slug) {
      fetchStoreData();
    }
  }, [slug]);

  // Handle Add to Cart
  const handleAddToCart = (p: any) => {
    const res = cartService.addToCart({
      productId: p.id,
      productName: p.name,
      priceCore: p.price_core,
      sellerId: store?.id || p.seller_id,
      sellerName: store?.name || 'Gian Hàng',
      sellerSlug: slug,
      sellerAvatar: store?.avatar_url,
      gameSlug: p.game_slug,
      gameName: p.game_name,
      coverUrl: p.cover_url,
    });
    setCartToast({ message: res.message, success: res.success });
    setTimeout(() => setCartToast(null), 3000);
  };

  // Handle Purchase
  const handlePurchase = async () => {
    if (!currentUser) {
      onOpenLogin();
      return;
    }
    if (!selectedProduct) return;

    setPurchasing(true);
    setPurchaseError('');
    try {
      const res = await fetch('/api/seller-orders', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ product_id: selectedProduct.id }),
      });
      const data = await res.json();
      if (data.success) {
        setPurchasedOrder(data.order);
        if (typeof data.new_balance === 'number' && currentUser) {
          currentUser.wallet_balance = data.new_balance;
          dataService.saveCurrentUser(currentUser);
        }
      } else {
        setPurchaseError(data.error || 'Thanh toán thất bại.');
      }
    } catch {
      setPurchaseError('Lỗi kết nối máy chủ.');
    } finally {
      setPurchasing(false);
      dataService.refreshCurrentUserBalance().catch(() => {});
    }
  };

  const copyDeliveredCode = () => {
    if (!purchasedOrder?.delivered_code) return;
    navigator.clipboard.writeText(purchasedOrder.delivered_code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (errorMsg || !store) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold mb-2">Không Tìm Thấy Gian Hàng</h2>
        <p className="text-muted-foreground text-sm max-w-md mb-6">{errorMsg || 'Gian hàng không tồn tại hoặc đã tạm dừng mở bán.'}</p>
        <button
          onClick={onNavigateHome}
          className="px-6 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-sm"
        >
          Quay Về Trang Chủ
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Store Banner & Info Header */}
      <div className="relative rounded-3xl overflow-hidden bg-card border border-border shadow-sm mb-8">
        <div className="h-32 sm:h-44 bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 relative">
          {store.cover_url && (
            <img src={store.cover_url} alt="" className="w-full h-full object-cover opacity-30" />
          )}
        </div>

        <div className="p-4 sm:p-6 -mt-12 sm:-mt-14 relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="flex items-end gap-4">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-card border-4 border-card shadow-lg flex items-center justify-center text-primary font-black text-2xl overflow-hidden shrink-0">
                {store.avatar_url ? (
                  <img src={store.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  store.name.charAt(0).toUpperCase()
                )}
              </div>
              <div className="pb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">{store.name}</h1>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Uy tín {store.reputation_score || 100}
                  </span>
                  {ratingsData.total_ratings > 0 && ratingsData.avg_stars !== null ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> {ratingsData.avg_stars} ({ratingsData.total_ratings} đánh giá)
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-muted/60 text-muted-foreground border border-border flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 text-muted-foreground/60" /> Chưa có đánh giá
                    </span>
                  )}
                  {isVacation && (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center gap-1">
                      <PauseCircle className="w-3.5 h-3.5" /> Đang Nghỉ Bán
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> Giờ hỗ trợ: {store.support_hours || '08:00 - 22:00'}
                  </span>
                  <span>•</span>
                  <span>Sàn TMĐT Số CodeGame.shop</span>
                </div>
              </div>
            </div>

            {/* Policies Badge */}
            <div className="flex items-center gap-2 text-[11px] bg-muted/60 p-2.5 rounded-xl border border-border/60">
              <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
              <div className="line-clamp-2">
                <span className="font-semibold text-foreground">Bảo hành:</span> {store.warranty_policy || 'Bảo hành 24H 1 đổi 1 hoặc hoàn tiền'}
              </div>
            </div>
          </div>

          {store.description && (
            <p className="mt-4 text-xs text-muted-foreground leading-relaxed border-t border-border/60 pt-3">
              {store.description}
            </p>
          )}
        </div>
      </div>

      {/* Vacation Banner */}
      {isVacation && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center gap-3">
          <PauseCircle className="w-6 h-6 shrink-0" />
          <div className="text-xs">
            <div className="font-bold text-sm">Gian hàng hiện đang tạm thời nghỉ bán!</div>
            <div className="opacity-90 mt-0.5">Người bán đang trong kỳ nghỉ hoặc bảo trì kho. Quý khách vui lòng quay lại sau ít ngày.</div>
          </div>
        </div>
      )}

      {/* Products Catalog */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Danh Mục Gói Sản Phẩm & Giftcode</h2>
          <p className="text-xs text-muted-foreground">Thanh toán tự động bằng ví Core, nhận mã ngay trong 0 giây.</p>
        </div>
        <div className="text-xs font-semibold text-muted-foreground">
          {products.length} sản phẩm
        </div>
      </div>

      {products.length === 0 ? (
        <div className="py-16 text-center bg-card border border-border rounded-2xl">
          <Package className="w-12 h-12 text-muted-foreground/40 mx-auto mb-2" />
          <div className="text-sm font-semibold">Chưa có sản phẩm mở bán</div>
          <p className="text-xs text-muted-foreground mt-1">Gian hàng chưa đăng sản phẩm nào hoặc các sản phẩm đang chờ duyệt.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((p) => (
            <div
              key={p.id}
              className="bg-card border border-border rounded-2xl p-4 flex flex-col justify-between hover:border-primary/40 hover:shadow-md transition-all group"
            >
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <img
                    src={p.cover_url}
                    alt=""
                    className="w-12 h-12 rounded-xl object-cover shrink-0 border border-border group-hover:scale-105 transition-transform"
                  />
                  <div className="truncate">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-muted text-muted-foreground uppercase">
                      {p.game_name || p.game_slug}
                    </span>
                    <h3 className="font-bold text-sm text-foreground truncate mt-0.5" title={p.name}>
                      {p.name}
                    </h3>
                  </div>
                </div>

                {p.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3 leading-relaxed">
                    {p.description}
                  </p>
                )}

                <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-4 flex-wrap">
                  <span className="px-2 py-0.5 rounded bg-muted/80">BH {p.warranty_type}</span>
                  <span className="px-2 py-0.5 rounded bg-muted/80">
                    {p.delivery_type === 'AUTO' ? 'Giao tức thì 24/7' : 'Giao thủ công'}
                  </span>
                  {ratingsData.total_ratings > 0 && ratingsData.avg_stars !== null ? (
                    <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-bold flex items-center gap-1">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {ratingsData.avg_stars}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-muted/60 text-muted-foreground text-[10px]">
                      Chưa có đánh giá
                    </span>
                  )}
                  {p.has_stock ? (
                    <span className="text-emerald-500 font-bold ml-auto flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Còn hàng
                    </span>
                  ) : (
                    <span className="text-destructive font-semibold ml-auto">Tạm hết hàng</span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border/60">
                <div>
                  <div className="text-base font-black text-foreground flex items-center gap-1">
                    {p.price_core.toLocaleString()} <span className="text-xs font-bold text-amber-500">Core</span>
                  </div>
                  {p.original_price_core && (
                    <div className="text-[10px] text-muted-foreground line-through">
                      {p.original_price_core.toLocaleString()} Core
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={!p.has_stock || isVacation}
                    onClick={() => handleAddToCart(p)}
                    className="px-2.5 py-1.5 rounded-xl bg-card hover:bg-muted border-2 border-primary/40 hover:border-primary text-foreground hover:text-primary transition-all disabled:opacity-40 disabled:pointer-events-none active:scale-95 shadow-sm flex items-center gap-1.5 text-xs font-semibold"
                    title="Thêm sản phẩm này vào giỏ hàng"
                    aria-label="Thêm vào giỏ hàng"
                  >
                    <ShoppingCart className="w-3.5 h-3.5 text-primary" />
                    <span>Thêm vào giỏ</span>
                  </button>
                  <button
                    disabled={!p.has_stock || isVacation}
                    onClick={() => {
                      setSelectedProduct(p);
                      setPurchasedOrder(null);
                      setPurchaseError('');
                    }}
                    className="px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-95 transition-all shadow-sm shadow-primary/20 disabled:opacity-40 disabled:pointer-events-none active:scale-95 whitespace-nowrap"
                  >
                    Mua Ngay
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Customer Reviews Section (§A) */}
      <div className="mt-12 pt-8 border-t border-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
              <span>Đánh Giá Của Khách Hàng</span>
              {ratingsData.total_ratings > 0 && ratingsData.avg_stars !== null && (
                <span className="ml-2 text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-bold border border-amber-500/20">
                  {ratingsData.avg_stars} / 5 ⭐ ({ratingsData.total_ratings} lượt)
                </span>
              )}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Đánh giá thực tế từ khách hàng đã mua và thanh toán đơn hàng thành công trên sàn.
            </p>
          </div>
        </div>

        {ratingsData.ratings.length === 0 ? (
          <div className="py-12 text-center bg-card border border-border rounded-2xl p-6">
            <Star className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
            <div className="text-sm font-semibold text-foreground">Chưa có đánh giá nào</div>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Gian hàng này chưa có lượt đánh giá nào được duyệt. Mua sản phẩm để trở thành người đầu tiên đánh giá!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ratingsData.ratings.map((r: any) => (
              <div key={r.id} className="p-4 rounded-2xl bg-card border border-border shadow-sm flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((starVal) => (
                        <Star
                          key={starVal}
                          className={`w-3.5 h-3.5 ${
                            starVal <= r.stars
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-muted-foreground/30'
                          }`}
                        />
                      ))}
                      <span className="text-xs font-bold text-amber-400 ml-1">{r.stars} sao</span>
                    </div>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {r.created_at ? new Date(r.created_at).toLocaleDateString('vi-VN') : ''}
                    </span>
                  </div>
                  {r.comment && (
                    <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                      {r.comment}
                    </p>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground pt-2 border-t border-border/40 flex items-center justify-between">
                  <span className="font-semibold text-foreground">Người mua: <strong className="font-mono">{r.buyer_name}</strong></span>
                  <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Đã mua hàng
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Mua Hàng Bằng Core (§6.2) */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-primary" /> Mua Bằng Ví Core Nội Bộ
              </h3>
              <button
                onClick={() => {
                  setSelectedProduct(null);
                  setPurchasedOrder(null);
                }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!purchasedOrder ? (
              <div className="space-y-4 text-xs">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/60">
                  <img src={selectedProduct.cover_url} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0 border" />
                  <div>
                    <div className="font-bold text-sm text-foreground">{selectedProduct.name}</div>
                    <div className="text-muted-foreground text-[11px]">{selectedProduct.game_name || selectedProduct.game_slug}</div>
                    <div className="text-primary font-bold mt-0.5">{selectedProduct.price_core.toLocaleString()} Core</div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-background border border-border space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Giá sản phẩm:</span>
                    <strong className="text-foreground">{selectedProduct.price_core.toLocaleString()} Core</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Số dư ví của bạn:</span>
                    <strong className="text-amber-500">
                      {currentUser
                        ? `${(Number(currentUser.wallet_balance ?? (currentUser as any).balance ?? (currentUser as any).core_balance) || 0).toLocaleString('vi-VN')} Core`
                        : 'Chưa đăng nhập'}
                    </strong>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-border/60">
                    <span className="text-muted-foreground">Thời gian giao:</span>
                    <strong className="text-emerald-500">Tức thì (0 giây)</strong>
                  </div>
                </div>

                {purchaseError && (
                  <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{purchaseError}</span>
                  </div>
                )}

                <div className="pt-2">
                  {!currentUser ? (
                    <button
                      onClick={onOpenLogin}
                      className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-bold"
                    >
                      Đăng Nhập Để Mua
                    </button>
                  ) : (
                    <button
                      disabled={purchasing}
                      onClick={handlePurchase}
                      className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold shadow-md shadow-primary/20 disabled:opacity-50"
                    >
                      {purchasing ? 'Đang giao dịch...' : `Xác Nhận Thanh Toán (${selectedProduct.price_core.toLocaleString()} Core)`}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* Đã Mua Thành Công -> Giao Mã Ngay */
              <div className="space-y-4 text-center py-2">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-foreground">Giao Dịch Thành Công!</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">Mã giftcode của bạn đã sẵn sàng sử dụng.</p>
                </div>

                <div className="p-4 rounded-xl bg-muted/80 border border-border">
                  <div className="text-[10px] text-muted-foreground font-semibold mb-1 uppercase tracking-wider">Mã Quà Tặng / Giftcode Của Bạn</div>
                  <div className="font-mono text-base font-black text-primary select-all break-all py-1">
                    {purchasedOrder.delivered_code}
                  </div>
                  <button
                    onClick={copyDeliveredCode}
                    className="mt-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold inline-flex items-center gap-1.5 shadow-sm"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {copiedCode ? 'Đã Sao Chép!' : 'Sao Chép Mã'}
                  </button>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => {
                      setSelectedProduct(null);
                      setPurchasedOrder(null);
                    }}
                    className="flex-1 py-2 rounded-xl border border-border text-xs font-semibold hover:bg-muted"
                  >
                    Tiếp Tục Mua
                  </button>
                  {onOpenProfile && (
                    <button
                      onClick={() => {
                        setSelectedProduct(null);
                        setPurchasedOrder(null);
                        onOpenProfile();
                      }}
                      className="flex-1 py-2 rounded-xl bg-muted hover:bg-muted/80 text-xs font-bold"
                    >
                      Xem Tủ Mã Của Tôi
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Floating Cart Toast Notification */}
      {cartToast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="p-3.5 rounded-2xl bg-card border border-border shadow-xl flex items-center gap-3 max-w-sm">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                cartToast.success ? 'bg-emerald-500/20 text-emerald-500' : 'bg-destructive/20 text-destructive'
              }`}
            >
              {cartToast.success ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-foreground truncate">{cartToast.message}</div>
            </div>
            {onOpenCart && cartToast.success && (
              <button
                type="button"
                onClick={onOpenCart}
                className="px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-[11px] font-bold shrink-0 hover:opacity-90 shadow-sm"
              >
                Mở Giỏ
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
