// 公开查询层：物种聚合、调查、地点、贡献者与搜索索引。
// 物种页面永远从「已发布观察 + 当前鉴定」推导，不手工维护物种条目（prompt.md §44）。

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getPublicObservations,
  toPublicObservation,
  withBase,
  type PublicObservation,
} from './privacy';
import {
  displayNameOf,
  mediaById,
  observations,
  profiles,
  taxa,
  trips,
} from './store';
import type { Taxon } from './types';

const MEDIA_MANIFEST_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../public/media/derivatives/manifest.json',
);

function mediaManifest(): Record<string, { width: number; height: number }> {
  try {
    return JSON.parse(readFileSync(MEDIA_MANIFEST_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

const manifest = mediaManifest();
const publishedObservationIds = new Set(
  observations.filter((o) => o.status === 'published' && o.visibility === 'public').map((o) => o.id),
);

export const allPublicObservations: PublicObservation[] = getPublicObservations().map((o) => {
  o.media = o.media.map((m) => ({
    ...m,
    width: manifest[m.id]?.width ?? 0,
    height: manifest[m.id]?.height ?? 0,
  }));
  if (o.cover) {
    o.cover = o.media.find((m) => m.id === o.cover!.id) ?? o.cover;
  }
  return o;
});

export function getObservation(publicId: string): PublicObservation | undefined {
  const found = observations.find((o) => o.public_id === publicId);
  if (!found || found.status !== 'published' || found.visibility !== 'public') return undefined;
  const o = toPublicObservation(found);
  o.media = o.media.map((m) => ({
    ...m,
    width: manifest[m.id]?.width ?? 0,
    height: manifest[m.id]?.height ?? 0,
  }));
  if (o.cover) o.cover = o.media.find((m) => m.id === o.cover!.id) ?? o.cover;
  return o;
}

// ---------- 物种聚合 ----------

export interface SpeciesGroup {
  key: string;
  /** 页面主显示名 */
  display: string;
  /** 学名排版用 rank */
  rank: Taxon['rank'];
  taxon: Taxon | null;
  /** 英文/中文副名 */
  chinese_name: string | null;
  observations: PublicObservation[];
  provinces: string[];
  personal_note: string | null;
  taxon_status: Taxon['status'] | null;
}

export function getSpeciesGroups(): SpeciesGroup[] {
  const groups = new Map<string, SpeciesGroup>();
  for (const o of allPublicObservations) {
    const idn = o.identification;
    if (!idn) continue;
    const taxon = idn.taxon_slug ? findTaxonBySlug(idn.taxon_slug) : null;
    const key = idn.display;
    let g = groups.get(key);
    if (!g) {
      g = {
        key,
        display: idn.display,
        rank: idn.taxon_rank,
        taxon,
        chinese_name: taxon?.chinese_name ?? null,
        observations: [],
        provinces: [],
        personal_note: taxon?.personal_note ?? null,
        taxon_status: taxon?.status ?? null,
      };
      groups.set(key, g);
    }
    g.observations.push(o);
    const p = o.location.state_province;
    if (!g.provinces.includes(p)) g.provinces.push(p);
  }
  for (const g of groups.values()) {
    g.observations.sort((a, b) => b.observed_at.localeCompare(a.observed_at));
  }
  return [...groups.values()].sort((a, b) => b.observations.length - a.observations.length);
}

export function getSpeciesGroup(slug: string): SpeciesGroup | undefined {
  return getSpeciesGroups().find((g) => (g.taxon?.slug ?? slugifyDisplay(g.display)) === slug);
}

export function speciesSlug(g: SpeciesGroup): string {
  return g.taxon?.slug ?? slugifyDisplay(g.display);
}

function findTaxonBySlug(slug: string): Taxon | null {
  return taxa.find((t) => t.slug === slug) ?? null;
}

function slugifyDisplay(display: string): string {
  return display
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

/** 未鉴定（无当前鉴定）的已发布观察 */
export function getUnidentifiedObservations(): PublicObservation[] {
  return allPublicObservations.filter((o) => o.identification == null);
}

// ---------- 调查 ----------

export interface PublicTripDay {
  label: string;
  title: string;
  date: string;
  text: string;
  media: { medium: string; large: string; caption: string | null; photographer: string; ratio: 'landscape' | 'portrait' | 'square' }[];
}

export interface PublicTrip {
  slug: string;
  title: string;
  subtitle: string | null;
  start_date: string;
  end_date: string;
  province: string;
  summary: string;
  cover: { medium: string; large: string } | null;
  days: PublicTripDay[];
  observations: PublicObservation[];
}

/** 仅解析「已发布且公开」观察所属的媒体，供 Trip 正文插图使用 */
function safeTripMedia(mediaIds: string[]) {
  return mediaIds
    .map((id) => mediaById.get(id))
    .filter(
      (m): m is NonNullable<ReturnType<typeof mediaById.get>> =>
        !!m && m.visibility === 'public' && publishedObservationIds.has(m.observation_id),
    )
    .map((m) => {
      const dim = manifest[m.id];
      const ratio = dim && dim.width && dim.height
        ? dim.width / dim.height > 1.15
          ? 'landscape'
          : dim.width / dim.height < 0.87
            ? 'portrait'
            : 'square'
        : 'landscape';
      return {
        medium: withBase(`/media/derivatives/${m.id}_medium.jpg`),
        large: withBase(`/media/derivatives/${m.id}_large.jpg`),
        caption: m.caption,
        photographer: displayNameOf(m.photographer_profile_id) ?? m.photographer_name ?? '未知',
        ratio: ratio as 'landscape' | 'portrait' | 'square',
      };
    });
}

export function getPublicTrips(): PublicTrip[] {
  return trips
    .filter((t) => t.visibility === 'public')
    .map((t) => {
      const cover = t.cover_media_id ? mediaById.get(t.cover_media_id) : null;
      return {
        slug: t.slug,
        title: t.title,
        subtitle: t.subtitle,
        start_date: t.start_date,
        end_date: t.end_date,
        province: t.province,
        summary: t.summary,
        cover: cover
          ? {
              medium: withBase(`/media/derivatives/${cover.id}_medium.jpg`),
              large: withBase(`/media/derivatives/${cover.id}_large.jpg`),
            }
          : null,
        days: t.days.map((d) => ({
          label: d.label,
          title: d.title,
          date: d.date,
          text: d.text,
          media: safeTripMedia(d.media_ids),
        })),
        observations: allPublicObservations.filter((o) => o.trip?.slug === t.slug),
      };
    })
    .sort((a, b) => b.start_date.localeCompare(a.start_date));
}

export function getPublicTrip(slug: string): PublicTrip | undefined {
  return getPublicTrips().find((t) => t.slug === slug);
}

// ---------- 地点（面向访客的地点视觉卡；观测 ID 留在详情页） ----------

export interface LocalityCard {
  province: string;
  name: string;
  county: string | null;
  locality: string | null;
  elevation: number | null;
  visibilityLabel: string;
  count: number;
  habitats: string[];
  cover: { thumb: string; medium: string; large: string } | null;
}

export function getLocalityCards(): LocalityCard[] {
  const byLocality = new Map<string, LocalityCard>();
  for (const o of allPublicObservations) {
    const loc = o.location;
    const nameParts = [loc.county, loc.locality].filter(Boolean) as string[];
    const key = `${loc.state_province}|${nameParts.join('·')}`;
    let card = byLocality.get(key);
    if (!card) {
      card = {
        province: loc.state_province,
        name: nameParts.join(' · ') || loc.state_province,
        county: loc.county,
        locality: loc.locality,
        elevation: loc.elevation_m,
        visibilityLabel: loc.visibility,
        count: 0,
        habitats: [],
        cover: null,
      };
      byLocality.set(key, card);
    }
    card.count += 1;
    if (o.habitat && !card.habitats.includes(o.habitat)) card.habitats.push(o.habitat);
    if (!card.cover && o.cover) {
      card.cover = { thumb: o.cover.thumb, medium: o.cover.medium, large: o.cover.large };
    }
  }
  return [...byLocality.values()].sort((a, b) => b.count - a.count);
}

// ---------- 地点（按省份聚合，仅文字层级；MVP 不做交互地图） ----------

export interface ProvinceGroup {
  province: string;
  localities: {
    name: string;
    visibilityLabel: string;
    elevation: number | null;
    count: number;
    observations: PublicObservation[];
  }[];
  count: number;
}

export function getProvinceGroups(): ProvinceGroup[] {
  const byProvince = new Map<string, ProvinceGroup>();
  for (const o of allPublicObservations) {
    const prov = o.location.state_province;
    let pg = byProvince.get(prov);
    if (!pg) {
      pg = { province: prov, localities: [], count: 0 };
      byProvince.set(prov, pg);
    }
    pg.count += 1;
    const nameParts = [o.location.county, o.location.locality].filter(Boolean) as string[];
    const name = nameParts.join(' · ') || o.location.state_province;
    let loc = pg.localities.find((l) => l.name === name);
    if (!loc) {
      loc = {
        name,
        visibilityLabel: o.location.visibility,
        elevation: o.location.elevation_m,
        count: 0,
        observations: [],
      };
      pg.localities.push(loc);
    }
    loc.count += 1;
    loc.observations.push(o);
  }
  return [...byProvince.values()].sort((a, b) => b.count - a.count);
}

// ---------- 贡献者（仅公开主页） ----------

export interface PublicContributor {
  name: string;
  nameEn: string | null;
  slug: string;
  title: string | null;
  bio: string | null;
  observationCount: number;
  provinces: string[];
  /** 代表照片（本人最喜欢的一张），用作个人卡封面 */
  favorite: { thumb: string; medium: string; large: string } | null;
  coverThumbs: { thumb: string; url: string; alt: string }[];
}

export function getPublicContributors(): PublicContributor[] {
  return profiles
    .filter((p) => p.profile_visibility === 'public' && p.slug != null)
    .map((p) => {
      const own = allPublicObservations.filter(
        (o) => o.observer_name === p.display_name || o.identification?.identified_by === p.display_name,
      );
      const observedBy = allPublicObservations.filter((o) => o.observer_name === p.display_name);
      const provinces: string[] = [];
      for (const o of observedBy) {
        if (!provinces.includes(o.location.state_province)) {
          provinces.push(o.location.state_province);
        }
      }
      const favoriteMedia = p.favorite_media_id ? mediaById.get(p.favorite_media_id) : undefined;
      const favorite =
        favoriteMedia &&
        favoriteMedia.visibility === 'public' &&
        publishedObservationIds.has(favoriteMedia.observation_id)
          ? {
              thumb: withBase(`/media/derivatives/${favoriteMedia.id}_thumb.jpg`),
              medium: withBase(`/media/derivatives/${favoriteMedia.id}_medium.jpg`),
              large: withBase(`/media/derivatives/${favoriteMedia.id}_large.jpg`),
            }
          : null;
      const coverThumbs = observedBy
        .filter((o) => o.cover)
        .slice(0, 6)
        .map((o) => ({
          thumb: o.cover!.thumb,
          url: o.url,
          alt: `${o.public_id} 封面照片`,
        }));
      return {
        name: p.display_name,
        nameEn: p.display_name_en,
        slug: p.slug!,
        title: p.title,
        bio: p.bio,
        observationCount: own.length,
        provinces,
        favorite,
        coverThumbs,
      };
    })
    .sort((a, b) => b.observationCount - a.observationCount);
}

export function getPublicContributor(slug: string): PublicContributor | undefined {
  return getPublicContributors().find((c) => c.slug === slug);
}

// ---------- 搜索索引（只含公开安全字段） ----------

export function buildSearchIndex() {
  const obs = allPublicObservations.map((o) => ({
    type: 'observation',
    id: o.public_id,
    url: o.url,
    title: o.identification?.display ?? '未鉴定的跳蛛',
    meta: `${o.observed_at} · ${o.location.state_province}`,
    text: [o.location.locality, o.habitat, o.microhabitat, o.behavior, o.field_note]
      .filter(Boolean)
      .join(' '),
    thumb: o.cover?.thumb ?? null,
  }));
  const species = getSpeciesGroups().map((g) => ({
    type: 'species',
    id: speciesSlug(g),
    url: withBase(`/species/${speciesSlug(g)}/`),
    title: g.display,
    meta: `${g.observations.length} 条记录 · ${g.provinces.join('、')}`,
    text: [g.chinese_name ?? '', g.personal_note ?? ''].join(' '),
    thumb: g.observations.find((o) => o.cover)?.cover?.thumb ?? null,
  }));
  const tripIndex = getPublicTrips().map((t) => ({
    type: 'trip',
    id: t.slug,
    url: withBase(`/trips/${t.slug}/`),
    title: t.title,
    meta: `${t.start_date.slice(0, 7)} · ${t.province}`,
    text: [t.subtitle ?? '', t.summary].join(' '),
    thumb: null,
  }));
  return { observations: obs, species, trips: tripIndex };
}
