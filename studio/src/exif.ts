// EXIF 解析：拍摄日期与 GPS 精确坐标（prompt.md §17：解析并展示，须经贡献者确认，绝不静默发布）。
import sharp from 'sharp';
import exifReader from 'exif-reader';

export interface ExifSuggestion {
  /** 拍摄日期 YYYY-MM-DD（来自 DateTimeOriginal / DateTime） */
  date?: string;
  /** GPS 十进制坐标（WGS84） */
  gps?: { lat: number; lng: number };
}

function dmsToDecimal(dms: unknown, ref: unknown): number | null {
  if (!Array.isArray(dms) || dms.length < 3) return null;
  const [d, m, s] = dms.map((x) => Number(x));
  if (![d, m, s].every((n) => Number.isFinite(n))) return null;
  let dec = d + m / 60 + s / 3600;
  const refStr = String(ref ?? '').toUpperCase();
  if (refStr === 'S' || refStr === 'W') dec = -dec;
  return Math.round(dec * 1e6) / 1e6;
}

export async function parseExif(buffer: Buffer): Promise<ExifSuggestion> {
  const out: ExifSuggestion = {};
  try {
    const meta = await sharp(buffer).metadata();
    if (!meta.exif) return out;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const exif = exifReader(meta.exif) as any;

    const dateVal = exif?.Photo?.DateTimeOriginal ?? exif?.Image?.DateTime;
    if (dateVal) {
      const d = new Date(dateVal);
      if (!Number.isNaN(d.getTime())) {
        out.date = d.toISOString().slice(0, 10);
      }
    }

    const gps = exif?.GPSInfo;
    if (gps) {
      const lat = dmsToDecimal(gps.GPSLatitude, gps.GPSLatitudeRef);
      const lng = dmsToDecimal(gps.GPSLongitude, gps.GPSLongitudeRef);
      if (lat != null && lng != null) out.gps = { lat, lng };
    }
  } catch {
    /* 损坏或缺失的 EXIF 一律按无建议处理 */
  }
  return out;
}
