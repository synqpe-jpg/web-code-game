export type GameEventSourceType = 'FANPAGE' | 'GROUP' | 'WEB';
export type GameEventStatus = 'PUBLISHED' | 'PENDING' | 'REJECTED';
export type GameEventTimeStatus = 'HAPPENING' | 'UPCOMING' | 'ENDED';

export interface GameEventItem {
  id: string;
  title: string;
  game_name: string;
  game_slug: string;
  game_icon: string;
  source_type: GameEventSourceType;
  source_name: string;
  source_url: string;
  start_time: string;
  end_time?: string;
  is_no_end_date?: boolean;
  how_to_join: string;
  related_code?: string;
  status: GameEventStatus;
  created_at: string;
  updated_at?: string;
  created_by?: 'MANUAL' | 'CRAWLER' | 'API';
}

/**
 * Tính toán trạng thái thời gian thực của sự kiện (tự động tính từ thời gian, không nhập tay)
 */
export function getGameEventTimeStatus(event: GameEventItem, referenceTime: number = Date.now()): GameEventTimeStatus {
  if (event.is_no_end_date) {
    const startMs = event.start_time ? new Date(event.start_time).getTime() : 0;
    if (startMs && referenceTime < startMs) return 'UPCOMING';
    return 'HAPPENING';
  }

  const startMs = event.start_time ? new Date(event.start_time).getTime() : 0;
  const endMs = event.end_time ? new Date(event.end_time).getTime() : 0;

  if (endMs && referenceTime > endMs) {
    return 'ENDED';
  }
  if (startMs && referenceTime < startMs) {
    return 'UPCOMING';
  }
  return 'HAPPENING';
}

/**
 * Sắp xếp danh sách sự kiện theo chuẩn UX:
 * 1. Đang diễn ra: theo hạn gần nhất trước (để người đọc tham gia kịp hạn)
 * 2. Sắp tới: theo ngày bắt đầu gần nhất
 * 3. Đã kết thúc: theo ngày kết thúc mới nhất (để tiện tra cứu)
 */
export function sortGameEvents(events: GameEventItem[], referenceTime: number = Date.now()): GameEventItem[] {
  return [...events].sort((a, b) => {
    const statusA = getGameEventTimeStatus(a, referenceTime);
    const statusB = getGameEventTimeStatus(b, referenceTime);

    const orderWeight = { HAPPENING: 1, UPCOMING: 2, ENDED: 3 };
    if (orderWeight[statusA] !== orderWeight[statusB]) {
      return orderWeight[statusA] - orderWeight[statusB];
    }

    if (statusA === 'HAPPENING') {
      const endA = a.is_no_end_date ? Infinity : (a.end_time ? new Date(a.end_time).getTime() : Infinity);
      const endB = b.is_no_end_date ? Infinity : (b.end_time ? new Date(b.end_time).getTime() : Infinity);
      if (endA !== endB) return endA - endB;
    }

    if (statusA === 'UPCOMING') {
      const startA = a.start_time ? new Date(a.start_time).getTime() : 0;
      const startB = b.start_time ? new Date(b.start_time).getTime() : 0;
      if (startA !== startB) return startA - startB;
    }

    if (statusA === 'ENDED') {
      const endA = a.end_time ? new Date(a.end_time).getTime() : 0;
      const endB = b.end_time ? new Date(b.end_time).getTime() : 0;
      if (endA !== endB) return endB - endA;
    }

    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  });
}
