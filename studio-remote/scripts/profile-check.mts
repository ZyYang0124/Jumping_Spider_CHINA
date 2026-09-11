// 个人资料链路快速验证（本地 dev；用直插会话跳过 OTP）
import { execSync } from 'node:child_process';
const BASE = 'http://127.0.0.1:4344';
const TOKEN = 'profile-check-token';
let cookie = `studio_session=${TOKEN}`;
async function req(p: string, o: any = {}): Promise<Response> {
  const r = await fetch(BASE + p, { ...o, headers: { ...(o.headers ?? {}), ...(cookie ? { Cookie: cookie } : {}) } });
  return r;
}
execSync('npx wrangler d1 execute salticid-studio --local --command "INSERT OR REPLACE INTO sessions (token, user_id, expires_at) VALUES (\'profile-check-token\', (SELECT id FROM users WHERE role=\'owner\' AND email IS NOT NULL LIMIT 1), datetime(\'now\',\'+1 hour\'))"', { stdio: 'pipe' });

const page = await req('/studio/profile');
console.log('H1 个人资料页:', page.status === 200 ? 'OK' : page.status);

const save = await (await req('/studio/api/profile', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ display_name: '咩咩', title: '跳蛛分类、系统学与自然观察', bio: 'E2E 资料编辑验证。' }),
})).json();
console.log('H2 资料保存:', JSON.stringify(save));

const row = JSON.parse(execSync('npx wrangler d1 execute salticid-studio --local --json --command "SELECT title FROM user_profiles WHERE user_id=(SELECT id FROM users WHERE role=\'owner\' AND email IS NOT NULL)"', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }))[0].results[0];
console.log('H3 D1 落库 title:', row.title);

const zipBuf = await (await req('/studio/export')).arrayBuffer();
const { unzipSync } = await import('fflate');
const files = Object.keys(unzipSync(new Uint8Array(zipBuf)));
console.log('H4 导出含 profiles:', files.includes('studio-profiles.json'));
const profiles = JSON.parse(new TextDecoder().decode(unzipSync(new Uint8Array(zipBuf))['studio-profiles.json']));
const me = profiles.find((x: any) => x.id === 'prof-zhiyong');
console.log('H5 导出档案:', me.display_name, '| title:', me.title);

// 清理：恢复空 bio
execSync('npx wrangler d1 execute salticid-studio --local --command "UPDATE user_profiles SET bio=\'\' WHERE user_id=(SELECT id FROM users WHERE role=\'owner\' AND email IS NOT NULL)"', { stdio: 'pipe' });
console.log('H6 清理完成');
