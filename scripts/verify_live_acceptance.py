import urllib.request
import ssl
import json
import base64
import sys
import time

sys.stdout.reconfigure(encoding='utf-8')

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

BASE_URL = 'https://codegame.shop'
SECRET = 'b4e08494bf1c3fd6a0c965dd2411780c60513f7f87001bc955d7496331b2faef'

def is_webp(data: bytes) -> bool:
    return len(data) >= 12 and data[:4] == b'RIFF' and data[8:12] == b'WEBP'

def is_png(data: bytes) -> bool:
    return len(data) >= 8 and data[:8] == b'\x89PNG\r\n\x1a\n'

def is_jpeg(data: bytes) -> bool:
    return len(data) >= 3 and data[:3] == b'\xff\xd8\xff'

def api_put(path, payload):
    url = f'{BASE_URL}{path}'
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode('utf-8'),
        headers={
            'Content-Type': 'application/json',
            'X-Sync-Key': SECRET,
            'User-Agent': 'LiveAcceptanceVerifier/1.0',
        },
        method='PUT'
    )
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
            body = resp.read().decode('utf-8')
            return resp.status, json.loads(body)
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8')
        try:
            return e.code, json.loads(body)
        except:
            return e.code, {'raw': body}

def api_post(path, payload):
    url = f'{BASE_URL}{path}'
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode('utf-8'),
        headers={
            'Content-Type': 'application/json',
            'X-Sync-Key': SECRET,
            'User-Agent': 'LiveAcceptanceVerifier/1.0',
        },
        method='POST'
    )
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=20) as resp:
            body = resp.read().decode('utf-8')
            return resp.status, json.loads(body)
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8')
        try:
            return e.code, json.loads(body)
        except:
            return e.code, {'raw': body}

def api_get(path):
    url = f'{BASE_URL}{path}'
    req = urllib.request.Request(
        url,
        headers={
            'Accept': 'application/json',
            'User-Agent': 'LiveAcceptanceVerifier/1.0',
        }
    )
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
            body = resp.read().decode('utf-8')
            return resp.status, json.loads(body)
    except urllib.error.HTTPError as e:
        return e.code, None

def fetch_raw(url_path):
    url = f'{BASE_URL}{url_path}' if url_path.startswith('/') else url_path
    req = urllib.request.Request(
        url,
        headers={
            'Accept': 'image/webp,image/*,*/*',
            'User-Agent': 'LiveAcceptanceVerifier/1.0',
        }
    )
    with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
        headers = dict(resp.headers)
        data = resp.read()
        return resp.status, headers, data

print('=' * 80)
print('🚀 BẮT ĐẦU NGHIỆM THU LIVE 9 BƯỚC THEO YÊU CẦU')
print('=' * 80)

# ----------------------------------------------------
# BƯỚC 2: Đổi cover 4 bài thật
# ----------------------------------------------------
print('\n▶ BƯỚC 2: PUT 4 bài thật sang cover tương đối plain (/game_icons/<slug>.webp)...')
target_articles = [
    ('ArcheAge Chronicles', 'news_1793768224363_7dno', '/game_icons/archeage.webp'),
    ('World of Warcraft: Forever', 'news_1793757640705_kw8w', '/game_icons/world-of-warcraft.webp'),
    ('KOF: Legend', 'news_1793681832220_lhyw', '/game_icons/kof-legend.webp'),
    ("No Man's Sky", 'news_1793177069735_za7d', '/game_icons/no-mans-sky.webp'),
]

b2_results = []
for title, aid, target_cover in target_articles:
    status, res = api_put(f'/api/news/{aid}', {'cover_url': target_cover})
    print(f'   PUT [{aid}] "{title}" -> {target_cover}: HTTP {status}')
    if status == 200:
        # GET lại để kiểm tra
        g_status, g_data = api_get(f'/api/news/{aid}')
        curr_cover = g_data.get('article', {}).get('cover_url') if g_data else None
        print(f'      GET xác minh: cover_url = {curr_cover}')
        b2_results.append((aid, status == 200 and curr_cover == target_cover, curr_cover))
    else:
        print(f'      Lỗi: {res}')
        b2_results.append((aid, False, str(res)))

