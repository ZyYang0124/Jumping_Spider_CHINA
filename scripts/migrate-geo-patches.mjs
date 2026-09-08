// 一次性迁移补丁：页面组件 → 全球地理模型字段（SOP 阶段 03）
import { readFileSync, writeFileSync } from 'node:fs';

function patch(path, pairs) {
  let s = readFileSync(path, 'utf8');
  let miss = 0;
  for (const [a, b] of pairs) {
    if (!s.includes(a)) {
      console.log('MISS in ' + path + ': ' + a.slice(0, 70));
      miss++;
      continue;
    }
    s = s.split(a).join(b);
  }
  writeFileSync(path, s);
  console.log('patched ' + path + (miss ? `（${miss} 处未命中）` : ''));
}

patch('src/components/ObsCard.astro', [
  ['{formatDate(obs.observed_at, obs.observed_at_precision)} · {obs.location.state_province}\n      {obs.location.county ? ` ${obs.location.county}` : \'\'}',
   '{formatDate(obs.observed_at, obs.observed_at_precision)} · {shortRegion(obs.location)}'],
  ["import { formatDate } from '../lib/format';", "import { formatDate, shortRegion } from '../lib/format';"],
]);

patch('src/pages/index.astro', [
  ['{formatDate(lead.observed_at, lead.observed_at_precision)} · {lead.location.state_province}\n                {lead.location.county ? ` ${lead.location.county}` : \'\'}',
   '{formatDate(lead.observed_at, lead.observed_at_precision)} · {shortRegion(lead.location)}'],
  ['{formatDate(o.observed_at, o.observed_at_precision)} · {o.location.state_province}\n              {o.location.county ? ` ${o.location.county}` : \'\'}',
   '{formatDate(o.observed_at, o.observed_at_precision)} · {shortRegion(o.location)}'],
  ['<div class="dates">{t.province} · {t.start_date} – {t.end_date} · {t.observations.length} 条记录</div>',
   '<div class="dates">{t.region} · {t.start_date} – {t.end_date} · {t.observations.length} 条记录</div>'],
  ["<div class=\"sub\">{g.observations.length} 条记录 · {g.provinces.join('、')}</div>",
   "<div class=\"sub\">{g.observations.length} 条记录 · {g.regions.join('、')}</div>"],
  ['<div class="meta">{p.province} · {p.count} 次相遇',
   '<div class="meta">{p.country_name === \'中国\' ? p.admin1 : p.country_name + \' · \' + p.admin1} · {p.count} 次相遇'],
  ["import { sciNameHtml, formatDate } from '../lib/format';", "import { sciNameHtml, formatDate, shortRegion } from '../lib/format';"],
]);

patch('src/pages/contributors/index.astro', [
  ["{c.observationCount} 次观察\n              {c.provinces.length > 0 && <span class=\"pv\"> · {c.provinces.join(' · ')}</span>}",
   "{c.observationCount} 次观察\n              {c.regions.length > 0 && <span class=\"pv\"> · {c.regions.join(' · ')}</span>}"],
]);

patch('src/pages/contributors/[slug].astro', [
  ['{c.observationCount} 条相关记录{c.provinces.length > 0 && ` · ${c.provinces.join(\'、\')}`}',
   '{c.observationCount} 条相关记录{c.regions.length > 0 && ` · ${c.regions.join(\'、\')}`}'],
  ['<span class="loc-meta">{o.observed_at} · {o.location.state_province}</span>',
   '<span class="loc-meta">{o.observed_at} · {shortRegion(o.location)}</span>'],
  ["import { getPublicContributor, getPublicContributors, allPublicObservations } from '../../lib/queries';",
   "import { getPublicContributor, getPublicContributors, allPublicObservations } from '../../lib/queries';\nimport { shortRegion } from '../../lib/format';"],
]);

patch('src/pages/species/index.astro', [
  ["{g.observations.length} 次相遇 · {g.provinces.join('、')}", "{g.observations.length} 次相遇 · {g.regions.join('、')}"],
]);

patch('src/pages/species/[slug].astro', [
  ["        {group.observations.length} 次相遇\n        {group.provinces.length > 0 && <> · {group.provinces.join('、')}</>}",
   "        {group.observations.length} 次相遇\n        {group.regions.length > 0 && <> · {group.regions.join('、')}</>}"],
  ["    const key = o.location.state_province;\n    const nameParts = [o.location.county, o.location.locality].filter(Boolean) as string[];\n    const list = placeSet.get(key) ?? [];",
   "    const key = shortRegion(o.location);\n    const nameParts = [o.location.admin2, o.location.locality ?? o.location.site_name].filter(Boolean) as string[];\n    const list = placeSet.get(key) ?? [];"],
  ["import { getSpeciesGroup, getSpeciesGroups, getMediaOfObservations, speciesSlug } from '../../lib/queries';",
   "import { getSpeciesGroup, getSpeciesGroups, getMediaOfObservations, speciesSlug } from '../../lib/queries';\nimport { shortRegion } from '../../lib/format';"],
]);

patch('src/pages/trips/index.astro', [
  ['{t.province} · {t.start_date} – {t.end_date} · {t.observations.length} 条记录', '{t.region} · {t.start_date} – {t.end_date} · {t.observations.length} 条记录'],
]);

patch('src/pages/trips/[slug].astro', [
  ['<div class="kicker">Field Trip · {trip.province}</div>', '<div class="kicker">Field Trip · {trip.region}</div>'],
]);

patch('src/pages/observations/[id].astro', [
  ["        o.location.state_province === obs.location.state_province),", "        o.location.admin1 === obs.location.admin1 && o.location.country_code === obs.location.country_code),"],
  ['{formatDate(obs.observed_at, obs.observed_at_precision)} · {locationLine(loc)}', '{locationLine(loc)} · {formatDate(obs.observed_at, obs.observed_at_precision)}'],
  ['<div class="side-primary">{loc.locality ?? loc.county ?? loc.state_province}</div>', '<div class="side-primary">{loc.locality ?? loc.site_name ?? loc.admin2 ?? loc.admin1}</div>'],
  ['<div class="side-secondary">{[loc.state_province, loc.county].filter(Boolean).join(\' · \')}</div>', '<div class="side-secondary">{[loc.country_name, loc.admin1].filter(Boolean).join(\' · \')}</div>'],
]);
console.log('ALL PATCHES DONE');
