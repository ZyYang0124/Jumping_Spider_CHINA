// 工作编号（§21-§24）：cf. / aff. / sp. / 属级 sp. 等未定名类群。
// 静态 taxa-data.json 是正式类群；这里补充 D1 中的工作编号，二者合成鉴定可选列表。
import taxaData from './taxa-data.json';
import { all, get, run, type Env } from './db';

/** 编辑器物种选择器选项（与 pages.ts boot.taxa 形状一致） */
export interface TaxonOption {
  slug: string;
  name: string;
  cn: string | null;
  rank: string;
  /** true = 工作编号（非正式发表类群） */
  working?: boolean;
}

const STATIC_TAXA = taxaData as { slug: string; scientific_name: string; chinese_name: string | null; rank: string }[];

const staticSlugs = new Set(STATIC_TAXA.map((t) => t.slug));

/** 学名/工作编号形态：字母开头，可含空格、连字符与 cf. / aff. / sp. / gen. nov. 等限定词 */
const NAME_RE = /^[A-Za-z][A-Za-z.\- ]{1,79}$/;

export function slugifyTaxonName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export interface WorkingTaxonRow {
  id: number;
  slug: string;
  scientific_name: string;
  rank: string;
  authorship: string | null;
  chinese_name: string | null;
  status: string;
  created_by: string | null;
  created_at: string;
}

export async function workingTaxaRows(env: Env): Promise<WorkingTaxonRow[]> {
  return all<WorkingTaxonRow>(env.DB, 'SELECT * FROM working_taxa ORDER BY created_at, id');
}

/** 静态正式类群 + D1 工作编号，合成编辑器完整可选列表 */
export async function allTaxonOptions(env: Env): Promise<TaxonOption[]> {
  const staticOptions: TaxonOption[] = STATIC_TAXA.map((t) => ({
    slug: t.slug,
    name: t.scientific_name,
    cn: t.chinese_name,
    rank: t.rank,
  }));
  const working = (await workingTaxaRows(env)).map((t) => ({
    slug: t.slug,
    name: t.scientific_name,
    cn: t.chinese_name,
    rank: t.rank,
    working: true,
  }));
  return [...staticOptions, ...working];
}

/** 鉴定写入用：slug → 类群（静态优先，工作编号兜底） */
export async function findTaxonOptionBySlug(env: Env, slug: string): Promise<TaxonOption | null> {
  const staticHit = STATIC_TAXA.find((t) => t.slug === slug);
  if (staticHit) return { slug: staticHit.slug, name: staticHit.scientific_name, cn: staticHit.chinese_name, rank: staticHit.rank };
  const row = await get<WorkingTaxonRow>(env.DB, 'SELECT * FROM working_taxa WHERE slug = ?', slug);
  if (!row) return null;
  return { slug: row.slug, name: row.scientific_name, cn: row.chinese_name, rank: row.rank, working: true };
}

export type CreateTaxonResult =
  | { ok: true; taxon: TaxonOption; created: boolean }
  | { ok: false; error: string; status: number };

/** 建立（或复用）工作编号；与正式类群重名时拒绝 */
export async function createWorkingTaxon(env: Env, rawName: string, actor: string): Promise<CreateTaxonResult> {
  const name = rawName.trim().replace(/\s+/g, ' ');
  if (!NAME_RE.test(name)) {
    return { ok: false, status: 400, error: '工作编号需为字母开头的学名或编号（可含 cf. / aff. / sp. 等限定词）' };
  }
  const slug = slugifyTaxonName(name);
  if (!slug) return { ok: false, status: 400, error: '无法从该名称生成稳定缩写' };
  if (staticSlugs.has(slug)) {
    return { ok: false, status: 409, error: '与正式类群重名，请在列表中直接选择' };
  }
  const existing = await get<WorkingTaxonRow>(env.DB, 'SELECT * FROM working_taxa WHERE slug = ?', slug);
  if (existing) {
    return {
      ok: true,
      created: false,
      taxon: { slug: existing.slug, name: existing.scientific_name, cn: existing.chinese_name, rank: existing.rank, working: true },
    };
  }
  await run(
    env.DB,
    'INSERT INTO working_taxa (slug, scientific_name, rank, status, created_by) VALUES (?,?,?,?,?)',
    slug,
    name,
    'species',
    'working',
    actor,
  );
  return { ok: true, created: true, taxon: { slug, name, cn: null, rank: 'species', working: true } };
}
