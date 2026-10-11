import React, { useState, useEffect, useMemo } from 'react';
import {
  Newspaper,
  Plus,
  Sparkles,
  Search,
  Eye,
  Trash2,
  Edit,
  Clock,
  Gift,
  Flame,
  CheckCircle2,
  Globe,
  RefreshCw,
  ExternalLink,
  Bot,
  Calendar,
  Save,
  X,
  FileText,
  Gamepad2,
  Share2,
} from 'lucide-react';
import { NewsArticle } from '../../types/game';
import { newsService } from '../../services/newsService';
import { adminDataService } from '../services/adminDataService';
import { dataService } from '../../services/dataService';
import { SearchableGameSelect } from '../components/ui/SearchableGameSelect';
import { GameAdminRecord } from '../types/adminTypes';
import { smartVietnameseMatch } from '../../utils/textUtils';

interface NewsModuleProps {
  onShowToast: (title: string, message?: string, type?: 'success' | 'error' | 'info') => void;
}

export const NewsModule: React.FC<NewsModuleProps> = ({ onShowToast }) => {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [games, setGames] = useState<GameAdminRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'PUBLISHED' | 'DRAFT'>('all');
  const [isSyncing, setIsSyncing] = useState(false);

  // Edit / Create Modal state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Partial<NewsArticle>>({});
  const [codeInputValue, setCodeInputValue] = useState('');
  const [tagInputValue, setTagInputValue] = useState('');

  // AI Generator Modal state
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiSelectedGame, setAiSelectedGame] = useState<GameAdminRecord | null>(null);
  const [aiTopicType, setAiTopicType] = useState<'codes' | 'update' | 'guide' | 'event'>('codes');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  // Load initial data
  const loadData = () => {
    const list = newsService.getAllArticles();
    setArticles(list);
    const adminGames = adminDataService.getGames();
    setGames(adminGames);
  };

  useEffect(() => {
    loadData();
    const handleNewsUpdate = () => {
      setArticles(newsService.getAllArticles());
    };
    window.addEventListener('wcg_news_updated', handleNewsUpdate);
    return () => window.removeEventListener('wcg_news_updated', handleNewsUpdate);
  }, []);

  // Filtered articles
  const filteredArticles = useMemo(() => {
    return articles.filter((a) => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const matches = smartVietnameseMatch(
          [a.title, a.excerpt, a.game_name || '', ...(a.tags || [])],
          searchQuery
        );
        if (!matches) return false;
      }
      return true;
    });
  }, [articles, statusFilter, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const totalViews = articles.reduce((acc, a) => acc + (a.views || 0), 0);
    const totalCodes = articles.reduce((acc, a) => acc + (a.codes?.length || 0), 0);
    const publishedCount = articles.filter((a) => a.status === 'PUBLISHED').length;
    const featuredCount = articles.filter((a) => a.is_featured).length;
    return { total: articles.length, totalViews, totalCodes, publishedCount, featuredCount };
  }, [articles]);

  // Handle open create new article
  const handleOpenCreate = () => {
    const newId = `news_${Date.now()}`;
    setEditingArticle({
      id: newId,
      slug: `tin-tuc-game-${Date.now().toString().slice(-6)}`,
      title: '',
      excerpt: '',
      content: '',
      cover_url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80',
      author: 'CodeGame Editorial',
      views: 0,
      read_time_minutes: 3,
      is_featured: false,
      is_hot: false,
      status: 'PUBLISHED',
      codes: [],
      tags: ['Giftcode', 'GameMobile'],
      published_at: new Date().toISOString(),
    });
    setCodeInputValue('');
    setTagInputValue('Giftcode, GameMobile');
    setIsEditorOpen(true);
  };

  // Handle open edit article
  const handleOpenEdit = (article: NewsArticle) => {
    setEditingArticle({ ...article });
    setCodeInputValue('');
    setTagInputValue(article.tags?.join(', ') || '');
    setIsEditorOpen(true);
  };

  // Handle Save article
  const handleSaveArticle = async () => {
    if (!editingArticle.title?.trim()) {
      onShowToast('Thiếu tiêu đề', 'Vui lòng nhập tiêu đề cho bài viết!', 'error');
      return;
    }
    if (!editingArticle.content?.trim()) {
      onShowToast('Thiếu nội dung', 'Vui lòng nhập nội dung chi tiết cho bài viết!', 'error');
      return;
    }

    const slug =
      editingArticle.slug?.trim() ||
      editingArticle.title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[đĐ]/g, 'd')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    const parsedTags = tagInputValue
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const articleToSave: NewsArticle = {
      id: editingArticle.id || `news_${Date.now()}`,
      slug,
      title: editingArticle.title.trim(),
      excerpt: editingArticle.excerpt?.trim() || editingArticle.content.slice(0, 180) + '...',
      content: editingArticle.content,
      cover_url:
        editingArticle.cover_url ||
        'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80',
      game_id: editingArticle.game_id,
      game_slug: editingArticle.game_slug,
      game_name: editingArticle.game_name,
      tags: parsedTags,
      codes: editingArticle.codes || [],
      author: editingArticle.author || 'CodeGame Editorial',
      views: editingArticle.views || 0,
      read_time_minutes: editingArticle.read_time_minutes || 3,
      is_featured: Boolean(editingArticle.is_featured),
      is_hot: Boolean(editingArticle.is_hot),
      status: editingArticle.status || 'PUBLISHED',
      published_at: editingArticle.published_at || new Date().toISOString(),
    };

    newsService.saveArticle(articleToSave);
    setArticles(newsService.getAllArticles());
    setIsEditorOpen(false);
    onShowToast('Thành công', 'Đã lưu bài viết tin tức thành công!', 'success');

    // Trigger background cloud sync
    newsService.syncArticlesToCloudflare();
  };

  // Handle Delete article
  const handleDeleteArticle = (articleId: string, title: string) => {
    if (confirm(`Bạn có chắc muốn xóa bài viết "${title}"?`)) {
      newsService.deleteArticle(articleId);
      setArticles(newsService.getAllArticles());
      onShowToast('Đã xóa', `Đã xóa bài viết "${title}"`, 'info');
      newsService.syncArticlesToCloudflare();
    }
  };

  // Toggle Featured
  const handleToggleFeatured = (article: NewsArticle) => {
    const updated: NewsArticle = { ...article, is_featured: !article.is_featured };
    newsService.saveArticle(updated);
    setArticles(newsService.getAllArticles());
    onShowToast(
      updated.is_featured ? 'Đã ghim Tiêu Điểm' : 'Đã bỏ ghim Tiêu Điểm',
      article.title,
      'success'
    );
  };

  // Toggle Hot
  const handleToggleHot = (article: NewsArticle) => {
    const updated: NewsArticle = { ...article, is_hot: !article.is_hot };
    newsService.saveArticle(updated);
    setArticles(newsService.getAllArticles());
    onShowToast(updated.is_hot ? 'Đã bật HOT' : 'Đã tắt HOT', article.title, 'success');
  };

  // Sync to Cloudflare D1
  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const ok = await newsService.syncArticlesToCloudflare();
      if (ok) {
        onShowToast('Đã đồng bộ D1', 'Toàn bộ bài viết tin tức đã được lưu trên Cloudflare D1!', 'success');
      } else {
        onShowToast('Lỗi đồng bộ', 'Không thể đồng bộ bài viết lên D1.', 'error');
      }
    } catch (e: any) {
      onShowToast('Lỗi đồng bộ', e?.message, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // AI Generator: Run draft generation
  const handleRunAiGenerator = () => {
    if (!aiSelectedGame) {
      onShowToast('Vui lòng chọn game', 'Hãy chọn tựa game bạn muốn AI viết bài!', 'error');
      return;
    }

    setIsGeneratingAi(true);

    try {
      // Find codes for this game from catalog
      const allCodes = dataService.getAllCodes();
      const gameCodes = allCodes
        .filter((c) => c.game_id === aiSelectedGame.id || c.game_slug === aiSelectedGame.slug)
        .map((c) => c.code);

      const draft = newsService.generateAiArticleDraft({
        game: {
          id: aiSelectedGame.id,
          name: aiSelectedGame.name,
          slug: aiSelectedGame.slug,
          cover_image: aiSelectedGame.bannerUrl || aiSelectedGame.iconUrl,
        },
        topicType: aiTopicType,
        availableCodes: gameCodes,
      });

      // Populate into editor
      setEditingArticle(draft);
      setCodeInputValue('');
      setTagInputValue(draft.tags?.join(', ') || '');
      setIsAiModalOpen(false);
      setIsEditorOpen(true);

      onShowToast(
        'AI tạo bài thành công! ✨',
        `Đã tạo bài viết chuẩn SEO cho "${aiSelectedGame.name}". Bạn có thể xem lại và lưu ngay.`,
        'success'
      );
    } catch (err: any) {
      onShowToast('Lỗi AI Generator', err?.message, 'error');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Editor: Add code pill
  const handleAddCodeToArticle = () => {
    if (!codeInputValue.trim()) return;
    const currentCodes = editingArticle.codes || [];
    const newCode = codeInputValue.trim().toUpperCase();
    if (!currentCodes.includes(newCode)) {
      setEditingArticle({ ...editingArticle, codes: [...currentCodes, newCode] });
    }
    setCodeInputValue('');
  };

  // Editor: Remove code pill
  const handleRemoveCodeFromArticle = (codeToRemove: string) => {
    const currentCodes = editingArticle.codes || [];
    setEditingArticle({
      ...editingArticle,
      codes: currentCodes.filter((c) => c !== codeToRemove),
    });
  };

  return (
    <div className="space-y-6 animate-fade-in p-4 sm:p-6 lg:p-8">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/60 border border-border/80 p-6 rounded-3xl backdrop-blur-xl">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary-light text-xs font-bold">
            <Newspaper className="w-3.5 h-3.5" />
            <span>NỘI DUNG & TIN TỨC GAME</span>
          </div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">
            Quản Lý Tin Tức & Cập Nhật Giftcode
          </h1>
          <p className="text-xs text-muted-foreground">
            Biên tập bài viết, chia sẻ giftcode tự động, gắn kèm mã quà tặng và công cụ AI viết bài chuẩn SEO.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* AI Generator button */}
          <button
            type="button"
            onClick={() => {
              setAiSelectedGame(games[0] || null);
              setIsAiModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-rose-500 text-white font-black text-xs shadow-lg hover:shadow-amber-500/25 transition-all active:scale-95 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-200 animate-pulse" />
            <span>✨ AI Tự Động Viết Bài</span>
          </button>

          {/* Create Manual button */}
          <button
            type="button"
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-primary text-white font-bold text-xs hover:bg-primary-dark transition-all active:scale-95 cursor-pointer shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo Bài Viết</span>
          </button>

          {/* Sync D1 button */}
          <button
            type="button"
            disabled={isSyncing}
            onClick={handleManualSync}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs border border-border/80 transition-all active:scale-95 cursor-pointer"
            title="Đồng bộ toàn bộ bài viết lên Cloudflare D1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-primary' : ''}`} />
            <span>{isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ D1'}</span>
          </button>
        </div>
      </div>

      {/* 2. Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-card border border-border/80 space-y-1">
          <div className="text-xs text-muted-foreground font-medium flex items-center justify-between">
            <span>Tổng bài viết</span>
            <FileText className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-black text-foreground font-mono">{stats.total}</div>
          <div className="text-[11px] text-emerald-400 font-semibold">
            {stats.publishedCount} đã xuất bản
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border/80 space-y-1">
          <div className="text-xs text-muted-foreground font-medium flex items-center justify-between">
            <span>Lượt xem độc giả</span>
            <Eye className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-black text-sky-400 font-mono">
            {stats.totalViews.toLocaleString('vi-VN')}
          </div>
          <div className="text-[11px] text-muted-foreground">Tương tác thực tế</div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border/80 space-y-1">
          <div className="text-xs text-muted-foreground font-medium flex items-center justify-between">
            <span>Mã Giftcode kèm theo</span>
            <Gift className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400 font-mono">{stats.totalCodes}</div>
          <div className="text-[11px] text-muted-foreground">Sẵn sàng 1-click copy</div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border/80 space-y-1">
          <div className="text-xs text-muted-foreground font-medium flex items-center justify-between">
            <span>Bài viết tiêu điểm</span>
            <Flame className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-400 font-mono">{stats.featuredCount}</div>
          <div className="text-[11px] text-muted-foreground">Ghim banner nổi bật</div>
        </div>
      </div>

      {/* 3. Filters & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-2xl border border-border/80">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tiêu đề, game, tags..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-muted/60 border border-border/60 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-primary text-white shadow-sm'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            Tất cả ({articles.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('PUBLISHED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'PUBLISHED'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            Đã xuất bản ({stats.publishedCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('DRAFT')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'DRAFT'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            Bản nháp ({articles.length - stats.publishedCount})
          </button>
        </div>
      </div>

      {/* 4. Articles Table */}
      <div className="overflow-hidden rounded-3xl bg-card border border-border/80 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/60 border-b border-border/80 text-muted-foreground font-semibold">
              <tr>
                <th className="py-3 px-4">Bài Viết</th>
                <th className="py-3 px-4">Game Liên Kết</th>
                <th className="py-3 px-4">Giftcode Kèm</th>
                <th className="py-3 px-4">Lượt Xem</th>
                <th className="py-3 px-4">Tiêu Điểm / HOT</th>
                <th className="py-3 px-4">Trạng Thái</th>
                <th className="py-3 px-4">Ngày Đăng</th>
                <th className="py-3 px-4 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredArticles.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    Không có bài viết nào phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                filteredArticles.map((art) => (
                  <tr key={art.id} className="hover:bg-muted/30 transition-colors">
                    {/* Bài Viết */}
                    <td className="py-3 px-4 max-w-xs">
                      <div className="flex items-center gap-3">
                        <img
                          src={art.cover_url}
                          alt={art.title}
                          className="w-12 h-12 rounded-xl object-cover shrink-0 border border-border/60"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=100&q=80';
                          }}
                        />
                        <div className="space-y-0.5 overflow-hidden">
                          <div className="font-bold text-foreground truncate">{art.title}</div>
                          <div className="text-[11px] text-muted-foreground truncate font-mono">
                            /news/{art.slug}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Game Liên Kết */}
                    <td className="py-3 px-4">
                      {art.game_name ? (
                        <span className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary-light font-bold text-[11px] border border-primary/20 whitespace-nowrap">
                          {art.game_name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Giftcode Kèm */}
                    <td className="py-3 px-4">
                      {art.codes && art.codes.length > 0 ? (
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 font-mono font-bold text-[11px]">
                            {art.codes.length} mã
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>

                    {/* Lượt Xem */}
                    <td className="py-3 px-4 font-mono text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5" />
                        {art.views || 0}
                      </span>
                    </td>

                    {/* Tiêu Điểm / HOT */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleToggleFeatured(art)}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${
                            art.is_featured
                              ? 'bg-amber-500 text-black shadow-sm font-black'
                              : 'bg-muted text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          Ghim
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleHot(art)}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${
                            art.is_hot
                              ? 'bg-rose-500 text-white shadow-sm font-black'
                              : 'bg-muted text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          HOT
                        </button>
                      </div>
                    </td>

                    {/* Trạng Thái */}
                    <td className="py-3 px-4">
                      {art.status === 'PUBLISHED' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 font-bold text-[11px]">
                          <CheckCircle2 className="w-3 h-3" />
                          Xuất bản
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-400 font-bold text-[11px]">
                          <Clock className="w-3 h-3" />
                          Bản nháp
                        </span>
                      )}
                    </td>

                    {/* Ngày Đăng */}
                    <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                      {new Date(art.published_at).toLocaleDateString('vi-VN')}
                    </td>

                    {/* Thao Tác */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(art)}
                          className="p-1.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground cursor-pointer transition-all"
                          title="Chỉnh sửa bài viết"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteArticle(art.id, art.title)}
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 cursor-pointer transition-all"
                          title="Xóa bài viết"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Modal: AI Tự Động Viết Bài */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-xl bg-card border border-border/80 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center text-white shadow-md">
                  <Sparkles className="w-5 h-5 animate-spin" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-foreground">
                    ✨ AI Tự Động Viết Bài Chuẩn SEO
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Chọn game từ 486 game có sẵn, AI sẽ tự động sinh bài viết và nhúng mã code.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAiModalOpen(false)}
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step 1: Chọn Game */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Gamepad2 className="w-4 h-4 text-primary" />
                <span>1. Chọn Tựa Game</span>
              </label>
              <SearchableGameSelect
                games={games}
                selectedGameSlug={aiSelectedGame?.slug || ''}
                onSelectGame={(g) => setAiSelectedGame(g)}
                placeholder="Tìm tên game tiếng Việt / tiếng Anh..."
              />
            </div>

            {/* Step 2: Chọn Chủ Đề */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-primary" />
                <span>2. Chọn Chủ Đề Bài Viết</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  {
                    id: 'codes',
                    label: '🎁 Giftcode mới nhất & Cách nhập',
                    desc: 'Nhúng mã quà tặng hoạt động 100% kèm hướng dẫn',
                  },
                  {
                    id: 'update',
                    label: '🚀 Cập nhật phiên bản & Máy chủ',
                    desc: 'Thông báo update, bảo trì và sự kiện ra mắt',
                  },
                  {
                    id: 'guide',
                    label: '⚔️ Hướng dẫn tân thủ & Đội hình',
                    desc: 'Cẩm nang cày cấp, build tướng và bí kíp',
                  },
                  {
                    id: 'event',
                    label: '🏆 Sự kiện đua TOP & Ưu đãi',
                    desc: 'Phúc lợi sự kiện, mốc quà tặng hấp dẫn',
                  },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setAiTopicType(t.id as any)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      aiTopicType === t.id
                        ? 'border-primary bg-primary/10 shadow-sm'
                        : 'border-border/80 bg-muted/40 hover:bg-muted'
                    }`}
                  >
                    <div className="text-xs font-bold text-foreground">{t.label}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-border/60 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsAiModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={isGeneratingAi || !aiSelectedGame}
                onClick={handleRunAiGenerator}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 text-white font-bold text-xs shadow-lg hover:shadow-amber-500/25 transition-all disabled:opacity-50 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isGeneratingAi ? 'Đang tạo bài...' : 'Tạo Bài Viết Ngay'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Modal: Biên Tập / Tạo Mới Bài Viết */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in overflow-y-auto">
          <div className="relative w-full max-w-3xl bg-card border border-border/80 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-border/60">
              <div>
                <h3 className="text-lg font-black text-foreground">
                  {editingArticle.id ? 'Biên Tập Bài Viết' : 'Tạo Bài Viết Mới'}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Biên tập tiêu đề, ảnh bìa, mã code đính kèm và nội dung bài viết.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Fields */}
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              {/* Tiêu đề */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">Tiêu đề bài viết *</label>
                <input
                  type="text"
                  value={editingArticle.title || ''}
                  onChange={(e) => setEditingArticle({ ...editingArticle, title: e.target.value })}
                  placeholder="Ví dụ: Tổng Hợp Giftcode Delta Force Mới Nhất 2026..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-muted/60 border border-border/80 text-xs text-foreground outline-none focus:border-primary"
                />
              </div>

              {/* Game liên kết */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">Tựa Game liên kết</label>
                <SearchableGameSelect
                  games={games}
                  selectedGameSlug={editingArticle.game_slug || ''}
                  onSelectGame={(g) => {
                    setEditingArticle({
                      ...editingArticle,
                      game_id: g?.id,
                      game_slug: g?.slug,
                      game_name: g?.name,
                    });
                  }}
                  placeholder="Chọn game để hiển thị badge và liên kết..."
                  allowClear
                />
              </div>

              {/* URL Slug & Cover URL */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground">URL Slug</label>
                  <input
                    type="text"
                    value={editingArticle.slug || ''}
                    onChange={(e) => setEditingArticle({ ...editingArticle, slug: e.target.value })}
                    placeholder="delta-force-giftcode-2026"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-muted/60 border border-border/80 text-xs text-foreground font-mono outline-none focus:border-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground">Ảnh bìa URL</label>
                  <input
                    type="text"
                    value={editingArticle.cover_url || ''}
                    onChange={(e) =>
                      setEditingArticle({ ...editingArticle, cover_url: e.target.value })
                    }
                    placeholder="https://images.unsplash.com/..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-muted/60 border border-border/80 text-xs text-foreground outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Tóm tắt ngắn */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">Tóm tắt ngắn (Excerpt)</label>
                <textarea
                  rows={2}
                  value={editingArticle.excerpt || ''}
                  onChange={(e) =>
                    setEditingArticle({ ...editingArticle, excerpt: e.target.value })
                  }
                  placeholder="Mô tả ngắn hiển thị trên thẻ bài viết và meta SEO..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-muted/60 border border-border/80 text-xs text-foreground outline-none focus:border-primary resize-none"
                />
              </div>

              {/* Danh sách Giftcode đính kèm */}
              <div className="space-y-2 p-3.5 rounded-2xl bg-amber-500/5 border border-amber-500/20">
                <label className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <Gift className="w-4 h-4 text-amber-400" />
                  <span>Danh sách Giftcode đính kèm bài viết (Độc giả có thể copy 1 chạm)</span>
                </label>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={codeInputValue}
                    onChange={(e) => setCodeInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCodeToArticle();
                      }
                    }}
                    placeholder="Nhập mã code (Ví dụ: DELTA2026)..."
                    className="flex-1 px-3 py-2 rounded-xl bg-card border border-border/80 text-xs font-mono uppercase text-foreground outline-none focus:border-amber-400"
                  />
                  <button
                    type="button"
                    onClick={handleAddCodeToArticle}
                    className="px-3 py-2 rounded-xl bg-amber-500 text-black font-bold text-xs hover:bg-amber-400 transition-all cursor-pointer"
                  >
                    Thêm Code
                  </button>
                </div>

                {/* Code chips */}
                {editingArticle.codes && editingArticle.codes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {editingArticle.codes.map((c) => (
                      <span
                        key={c}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-card border border-amber-500/30 font-mono font-bold text-[11px] text-amber-300"
                      >
                        {c}
                        <button
                          type="button"
                          onClick={() => handleRemoveCodeFromArticle(c)}
                          className="text-muted-foreground hover:text-rose-400"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Tags & Read time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground">
                    Tags (Phân cách bằng dấu phẩy)
                  </label>
                  <input
                    type="text"
                    value={tagInputValue}
                    onChange={(e) => setTagInputValue(e.target.value)}
                    placeholder="Giftcode, HuongDan, DeltaForce"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-muted/60 border border-border/80 text-xs text-foreground outline-none focus:border-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground">Thời gian đọc (phút)</label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={editingArticle.read_time_minutes || 3}
                    onChange={(e) =>
                      setEditingArticle({
                        ...editingArticle,
                        read_time_minutes: Number(e.target.value) || 3,
                      })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-muted/60 border border-border/80 text-xs text-foreground outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Tùy chọn trạng thái & Ghim */}
              <div className="flex flex-wrap items-center gap-4 p-3 rounded-2xl bg-muted/40 border border-border/60">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-foreground">
                  <input
                    type="checkbox"
                    checked={editingArticle.is_featured || false}
                    onChange={(e) =>
                      setEditingArticle({ ...editingArticle, is_featured: e.target.checked })
                    }
                    className="rounded text-primary focus:ring-primary"
                  />
                  <span>Ghim Tiêu Điểm (Hero Banner)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-foreground">
                  <input
                    type="checkbox"
                    checked={editingArticle.is_hot || false}
                    onChange={(e) =>
                      setEditingArticle({ ...editingArticle, is_hot: e.target.checked })
                    }
                    className="rounded text-rose-500 focus:ring-rose-500"
                  />
                  <span>Gắn nhãn HOT</span>
                </label>

                <div className="ml-auto flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-semibold">Trạng thái:</span>
                  <select
                    value={editingArticle.status || 'PUBLISHED'}
                    onChange={(e) =>
                      setEditingArticle({
                        ...editingArticle,
                        status: e.target.value as 'PUBLISHED' | 'DRAFT',
                      })
                    }
                    className="px-2.5 py-1 rounded-lg bg-card border border-border/80 text-xs font-bold text-foreground outline-none"
                  >
                    <option value="PUBLISHED">Xuất bản ngay</option>
                    <option value="DRAFT">Lưu bản nháp</option>
                  </select>
                </div>
              </div>

              {/* Nội dung bài viết (Markdown) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground">
                    Nội dung bài viết * (Hỗ trợ định dạng Markdown)
                  </label>
                  <div className="text-[11px] text-muted-foreground font-mono">
                    {editingArticle.content?.length || 0} ký tự
                  </div>
                </div>

                <textarea
                  rows={14}
                  value={editingArticle.content || ''}
                  onChange={(e) =>
                    setEditingArticle({ ...editingArticle, content: e.target.value })
                  }
                  placeholder="## 1. Giới thiệu tổng quan..."
                  className="w-full p-3.5 rounded-2xl bg-muted/40 border border-border/80 text-xs text-foreground font-mono leading-relaxed outline-none focus:border-primary resize-y"
                />
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="pt-4 border-t border-border/60 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleSaveArticle}
                className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-primary text-white font-bold text-xs hover:bg-primary-dark transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Lưu & Xuất Bản</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
