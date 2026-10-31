/**
 * Pre-build audit script: Audit all News covers on disk
 * Prevents broken cover images from ever being deployed to production.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

function auditFile(filePath, desc) {
  if (!fs.existsSync(filePath)) {
    console.warn(`[Audit News Covers] Warning: ${desc} not found at ${filePath}`);
    return [];
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  let data;
  try {
    data = JSON.parse(content);
  } catch (e) {
    console.error(`[Audit News Covers] Error parsing JSON ${filePath}:`, e.message);
    return [];
  }
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.newsArticles)) return data.newsArticles;
  if (Array.isArray(data.wcg_news_articles_v1)) return data.wcg_news_articles_v1;
  return [];
}

let allArticles = [];

// 1. Audit canonical_backup_state.json
const canonPath = path.join(ROOT_DIR, 'src/data/canonical_backup_state.json');
const canonArticles = auditFile(canonPath, 'src canonical backup');
allArticles = allArticles.concat(canonArticles);

// 2. Audit functions backup
const funcCanonPath = path.join(ROOT_DIR, 'functions/data/canonical_backup_state.json');
const funcArticles = auditFile(funcCanonPath, 'functions canonical backup');
allArticles = allArticles.concat(funcArticles);

// Deduplicate articles by ID
const articleMap = new Map();
allArticles.forEach((art) => {
  if (art && art.id) {
    articleMap.set(art.id, art);
  }
});

console.log(`[Audit News Covers] Auditing ${articleMap.size} unique news articles...`);

let errors = [];

articleMap.forEach((art) => {
  const coverUrl = art.cover_url;
  if (!coverUrl) return;

  // External URLs (http/https) are skipped from local disk checks
  if (coverUrl.startsWith('http://') || coverUrl.startsWith('https://')) {
    return;
  }

  // Internal paths
  if (coverUrl.startsWith('/')) {
    // Strip query string if any
    const cleanPath = coverUrl.split('?')[0].slice(1);
    const localDiskPath = path.join(PUBLIC_DIR, cleanPath);

    if (!fs.existsSync(localDiskPath)) {
      errors.push({
        id: art.id,
        slug: art.slug,
        title: art.title,
        cover_url: coverUrl,
        missingPath: localDiskPath,
      });
    }
  }
});

if (errors.length > 0) {
  console.error(`\n❌ [Audit News Covers] FAILED: Found ${errors.length} broken news cover image(s):`);
  errors.forEach((err, idx) => {
    console.error(`  ${idx + 1}. [${err.id}] "${err.title}"`);
    console.error(`     Slug: ${err.slug}`);
    console.error(`     Broken Cover: ${err.cover_url}`);
    console.error(`     Missing File: ${err.missingPath}\n`);
  });
  process.exit(1);
} else {
  console.log(`✅ [Audit News Covers] PASSED: All ${articleMap.size} news article covers exist on disk.`);
  process.exit(0);
}
