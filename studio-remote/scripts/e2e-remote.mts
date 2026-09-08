// Studio 远程版端到端验证（对本地 studio/scripts/e2e-v1.mts 的移植）。
// 前置：`wrangler dev --port 4333`（本地 D1/R2 模拟）+ fixtures。
// 运行：npx tsx scripts/e2e-remote.mts <wrangler日志路径>
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';
import sharp from 'sharp';
import { unzipSync } from 'fflate';

const ROOT = process.cwd(); // studio-remote/
const BASE = 'http://127.0.0.1:4344';
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

// 浏览器端 canvas 派生图的本地等价物（sharp 生成同样的分组字段）
async function preparedUpload(file: Buffer, name: string) {
  const img = sharp(file);
  const meta = await img.metadata();
  const width = meta.width!;
  const height = meta.height!;
  const variants: { name: string; blob: Blob }[] = [];
  for (const w of [480, 768, 1280, 1920].filter((x) => x <= width)) {
    const bufJ = await sharp(file).resize({ width: w }).jpeg({ quality: 82 }).toBuffer();
    variants.push({ name: `${w}.jpg`, blob: new Blob([bufJ], { type: 'image/jpeg' }) });
    const bufW = await sharp(file).resize({ width: w }).webp({ quality: 72 }).toBuffer();
    variants.push({ name: `${w}.webp`, blob: new Blob([bufW], { type: 'image/webp' }) });
  }
  return {
    original: new File([file], name, { type: 'image/jpeg' }),
    width,
    height,
    variants,
  };
}

function appendUpload(fd: FormData, p: Awaited<ReturnType<typeof preparedUpload>>) {
  fd.append('original', p.original, p.original.name);
  fd.append('width', String(p.width));
  fd.append('height', String(p.height));
  for (const v of p.variants) fd.append('variant', v.blob, v.name);
}

function d1(sql: string): any[] {
  const out = execSync(
    `npx wrangler d1 execute salticid-studio --local --json --command "${sql.replace(/"/g, '\\"')}"`,
    { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
  );
  const parsed = JSON.parse(out);
  return parsed?.[0]?.results ?? [];
}

// ---------- 登录（受邀邮箱 OTP；wrangler dev 控制台读取验证码） ----------
await req('/studio/login/otp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: `email=${encodeURIComponent(EMAIL)}`,
});
await sleep(500);
const log = readFileSync(LOG, 'utf8');
const codes = [...log.matchAll(new RegExp(`${EMAIL} 的登录验证码：(\\d{6})`, 'g'))].map((m) => m[1]);
const code = codes[codes.length - 1];
ok(/^\d{6}$/.test(code ?? ''), `A0 登录：取得验证码（${code}）`);
const vres = await req('/studio/login/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: `email=${encodeURIComponent(EMAIL)}&code=${code}`,
  redirect: 'manual',
});
ok(vres.status === 302 && cookie.includes('studio_session='), 'A0 登录：OTP 校验通过并获得会话');

// ---------- 场景 A ----------
const gpsBuf = readFileSync(resolve(ROOT, 'fixtures/e2e-src-gps.jpg'));
const nogpsBuf = readFileSync(resolve(ROOT, 'fixtures/e2e-src-nogps.jpg'));

const fd0 = new FormData();
fd0.append('photo', new File([gpsBuf], 'gps.jpg', { type: 'image/jpeg' }));
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
    country_name: '中国', admin1: '广东省', admin2: '惠州市', locality: '罗浮山', site_name: '山径林缘',
    elevation_m: '620', microhabitat: '林缘叶面', behavior: '游猎', weather: '晴',
    field_note: '成体雄蛛，远程 E2E 样本。', species_taxon_slug: 'salticidae',
  }),
})).json();
ok(patch.ok === true, 'A3 autosave：字段与鉴定已保存');

const upA = new FormData();
appendUpload(upA, await preparedUpload(gpsBuf, 'a1.jpg'));
const upAres = await req(`/studio/observations/${pidA}/photos`, { method: 'POST', body: upA });
const upAj = await upAres.json().catch(() => ({}));
ok(upAres.ok && upAj.added?.length === 1, `A4 照片上传：${upAj.added?.[0] ?? (await upAres.text()).slice(0, 80)}`);

const pj = await (await req(`/studio/api/observations/${pidA}/publish`, { method: 'POST' })).json();
ok(pj.ok === true, `A5 发布：${pj.public_url ?? pj.error}`);