# ----------------------------------------------------
# BƯỚC 3: Body thật sau purge của 4 file plain URL
# ----------------------------------------------------
print('\n▶ BƯỚC 3: Kiểm tra Body thật (Magic Bytes) của 4 đường dẫn plain URL...')
b3_results = []
for title, aid, target_cover in target_articles:
    st, hdrs, body = fetch_raw(target_cover)
    webp_ok = is_webp(body)
    cf_cache = hdrs.get('cf-cache-status', 'NONE')
    ct = hdrs.get('content-type', '')
    print(f'   {target_cover}: HTTP {st}, Content-Type: {ct}, Size: {len(body)} B, isWebP: {webp_ok}, cf-cache: {cf_cache}')
    b3_results.append((target_cover, st == 200 and webp_ok, len(body), cf_cache))

# Kiểm tra cả bài VAMPIR đã xong trước đó
st_v, hdrs_v, body_v = fetch_raw('/game_icons/vampir.webp')
print(f'   /game_icons/vampir.webp (kiểm chứng): HTTP {st_v}, isWebP: {is_webp(body_v)}, Size: {len(body_v)} B')

# ----------------------------------------------------
# BƯỚC 1: Luồng mới tải lên -> đổi cover ngay
# ----------------------------------------------------
print('\n▶ BƯỚC 1: Tải ảnh thử mới (cover-test-20261105) -> PUT cover ngay lập tức...')
# Tạo 1 ảnh JPEG nhỏ để test cả tính năng tự chuyển sang WebP
# 1x1 red pixel JPEG
sample_jpeg_b64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA='
b1_slug = 'cover-test-20261105'
up_st, up_res = api_post('/api/games/upload-icon', {
    'slug': b1_slug,
    'image_base64': sample_jpeg_b64,
    'source': 'test-step-1',
    'admin_override': True,
})
print(f'   Upload test icon: HTTP {up_st}, readBackVerified: {up_res.get("readBackVerified")}, iconUrl: {up_res.get("iconUrl")}')

# PUT ngay làm cover cho bài KOF
kof_aid = 'news_1793681832220_lhyw'
test_put_st, test_put_res = api_put(f'/api/news/{kof_aid}', {'cover_url': f'/game_icons/{b1_slug}.webp'})
print(f'   PUT cover thử ngay lần đầu: HTTP {test_put_st}, response: {test_put_res.get("success")}')

# Hoàn tác lại cover chuẩn cho KOF
api_put(f'/api/news/{kof_aid}', {'cover_url': '/game_icons/kof-legend.webp'})
print('   Hoàn tác cover KOF về lại /game_icons/kof-legend.webp.')

# ----------------------------------------------------
# BƯỚC 6: Chuyển mã nhất quán (JPEG và PNG -> WebP thật)
# ----------------------------------------------------
print('\n▶ BƯỚC 6: Chuyển mã nhất quán (Test tải JPEG và PNG qua upload-icon)...')
# 1. Test JPEG
jpg_slug = 'test-convert-jpg-slug'
j_st, j_res = api_post('/api/games/upload-icon', {
    'slug': jpg_slug,
    'image_base64': sample_jpeg_b64,
    'admin_override': True
})
st_j, _, body_j = fetch_raw(f'/game_icons/{jpg_slug}.webp?t={int(time.time())}')
print(f'   Input JPEG -> Saved file: HTTP {st_j}, Size: {len(body_j)} B, isWebP: {is_webp(body_j)}, isJPEG: {is_jpeg(body_j)}')

# 2. Test PNG (1x1 transparent PNG)
sample_png_b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
png_slug = 'test-convert-png-slug'
p_st, p_res = api_post('/api/games/upload-icon', {
    'slug': png_slug,
    'image_base64': sample_png_b64,
    'admin_override': True
})
st_p, _, body_p = fetch_raw(f'/game_icons/{png_slug}.webp?t={int(time.time())}')
print(f'   Input PNG -> Saved file: HTTP {st_p}, Size: {len(body_p)} B, isWebP: {is_webp(body_p)}, isPNG: {is_png(body_p)}')

# ----------------------------------------------------
# BƯỚC 7: URL có ?v=...
# ----------------------------------------------------
print('\n▶ BƯỚC 7: PUT thử URL có ?v=<timestamp>...')
v_url = f'/game_icons/kof-legend.webp?v={int(time.time())}'
v_st, v_res = api_put(f'/api/news/{kof_aid}', {'cover_url': v_url})
print(f'   PUT với {v_url}: HTTP {v_st}, response: {v_res.get("success")}')
# Hoàn tác về plain URL
api_put(f'/api/news/{kof_aid}', {'cover_url': '/game_icons/kof-legend.webp'})
print('   Hoàn tác cover KOF về lại plain URL /game_icons/kof-legend.webp.')

