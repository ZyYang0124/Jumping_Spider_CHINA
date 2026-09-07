// 数据装载与完整性校验。
// 构建期执行（任何违规直接让 build 失败），等价于数据库层的外键约束与状态机约束。

import type {
  Identification,
  LocationRecord,
  MediaRecord,
  Observation,
  Profile,
  SiteConfig,
  Specimen,
  Taxon,
  Trip,
} from './types';

// 数据以 Vite 静态导入内联进构建产物；这里的 JSON 即「数据库」的源表。
import siteConfigJson from '../data/site.config.json';
import profilesJson from '../data/profiles.json';
import taxaJson from '../data/taxa.json';
import locationsJson from '../data/locations.json';
import observationsJson from '../data/observations.json';
import identificationsJson from '../data/identifications.json';
import mediaJson from '../data/media.json';
import tripsJson from '../data/trips.json';
import specimensJson from '../data/specimens.json';

export const siteConfig = siteConfigJson as unknown as SiteConfig;
export const profiles = profilesJson as unknown as Profile[];
export const taxa = taxaJson as unknown as Taxon[];
export const locations = locationsJson as unknown as LocationRecord[];
export const observations = observationsJson as unknown as Observation[];
export const identifications = identificationsJson as unknown as Identification[];
export const media = mediaJson as unknown as MediaRecord[];
export const trips = tripsJson as unknown as Trip[];
export const specimens = specimensJson as unknown as Specimen[];

// ---------- 校验（dev/构建期 "migration gate"） ----------

function fail(msg: string): never {
  throw new Error(`[数据校验失败] ${msg}`);
}

function validate(): void {
  const profileIds = new Set(profiles.map((p) => p.id));
  const taxonIds = new Set(taxa.map((t) => t.id));
  const locationIds = new Set(locations.map((l) => l.id));
  const observationIds = new Set(observations.map((o) => o.id));
  const mediaIds = new Set(media.map((m) => m.id));
  const mediaPublicIds = new Set<string>();
  const tripIds = new Set(trips.map((t) => t.id));
  const publicIds = new Set<string>();

  for (const t of taxa) {
    if (t.parent_id && !taxonIds.has(t.parent_id)) fail(`taxon ${t.id} 的 parent_id 不存在`);
  }

  for (const o of observations) {
    if (publicIds.has(o.public_id)) fail(`public_id 重复：${o.public_id}`);
    if (!/^CSFN-\d{4}-\d{6}$/.test(o.public_id)) fail(`public_id 格式非法：${o.public_id}（不得包含学名/地名/人名）`);
    publicIds.add(o.public_id);
    if (!observationIds.has(o.id)) fail(`观察 ${o.public_id} 自引用异常`);
    if (!profileIds.has(o.observer)) fail(`观察 ${o.public_id} 的 observer 不存在`);
    if (!locationIds.has(o.location_id)) fail(`观察 ${o.public_id} 的 location_id 不存在`);
    if (o.trip_id && !tripIds.has(o.trip_id)) fail(`观察 ${o.public_id} 的 trip_id 不存在`);
  }

  // 规则 6/7：每条鉴定必须引用 taxon 记录；每条观察至多一条当前鉴定
  const currentPerObservation = new Map<string, number>();
  for (const idn of identifications) {
    if (!observationIds.has(idn.observation_id)) fail(`鉴定 ${idn.id} 指向不存在的观察`);
    if (!taxonIds.has(idn.taxon_id)) fail(`鉴定 ${idn.id} 未引用 taxon 记录（规则 6）`);
    if (idn.is_current) {
      currentPerObservation.set(idn.observation_id, (currentPerObservation.get(idn.observation_id) ?? 0) + 1);
    }
  }
  for (const [obsId, n] of currentPerObservation) {
    if (n > 1) fail(`观察 ${obsId} 存在 ${n} 条当前鉴定（is_current 必须唯一）`);
  }

  for (const m of media) {
    if (!observationIds.has(m.observation_id)) fail(`媒体 ${m.id} 指向不存在的观察`);
    if (!/^CSFN-M-\d{6}$/.test(m.public_id)) fail(`媒体 ${m.id} 的 public_id 格式非法：${m.public_id}`);
    if (mediaPublicIds.has(m.public_id)) fail(`媒体 public_id 重复：${m.public_id}`);
    mediaPublicIds.add(m.public_id);
    if (m.photographer_profile_id && !profileIds.has(m.photographer_profile_id)) {
      fail(`媒体 ${m.id} 的 photographer 不存在`);
    }
  }
  for (const t of trips) {
    if (t.cover_media_id && !mediaIds.has(t.cover_media_id)) fail(`调查 ${t.id} 的封面媒体不存在`);
  }
  for (const s of specimens) {
    if (!observationIds.has(s.observation_id)) fail(`标本 ${s.id} 指向不存在的观察`);
  }

  // 地点隐私一致性：blurred 必须有脱敏坐标；locality_only/hidden 绝不携带公开坐标
  for (const l of locations) {
    if (l.location_visibility === 'blurred' && (l.public_latitude == null || l.public_longitude == null)) {
      fail(`地点 ${l.id} 为 blurred 但缺少 public 坐标`);
    }
    if (l.location_visibility === 'exact' &&
        (l.public_latitude !== l.exact_latitude || l.public_longitude !== l.exact_longitude)) {
      fail(`地点 ${l.id} 为 exact 但 public 坐标与 exact 坐标不一致`);
    }
    if ((l.location_visibility === 'locality_only' || l.location_visibility === 'hidden') &&
        l.public_latitude != null) {
      fail(`地点 ${l.id} 不允许携带公开坐标`);
    }
  }
}
validate();

// ---------- 索引 ----------

export const profileById = new Map(profiles.map((p) => [p.id, p]));
export const taxonById = new Map(taxa.map((t) => [t.id, t]));
export const locationById = new Map(locations.map((l) => [l.id, l]));
export const observationById = new Map(observations.map((o) => [o.id, o]));
export const mediaByObservation = new Map<string, MediaRecord[]>();
for (const m of media) {
  const list = mediaByObservation.get(m.observation_id) ?? [];
  list.push(m);
  mediaByObservation.set(m.observation_id, list);
}
for (const list of mediaByObservation.values()) {
  list.sort((a, b) => a.sort_order - b.sort_order);
}
export const mediaById = new Map(media.map((m) => [m.id, m]));
export const tripById = new Map(trips.map((t) => [t.id, t]));
export const specimenByObservation = new Map(specimens.map((s) => [s.observation_id, s]));
export const currentIdentificationByObservation = new Map<string, Identification>();
for (const idn of identifications) {
  if (idn.is_current) currentIdentificationByObservation.set(idn.observation_id, idn);
}
export const identificationsByObservation = new Map<string, Identification[]>();
for (const idn of identifications) {
  const list = identificationsByObservation.get(idn.observation_id) ?? [];
  list.push(idn);
  identificationsByObservation.set(idn.observation_id, list);
}
for (const list of identificationsByObservation.values()) {
  list.sort((a, b) => a.identified_at.localeCompare(b.identified_at));
}

export function displayNameOf(profileId: string | null): string | null {
  if (!profileId) return null;
  return profileById.get(profileId)?.display_name ?? null;
}
