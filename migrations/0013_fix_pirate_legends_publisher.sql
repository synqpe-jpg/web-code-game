-- Migration 0013: Update publisher of Pirate Legends to 'Neotrix'
-- Authoritative Publisher for International/Vietnamese release: Neotrix
UPDATE games 
SET publisher = 'Neotrix', 
    updated_at = datetime('now') 
WHERE slug = 'pirate-legends' OR id = 'pirate-legends';
