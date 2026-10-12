import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  Image,
  ImageIcon,
  TrendingUp,
  Bold,
  Heading2,
  Heading3,
  List,
  Quote,
  Upload,
  Check,
  Zap,
  ClipboardPaste,
  AlertCircle,
  Info,
} from 'lucide-react';
import { NewsArticle } from '../../types/game';
import { newsService } from '../../services/newsService';
import { adminDataService } from '../services/adminDataService';
import { dataService } from '../../services/dataService';
import { SearchableGameSelect } from '../components/ui/SearchableGameSelect';
import { GameAdminRecord } from '../types/adminTypes';
import { smartVietnameseMatch, normalizeVietnamese } from '../../utils/textUtils';
import { compressImageFile, optimizeImageUrl, formatBytes } from '../../utils/imageCompressor';

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
  const [galleryInputValue, setGalleryInputValue] = useState('');
  const [activeEditorTab, setActiveEditorTab] = useState<'edit' | 'preview'>('edit');
  const [isCompressingCover, setIsCompressingCover] = useState(false);
  const [isCompressingGallery, setIsCompressingGallery] = useState(false);
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const coverFileInputRef = useRef<HTMLInputElement>(null);
  const galleryFileInputRef = useRef<HTMLInputElement>(null);

  // AI Generator Modal state
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiMode, setAiMode] = useState<'rewrite' | 'template'>('rewrite');
  const [aiSelectedGame, setAiSelectedGame] = useState<GameAdminRecord | null>(null);
  const [aiTopicType, setAiTopicType] = useState<'codes' | 'update' | 'guide' | 'event'>('codes');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  // AI Rewrite from Link/Content state
  const [crawlUrlInput, setCrawlUrlInput] = useState('');
  const [crawlRawContent, setCrawlRawContent] = useState('');
  const [isCrawlingUrl, setIsCrawlingUrl] = useState(false);
  const [crawledData, setCrawledData] = useState<{
    title?: string;
    excerpt?: string;
    cover_url?: string;
    content?: string;
    codes?: string[];
    images?: string[];
  } | null>(null);

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
      cover_url: '',
      gallery_urls: [],
      virtual_views: 120,
      views_growth_rate: 1.0,
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
    setGalleryInputValue('');
    setActiveEditorTab('edit');
    setIsEditorOpen(true);
  };

  // Handle open edit article
  const handleOpenEdit = (article: NewsArticle) => {
    setEditingArticle({
      ...article,
      gallery_urls: article.gallery_urls || [],
      virtual_views: article.virtual_views !== undefined ? article.virtual_views : 0,
      views_growth_rate: article.views_growth_rate !== undefined ? article.views_growth_rate : 1.0,
    });
    setCodeInputValue('');
    setTagInputValue(article.tags?.join(', ') || '');
    setGalleryInputValue('');
    setActiveEditorTab('edit');
    setIsEditorOpen(true);
  };

  // Insert text at cursor position in content textarea
  const insertTextAtCursor = (textToInsert: string) => {
    const textarea = contentTextareaRef.current;
    const current = editingArticle.content || '';
    if (!textarea) {
      setEditingArticle({ ...editingArticle, content: current + '\n' + textToInsert });
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const nextContent = current.substring(0, start) + textToInsert + current.substring(end);
    setEditingArticle({ ...editingArticle, content: nextContent });
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + textToInsert.length, start + textToInsert.length);
    }, 0);
  };

  // Tải & Nén ảnh bìa từ máy tính
  const handleCoverFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      onShowToast('Định dạng không hợp lệ', 'Vui lòng chọn file hình ảnh (PNG, JPG, WebP)!', 'error');
      return;
    }

    setIsCompressingCover(true);
    try {
      const res = await compressImageFile(file, {
        maxWidth: 1400,
        maxHeight: 900,
        quality: 0.82,
        format: 'image/webp',
      });

      setEditingArticle((prev) => ({
        ...prev,
        cover_url: res.dataUrl,
      }));

      onShowToast(
        'Nén ảnh bìa thành công! ⚡',
        `Dung lượng: ${formatBytes(res.originalSize)} ➔ ${formatBytes(res.compressedSize)} (Giảm ${res.savedPercent}%, WebP siêu nhẹ)`,
        'success'
      );
    } catch (err: any) {
      onShowToast('Lỗi nén ảnh', err?.message || 'Không thể nén file ảnh', 'error');
    } finally {
      setIsCompressingCover(false);
      if (coverFileInputRef.current) coverFileInputRef.current.value = '';
    }
  };

  // Tải & Nén ảnh phụ/thư viện từ máy tính
  const handleGalleryFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      onShowToast('Định dạng không hợp lệ', 'Vui lòng chọn file hình ảnh!', 'error');
      return;
    }

    setIsCompressingGallery(true);
    try {
      const res = await compressImageFile(file, {
        maxWidth: 1200,
        maxHeight: 1200,
        quality: 0.80,
        format: 'image/webp',
      });

      const currentGallery = editingArticle.gallery_urls || [];
      setEditingArticle((prev) => ({
        ...prev,
        gallery_urls: [...currentGallery, res.dataUrl],
      }));

      onShowToast(
        'Đã nén & thêm ảnh vào bài! ⚡',
        `Dung lượng: ${formatBytes(res.originalSize)} ➔ ${formatBytes(res.compressedSize)} (Giảm ${res.savedPercent}%, WebP)`,
        'success'
      );
    } catch (err: any) {
      onShowToast('Lỗi nén ảnh', err?.message || 'Không thể nén file ảnh', 'error');
    } finally {
      setIsCompressingGallery(false);
      if (galleryFileInputRef.current) galleryFileInputRef.current.value = '';
    }
  };

  // Đặt ảnh trong thư viện làm ảnh bìa
  const handleSetGalleryAsCover = (url: string) => {
    setEditingArticle((prev) => ({ ...prev, cover_url: url }));
    onShowToast('Đã đổi ảnh bìa', 'Đã đặt hình ảnh này làm ảnh bìa chính của bài viết!', 'info');
  };

  // Add gallery image
  const handleAddGalleryImage = () => {
    const trimmed = galleryInputValue.trim();
    if (!trimmed) return;
    const optimized = optimizeImageUrl(trimmed, 1000);
    const currentList = editingArticle.gallery_urls || [];
    if (currentList.includes(optimized)) {
      onShowToast('Ảnh đã tồn tại', 'Hình ảnh này đã có trong bộ sưu tập!', 'info');
      return;
    }
    setEditingArticle({
      ...editingArticle,
      gallery_urls: [...currentList, optimized],
    });
    setGalleryInputValue('');
    onShowToast('Đã thêm ảnh', 'Đã tối ưu hóa và thêm ảnh vào bộ sưu tập.', 'success');
  };

  // Remove gallery image
  const handleRemoveGalleryImage = (urlToRemove: string) => {
    const currentList = editingArticle.gallery_urls || [];
    setEditingArticle({
      ...editingArticle,
      gallery_urls: currentList.filter((u) => u !== urlToRemove),
    });
  };

  // Insert image markdown into content
  const handleInsertGalleryImageIntoText = (url: string, caption?: string) => {
    const markdown = `\n\n![${caption || 'Ảnh minh họa'}](${url})\n\n`;
    insertTextAtCursor(markdown);
    onShowToast('Đã chèn ảnh', 'Đã chèn ảnh vào vị trí con trỏ trong bài viết!', 'success');
  };

  // Toolbar markdown action
  const handleToolbarAction = (type: 'bold' | 'h2' | 'h3' | 'list' | 'quote' | 'image') => {
    const textarea = contentTextareaRef.current;
    const start = textarea?.selectionStart || 0;
    const end = textarea?.selectionEnd || 0;
    const selected = (editingArticle.content || '').substring(start, end).trim();

    switch (type) {
      case 'bold': {
        const text = selected || prompt('Nhập nội dung cần in đậm:')?.trim() || '';
        if (text) insertTextAtCursor(`**${text}**`);
        break;
      }
      case 'h2': {
        const text = selected || prompt('Nhập tiêu đề mục lớn (H2):')?.trim() || '';
        if (text) insertTextAtCursor(`\n\n## ${text}\n\n`);
        break;
      }
      case 'h3': {
        const text = selected || prompt('Nhập tiêu đề mục nhỏ (H3):')?.trim() || '';
        if (text) insertTextAtCursor(`\n\n### ${text}\n\n`);
        break;
      }
      case 'list': {
        if (selected) {
          const listText = selected
            .split('\n')
            .map((l) => `- ${l.replace(/^[-*•]\s*/, '').trim()}`)
            .filter((l) => l.length > 2)
            .join('\n');
          insertTextAtCursor(`\n\n${listText}\n\n`);
        } else {
          const item = prompt('Nhập nội dung gạch đầu dòng:')?.trim() || '';
          if (item) insertTextAtCursor(`\n- ${item}\n`);
        }
        break;
      }
      case 'quote': {
        const text = selected || prompt('Nhập nội dung hộp lưu ý / mẹo:')?.trim() || '';
        if (text) insertTextAtCursor(`\n\n> 💡 **Lưu ý:** ${text}\n\n`);
        break;
      }
      case 'image': {
        const url = prompt('Nhập URL hình ảnh muốn chèn:');
        if (url?.trim()) {
          const cap = prompt('Nhập chú thích ảnh (tùy chọn):') || 'Ảnh minh họa';
          insertTextAtCursor(`\n\n![${cap.trim()}](${url.trim()})\n\n`);
        }
        break;
      }
    }
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
      gallery_urls: editingArticle.gallery_urls || [],
      virtual_views: Number(editingArticle.virtual_views) || 0,
      views_growth_rate: editingArticle.views_growth_rate !== undefined ? Number(editingArticle.views_growth_rate) : 1.0,
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
  const handleDeleteArticle = async (articleId: string, title: string) => {
    if (confirm(`Bạn có chắc muốn xóa vĩnh viễn bài viết "${title}"?`)) {
      await newsService.deleteArticle(articleId);
      setArticles(newsService.getAllArticles());
      onShowToast('Đã xóa vĩnh viễn', `Đã xóa bài viết "${title}"`, 'info');
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

  // AI Generator: Run draft generation (Chế độ 1: Theo game)
  const handleRunAiGenerator = () => {
    if (!aiSelectedGame) {
      onShowToast('Vui lòng chọn game', 'Hãy chọn tựa game bạn muốn AI viết bài!', 'error');
      return;
    }

    setIsGeneratingAi(true);

    try {
      // Find codes for this game safely from catalog
      let gameCodes: string[] = [];
      try {
        const found = dataService.getCodesForGame(aiSelectedGame as any);
        if (Array.isArray(found) && found.length > 0) {
          gameCodes = found.map((c) => c.code);
        } else {
          const adminFound = adminDataService.getFreeCodes({ gameSlug: aiSelectedGame.slug });
          if (Array.isArray(adminFound) && adminFound.length > 0) {
            gameCodes = adminFound.map((c) => c.code);
          }
        }
      } catch (err) {
        console.warn('Cannot fetch codes for game:', err);
      }

      const gameLogo =
        aiSelectedGame.cover_image_url ||
        aiSelectedGame.icon_url ||
        aiSelectedGame.bannerUrl ||
        (aiSelectedGame.slug ? `/game_icons/${aiSelectedGame.slug}.webp` : '');

      const draft = newsService.generateAiArticleDraft({
        game: {
          id: aiSelectedGame.id,
          name: aiSelectedGame.name,
          slug: aiSelectedGame.slug,
          cover_image_url: gameLogo,
          banner_url: gameLogo,
          icon_url: gameLogo,
        },
        topicType: aiTopicType,
        availableCodes: gameCodes,
      });

      const slug =
        draft.slug ||
        (draft.title || '')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[đĐ]/g, 'd')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');

      // Populate into editor
      setEditingArticle({ ...draft, slug });
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
      onShowToast('Lỗi AI Generator', err?.message || 'Có lỗi xảy ra', 'error');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // AI Generator: Bóc tách bài viết từ link URL
  const handleCrawlUrl = async () => {
    const url = crawlUrlInput.trim();
    if (!url || !url.startsWith('http')) {
      onShowToast('Link không hợp lệ', 'Vui lòng nhập đường link bài viết đầy đủ (bắt đầu bằng https://)', 'error');
      return;
    }

    setIsCrawlingUrl(true);
    try {
      const res = await fetch('/api/crawl-article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();
      if (!data.success) {
        onShowToast(
          data.isSocial ? 'Mẹo Facebook / Mạng xã hội' : 'Thông báo',
          data.error || 'Không thể cào link do trang web bảo mật. Bạn có thể dán trực tiếp nội dung bài báo vào ô dưới.',
          data.isSocial ? 'info' : 'error'
        );
        return;
      }

      setCrawledData(data);
      if (data.content) {
        setCrawlRawContent(data.content);
      }

      // Tự động tìm game phù hợp nhất từ tiêu đề bài viết
      if (data.title) {
        const normTitle = normalizeVietnamese(data.title);
        const candidates = games
          .map((g) => {
            const normName = normalizeVietnamese(g.name);
            let score = 0;
            if (normTitle.includes(normName)) {
              score = normName.length * 100;
            } else if (normTitle.includes(normalizeVietnamese(g.slug))) {
              score = normalizeVietnamese(g.slug).length * 80;
            }
            return { game: g, score };
          })
          .filter((c) => c.score > 0)
          .sort((a, b) => b.score - a.score);

        if (candidates.length > 0) {
          setAiSelectedGame(candidates[0].game);
        }
      }

      onShowToast(
        'Bóc tách thành công! ⚡',
        `Đã đọc nội dung bài viết | Tìm thấy ${data.codes?.length || 0} mã code | ${data.images?.length || 0} ảnh`,
        'success'
      );
    } catch (err: any) {
      onShowToast('Lỗi kết nối', 'Không thể kết nối máy chủ bóc tách. Bạn hãy dán trực tiếp nội dung bài báo vào ô.', 'error');
    } finally {
      setIsCrawlingUrl(false);
    }
  };

  // AI Generator: Dán nội dung trực tiếp từ bộ nhớ tạm Clipboard (cho Facebook/Mạng xã hội)
  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        const clean = text
          .replace(/[\u200B-\u200D\uFEFF\u200E\u200F\u00A0]/g, ' ')
          .replace(/[»«►◄▲▼■◆●★☆❖✓✔✕✖]/g, ' ')
          .trim();
        setCrawlRawContent(clean);

        // Auto-detect game if matches
        const norm = normalizeVietnamese(clean);
        const candidates = games
          .map((g) => {
            const normName = normalizeVietnamese(g.name);
            let score = 0;
            if (norm.includes(normName)) score = normName.length * 100;
            return { game: g, score };
          })
          .filter((c) => c.score > 0)
          .sort((a, b) => b.score - a.score);

        if (candidates.length > 0) {
          setAiSelectedGame(candidates[0].game);
        }

        onShowToast('Đã dán thành công 📋', `Đã nhận ${clean.length} ký tự từ bộ nhớ tạm!`, 'success');
      } else {
        onShowToast('Bộ nhớ tạm trống', 'Vui lòng sao chép bài viết trên Facebook trước khi dán.', 'info');
      }
    } catch {
      onShowToast('Thông báo', 'Trình duyệt chặn truy cập Clipboard, vui lòng nhấn Ctrl+V trực tiếp vào ô.', 'info');
    }
  };

  // AI Generator: Viết lại bài viết từ nội dung / link bài báo
  const handleRunAiRewrite = () => {
    const rawText = crawlRawContent.trim();
    if (!rawText) {
      onShowToast('Thiếu nội dung', 'Vui lòng nhập link bài viết và bấm "Quét Link", hoặc dán nội dung bài báo vào ô.', 'error');
      return;
    }

    setIsGeneratingAi(true);
    try {
      const rewritten = newsService.rewriteArticleWithAi({
        rawTitle: crawledData?.title,
        rawContent: rawText,
        sourceUrl: crawlUrlInput.trim(),
        game: aiSelectedGame
          ? {
              id: aiSelectedGame.id,
              name: aiSelectedGame.name,
              slug: aiSelectedGame.slug,
              banner_url: aiSelectedGame.bannerUrl,
              icon_url: aiSelectedGame.iconUrl,
            }
          : null,
        foundCodes: crawledData?.codes || [],
        foundImages: crawledData?.images || [],
      });

      const slug =
        rewritten.slug ||
        (rewritten.title || '')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[đĐ]/g, 'd')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');

      // Populate into editor
      setEditingArticle({ ...rewritten, slug });
      setCodeInputValue('');
      setTagInputValue(rewritten.tags?.join(', ') || '');
      setIsAiModalOpen(false);
      setIsEditorOpen(true);

      onShowToast(
        'AI Viết lại thành công! ✨',
        `Đã tạo bài viết độc quyền chuẩn SEO và bóc tách ${rewritten.codes?.length || 0} mã code.`,
        'success'
      );
    } catch (err: any) {
      onShowToast('Lỗi viết lại', err?.message || 'Có lỗi xảy ra khi viết lại bài', 'error');
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
              setAiSelectedGame(null);
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
                      <div className="flex flex-col gap-0.5">
                        <span className="flex items-center gap-1 font-bold text-foreground">
                          <Eye className="w-3.5 h-3.5 text-primary" />
                          {newsService.getDisplayViews(art)}
                        </span>
                        {(art.virtual_views !== undefined || art.views_growth_rate !== undefined) && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <TrendingUp className="w-2.5 h-2.5 text-emerald-400" />
                            Gốc: {art.virtual_views || 0} ({art.views_growth_rate ?? 1}x)
                          </span>
                        )}
                      </div>
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

      {/* 5. Modal: AI Tự Động Viết Bài & Viết Lại Từ Link */}
      {isAiModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fade-in">
            <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5 text-slate-100 max-h-[92vh] overflow-y-auto custom-scrollbar">
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center text-white shadow-md">
                    <Sparkles className="w-5 h-5 animate-spin" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white">
                      ✨ AI Tự Động Sáng Tạo Nội Dung
                    </h3>
                    <p className="text-xs text-slate-400">
                      Tự động viết bài chuẩn SEO hoặc bóc tách và viết lại độc quyền từ link bài báo (Miễn phí 100%).
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAiModalOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Mode Switch Tabs */}
              <div className="grid grid-cols-2 p-1 rounded-2xl bg-slate-800 border border-slate-700 shadow-inner">
                <button
                  type="button"
                  onClick={() => setAiMode('rewrite')}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    aiMode === 'rewrite'
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Globe className="w-4 h-4" />
                  <span>🔗 Viết Lại Từ Link Bài Báo</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAiMode('template');
                    if (!aiSelectedGame) setAiSelectedGame(games[0] || null);
                  }}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    aiMode === 'template'
                      ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>⚡ Tạo Theo Tựa Game Có Sẵn</span>
                </button>
              </div>

              {/* MODE 1: REWRITE TỪ LINK HOẶC NỘI DUNG GỐC */}
              {aiMode === 'rewrite' && (
                <div className="space-y-4 animate-fade-in">
                  {/* Nhập link bài viết */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-200 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Globe className="w-4 h-4 text-indigo-400" />
                        <span>1. Link bài viết nguồn (Báo chí, GameK, Sforum, Fanpage...)</span>
                      </span>
                      <span className="text-[11px] text-indigo-400">Tự động cào & quét code</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={crawlUrlInput}
                        onChange={(e) => setCrawlUrlInput(e.target.value)}
                        placeholder="Dán link bài viết (Thegioididong, Sforum, Kenh14...)..."
                        className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 text-xs text-white outline-none focus:border-indigo-500 font-mono"
                      />
                      <button
                        type="button"
                        disabled={isCrawlingUrl}
                        onClick={handleCrawlUrl}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50 cursor-pointer whitespace-nowrap"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isCrawlingUrl ? 'animate-spin' : ''}`} />
                        <span>{isCrawlingUrl ? 'Đang quét...' : '⚡ Quét Link'}</span>
                      </button>
                    </div>

                    {/* Social Media Hint */}
                    {/facebook\.com|fb\.com|fb\.watch|instagram\.com|tiktok\.com|threads\.net|twitter\.com|x\.com/i.test(crawlUrlInput) && (
                      <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-200 mt-2">
                        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <p className="font-bold text-amber-300">💡 Lưu ý bài viết từ Facebook / Mạng xã hội:</p>
                          <p className="text-[11px] text-slate-300 leading-relaxed">
                            Facebook yêu cầu đăng nhập tài khoản nên máy chủ bị chặn quét link trực tiếp. Để viết bài nhanh nhất: Bạn chỉ cần <b>Copy (sao chép) bài viết trên Facebook</b> rồi bấm nút <b>"📋 Dán Từ Clipboard"</b> ở mục số 2 bên dưới ➔ AI sẽ viết lại bài và lọc mã code ngay lập tức!
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Thông tin quét được nếu có */}
                  {crawledData && (
                    <div className="p-3 rounded-2xl bg-indigo-950/40 border border-indigo-700/50 space-y-1.5 text-xs">
                      <div className="font-bold text-indigo-300 truncate">
                        📰 {crawledData.title || 'Đã đọc nội dung thành công'}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold font-mono">
                          🎁 {crawledData.codes?.length || 0} mã code tìm thấy
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-bold">
                          🖼️ {crawledData.images?.length || 0} ảnh trích xuất
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Nội dung bài viết thô (có thể paste trực tiếp) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-indigo-400" />
                        <span>2. Nội dung bài viết gốc (Dán bài Facebook/Web vào)</span>
                      </label>
                      <button
                        type="button"
                        onClick={handlePasteFromClipboard}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 text-[11px] font-bold transition-all cursor-pointer shadow-sm active:scale-95"
                        title="Dán nhanh văn bản đã sao chép từ Facebook hoặc trang web"
                      >
                        <ClipboardPaste className="w-3.5 h-3.5 text-indigo-300" />
                        <span>📋 Dán Từ Clipboard</span>
                      </button>
                    </div>
                    <textarea
                      rows={5}
                      value={crawlRawContent}
                      onChange={(e) => setCrawlRawContent(e.target.value)}
                      placeholder="Dán nội dung bài báo, bài viết Facebook hoặc thông báo game vào đây..."
                      className="w-full p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-white font-mono leading-relaxed outline-none focus:border-indigo-500 resize-y"
                    />
                    {crawlRawContent.length > 0 && (
                      <div className="flex justify-between items-center text-[10px] text-slate-400 px-1">
                        <span>Độ dài: {crawlRawContent.length} ký tự</span>
                        <button
                          type="button"
                          onClick={() => setCrawlRawContent('')}
                          className="text-rose-400 hover:underline cursor-pointer"
                        >
                          Xóa nội dung
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Chọn Game liên kết */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <Gamepad2 className="w-4 h-4 text-indigo-400" />
                      <span>3. Tựa Game liên kết (Gắn nhãn và huy hiệu game)</span>
                    </label>
                    <SearchableGameSelect
                      games={games}
                      selectedGameSlug={aiSelectedGame?.slug || ''}
                      onSelectGame={(g) => setAiSelectedGame(g)}
                      placeholder="Tìm tên game tiếng Việt / tiếng Anh..."
                      allowClear
                    />
                  </div>

                  {/* Action buttons */}
                  <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setIsAiModalOpen(false)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="button"
                      disabled={isGeneratingAi || !crawlRawContent.trim()}
                      onClick={handleRunAiRewrite}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white font-black text-xs shadow-lg hover:shadow-indigo-500/25 transition-all disabled:opacity-50 cursor-pointer active:scale-95"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>{isGeneratingAi ? 'Đang viết lại...' : '✨ AI Viết Lại Bài Viết Ngay'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* MODE 2: TẠO BÀI THEO TỰA GAME CÓ SẴN */}
              {aiMode === 'template' && (
                <div className="space-y-4 animate-fade-in">
                  {/* Step 1: Chọn Game */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <Gamepad2 className="w-4 h-4 text-amber-400" />
                      <span>1. Chọn Tựa Game Trong Danh Sách</span>
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
                    <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-amber-400" />
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
                              ? 'border-amber-500 bg-amber-500/15 shadow-sm'
                              : 'border-slate-800 bg-slate-800/40 hover:bg-slate-800'
                          }`}
                        >
                          <div className="text-xs font-bold text-white">{t.label}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{t.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setIsAiModalOpen(false)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
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
              )}
            </div>
          </div>,
          document.body
        )}

      {/* 6. Modal: Biên Tập / Tạo Mới Bài Viết (Portal ra document.body chống bị đè sidebar & layout 2 cột tối ưu) */}
      {isEditorOpen &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 md:p-6 bg-black/85 backdrop-blur-md animate-fade-in">
            {/* Hidden file inputs for auto-compression upload */}
            <input
              type="file"
              ref={coverFileInputRef}
              onChange={handleCoverFileUpload}
              accept="image/*"
              className="hidden"
            />
            <input
              type="file"
              ref={galleryFileInputRef}
              onChange={handleGalleryFileUpload}
              accept="image/*"
              className="hidden"
            />

            <div className="relative w-full max-w-6xl h-[92vh] max-h-[890px] bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
              {/* Header: Cố định trên cùng */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0 bg-slate-900/95">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
                    <Newspaper className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-white">
                      {editingArticle.id ? 'Biên Tập Bài Viết' : 'Tạo Bài Viết Mới'}
                    </h3>
                    <p className="text-[11px] text-slate-400 hidden sm:block">
                      Tự động nén WebP siêu nhẹ, cài đặt số lượt xem & hệ số tăng trưởng, soạn thảo markdown.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
                  title="Đóng (Hủy bỏ)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body: 2 Cột (Cột Trái 5 / Cột Phải 7) */}
              <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
                {/* CỘT TRÁI: Thông tin, Ảnh, Views & Cấu hình (Cuộn độc lập) */}
                <div className="lg:col-span-5 h-full overflow-y-auto p-4 sm:p-5 space-y-4 border-b lg:border-b-0 lg:border-r border-slate-800 custom-scrollbar">
                  {/* Tiêu đề */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-200">Tiêu đề bài viết *</label>
                    <input
                      type="text"
                      value={editingArticle.title || ''}
                      onChange={(e) => {
                        const newTitle = e.target.value;
                        const autoSlug = newTitle
                          .toLowerCase()
                          .normalize('NFD')
                          .replace(/[\u0300-\u036f]/g, '')
                          .replace(/[đĐ]/g, 'd')
                          .replace(/[^a-z0-9]+/g, '-')
                          .replace(/^-+|-+$/g, '');
                        setEditingArticle({
                          ...editingArticle,
                          title: newTitle,
                          slug: editingArticle.slug && editingArticle.id ? editingArticle.slug : autoSlug,
                        });
                      }}
                      placeholder="Nhập tiêu đề bài viết chuẩn SEO..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-white outline-none focus:border-indigo-500 font-medium"
                    />
                  </div>

                  {/* Game liên kết */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-200">Tựa Game liên kết</label>
                    <SearchableGameSelect
                      games={games}
                      selectedGameSlug={editingArticle.game_slug || ''}
                      onSelectGame={(g) => {
                        const gameLogo = g ? (g.cover_image_url || g.icon_url || (g.slug ? `/game_icons/${g.slug}.webp` : '')) : '';
                        const isDefaultOrEmptyCover = !editingArticle.cover_url || editingArticle.cover_url.includes('images.unsplash.com');
                        setEditingArticle({
                          ...editingArticle,
                          game_id: g?.id,
                          game_slug: g?.slug,
                          game_name: g?.name,
                          cover_url: gameLogo || editingArticle.cover_url || '',
                          slug: (!editingArticle.slug || editingArticle.slug.startsWith('tin-tuc-game-')) && g?.slug
                            ? `${g.slug}-2026`
                            : editingArticle.slug,
                        });
                      }}
                      placeholder="Chọn game để gắn nhãn & đồng bộ..."
                      allowClear
                    />
                  </div>

                  {/* URL Slug */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-200">URL Slug</label>
                    <input
                      type="text"
                      value={editingArticle.slug || ''}
                      onChange={(e) =>
                        setEditingArticle({ ...editingArticle, slug: e.target.value })
                      }
                      placeholder="duong-dan-bai-viet-chuan-seo"
                      className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-white font-mono outline-none focus:border-indigo-500"
                    />
                  </div>

                  {/* Ảnh bìa chính (Cover URL) kèm nút Nén tự động & Nút Dùng logo game */}
                  <div className="p-3.5 rounded-2xl bg-slate-800/50 border border-slate-700/80 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                        <Image className="w-4 h-4 text-indigo-400" />
                        <span>Ảnh bìa chính (Cover Banner)</span>
                      </label>
                      <div className="flex items-center gap-2">
                        {editingArticle.game_slug && (
                          <button
                            type="button"
                            onClick={() => {
                              const foundGame = games.find((g) => g.slug === editingArticle.game_slug || g.id === editingArticle.game_slug);
                              const gameLogo = foundGame?.cover_image_url || foundGame?.icon_url || `/game_icons/${editingArticle.game_slug}.webp`;
                              setEditingArticle({ ...editingArticle, cover_url: gameLogo });
                              onShowToast('Đã đổi ảnh bìa', 'Đã đặt logo của tựa game làm ảnh bìa chính!', 'success');
                            }}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30 text-[11px] font-bold cursor-pointer transition-all"
                            title="Đặt logo của tựa game liên kết làm ảnh bìa chính"
                          >
                            <Gamepad2 className="w-3 h-3" />
                            <span>🎮 Dùng Logo Game</span>
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={isCompressingCover}
                          onClick={() => coverFileInputRef.current?.click()}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 text-[11px] font-bold cursor-pointer disabled:opacity-50 transition-all"
                          title="Chọn ảnh từ máy tính (Tự động nén WebP siêu nhẹ)"
                        >
                          <Upload className="w-3 h-3" />
                          <span>{isCompressingCover ? 'Đang nén...' : '📁 Tải ảnh từ máy'}</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={editingArticle.cover_url || ''}
                        onChange={(e) =>
                          setEditingArticle({
                            ...editingArticle,
                            cover_url: optimizeImageUrl(e.target.value, 1200),
                          })
                        }
                        placeholder={editingArticle.game_slug ? `Mặc định: /game_icons/${editingArticle.game_slug}.webp (Logo game)` : 'https://... hoặc tải ảnh từ máy tính'}
                        className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white outline-none focus:border-indigo-500 font-mono"
                      />
                      {editingArticle.cover_url && (
                        <div className="relative w-12 h-9 rounded-lg overflow-hidden border border-slate-600 shrink-0 bg-black/40">
                          <img
                            src={editingArticle.cover_url}
                            alt="Cover"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* THƯ VIỆN HÌNH ẢNH (Ảnh Minh Họa / Phụ) KÈM NÉN TỰ ĐỘNG */}
                  <div className="p-3.5 rounded-2xl bg-slate-800/50 border border-slate-700/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                        <ImageIcon className="w-4 h-4 text-emerald-400" />
                        <span>Thư Viện Ảnh Bổ Sung ({editingArticle.gallery_urls?.length || 0})</span>
                      </label>
                      <button
                        type="button"
                        disabled={isCompressingGallery}
                        onClick={() => galleryFileInputRef.current?.click()}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 text-[11px] font-bold cursor-pointer disabled:opacity-50 transition-all"
                        title="Tải ảnh từ máy (Tự động nén WebP giảm 90% dung lượng)"
                      >
                        <Upload className="w-3 h-3" />
                        <span>{isCompressingGallery ? 'Đang nén...' : '📁 Tải ảnh & Nén'}</span>
                      </button>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={galleryInputValue}
                        onChange={(e) => setGalleryInputValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddGalleryImage();
                          }
                        }}
                        placeholder="Dán link ảnh (https://...)..."
                        className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white outline-none focus:border-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={handleAddGalleryImage}
                        className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all cursor-pointer whitespace-nowrap"
                      >
                        + Thêm Link
                      </button>
                    </div>

                    {/* Danh sách ảnh trong Gallery */}
                    {editingArticle.gallery_urls && editingArticle.gallery_urls.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2 pt-1 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                        {editingArticle.gallery_urls.map((imgUrl, idx) => (
                          <div
                            key={idx}
                            className="relative group rounded-xl overflow-hidden border border-slate-700 bg-slate-900 p-1.5 flex flex-col gap-1.5 shadow-sm"
                          >
                            <div className="aspect-video w-full rounded-lg overflow-hidden bg-black/40">
                              <img
                                src={imgUrl}
                                alt={`Gallery ${idx + 1}`}
                                className="w-full h-full object-cover"
                                loading="lazy"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src =
                                    'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=300&q=80';
                                }}
                              />
                            </div>
                            <div className="flex items-center justify-between gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  handleInsertGalleryImageIntoText(imgUrl, `Ảnh minh họa ${idx + 1}`)
                                }
                                className="flex-1 px-1.5 py-1 rounded-md bg-indigo-500/20 hover:bg-indigo-600 text-indigo-300 hover:text-white font-bold text-[10px] transition-all cursor-pointer truncate"
                                title="Chèn ảnh này vào vị trí con trỏ trong bài viết"
                              >
                                📥 Chèn vào bài
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSetGalleryAsCover(imgUrl)}
                                className="px-1.5 py-1 rounded-md bg-amber-500/20 hover:bg-amber-600 text-amber-300 hover:text-white font-bold text-[10px] transition-all cursor-pointer"
                                title="Đặt ảnh này làm ảnh bìa chính"
                              >
                                Làm bìa
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveGalleryImage(imgUrl)}
                                className="p-1 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-500/20 transition-all cursor-pointer"
                                title="Xóa ảnh khỏi thư viện"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400 italic">
                        Chưa có ảnh phụ nào. Bấm <b>📁 Tải ảnh & Nén</b> từ máy tính hoặc dán link ảnh để độc giả chiêm ngưỡng.
                      </p>
                    )}
                  </div>

                  {/* CÀI ĐẶT LƯỢT XEM & TĂNG TRƯỞNG */}
                  <div className="p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-700/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                        <TrendingUp className="w-4 h-4 text-indigo-400" />
                        <span>Cài Đặt Lượt Xem & Tăng Trưởng</span>
                      </label>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono font-bold">
                        ~{newsService.getDisplayViews(editingArticle)} views hiện tại
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                          <Eye className="w-3 h-3 text-slate-400" />
                          <span>Lượt xem ban đầu (Cơ sở)</span>
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={10}
                          value={
                            editingArticle.virtual_views !== undefined
                              ? editingArticle.virtual_views
                              : 120
                          }
                          onChange={(e) =>
                            setEditingArticle({
                              ...editingArticle,
                              virtual_views: Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                          placeholder="Ví dụ: 150"
                          className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono font-bold text-white outline-none focus:border-indigo-400"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                          <TrendingUp className="w-3 h-3 text-slate-400" />
                          <span>Hệ số tăng trưởng / giờ</span>
                        </label>
                        <select
                          value={
                            editingArticle.views_growth_rate !== undefined
                              ? editingArticle.views_growth_rate
                              : 1.0
                          }
                          onChange={(e) =>
                            setEditingArticle({
                              ...editingArticle,
                              views_growth_rate: Number(e.target.value),
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-bold text-white outline-none focus:border-indigo-400"
                        >
                          <option value={0}>0x (Tắt tự tăng)</option>
                          <option value={0.5}>0.5x (Chậm ~3 lượt/giờ)</option>
                          <option value={1.0}>1.0x (Chuẩn ~6 lượt/giờ)</option>
                          <option value={1.5}>1.5x (Khá nhanh ~9 lượt/giờ)</option>
                          <option value={2.0}>2.0x (Nhanh ~12 lượt/giờ)</option>
                          <option value={3.0}>3.0x (Rất nhanh ~18 lượt/giờ)</option>
                        </select>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      💡 Lượt xem tự động tăng theo thời gian trôi qua, hoàn toàn tự nhiên và không gây lag web.
                    </p>
                  </div>

                  {/* Tóm tắt ngắn (Excerpt) */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-200">Tóm tắt ngắn (Excerpt)</label>
                    <textarea
                      rows={2}
                      value={editingArticle.excerpt || ''}
                      onChange={(e) =>
                        setEditingArticle({ ...editingArticle, excerpt: e.target.value })
                      }
                      placeholder="Mô tả ngắn hiển thị trên thẻ bài viết và meta SEO..."
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-white outline-none focus:border-indigo-500 resize-none"
                    />
                  </div>

                  {/* Danh sách Giftcode đính kèm */}
                  <div className="space-y-2 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25">
                    <label className="text-xs font-bold text-amber-300 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Gift className="w-4 h-4 text-amber-400" />
                        <span>Giftcode đính kèm</span>
                      </span>
                      <span className="text-[10px] text-slate-400">Copy 1 chạm</span>
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
                        className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono uppercase text-white outline-none focus:border-amber-400"
                      />
                      <button
                        type="button"
                        onClick={handleAddCodeToArticle}
                        className="px-3 py-2 rounded-xl bg-amber-500 text-black font-bold text-xs hover:bg-amber-400 transition-all cursor-pointer whitespace-nowrap"
                      >
                        Thêm Code
                      </button>
                    </div>

                    {editingArticle.codes && editingArticle.codes.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {editingArticle.codes.map((c) => (
                          <span
                            key={c}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-amber-500/40 font-mono font-bold text-[11px] text-amber-300"
                          >
                            {c}
                            <button
                              type="button"
                              onClick={() => handleRemoveCodeFromArticle(c)}
                              className="text-slate-400 hover:text-rose-400 cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Tags & Thời gian đọc */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-200">Tags (phẩy)</label>
                      <input
                        type="text"
                        value={tagInputValue}
                        onChange={(e) => setTagInputValue(e.target.value)}
                        placeholder="Giftcode, HuongDan..."
                        className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-white outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-200">Thời gian đọc (phút)</label>
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
                        className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-white outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Trạng thái & Ghim */}
                  <div className="flex flex-wrap items-center gap-3 p-3 rounded-2xl bg-slate-800/50 border border-slate-700/60">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-200">
                      <input
                        type="checkbox"
                        checked={editingArticle.is_featured || false}
                        onChange={(e) =>
                          setEditingArticle({
                            ...editingArticle,
                            is_featured: e.target.checked,
                          })
                        }
                        className="rounded text-indigo-500 focus:ring-indigo-500"
                      />
                      <span>Ghim Tiêu Điểm</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-200">
                      <input
                        type="checkbox"
                        checked={editingArticle.is_hot || false}
                        onChange={(e) =>
                          setEditingArticle({ ...editingArticle, is_hot: e.target.checked })
                        }
                        className="rounded text-rose-500 focus:ring-rose-500"
                      />
                      <span>HOT</span>
                    </label>

                    <div className="ml-auto flex items-center gap-2">
                      <select
                        value={editingArticle.status || 'PUBLISHED'}
                        onChange={(e) =>
                          setEditingArticle({
                            ...editingArticle,
                            status: e.target.value as 'PUBLISHED' | 'DRAFT',
                          })
                        }
                        className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs font-bold text-white outline-none cursor-pointer"
                      >
                        <option value="PUBLISHED">Xuất bản</option>
                        <option value="DRAFT">Bản nháp</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* CỘT PHẢI: Khung Soạn Thảo & Xem Trước Live Preview */}
                <div className="lg:col-span-7 h-full flex flex-col p-4 sm:p-5 min-h-0 bg-slate-950/40">
                  {/* Header Cột Phải & Toolbar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800 shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-white uppercase tracking-wider">
                        Nội Dung Bài Viết
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        ({editingArticle.content?.length || 0} ký tự)
                      </span>
                    </div>

                    {/* Tab Switch: Soạn Thảo vs Xem Trước */}
                    <div className="inline-flex p-1 rounded-xl bg-slate-800 border border-slate-700 shadow-inner">
                      <button
                        type="button"
                        onClick={() => setActiveEditorTab('edit')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          activeEditorTab === 'edit'
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        ✏️ Soạn Thảo
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveEditorTab('preview')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          activeEditorTab === 'preview'
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        👁️ Xem Trước
                      </button>
                    </div>
                  </div>

                  {/* Toolbar các nút định dạng nhanh khi ở Tab Soạn Thảo */}
                  {activeEditorTab === 'edit' && (
                    <div className="flex flex-wrap items-center gap-1.5 py-2.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToolbarAction('bold')}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                        title="In đậm chữ (**text**)"
                      >
                        <Bold className="w-3.5 h-3.5" />
                        <span>Đậm</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToolbarAction('h2')}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                        title="Tiêu đề mục lớn (## Title)"
                      >
                        <Heading2 className="w-3.5 h-3.5" />
                        <span>H2</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToolbarAction('h3')}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                        title="Tiêu đề mục nhỏ (### Subtitle)"
                      >
                        <Heading3 className="w-3.5 h-3.5" />
                        <span>H3</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToolbarAction('list')}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                        title="Danh sách gạch đầu dòng (- Item)"
                      >
                        <List className="w-3.5 h-3.5" />
                        <span>Danh sách</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToolbarAction('quote')}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                        title="Hộp lưu ý/mẹo (> 💡 Tip)"
                      >
                        <Quote className="w-3.5 h-3.5" />
                        <span>Lưu ý</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToolbarAction('image')}
                        className="px-2.5 py-1 rounded-lg bg-indigo-500/20 border border-indigo-500/40 hover:bg-indigo-500/30 text-indigo-300 text-xs font-bold flex items-center gap-1 cursor-pointer ml-auto"
                        title="Chèn ảnh theo link (![Alt](URL))"
                      >
                        <Image className="w-3.5 h-3.5" />
                        <span>🖼️ Chèn link ảnh</span>
                      </button>
                    </div>
                  )}

                  {/* Khu Vực Soạn Thảo hoặc Live Preview */}
                  <div className="flex-1 min-h-0 relative flex flex-col pt-1">
                    {activeEditorTab === 'edit' ? (
                      <div className="flex-1 min-h-0 flex flex-col">
                        <textarea
                          ref={contentTextareaRef}
                          value={editingArticle.content || ''}
                          onChange={(e) =>
                            setEditingArticle({ ...editingArticle, content: e.target.value })
                          }
                          placeholder="## 1. Giới thiệu tổng quan...&#10;&#10;Dán nội dung hoặc chọn ảnh từ cột trái bấm '📥 Chèn vào bài' để đặt ảnh giữa bài viết..."
                          className="flex-1 min-h-[300px] w-full p-4 rounded-2xl bg-slate-900 border border-slate-700 text-xs text-slate-100 font-mono leading-relaxed outline-none focus:border-indigo-500 resize-none overflow-y-auto"
                        />
                        <div className="pt-2 text-[11px] text-slate-400 flex items-center justify-between">
                          <span>
                            💡 Để chèn ảnh giữa các đoạn: Bấm <b>📥 Chèn vào bài</b> ở cột trái hoặc dùng nút <b>🖼️ Chèn link ảnh</b>.
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 min-h-[300px] w-full p-5 rounded-2xl bg-slate-900 border border-slate-700 overflow-y-auto space-y-3.5 text-xs text-slate-200 leading-relaxed custom-scrollbar">
                        {editingArticle.cover_url && (
                          <div className="mb-4 rounded-2xl overflow-hidden border border-slate-700 bg-black/40">
                            <img
                              src={editingArticle.cover_url}
                              alt="Cover"
                              className="w-full max-h-56 object-cover"
                              loading="lazy"
                            />
                          </div>
                        )}
                        <h2 className="text-base sm:text-lg font-black text-white">
                          {editingArticle.title || 'Chưa có tiêu đề'}
                        </h2>
                        {editingArticle.excerpt && (
                          <p className="text-xs text-slate-400 italic border-l-2 border-indigo-500 pl-3 py-1 bg-slate-800/40 rounded-r-lg">
                            {editingArticle.excerpt}
                          </p>
                        )}
                        <div className="space-y-3 pt-2">
                          {(editingArticle.content || 'Chưa có nội dung...').split('\n\n').map((block, idx) => {
                            const trimmed = block.trim();
                            if (!trimmed) return null;
                            if (trimmed.startsWith('## ')) {
                              return (
                                <h3
                                  key={idx}
                                  className="text-sm font-black text-white pt-2 border-b border-slate-800 pb-1"
                                >
                                  {trimmed.replace(/^##\s+/, '')}
                                </h3>
                              );
                            }
                            if (trimmed.startsWith('### ')) {
                              return (
                                <h4
                                  key={idx}
                                  className="text-xs font-bold text-indigo-400 pt-1"
                                >
                                  {trimmed.replace(/^###\s+/, '')}
                                </h4>
                              );
                            }
                            if (trimmed.startsWith('> ')) {
                              return (
                                <blockquote
                                  key={idx}
                                  className="p-3 rounded-xl bg-amber-500/10 border-l-4 border-amber-400 text-amber-200 text-xs"
                                >
                                  {trimmed.replace(/^>\s+/, '')}
                                </blockquote>
                              );
                            }
                            const imgMatch = trimmed.match(/^!\[(.*?)\]\((.*?)\)$/);
                            if (imgMatch) {
                              return (
                                <figure key={idx} className="my-3 text-center">
                                  <img
                                    src={imgMatch[2]}
                                    alt={imgMatch[1]}
                                    className="w-full max-h-72 object-cover rounded-xl border border-slate-700 shadow-md mx-auto"
                                    loading="lazy"
                                  />
                                  {imgMatch[1] && (
                                    <figcaption className="text-[11px] text-slate-400 italic mt-1">
                                      {imgMatch[1]}
                                    </figcaption>
                                  )}
                                </figure>
                              );
                            }
                            return (
                              <p key={idx} className="text-xs text-slate-300 leading-relaxed">
                                {trimmed}
                              </p>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer: Cố định dưới đáy */}
              <div className="px-5 py-3.5 border-t border-slate-800 shrink-0 bg-slate-900/95 flex items-center justify-between">
                <div className="text-[11px] text-slate-400 hidden sm:flex items-center gap-2">
                  <span className="font-mono">/news/{editingArticle.slug || 'slug'}</span>
                  <span>•</span>
                  <span
                    className={
                      editingArticle.status === 'PUBLISHED'
                        ? 'text-emerald-400 font-bold'
                        : 'text-amber-400 font-bold'
                    }
                  >
                    {editingArticle.status === 'PUBLISHED' ? 'Xuất bản công khai' : 'Lưu bản nháp'}
                  </span>
                </div>

                <div className="flex items-center gap-3 ml-auto">
                  <button
                    type="button"
                    onClick={() => setIsEditorOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveArticle}
                    className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs transition-all shadow-md active:scale-95 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>Lưu & Xuất Bản</span>
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
