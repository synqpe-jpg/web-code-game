-- Migration 0016: Chuẩn hóa markdown trong bài tin Clone Drone trong system_settings
-- Đưa dấu hai chấm ra ngoài dấu in đậm (ví dụ: - **Nền tảng**: thay vì - **Nền tảng:**)
UPDATE system_settings
SET value = REPLACE(
  REPLACE(
    REPLACE(
      REPLACE(
        REPLACE(
          REPLACE(
            REPLACE(
              REPLACE(
                REPLACE(
                  REPLACE(
                    REPLACE(
                      REPLACE(
                        value,
                        '- **Nền tảng:**', '- **Nền tảng**:'
                      ),
                      '- **Hình thức phát hành:**', '- **Hình thức phát hành**:'
                    ),
                    '- **Nhiều người chơi:**', '- **Nhiều người chơi**:'
                  ),
                  '- **Giá bán:**', '- **Giá bán**:'
                ),
                '- **Thử thách Saw Dog:**', '- **Thử thách Saw Dog**:'
              ),
              '- **Thử thách Kỷ niệm (Anniversary Challenge):**', '- **Thử thách Kỷ niệm (Anniversary Challenge)**:'
            ),
            '- **Thử thách giàu cốt truyện:**', '- **Thử thách giàu cốt truyện**:'
          ),
          '- **Thời gian ra mắt mobile:**', '- **Thời gian ra mắt mobile**:'
        ),
        '- **Cách tải:**', '- **Cách tải**:'
      ),
      '- **Cập nhật kỷ niệm 10 năm:**', '- **Cập nhật kỷ niệm 10 năm**:'
    ),
    '- **Chế độ nhiều người chơi:**', '- **Chế độ nhiều người chơi**:'
  ),
  '- **Lưu ý cho người mới:**', '- **Lưu ý cho người mới**:'
),
updated_at = datetime('now')
WHERE key = 'wcg_news_articles_v1' AND value LIKE '%clone-drone-in-the-danger-zone%';
