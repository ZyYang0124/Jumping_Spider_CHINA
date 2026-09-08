// Studio v1 端到端验证（SOP §45 场景 A-F）。前置：studio 服务器运行于 4322，开发模式 OTP。
// 运行：npx tsx scripts/e2e-v1.mts <服务器日志路径>
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const ROOT = process.cwd(); // 从 studio/ 目录运行
const DB_PATH = resolve(ROOT, '../data/studio.db');
const BASE = 'http://localhost:4322';
const LOG = process.argv[2] ?? '';
const EMAIL = 'yangzy0124@gmail.com';

const failures: string[] = [];
const ok = (cond: boolean, label: string) => {
  console.log(`${cond ? '✓' : '✗'} ${label}`);
  if (!cond) failures.push(label);
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let cookie = '';
async function req(path: string, opts: any = {}): Promise<Response> {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: { ...(opts.headers ?? {}), ...(cookie ? { Cookie: cookie } : {}) },
  });
  for (const c of (res.headers as any).getSetCookie?.() ?? []) {
    const kv = String(c).split(';')[0];
    if (kv.startsWith('studio_session=')) cookie = kv;
  }
  return res;
}
const fileOf = (p: string, name: string) => new File([readFileSync(p)], name, { type: 'image/jpeg' });
const FIX = (n: 'gps' | 'nogps') => resolve(ROOT, 'scripts', 'fixtures', n === 'gps' ? 'e2e-src-gps.jpg' : 'e2e-src-nogps.jpg');

// ---------- 登录（受邀邮箱 OTP，开发模式验证码在服务器控制台） ----------
await req('/studio/login/otp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: `email=${encodeURIComponent(EMAIL)}`,
});
await sleep(400);
const log = readFileSync(LOG, 'utf8');
const codes = [...log.matchAll(new RegExp(`${EMAIL.replace('@', '@')} 的登录验证码：(\\d{6})`, 'g'))].map((m) => m[1]);
const code = codes[codes.length - 1];
ok(/^\d{6}$/.test(code ?? ''), `A0 登录：取得开发模式验证码（${code}）`);
const vres = await req('/studio/login/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: `email=${encodeURIComponent(EMAIL)}&code=${code}`,
  redirect: 'manual',
});
ok(vres.status === 302 && cookie.includes('studio_session='), 'A0 登录：OTP 校验通过并获得会话');

// ---------- 场景 A：带 GPS EXIF 的照片 → 自动读取 → 发布 → 导出坐标公开 ----------
const fd0 = new FormData();
fd0.append('photo', fileOf(FIX('gps'), 'gps.jpg'));
const xj = await (await req('/studio/api/exif-preview', { method: 'POST', body: fd0 })).json();
const x = xj.results?.[0];
ok(x?.date === '2026-09-07' && x?.gps?.lat != null, `A1 EXIF 预读：date=${x?.date} gps=${x?.gps?.lat},${x?.gps?.lng}`);