const expRes = await req('/studio/export');
ok(expRes.ok && (expRes.headers.get('content-type') ?? '').includes('zip'), 'A6 导出：zip 包可下载');
const zipBuf = new Uint8Array(await expRes.arrayBuffer());
const zip = unzipSync(zipBuf);
ok(['studio-observations.json', 'studio-locations.json', 'studio-media.json', 'studio-identifications.json', 'studio-posts.json', 'README.txt'].every((f) => f in zip), 'A6 导出：五个 JSON 与说明齐全');
const aObs = JSON.parse(new TextDecoder().decode(zip['studio-observations.json'])).find((o: any) => o.public_id === pidA);
const aLoc = JSON.parse(new TextDecoder().decode(zip['studio-locations.json'])).find((l: any) => l.id === aObs?.location_id);
ok(aObs && aLoc && Math.abs(aLoc.latitude - x.gps.lat) < 1e-6, `A7 导出坐标公开：${aLoc?.latitude},${aLoc?.longitude}`);
const aIdn = JSON.parse(new TextDecoder().decode(zip['studio-identifications.json']));
ok(aIdn[0]?.taxon_id === 'tax-salticidae', 'A7 导出鉴定：taxon_id 已映射');
ok(Object.keys(zip).some((k) => k.startsWith('originals/SFN-M-')), 'A6 导出：原图已打包');

// R2 派生图可读（Studio 内部路由）
const der = await req(`/media/derivatives/${upAj.added?.[0]}-480.jpg`);
ok(der.ok && (der.headers.get('content-type') ?? '').includes('image/jpeg'), 'A8 R2 派生图可访问');

// ---------- 场景 B ----------
const pidB = (await (await req('/studio/api/observations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).json()).public_id;
const upB = new FormData();
appendUpload(upB, await preparedUpload(nogpsBuf, 'b1.jpg'));
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

// ---------- 场景 C ----------
const pidC = (await (await req('/studio/api/observations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).json()).public_id;
const upC = new FormData();
for (const n of ['gps', 'nogps', 'gps', 'nogps', 'gps'] as const) {
  appendUpload(upC, await preparedUpload(n === 'gps' ? gpsBuf : nogpsBuf, `${n}.jpg`));
}
const upCres = await req(`/studio/observations/${pidC}/photos`, { method: 'POST', body: upC });
const upCj = await upCres.json().catch(() => ({}));
const cids: string[] = upCj.added ?? [];
ok(cids.length === 5, `C1 五张照片上传：${cids.join(',')}`);
const third = cids[2];
const oc = await (await req(`/studio/api/observations/${pidC}/photos/order`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ order: [third, ...cids.filter((p) => p !== third)] }),
})).json();
const coverRow = d1(`SELECT public_id FROM media WHERE observation_id = (SELECT id FROM observations WHERE public_id = '${pidC}') AND is_cover = 1`);
ok(oc.ok && coverRow[0]?.public_id === third, `C2 排序后第 3 张成为封面：${coverRow[0]?.public_id}`);
await req(`/studio/api/observations/${pidC}`, {
  method: 'PATCH', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ observed_at: '2026-09-07', latitude: '23.051944', longitude: '113.125', admin1: '广东省', admin2: '惠州市', locality: '罗浮山' }),
});
const cp = await (await req(`/studio/api/observations/${pidC}/publish`, { method: 'POST' })).json();
ok(cp.ok === true, `C3 排序后发布：${cp.public_url ?? cp.error}`);

// ---------- 场景 D ----------
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

// ---------- 场景 F ----------
await req(`/studio/api/observations/${pidA}`, {
  method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ field_note: '编辑复核：补充生境描述（发布后修订）。' }),
});
const revs = d1(`SELECT COUNT(*) AS c FROM revisions WHERE entity_type = 'observation' AND entity_id = '${pidA}'`);
const audits = d1(`SELECT COUNT(*) AS c FROM audit_logs WHERE entity_id = '${pidA}'`);
ok((revs[0]?.c ?? 0) >= 1 && (audits[0]?.c ?? 0) >= 1, `F1 编号不变、修订 ${revs[0]?.c} 条、审计 ${audits[0]?.c} 条`);

// 未登录防护（wrangler dev 偶发连接抖动，重试两次）
async function fetchRetry(url: string, opts: any = {}): Promise<Response> {
  let err: unknown;
  for (let i = 0; i < 3; i++) {
    try { return await fetch(url, opts); } catch (e) { err = e; await sleep(1500); }
  }
  throw err;
}
cookie = '';
const anon = await fetchRetry(BASE + '/studio', { redirect: 'manual' });
ok(anon.status === 302, 'S1 未登录访问 /studio 重定向到登录页');
const anonApi = await fetchRetry(BASE + '/studio/api/observations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
ok(anonApi.status === 401, 'S2 未登录 API 返回 401');

writeFileSync(resolve(ROOT, '.e2e-manifest.json'), JSON.stringify({ pidA, pidB, pidC, cids, note: nd.slug }, null, 2));
console.log(failures.length ? `\nE2E 失败 ${failures.length} 项` : '\nE2E 全部通过（远程版场景 A/B/C/D/F + 安全探测）');
process.exit(failures.length ? 1 : 0);
