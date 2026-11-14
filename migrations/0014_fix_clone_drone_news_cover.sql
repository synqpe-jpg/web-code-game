-- Migration 0014: Fix Clone Drone in the Danger Zone news cover URL from PNG to WebP
-- Applies to system_settings wcg_news_articles_v1
UPDATE system_settings
SET value = REPLACE(value, '/game_icons/clone-drone-in-the-danger-zone.png', '/game_icons/clone-drone-in-the-danger-zone.webp'),
    updated_at = datetime('now')
WHERE key = 'wcg_news_articles_v1' AND value LIKE '%clone-drone-in-the-danger-zone.png%';
