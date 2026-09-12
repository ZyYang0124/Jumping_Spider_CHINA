// 隐私管线：从私有源数据到公开输出的唯一通道。
// 对应 prompt.md §43（公开 DTO 必须在源头只选安全字段）与 DEVELOPMENT.md 规则 2/3。
//
// 铁律：
//  1. 只有 status === 'published' 且 visibility === 'public' 的观察才允许进入公开输出；
//  2. 坐标政策（Studio SOP §7）：跳蛛观察坐标全量精确公开，单一坐标模型，无模糊化层级；
//  3. 媒体 visibility !== 'public' 不进入公开输出；
//  4. 草稿、投稿、审核中的记录一律不出现在站点任何页面与 JSON 中。

import {
  currentIdentificationByObservation,
  displayNameOf,
  identificationsByObservation,
  locationById,
  mediaByObservation,
  observations,
  placeById,
  placeMergedInto,
  profileById,
  specimenByObservation,
  taxonById,
  tripById,
} from './store';
import mediaManifestJson from '../data/generated/media-manifest.json';
import type { Evidence, LocationVisibility, MediaRecord, MediaViewType, Observation, TaxonRank } from './types';

// 媒体尺寸清单（scripts/process-media.mjs 与 Studio 上传管线生成，构建期静态导入）
const MEDIA_MANIFEST = mediaManifestJson as Record<
  string,
  { width: number; height: number; variants: number[] }
>;

export interface PublicLocation {
  country_code: string;
  country_name: string;
  admin1: string;
  admin2: string | null;
  locality: string | null;
  site_name: string | null;
  elevation_m: number | null;
  /** 坐标政策（Studio SOP §7）：观察地点坐标全量精确公开 */
  latitude: number | null;
  longitude: number | null;
}

export interface PublicMedia {
  id: string;
  /** 稳定公开编号 CSFN-M/SFN-M-NNNNNN */
  public_id: string;
  thumb: string;
  medium: string;
  large: string;
  /** 响应式源集（AVIF/WebP/JPEG × 多宽度），供 <picture>/srcset 使用 */
  srcset: {
    avif: string;
    webp: string;
    jpg: string;
  };
  /** 原始显示宽高（用于 width/height 属性与 aspect-ratio 占位） */
  width: number;
  height: number;
  view_type: MediaViewType;
  caption: string | null;
  photographer: string;
  license: string;
  is_cover: boolean;
  detail_url: string;
}

export interface PublicIdentification {
  display: string;
  taxon_slug: string | null;
  taxon_rank: TaxonRank;
  evidence: Evidence;
  identified_by: string;
  identified_at: string;
  remarks: string | null;
}

export interface PublicObservation {
  public_id: string;
  url: string;
  observed_at: string;
  observed_at_precision: string;
  location: PublicLocation;
  /** 挂接的地点实体（Place，§14）；公开地点页按此聚合 */
  place_id: string | null;
  sex: string;
  life_stage: string;
  habitat: string | null;
  microhabitat: string | null;
  behavior: string | null;
  field_note: string;
  observer_name: string;
  observer_profile_slug: string | null;
  media: PublicMedia[];
  cover: PublicMedia | null;
  identification: PublicIdentification | null;
  identification_history: PublicIdentification[];
  specimen: {
    catalog_number: string;
    repository: string;
    preservation: string | null;
    sex: string;
    life_stage: string;
    notes: string | null;
  } | null;
  trip: { slug: string; title: string } | null;
}

// 站点根路径：跟随 Astro 配置（canonical 域名为根路径，历史镜像为子路径）
const BASE = import.meta.env.BASE_URL === '/' ? '' : import.meta.env.BASE_URL;

export function withBase(path: string): string {
  return `${BASE}${path}`;
}

// ---------- 公开地点：单一坐标模型（全量精确公开，Studio SOP §7） ----------

/** 观察所属地点实体：观察挂接优先，其次地点记录的标注；合并跳转在此一次解析 */
function resolveObservationPlaceId(obs: Observation): string | null {
  const raw = obs.place_id ?? locationById.get(obs.location_id)?.place_id ?? null;
  if (!raw) return null;
  return placeMergedInto.get(raw) ?? raw;
}

function publicLocation(locationId: string): PublicLocation {
  const l = locationById.get(locationId);
  if (!l) throw new Error(`location ${locationId} 不存在`);
  return {
    country_code: l.country_code,
    country_name: l.country_name,
    admin1: l.admin1,
    admin2: l.admin2,
    locality: l.locality,
    site_name: l.site_name,
    elevation_m: l.elevation_m,
    latitude: l.latitude,
    longitude: l.longitude,
  };
}

// ---------- 公开鉴定 ----------