# ----------------------------------------------------
# BƯỚC 8: Từ chối đúng (404 và không phải ảnh)
# ----------------------------------------------------
print('\n▶ BƯỚC 8: Kiểm tra từ chối đúng (Lỗi 5 & Lỗi 1)...')
# 1. Đường dẫn không tồn tại
ne_url = '/game_icons/khong-ton-tai-xyz.webp'
ne_st, ne_res = api_put(f'/api/news/{kof_aid}', {'cover_url': ne_url})
print(f'   PUT đường dẫn 404 ({ne_url}): HTTP {ne_st}, Error: "{ne_res.get("error")}"')

# 2. Đuôi mở rộng không hợp lệ
inv_url = '/game_icons/kof-legend.exe'
inv_st, inv_res = api_put(f'/api/news/{kof_aid}', {'cover_url': inv_url})
print(f'   PUT đuôi file cấm ({inv_url}): HTTP {inv_st}, Error: "{inv_res.get("error")}"')

# ----------------------------------------------------
# BƯỚC 9: Upload ảnh nguồn lớn
# ----------------------------------------------------
print('\n▶ BƯỚC 9: Tải thử ảnh lớn qua upload-icon...')
# Tạo buffer 600KB giả lập ảnh quá khổ
big_bytes = b'\xff\xd8\xff' + b'\x00' * (600 * 1024)
big_b64 = base64.b64encode(big_bytes).decode('ascii')
big_st, big_res = api_post('/api/games/upload-icon', {
    'slug': 'test-big-image-slug',
    'image_base64': big_b64,
    'admin_override': True
})
print(f'   Upload ảnh 600KB: HTTP {big_st}, Response: {big_res}')

# ----------------------------------------------------
# BƯỚC 5: Kiểm tra đồng bộ qua /api/sync
# ----------------------------------------------------
print('\n▶ BƯỚC 5: Kiểm tra đồng bộ qua /api/sync...')
sync_st, sync_data = api_get('/api/sync')
sync_articles = sync_data.get('newsArticles', []) if sync_data else []
print(f'   /api/sync HTTP {sync_st}, tổng số bài: {len(sync_articles)}')

art_map = {a['id']: a for a in sync_articles if a and 'id' in a}
for title, aid, target_cover in target_articles:
    a_sync = art_map.get(aid)
    cv = a_sync.get('cover_url') if a_sync else None
    print(f'   Bài [{aid}] "{title}": cover_url trong /api/sync = {cv} (Khớp: {cv == target_cover})')

# ----------------------------------------------------
# RÀ TOÀN BỘ 241 BÀI TRÊN LIVE
# ----------------------------------------------------
print('\n' + '=' * 80)
print('🔍 RÀ SOÁT TOÀN BỘ 241 BÀI VIẾT TRÊN LIVE QUA /api/sync')
print('=' * 80)

total_articles = len(sync_articles)
absolute_covers = []
relative_covers = []
missing_covers = []
unique_covers = set()

for art in sync_articles:
    aid = art.get('id')
    cv = art.get('cover_url') or art.get('cover_image') or ''
    if not cv:
        missing_covers.append(aid)
    elif cv.startswith('http://') or cv.startswith('https://'):
        absolute_covers.append((aid, art.get('title'), cv))
    elif cv.startswith('/'):
        relative_covers.append((aid, cv))
        unique_covers.add(cv.split('?')[0])

print(f'Tổng số bài: {total_articles}')
print(f'Số bài cover tương đối: {len(relative_covers)}')
print(f'Số bài cover tuyệt đối (link ngoài): {len(absolute_covers)}')
print(f'Số bài thiếu cover: {len(missing_covers)}')

if absolute_covers:
    print('❌ Vẫn còn bài dùng cover tuyệt đối:')
    for item in absolute_covers:
        print(f'   - [{item[0]}] {item[1]}: {item[2]}')
else:
    print('✅ 100% BÀI VIẾT ĐÃ DÙNG COVER TƯƠNG ĐỐI NỘI BỘ (0 bài cover tuyệt đối)!')

print('\n🎉 HOÀN TẤT TOÀN BỘ PHÉP KIỂM NGHIỆM THU LIVE!')
