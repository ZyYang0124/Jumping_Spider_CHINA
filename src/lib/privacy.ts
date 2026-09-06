// 隐私管线：从私有源数据到公开输出的唯一通道。
// 对应 prompt.md §43（公开 DTO 必须在源头只选安全字段）与 DEVELOPMENT.md 规则 2/3。
//
// 铁律：
//  1. 只有 status === 'published' 且 visibility === 'public' 的观察才允许进入公开输出；
//  2. 精确坐标（exact_*）绝不进入任何公开对象，模糊化在构建期完成，而非浏览器端；
//  3. 媒体 visibility !== 'public' 不进入公开输出；
//  4. 草稿、投稿、审核中的记录一律不出现在站点任何页面与 JSON 中。

import {
  currentIdentificationByObservation,
  displayNameOf,
  identificationsByObservation,
  locationById,
  mediaByObservation,
  observations,
  profileById,
  specimenByObservation,
  taxonById,
  tripById,
} from './store';
import type { Evidence, LocationVisibility, MediaViewType, TaxonRank } from './types';

export interface PublicLocation {
  country: string;
  state_province: string;
  city: string | null;
  county: string | null;
  locality: string | null;
  elevation_m: number | null;
  visibility: LocationVisibility;
  latitude: number | null;
  longitude: number | null;
  coordinate_uncertainty_m: number | null;
}

export interface PublicMedia {
  id: string;
  thumb: string;
  medium: string;
  large: string;
  width: number;
  height: number;
  view_type: MediaViewType;
  caption: string | null;
  photographer: string;
  license: string;
  is_cover: boolean;
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

const BASE = '/Jumping_Spider_CHINA';

export function withBase(path: string): string {
  return `${BASE}${path}`;
}

// ---------- 公开地点：按 visibility 决定暴露哪一层 ----------

function publicLocation(locationId: string): PublicLocation {
  const l = locationById.get(locationId);
  if (!l) throw new Error(`location ${locationId} 不存在`);
  const out: PublicLocation = {
    country: l.country,
    state_province: l.state_province,
    city: null,
    county: null,
    locality: null,
    elevation_m: l.elevation_m,
    visibility: l.location_visibility,
    latitude: null,
    longitude: null,
    coordinate_uncertainty_m: null,
  };
  switch (l.location_visibility) {
    case 'exact':
      out.city = l.city;
      out.county = l.county;
      out.locality = l.locality;
      out.latitude = l.public_latitude;
      out.longitude = l.public_longitude;
      out.coordinate_uncertainty_m = l.coordinate_uncertainty_m;
      break;
    case 'blurred':
      out.city = l.city;
      out.county = l.county;
      out.locality = l.locality;
      out.latitude = l.public_latitude;
      out.longitude = l.public_longitude;
      out.coordinate_uncertainty_m = l.coordinate_uncertainty_m;
      break;
    case 'locality_only':
      out.city = l.city;
      out.county = l.county;
      out.locality = l.locality;
      break;
    case 'hidden':
      // 不公开坐标，也不公开敏感地名细节
      break;
  }
  return out;
}

// ---------- 公开鉴定 ----------

function publicIdentification(idn: {
  display_identification: string;
  taxon_id: string;
  evidence: Evidence;
  identified_by_profile_id: string | null;
  identified_at: string;
  remarks: string | null;
}): PublicIdentification {
  const taxon = taxonById.get(idn.taxon_id);
  if (!taxon) throw new Error(`鉴定引用的 taxon ${idn.taxon_id} 不存在（规则 6）`);
  const identifiedBy =
    displayNameOf(idn.identified_by_profile_id) ?? idn.identified_by_profile_id ?? '未知';
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

function publicMedia(observationId: string): PublicMedia[] {
  const list = mediaByObservation.get(observationId) ?? [];
  return list
    .filter((m) => m.visibility === 'public')
    .map((m) => {
      const photographer =
        displayNameOf(m.photographer_profile_id) ?? m.photographer_name ?? '未知';
      return {
        id: m.id,
        thumb: withBase(`/media/derivatives/${m.id}_thumb.jpg`),
        medium: withBase(`/media/derivatives/${m.id}_medium.jpg`),
        large: withBase(`/media/derivatives/${m.id}_large.jpg`),
        // width/height 由媒体管线写入的 manifest 提供，构建时合并
        width: 0,
        height: 0,
        view_type: m.view_type,
        caption: m.caption,
        photographer,
        license: m.license,
        is_cover: m.is_cover,
      };
    });
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
  return observations
    .filter((o) => o.status === 'published' && o.visibility === 'public')
    .map(toPublicObservation)
    .sort((a, b) => b.observed_at.localeCompare(a.observed_at));
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
