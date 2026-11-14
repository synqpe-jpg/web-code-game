-- Migration 0015: Dọn dẹp bản ghi icon cũ của idle-cat-gunner trong uploaded_game_icons
-- Giúp Cloudflare Worker chuyển sang phục vụ bản nén tĩnh tối ưu 24.4 KiB từ Edge Assets
DELETE FROM uploaded_game_icons WHERE slug IN ('idle-cat-gunner', 'idle-cat-gunner.webp', 'idle-cat-gunner-thumb', 'idle-cat-gunner-thumb-256');
