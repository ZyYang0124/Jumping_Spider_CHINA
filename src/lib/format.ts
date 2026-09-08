// 学名排版（prompt.md §60）：属名、种名斜体；sp. / cf. / aff. 不斜体；科、族等高阶元不斜体。

export interface NameSegment {
  text: string;
  italic: boolean;
}

const NON_ITALIC_TOKENS = new Set(['sp.', 'cf.', 'aff.', 'nr.', 'sp.nr.', 'grp.', 'group', 'sp']);

export function sciNameSegments(display: string, rank: string): NameSegment[] {
  const tokens = display.split(/\s+/).filter(Boolean);
  // 科/族等高阶元整体不斜体
  if (rank === 'family' || rank === 'tribe') {
    return [{ text: display, italic: false }];
  }
  return tokens.map((token, i) => {
    const lower = token.toLowerCase();
    if (NON_ITALIC_TOKENS.has(lower)) return { text: token, italic: false };
    if (i === 0) return { text: token, italic: true };
    // 种名/亚名斜体；形态种编号（如 GD01、YN01）不斜体
    if (/^[A-Z]{2}\d+$/.test(token)) return { text: token, italic: false };
    return { text: token, italic: true };
  });
}

export function sciNameHtml(display: string, rank: string): string {
  return sciNameSegments(display, rank)
    .map((s) => (s.italic ? `<i>${s.text}</i>` : s.text))
    .join(' ');
}

export function formatDate(date: string, precision: string): string {
  const [y, m, d] = date.split('-');
  switch (precision) {
    case 'year':
      return `${y} 年`;
    case 'month':
      return `${y} 年 ${Number(m)} 月`;
    case 'unknown':
      return '日期不详';
    default:
      return `${y} 年 ${Number(m)} 月 ${Number(d)} 日`;
  }
}

export function formatMonthRange(start: string, end: string): string {
  const [sy, sm] = start.split('-');
  const [ey, em] = end.split('-');
  if (sy === ey) return `${sy} 年 ${Number(sm)}–${Number(em)} 月`;
  return `${sy} 年 ${Number(sm)} 月 – ${ey} 年 ${Number(em)} 月`;
}

export function locationLine(loc: {
  country_name: string;
  admin1: string;
  admin2: string | null;
  locality: string | null;
}): string {
  return [loc.country_name, loc.admin1, loc.admin2, loc.locality].filter(Boolean).join(' · ');
}

/** 列表卡片用的简短区域：国内显示一级行政区，国外显示 国家 · 一级行政区 */
export function shortRegion(loc: { country_name: string; admin1: string }): string {
  return loc.country_name === '中国' ? loc.admin1 : `${loc.country_name} · ${loc.admin1}`;
}

/** 坐标政策（Studio SOP §7）：跳蛛观察坐标全量精确公开 */
export function coordLabel(loc: { latitude: number | null; longitude: number | null }): string | null {
  return loc.latitude != null && loc.longitude != null ? '精确坐标公开' : null;
}
