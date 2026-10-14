import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Gift,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  Download,
  ExternalLink,
  BookOpen,
  Info,
  Calendar,
  Building,
  CheckCircle2,
  XCircle,
  Clock,
  Bookmark,
  Share2,
  AlertTriangle,
  Layers,
  Globe,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { GameItem, GiftCode, UserProfile } from '../types/game';
import { dataService } from '../services/dataService';
import { marketingService } from '../services/marketingService';
import { useLanguage } from '../context/LanguageContext';
import { isG1Licensed } from '../utils/licenseUtils';

interface GameDetailModalProps {
  game: GameItem | null;
  onClose: () => void;
  isBookmarked: boolean;
  onToggleBookmark: (gameId: string) => void;
  onOpenShare: (game: GameItem) => void;
  onShowToast: (title: string, message?: string, type?: 'success' | 'error' | 'info') => void;
  currentUser?: UserProfile | null;
}

export const GameDetailModal: React.FC<GameDetailModalProps> = ({
  game,
  onClose,
  isBookmarked,
  onToggleBookmark,
  onOpenShare,
  onShowToast,
  currentUser,
}) => {
  const { t } = useLanguage();
  const activeUser = currentUser || (typeof window !== 'undefined' ? dataService.getCurrentUser() : null);
  const [liveGame, setLiveGame] = useState<GameItem | null>(game);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [votes, setVotes] = useState<Record<string, { up: number; down: number }>>({});
  const [selectedCodeTab, setSelectedCodeTab] = useState<'all' | 'active' | 'expired'>('all');
  const [modalImageError, setModalImageError] = useState(false);

  useEffect(() => {
    setLiveGame(game);
    setModalImageError(false);
  }, [game]);

  // Dynamically fetch and enrich with latest giftcodes from Cloudflare serverless D1 API
  useEffect(() => {
    if (!game?.slug) return;
    let isCancelled = false;
    dataService.getGameBySlug(game.slug, true).then((fresh) => {
      if (!isCancelled && fresh && fresh.codes && fresh.codes.length >= (game.codes?.length || 0)) {
        setLiveGame(fresh);
      }
    });
    return () => {
      isCancelled = true;
    };
  }, [game?.slug]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const isExpired = (c: GiftCode) =>
    (c.status as string)?.toLowerCase() === 'expired' ||
    c.code.toUpperCase() === 'ATNGAY1' ||
    c.code.toUpperCase() === 'ATNGAY2';

  // Ensure currentGame is strictly null if game is null or closed
  const currentGame = game
    ? (liveGame && (liveGame.slug === game.slug || liveGame.id === game.id) ? liveGame : game)
    : null;

  useEffect(() => {
    if (!currentGame || !currentGame.codes) return;
    const initialVotes: Record<string, { up: number; down: number }> = {};
    for (const c of currentGame.codes) {
      initialVotes[c.code] = dataService.getCodeVotes(c.code, isExpired(c));
    }
    setVotes(initialVotes);
  }, [currentGame]);

  if (!game || !currentGame) return null;

  const allCodes = currentGame.codes || [];
  const activeCodes = allCodes.filter((c) => !isExpired(c));
  const expiredCodes = allCodes.filter((c) => isExpired(c));

  const copyToClipboard = async (text: string): Promise<boolean> => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // Fallback below
    }
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    } catch (err) {
      console.error('Copy fallback failed', err);
      return false;
    }
  };

  const handleCopyAll = async (targetCodes: GiftCode[], typeKey: string) => {
    if (!targetCodes || targetCodes.length === 0) {
      onShowToast('Không có mã nào', 'Mục này hiện chưa có mã code để sao chép.', 'info');
      return;
    }

    const codeList = targetCodes.map((c) => c.code.trim()).filter(Boolean);
    const gameLink = `https://codegame.shop/game/${currentGame.slug || currentGame.id || ''}`;
    const watermark = `\n\n📌 Nguồn: CodeGame.shop - Cổng Tra Cứu Giftcode Bản Quyền G1\n👉 Nhận thêm mã VIP miễn phí tại: ${gameLink}`;
    const codeString = codeList.join('\n') + watermark;

    const ok = await copyToClipboard(codeString);
    if (!ok) {
      onShowToast('Lỗi sao chép', 'Không thể truy cập bộ nhớ tạm (clipboard).', 'error');
      return;
    }

    // Ghi nhận sự kiện copy cho từng mã
    targetCodes.forEach((c) => {
      dataService.recordCopyEvent(c.code, currentGame.slug || currentGame.name);
    });
    marketingService.recordRealCopy(currentGame.name, currentGame.slug || '', targetCodes.length, activeUser);

    setCopiedType(typeKey);
    onShowToast(
      `Đã sao chép tất cả ${targetCodes.length} mã code!`,
      `Toàn bộ ${targetCodes.length} mã đã được lưu vào bộ nhớ tạm (mỗi mã một dòng). Dán vào game để nhận quà!`,
      'success'
    );

    confetti({
      particleCount: 50,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#10B981', '#06B6D4', '#8B5CF6', '#F59E0B'],
    });

    setTimeout(() => {
      setCopiedType((prev) => (prev === typeKey ? null : prev));
    }, 2500);
  };

  const handleCopy = (code: string, isExpired = false) => {
    navigator.clipboard.writeText(code);
    dataService.recordCopyEvent(code, currentGame.slug || currentGame.name);
    marketingService.recordRealCopy(currentGame.name, currentGame.slug || '', 1, activeUser);
    setCopiedCode(code);
    if (isExpired) {
      onShowToast(t.modal.copySuccess, `${t.modal.expiredNotice}`, 'info');
    } else {
      onShowToast(t.modal.copySuccess, `${t.modal.copiedNotice}`, 'success');
      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#8B5CF6', '#F43F5E', '#10B981', '#06B6D4'],
      });
    }

    setTimeout(() => setCopiedCode(null), 2500);
  };

  const handleVote = (code: string, type: 'up' | 'down') => {
    const codeObj = allCodes.find((c) => c.code === code);
    const expiredStatus = codeObj ? isExpired(codeObj) : false;
    const res = dataService.voteCode(code, type, expiredStatus);
    setVotes((prev) => ({ ...prev, [code]: res }));
    onShowToast(
      type === 'up' ? t.modal.reportWorking : t.modal.reportExpired,
      `Mã: ${code}`,
      type === 'up' ? 'success' : 'info'
    );
  };

  const initials = currentGame.name ? currentGame.name.substring(0, 2).toUpperCase() : 'G';

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md overflow-hidden animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl h-[88dvh] sm:h-auto sm:max-h-[88vh] flex flex-col bg-card border-t sm:border border-border/90 rounded-t-[28px] sm:rounded-3xl shadow-2xl overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar - Fixed at top of modal */}
        <div className="relative p-3.5 sm:p-5 pb-3 sm:pb-4 border-b border-border/70 bg-card/95 backdrop-blur-md shrink-0 sticky top-0 z-20">
          {/* Mobile Sheet Indicator */}
          <div className="w-12 h-1.5 bg-slate-600/60 rounded-full mx-auto mb-2 sm:hidden shrink-0" />

          <div className="flex items-start justify-between gap-2.5 sm:gap-3">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-muted border border-border overflow-hidden shrink-0 shadow-lg flex items-center justify-center">
                {!modalImageError ? (
                  <img
                    src={currentGame.icon_url || `/game_icons/${currentGame.slug}.webp`}
                    alt={currentGame.name}
                    className="w-full h-full object-cover"
                    onError={() => setModalImageError(true)}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary via-purple-600 to-accent flex items-center justify-center font-display font-extrabold text-white text-lg sm:text-2xl select-none">
                    {initials}
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                  <span className="text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-lg bg-primary/20 text-primary-light border border-primary/30 whitespace-nowrap">
                    {currentGame.category || 'Game'}
                  </span>
                  {isG1Licensed(currentGame) ? (
                    <span
                      className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm cursor-help whitespace-nowrap"
                      title={`${t.gameCard.licenseTooltip} (GP G1: ${currentGame.so_giay_phep || currentGame.license_number})`}
                    >
                      <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span>{t.gameCard.licensed}</span>
                      <span className="hidden sm:inline font-mono text-emerald-400/80">({currentGame.so_giay_phep || currentGame.license_number})</span>
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm whitespace-nowrap"
                      title={t.gameCard.internationalTooltip}
                    >
                      <Globe className="w-3 h-3 text-cyan-400 shrink-0" />
                      <span>{t.gameCard.international}</span>
                    </span>
                  )}
                </div>

                <h2 className="font-heading font-extrabold text-sm sm:text-xl text-foreground truncate">
                  {currentGame.name}
                </h2>

                <p className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                  <span className="flex items-center gap-1 truncate">
                    <Building className="w-3 h-3 shrink-0" />
                    <span className="truncate">{currentGame.publisher || t.modal.publisher}</span>
                  </span>
                  {currentGame.release_date && (
                    <span className="hidden xs:flex items-center gap-1 shrink-0">
                      <Calendar className="w-3 h-3" />
                      {currentGame.release_date}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              <button
                onClick={() => onOpenShare(currentGame)}
                className="p-1.5 sm:p-2.5 rounded-xl bg-muted/60 hover:bg-muted border border-border text-muted-foreground hover:text-foreground transition-all cursor-pointer active:scale-90"
                title={t.modal.share}
              >
                <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>

              <button
                onClick={() => onToggleBookmark(currentGame.id)}
                className={`p-1.5 sm:p-2.5 rounded-xl border transition-all cursor-pointer active:scale-90 ${
                  isBookmarked
                    ? 'bg-amber-400/20 border-amber-400/50 text-amber-400'
                    : 'bg-muted/60 border-border text-muted-foreground hover:text-foreground'
                }`}
                title={isBookmarked ? t.gameCard.bookmarked : t.gameCard.addBookmark}
              >
                <Bookmark className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isBookmarked ? 'fill-amber-400' : ''}`} />
              </button>

              {/* High-visibility Close Button */}
              <button
                onClick={onClose}
                className="p-1.5 sm:p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 hover:border-slate-600 shadow-md cursor-pointer transition-all active:scale-90 flex items-center justify-center shrink-0"
                aria-label={t.modal.close}
                title={t.modal.close}
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </button>
            </div>
          </div>

          {/* Download & Redeem Links */}
          <div className="flex items-center gap-1.5 sm:gap-2 mt-3 pt-2.5 border-t border-border/40 overflow-x-auto scrollbar-none pb-0.5">
            {currentGame.redeem_url && (
              <a
                href={currentGame.redeem_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] sm:text-xs font-semibold bg-accent hover:bg-accent-hover text-white shadow-sm transition-all shrink-0 active:scale-95"
              >
                <ExternalLink className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span>{t.modal.redeemWeb}</span>
              </a>
            )}

            {currentGame.download_android && (
              <a
                href={currentGame.download_android}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] sm:text-xs font-medium bg-card hover:bg-card-hover border border-border text-muted-foreground hover:text-foreground transition-all shrink-0 active:scale-95"
              >
                <Download className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400" />
                <span>Google Play</span>
              </a>
            )}

            {currentGame.download_ios && (
              <a
                href={currentGame.download_ios}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] sm:text-xs font-medium bg-card hover:bg-card-hover border border-border text-muted-foreground hover:text-foreground transition-all shrink-0 active:scale-95"
              >
                <Download className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-secondary" />
                <span>App Store</span>
              </a>
            )}

            {currentGame.download_pc && (
              <a
                href={currentGame.download_pc}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] sm:text-xs font-medium bg-card hover:bg-card-hover border border-border text-muted-foreground hover:text-foreground transition-all shrink-0 active:scale-95"
              >
                <Download className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary-light" />
                <span>Bản PC</span>
              </a>
            )}
          </div>
        </div>

        {/* Modal Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 overscroll-contain pb-[max(env(safe-area-inset-bottom,0px),1.5rem)]">
          {/* Code Filter Tab Switcher (Full-width Segmented Control) */}
          <div className="sticky top-0 z-10 p-1 rounded-2xl bg-card/95 backdrop-blur-md border border-border/80 shadow-sm">
            <div className="grid grid-cols-3 gap-1 w-full">
              <button
                type="button"
                onClick={() => setSelectedCodeTab('all')}
                className={`flex items-center justify-center gap-1 sm:gap-1.5 py-1.5 sm:py-2 px-1 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer active:scale-95 whitespace-nowrap ${
                  selectedCodeTab === 'all'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                }`}
              >
                <Layers className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                <span>{t.modal.allCodes}</span>
                <span className="text-[10px] font-mono opacity-80">({allCodes.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedCodeTab('active')}
                className={`flex items-center justify-center gap-1 sm:gap-1.5 py-1.5 sm:py-2 px-1 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer active:scale-95 whitespace-nowrap ${
                  selectedCodeTab === 'active'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                }`}
              >
                <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-300 shrink-0" />
                <span>{t.modal.activeCodes}</span>
                <span className="text-[10px] font-mono opacity-80">({activeCodes.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedCodeTab('expired')}
                className={`flex items-center justify-center gap-1 sm:gap-1.5 py-1.5 sm:py-2 px-1 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer active:scale-95 whitespace-nowrap ${
                  selectedCodeTab === 'expired'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                }`}
              >
                <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-rose-300 shrink-0" />
                <span>{t.modal.expiredCodes}</span>
                <span className="text-[10px] font-mono opacity-80">({expiredCodes.length})</span>
              </button>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* PHẦN 1: DANH SÁCH MÃ GIFTCODE CÒN HOẠT ĐỘNG (ACTIVE CODES)               */}
          {/* ========================================================================= */}
          {(selectedCodeTab === 'all' || selectedCodeTab === 'active') && (
            <div className="space-y-3">
              {/* Section 1 Header */}
              <div className="flex items-center justify-between gap-2 pb-1 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0">
                    <Gift className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-heading font-extrabold text-sm sm:text-base text-foreground flex items-center gap-1.5">
                      <span>{t.modal.activeCodes}</span>
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        {activeCodes.length}
                      </span>
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {activeCodes.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleCopyAll(activeCodes, 'active')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer active:scale-95 shadow-sm shrink-0 ${
                        copiedType === 'active'
                          ? 'bg-emerald-600 text-white border-emerald-500 ring-2 ring-emerald-500/30'
                          : 'bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-400 hover:text-white border-emerald-500/35'
                      }`}
                      title={`Sao chép toàn bộ ${activeCodes.length} mã còn hạn`}
                    >
                      {copiedType === 'active' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-white" />
                          <span>{t.modal.copiedAll} ({activeCodes.length})</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>{t.modal.copyAll} ({activeCodes.length})</span>
                        </>
                      )}
                    </button>
                  )}
                  <span className="text-[11px] text-emerald-400 font-semibold hidden sm:flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    100%
                  </span>
                </div>
              </div>

              {activeCodes.length === 0 ? (
                <div className="p-4 rounded-2xl bg-muted/40 border border-border text-center text-xs sm:text-sm text-muted-foreground">
                  {t.filter.noGames}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {activeCodes.map((codeItem, idx) => {
                    const voteInfo = votes[codeItem.code] || { up: 0, down: 0 };
                    const isThisCopied = copiedCode === codeItem.code;

                    return (
                      <div
                        key={`active-${codeItem.code}-${idx}`}
                        className="p-2.5 sm:p-3.5 rounded-2xl bg-muted/50 border border-emerald-500/30 hover:border-emerald-500/60 hover:bg-muted/70 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 group shadow-sm overflow-hidden"
                      >
                        {/* Code & Reward Info */}
                        <div className="flex-1 min-w-0 max-w-full">
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                            <button
                              onClick={() => handleCopy(codeItem.code)}
                              className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl bg-card border border-emerald-500/40 hover:border-emerald-500 text-xs sm:text-base font-mono font-bold text-emerald-400 hover:text-white hover:bg-emerald-600 transition-all cursor-pointer shadow-inner max-w-full truncate"
                              title={t.modal.copy}
                            >
                              <span className="truncate">{codeItem.code}</span>
                              {isThisCopied ? (
                                <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 shrink-0" />
                              ) : (
                                <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground group-hover:text-white shrink-0" />
                              )}
                            </button>

                            <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                              <CheckCircle2 className="w-3 h-3 shrink-0" /> {t.modal.activeCodes}
                            </span>
                          </div>

                          <p className="text-xs sm:text-sm text-muted-foreground mt-1 font-sans leading-snug break-words">
                            🎁 {codeItem.rewards || 'Giftcode in-game rewards'}
                          </p>

                          {codeItem.expiry && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground font-mono mt-0.5">
                              <Clock className="w-3 h-3 text-amber-400 shrink-0" /> {t.modal.releaseDate}: {codeItem.expiry}
                            </span>
                          )}
                        </div>

                        {/* Vote Buttons & Copy CTA */}
                        <div className="flex items-center gap-1.5 sm:gap-2 self-end sm:self-center shrink-0 mt-1 sm:mt-0">
                          <button
                            onClick={() => handleVote(codeItem.code, 'up')}
                            className="flex items-center gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl bg-card hover:bg-emerald-500/20 border border-border hover:border-emerald-500/40 text-xs font-mono text-muted-foreground hover:text-emerald-400 transition-colors cursor-pointer"
                            title={t.modal.reportWorking}
                          >
                            <ThumbsUp className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                            <span>{voteInfo.up}</span>
                          </button>

                          <button
                            onClick={() => handleVote(codeItem.code, 'down')}
                            className="flex items-center gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl bg-card hover:bg-rose-500/20 border border-border hover:border-rose-500/40 text-xs font-mono text-muted-foreground hover:text-rose-400 transition-colors cursor-pointer"
                            title={t.modal.reportExpired}
                          >
                            <ThumbsDown className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                            <span>{voteInfo.down}</span>
                          </button>

                          <button
                            onClick={() => handleCopy(codeItem.code)}
                            className="flex items-center gap-1 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all cursor-pointer shrink-0"
                          >
                            {isThisCopied ? (
                              <>
                                <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                <span>{t.gameCard.copied}</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 sm:w-3.5 sm:h-3.5" />
                                <span>{t.modal.copy}</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* PHẦN 2: DANH SÁCH MÃ GIFTCODE ĐÃ HẾT HẠN (EXPIRED CODES)                 */}
          {/* ========================================================================= */}
          {(selectedCodeTab === 'all' || selectedCodeTab === 'expired') && (
            <div className="space-y-3 pt-2">
              {/* Section 2 Header */}
              <div className="flex items-center justify-between gap-2 pb-1 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-rose-500/15 text-rose-400 flex items-center justify-center border border-rose-500/30 shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-heading font-extrabold text-sm sm:text-base text-foreground flex items-center gap-1.5">
                      <span>{t.modal.expiredCodes}</span>
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30">
                        {expiredCodes.length}
                      </span>
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {expiredCodes.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleCopyAll(expiredCodes, 'expired')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer active:scale-95 shadow-sm shrink-0 ${
                        copiedType === 'expired'
                          ? 'bg-rose-600 text-white border-rose-500 ring-2 ring-rose-500/30'
                          : 'bg-rose-500/15 hover:bg-rose-500/30 text-rose-400 hover:text-white border-rose-500/35'
                      }`}
                      title={`Sao chép toàn bộ ${expiredCodes.length} mã hết hạn`}
                    >
                      {copiedType === 'expired' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-white" />
                          <span>{t.modal.copiedAll} ({expiredCodes.length})</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>{t.modal.copyAll} ({expiredCodes.length})</span>
                        </>
                      )}
                    </button>
                  )}
                  <span className="text-[11px] text-muted-foreground hidden sm:flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                    Archive
                  </span>
                </div>
              </div>

              {expiredCodes.length === 0 ? (
                <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/60 text-center text-xs text-muted-foreground">
                  {t.filter.noGames}
                </div>
              ) : (
                <div className="space-y-2">
                  {expiredCodes.map((codeItem, idx) => {
                    const isThisCopied = copiedCode === codeItem.code;

                    return (
                      <div
                        key={`expired-${codeItem.code}-${idx}`}
                        className="p-2.5 sm:p-3 rounded-2xl bg-muted/20 border border-border/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 opacity-80 hover:opacity-100 transition-opacity"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs sm:text-sm font-semibold line-through text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-lg border border-border/60">
                              {codeItem.code}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30">
                              <XCircle className="w-3 h-3" /> {t.modal.expiredCodes}
                            </span>
                          </div>
                          {codeItem.rewards && (
                            <p className="text-[11px] sm:text-xs text-muted-foreground mt-1 truncate">
                              🎁 {codeItem.rewards}
                            </p>
                          )}
                        </div>

                        <button
                          onClick={() => handleCopy(codeItem.code, true)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs text-muted-foreground hover:text-foreground hover:bg-muted border border-border/60 transition-colors cursor-pointer self-end sm:self-center"
                          title={t.modal.copy}
                        >
                          {isThisCopied ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-[11px]">{t.gameCard.copied}</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span className="text-[11px]">{t.modal.copy}</span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Instructions */}
          <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border/80 space-y-2.5">
            <div className="flex items-center gap-2 text-foreground font-heading font-bold text-sm sm:text-base">
              <BookOpen className="w-4 h-4 text-secondary" />
              <h4>{t.modal.instructions} - {currentGame.name}</h4>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
              {currentGame.instructions ||
                '1. Đăng nhập vào game và hoàn thành phần tân thủ.\n2. Vào mục Cài đặt (Settings) hoặc Avatar nhân vật.\n3. Chọn mục "Đổi Giftcode / Mã Quà Tặng".\n4. Dán mã code đã sao chép ở trên và nhấn Xác nhận để nhận quà qua Thư in-game.'}
            </p>
          </div>

          {/* Description */}
          {currentGame.description && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-foreground font-heading font-bold text-sm sm:text-base">
                <Info className="w-4 h-4 text-primary-light" />
                <h4>{t.modal.gameInfo}</h4>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                {currentGame.description}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