function publicIdentification(idn: {
  display_identification: string;
  taxon_id: string;
  evidence: Evidence;
  identified_by_profile_id: string | null;
  identified_by_text?: string | null;
  identified_at: string;
  remarks: string | null;
}): PublicIdentification {
  const taxon = taxonById.get(idn.taxon_id);
  if (!taxon) throw new Error(`鉴定引用的 taxon ${idn.taxon_id} 不存在（规则 6）`);
  const identifiedBy =
    displayNameOf(idn.identified_by_profile_id) ?? idn.identified_by_text ?? idn.identified_by_profile_id ?? '未知';
  return {
    display: idn.display_identification,
    taxon_slug: taxon.slug,
    taxon_rank: taxon.rank,
    evidence: idn.evidence,
    identified_by: identifiedBy,
    identified_at: idn.identified_at,
    remarks: idn.remarks,
  };
}

// ---------- 公开媒体（只含公开媒体；路径指向构建期生成的脱敏派生图） ----------

/** 从媒体记录构建完整公开媒体对象（含响应式源集与真实宽高）——单一出口，全站复用 */
export function publicMediaFromRecord(m: MediaRecord): PublicMedia {
  const photographer = displayNameOf(m.photographer_profile_id) ?? m.photographer_name ?? '未知';
  const mm = MEDIA_MANIFEST[m.id];
  const widths = mm?.variants ?? [];
  const srcsetFor = (ext: string) =>
    widths.map((w) => `${withBase(`/media/derivatives/${m.id}-${w}.${ext}`)} ${w}w`).join(', ');
  return {
    id: m.id,
    public_id: m.public_id,
    thumb: withBase(`/media/derivatives/${m.id}_thumb.jpg`),
    medium: withBase(`/media/derivatives/${m.id}_medium.jpg`),
    large: withBase(`/media/derivatives/${m.id}_large.jpg`),
    srcset: {
      avif: srcsetFor('avif'),
      webp: srcsetFor('webp'),
      jpg: srcsetFor('jpg'),
    },
    width: mm?.width ?? 0,
    height: mm?.height ?? 0,
    view_type: m.view_type,
    caption: m.caption,
    photographer,
    license: m.license,
    is_cover: m.is_cover,
    detail_url: withBase(`/media/${m.public_id}/`),
  };
}

function publicMedia(observationId: string): PublicMedia[] {
  const list = mediaByObservation.get(observationId) ?? [];
  return list.filter((m) => m.visibility === 'public').map((m) => publicMediaFromRecord(m));
}

export function toPublicObservation(o: Observation): PublicObservation {
  if (o.status !== 'published' || o.visibility !== 'public') {
    throw new Error(`观察 ${o.public_id} 未发布，禁止进入公开输出`);
  }
  const mediaList = publicMedia(o.id);
  const current = currentIdentificationByObservation.get(o.id) ?? null;
  const history = (identificationsByObservation.get(o.id) ?? []).map(publicIdentification);
  const spec = specimenByObservation.get(o.id) ?? null;
  const trip = o.trip_id ? tripById.get(o.trip_id) ?? null : null;
  const observer = profileById.get(o.observer);
  return {
    public_id: o.public_id,
    url: withBase(`/observations/${o.public_id}/`),
    observed_at: o.observed_at,
    observed_at_precision: o.observed_at_precision,
    location: publicLocation(o.location_id),
    place_id: resolveObservationPlaceId(o),
    sex: o.sex,
    life_stage: o.life_stage,
    habitat: o.habitat,
    microhabitat: o.microhabitat,
    behavior: o.behavior,
    field_note: o.field_note,
    observer_name: observer?.display_name ?? o.observer,
    observer_profile_slug: observer?.profile_visibility === 'public' ? observer.slug : null,
    media: mediaList,
    cover: mediaList.find((m) => m.is_cover) ?? mediaList[0] ?? null,
    identification: current ? publicIdentification(current) : null,
    identification_history: history,
    specimen:
      spec != null
        ? {
            catalog_number: spec.catalog_number,
            repository: spec.repository,
            preservation: spec.preservation,
            sex: spec.sex,
            life_stage: spec.life_stage,
            notes: spec.notes,
          }
        : null,
    trip: trip ? { slug: trip.slug, title: trip.title } : null,
  };
}

/** 公开观察列表（已发布 + 公开），按日期倒序。 */
export function getPublicObservations(): PublicObservation[] {
  /** 新发布的在前：主排序键为发布时间（后发布 → 列表更靠前），同批按编号倒序。 */
  const pubKey = (o: (typeof observations)[number]) => `${o.published_at ?? o.observed_at} ${o.public_id}`;
  return observations
    .filter((o) => o.status === 'published' && o.visibility === 'public')
    .sort((a, b) => pubKey(b).localeCompare(pubKey(a)))
    .map(toPublicObservation);
}

/** 把媒体尺寸 manifest 合并进公开观察对象（构建期调用）。 */
export function attachMediaDimensions(
  obs: PublicObservation,
  manifest: Record<string, { width: number; height: number }>,
): PublicObservation {
  obs.media = obs.media.map((m) => ({
    ...m,
    ...(manifest[m.id] ?? { width: m.width, height: m.height }),
  }));
  if (obs.cover) {
    obs.cover = obs.media.find((m) => m.id === obs.cover!.id) ?? obs.cover;
  }
  return obs;
}
