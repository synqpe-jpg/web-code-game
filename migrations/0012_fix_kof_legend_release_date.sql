-- ==============================================================================
-- Migration: 0012_fix_kof_legend_release_date.sql
-- Description: Cập nhật ngày ra mắt chính thức cho KOF: Legend (04/11/2026 SEA - JOYMAKER GAMES PTE. LTD)
-- ==============================================================================

UPDATE games 
SET release_date = '2026-11-04',
    updated_at = datetime('now')
WHERE slug = 'kof-legend';
