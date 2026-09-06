// 数据模型类型 — 与 prompt.md §9–§21 的核心数据模型对应。
// 静态部署形态下，数据库规范落实为：类型化 JSON 源数据 + 构建期校验 + 隐私过滤管线。

export type ObservationStatus =
  | 'draft'
  | 'submitted'
  | 'review'
  | 'revision_requested'
  | 'approved'
  | 'published'
  | 'rejected'
  | 'archived';

export type Visibility = 'public' | 'private' | 'embargoed';

export type Sex = 'male' | 'female' | 'unknown' | 'mixed' | 'not_applicable';

export type LifeStage = 'adult' | 'subadult' | 'juvenile' | 'unknown' | 'mixed';

export type Evidence =
  | 'tentative'
  | 'photo_based'
  | 'specimen_examined'
  | 'genitalia_confirmed'
  | 'molecularly_supported';

export type LocationVisibility = 'exact' | 'blurred' | 'locality_only' | 'hidden';

export type MediaViewType =
  | 'live_dorsal'
  | 'live_frontal'
  | 'live_lateral'
  | 'behavior'
  | 'habitat'
  | 'specimen_dorsal'
  | 'specimen_ventral'
  | 'male_palp'
  | 'epigyne'
  | 'vulva'
  | 'microscopy'
  | 'other';

export type License = 'all_rights_reserved' | 'cc_by_4_0' | 'cc_by_nc_4_0';

export type DatePrecision = 'day' | 'month' | 'year' | 'unknown';

export type TaxonRank = 'family' | 'tribe' | 'genus' | 'species' | 'subspecies';

export type TaxonStatus = 'accepted' | 'synonym' | 'provisional' | 'unresolved';

export interface Profile {
  id: string;
  display_name: string;
  display_name_en: string | null;
  slug: string | null;
  role: 'owner' | 'editor' | 'contributor';
  profile_visibility: 'public' | 'private';
  bio: string | null;
}

export interface Taxon {
  id: string;
  rank: TaxonRank;
  scientific_name: string;
  authorship: string | null;
  chinese_name: string | null;
  parent_id: string | null;
  status: TaxonStatus;
  slug: string;
  personal_note: string | null;
}

/** 私有源数据：包含精确坐标。任何 exact_ 字段都绝不进入公开输出。 */
export interface LocationRecord {
  id: string;
  country: string;
  state_province: string;
  city: string;
  county: string;
  locality: string;
  exact_latitude: number | null;
  exact_longitude: number | null;
  public_latitude: number | null;
  public_longitude: number | null;
  coordinate_uncertainty_m: number | null;
  elevation_m: number | null;
  location_visibility: LocationVisibility;
}

export interface Observation {
  id: string;
  public_id: string;
  created_by: string;
  observer: string;
  observed_at: string;
  observed_at_precision: DatePrecision;
  location_id: string;
  sex: Sex;
  life_stage: LifeStage;
  habitat: string | null;
  microhabitat: string | null;
  behavior: string | null;
  field_note: string;
  status: ObservationStatus;
  visibility: Visibility;
  trip_id: string | null;
}

/** 鉴定独立成表：观察记录中绝不存储权威学名（DEVELOPMENT.md 规则 5/6/7）。 */
export interface Identification {
  id: string;
  observation_id: string;
  taxon_id: string;
  display_identification: string;
  identified_by_profile_id: string | null;
  identified_at: string;
  evidence: Evidence;
  remarks: string | null;
  is_current: boolean;
}

export interface MediaRecord {
  id: string;
  observation_id: string;
  source_original: string;
  view_type: MediaViewType;
  caption: string | null;
  sort_order: number;
  is_cover: boolean;
  photographer_profile_id: string | null;
  photographer_name: string | null;
  license: License;
  visibility: Visibility;
}

export interface Trip {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  start_date: string;
  end_date: string;
  province: string;
  cover_media_id: string;
  summary: string;
  story: string;
  visibility: Visibility;
}

export interface Specimen {
  id: string;
  observation_id: string;
  collector: string;
  catalog_number: string;
  field_number: string | null;
  repository: string;
  preservation: string | null;
  sex: Sex;
  life_stage: LifeStage;
  notes: string | null;
}

export interface SiteConfig {
  site_name: string;
  site_name_en: string;
  subtitle: string;
  subtitle_en: string;
  owner_profile_id: string;
  public_id_prefix: string;
  copyright_holder: string;
  disclaimer: string;
  demo_note: string;
  footer_note: string;
}
