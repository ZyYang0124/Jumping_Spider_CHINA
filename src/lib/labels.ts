import type {
  Evidence,
  LifeStage,
  License,
  MediaViewType,
  ObservationStatus,
  Sex,
} from './types';

// 受控词表的中文标签（prompt.md §13：UI 不要写得太技术化）

export const EVIDENCE_ZH: Record<Evidence, string> = {
  tentative: '暂定参考',
  photo_based: '照片鉴定',
  specimen_examined: '标本检视',
  genitalia_confirmed: '外生殖器确认',
  molecularly_supported: '分子数据支持',
};

export const SEX_ZH: Record<Sex, string> = {
  male: '雄性',
  female: '雌性',
  unknown: '性别不明',
  mixed: '雌雄同记',
  not_applicable: '不适用',
};

export const LIFE_STAGE_ZH: Record<LifeStage, string> = {
  adult: '成体',
  subadult: '亚成体',
  juvenile: '幼体',
  unknown: '未知',
  mixed: '多龄混合',
};

export const VIEW_TYPE_ZH: Record<MediaViewType, string> = {
  live_dorsal: '活体·背面',
  live_frontal: '活体·正面',
  live_lateral: '活体·侧面',
  behavior: '行为',
  habitat: '生境',
  specimen_dorsal: '标本·背面',
  specimen_ventral: '标本·腹面',
  male_palp: '雄性触肢器',
  epigyne: '外雌器',
  vulva: '阴门',
  microscopy: '镜检',
  other: '其他',
};

export const LICENSE_ZH: Record<License, string> = {
  all_rights_reserved: '版权所有',
  cc_by_4_0: 'CC BY 4.0',
  cc_by_nc_4_0: 'CC BY-NC 4.0',
};

export const RANK_ZH: Record<string, string> = {
  family: '科',
  tribe: '族',
  genus: '属',
  species: '种',
  subspecies: '亚种',
};

export const STATUS_BADGE_ZH: Record<string, string> = {
  draft: '草稿',
  submitted: '待审核',
  review: '审核中',
  revision_requested: '需修改',
  approved: '已通过',
  published: '已发布',
  rejected: '未通过',
  archived: '已归档',
};