const cj = await (await req('/studio/api/observations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).json();
ok(/^SFN-\d{4}-\d{6}$/.test(cj.public_id ?? ''), `A2 新建记录：${cj.public_id}`);
const pidA = cj.public_id;

const patch = await (await req(`/studio/api/observations/${pidA}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    observed_at: x.date, latitude: x.gps.lat, longitude: x.gps.lng,
    country_name: '中国', admin1: '广东省', admin2: '惠州市', locality: '罗浮山', site_name: '海拔题词石附近小径',
    elevation_m: '620', microhabitat: '林缘叶面', behavior: '游猎', weather: '晴', field_note: '成体雄蛛，具体见照片。',
    species_taxon_slug: 'salticidae',
  }),
})).json();
ok(patch.ok === true, 'A3 autosave：字段与鉴定已保存');

const upA = new FormData();
upA.append('photos', fileOf(FIX('gps'), 'a1.jpg'));
const upj = await (await req(`/studio/observations/${pidA}/photos`, { method: 'POST', body: upA })).json();
ok(upj.ok === true && upj.added?.length === 1, `A4 照片上传：${upj.added?.[0]}`);

const pj = await (await req(`/studio/api/observations/${pidA}/publish`, { method: 'POST' })).json();
ok(pj.ok === true, `A5 发布：${pj.public_url ?? pj.error}`);

const exp = await (await req('/studio/export', { method: 'POST', redirect: 'manual' })).text();
ok(exp.includes('导出完成'), 'A6 导出：studio-*.json 已写盘');
const sObs = JSON.parse(readFileSync(resolve(ROOT, '../src/data/studio-observations.json'), 'utf8'));
const sLoc = JSON.parse(readFileSync(resolve(ROOT, '../src/data/studio-locations.json'), 'utf8'));
const aObs = sObs.find((o: any) => o.public_id === pidA);
const aLoc = sLoc.find((l: any) => l.id === aObs?.location_id);
ok(aObs && aLoc && Math.abs(aLoc.latitude - x.gps.lat) < 1e-6 && Math.abs(aLoc.longitude - x.gps.lng) < 1e-6,
  `A7 导出坐标公开：${aLoc?.latitude},${aLoc?.longitude}`);

// ---------- 场景 B：无 GPS 照片 → 发布被拦截 → 手动输入坐标后发布 ----------
const pidB = (await (await req('/studio/api/observations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).json()).public_id;
const upB = new FormData();
upB.append('photos', fileOf(FIX('nogps'), 'b1.jpg'));
await req(`/studio/observations/${pidB}/photos`, { method: 'POST', body: upB });
await req(`/studio/api/observations/${pidB}`, {
  method: 'PATCH', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ observed_at: '2026-09-06', field_note: '阴天，溪边巨石背面，一只亚成体。' }),
});
const bp1 = await (await req(`/studio/api/observations/${pidB}/publish`, { method: 'POST' })).json();
ok(bp1.ok !== true && String(bp1.error).includes('坐标'), `B1 发布拦截：${bp1.error}`);
const bp2 = await (await req(`/studio/api/observations/${pidB}`, {
  method: 'PATCH', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ latitude: '23.657200', longitude: '113.921600', admin1: '广东省', admin2: '龙门县', locality: '南昆山' }),
})).json();
const bp3 = await (await req(`/studio/api/observations/${pidB}/publish`, { method: 'POST' })).json();
ok(bp2.ok && bp3.ok === true, `B2 手动坐标后发布成功：${bp3.public_url ?? bp3.error}`);

// ---------- 场景 C：5 张照片排序与封面 ----------
const pidC = (await (await req('/studio/api/observations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).json()).public_id;
const upC = new FormData();
for (const n of ['gps', 'nogps', 'gps', 'nogps', 'gps'] as const) {
  upC.append('photos', fileOf(FIX(n), `${n}.jpg`));
}
const upCj = await (await req(`/studio/observations/${pidC}/photos`, { method: 'POST', body: upC })).json();
const cids: string[] = upCj.added;
ok(cids.length === 5, `C1 五张照片上传：${cids.join(',')}`);
const third = cids[2];
const oc = await (await req(`/studio/api/observations/${pidC}/photos/order`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ order: [third, ...cids.filter((p) => p !== third)] }),
})).json();
const db = new Database(DB_PATH, { readonly: true });
const cover = db.prepare('SELECT public_id FROM media WHERE observation_id = (SELECT id FROM observations WHERE public_id = ?) AND is_cover = 1').get(pidC) as { public_id: string } | undefined;
ok(oc.ok && cover?.public_id === third, `C2 排序后第 3 张成为封面：${cover?.public_id}`);
await req(`/studio/api/observations/${pidC}`, {
  method: 'PATCH', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ observed_at: '2026-09-07', latitude: '23.051944', longitude: '113.125', admin1: '广东省', admin2: '惠州市', locality: '罗浮山' }),
});
const cp = await (await req(`/studio/api/observations/${pidC}/publish`, { method: 'POST' })).json();
ok(cp.ok === true, `C3 排序后发布：${cp.public_url ?? cp.error}`);

// ---------- 场景 D：札记（Markdown + 双图 + 观察嵌入）→ 预览 → 发布 ----------
const bodyMd = [
  '## 山径上的半小时',
  '',
  '雨后初晴，叶片上的游猎者格外活跃。',
  '',
  `![封面图注](media:${cids[0]})`,
  '',
  `![第二张图注](media:${cids[1]})`,
  '',
  `{{observation:${pidA}}}`,
  '',
  '> 野外观感，仅供参考。',
].join('\n');
const nd = await (await req('/studio/api/notes', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ title: '雨后山径半小时', subtitle: '从沟谷到山脊，找一只翠蛛', body_md: bodyMd }),
})).json();
ok(!!nd.slug, `D1 札记创建：${nd.slug}`);
const pv = await (await req('/studio/api/notes/preview', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body_md: bodyMd }),
})).json();
ok(typeof pv.html === 'string' && pv.html.includes('amg-pair'), 'D2 预览：两张横图自动配对（amg-pair）');
ok(pv.html.includes('embed-observation') && pv.html.includes(pidA), 'D3 预览：观察嵌入渲染为卡片');
const np = await (await req(`/studio/api/notes/${nd.slug}/publish`, { method: 'POST' })).json();
ok(np.ok === true, `D4 札记发布：${np.public_url ?? np.error}`);

// ---------- 场景 F：编辑已发布观察 → 编号不变、修订留存 ----------
const fn = '编辑复核：补充生境描述（发布后修订）。';
await req(`/studio/api/observations/${pidA}`, {
  method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ field_note: fn }),
});
const revs = db.prepare("SELECT COUNT(*) c FROM revisions WHERE entity_type = 'observation' AND entity_id = ?").get(pidA) as { c: number };
const audits = db.prepare("SELECT COUNT(*) c FROM audit_logs WHERE entity_id = ?").get(pidA) as { c: number };
ok(revs.c >= 1 && audits.c >= 1, `F1 编号不变、修订 ${revs.c} 条、审计 ${audits.c} 条`);
db.close();

console.log(failures.length ? `\nE2E 失败 ${failures.length} 项` : '\nE2E 全部通过（场景 A/B/C/D/F）');
process.exit(failures.length ? 1 : 0);
