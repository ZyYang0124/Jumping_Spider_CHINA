可以。既然明确**不是“中国跳蛛数据库”**，而是“你的个人跳蛛观察网站 + 少量受邀朋友共同投稿”，那开发规范应该完全换一个中心：

> **它首先是个人自然史作品，其次才是结构化数据系统。**

上传接口的目的也不是 crowdsourcing，而是让你信任的朋友把观察材料交给你，由你决定如何呈现、鉴定和组织。

我建议把项目正式定义为：

# China Salticid Field Notes — Development SOP v1.0

---

## 1. 产品定位

### 1.1 网站是什么

这是一个：

> 记录本人及受邀朋友在中国观察、拍摄、采集和研究跳蛛经历的个人自然史网站。

核心内容是：

- 野外观察
- 活体照片
- 生境
- 行为
- 物种识别
- 个人笔记
- 野外调查故事
- 少量标本和分类学信息
- 朋友贡献的观察

### 1.2 网站不是什么

明确**不做**：

- 中国跳蛛完整名录
- World Spider Catalog 替代品
- GBIF 替代品
- iNaturalist 替代品
- 公共物种鉴定平台
- 大规模公众上传平台
- 中国跳蛛权威数据库

因此：

**缺物种没有关系。**

没有观察过的物种甚至完全可以不出现。

这句话非常重要：

> 网站的边界由“我们实际观察过什么”决定，而不是“中国有哪些跳蛛”决定。

---

# 2. 核心设计原则

整个开发过程中坚持六条。

### P1｜Observation First

最基本实体是：

**Observation**

而不是 Species。

---

### P2｜Personal First

网站应该让人感觉：

> “这是杨智勇和朋友们在野外看到的跳蛛。”

而不是：

> “这是某机构的信息管理系统。”

所以文字、摄影、游记、生境笔记的重要性不低于结构化字段。

---

### P3｜Curated, not crowdsourced

朋友可以投稿。

但是：

> **投稿 ≠ 自动公开。**

所有记录必须经过审核。

---

### P4｜Evidence-aware

鉴定可以不同程度可靠：

```text
Tentative
Photo-based
Specimen examined
Genitalia confirmed
Molecularly supported
```

网站不能把所有鉴定表现成同等确定。

---

### P5｜Taxonomy can change

一条 observation 永远代表：

> “某时某地发生的一次观察。”

分类名可以以后改变。

因此 observation 与 taxon 不应写死绑定。

---

### P6｜Photography First

这是一个非常依赖视觉的网站。

图片不是附件，而是核心数据。

---

# 3. 用户体系

第一版只设计四种角色。

```text
Visitor
Contributor
Editor
Owner
```

---

## 3.1 Visitor

任何访客。

可以：

- 浏览
- 搜索
- 看地图
- 看物种
- 看 observation
- 看 trip
- 分享链接

不能：

- 上传
- 编辑
- 评论
- 修改鉴定

---

## 3.2 Contributor

你的朋友。

只能通过：

> **邀请制账号**

注册。

可以：

- 创建 observation
- 上传照片
- 填写地点
- 填写日期
- 填写生境
- 提交自己认为的鉴定
- 修改自己尚未发布的 observation

不能：

- 直接公开
- 修改 Taxonomy
- 修改别人的 observation
- 删除已经发表的数据
- 修改鉴定审核结果

---

## 3.3 Editor

以后如果有可靠合作者。

可以：

- 审核 submission
- 修改 metadata
- 添加 identification
- 管理 taxon
- 发布记录

第一版甚至可以没有。

---

## 3.4 Owner

就是你。

拥有：

```text
full access
```

包括：

- publish
- unpublish
- edit
- taxonomic determination
- contributor management
- site configuration
- trip management
- sensitive coordinates
- media management

---

# 4. 上传机制

这是新版最重要的变化。

我建议：

# 不做“上传物种”

只做：

> **上传 Observation**

朋友看到了一只蜘蛛：

```text
New Observation
```

---

# 5. 投稿工作流

完整状态机：

```text
Draft
  ↓
Submitted
  ↓
Under Review
  ↓
Approved
  ↓
Published
```

同时允许：

```text
Submitted
  ↓
Needs Revision
```

或者：

```text
Rejected
```

---

## 5.1 Draft

朋友自己编辑。

别人看不到。

---

## 5.2 Submitted

投稿完成。

之后原则上锁定核心字段。

你进入后台审核。

---

## 5.3 Under Review

你正在：

- 检查图片
- 检查地点
- 判断鉴定
- 判断是否公开坐标
- 整理文字

---

## 5.4 Approved

内容通过。

但可以先不发布。

例如：

> 新种记录暂时 embargo。

---

## 5.5 Published

才进入公开网站。

---

# 6. 一个 Observation 的标准数据结构

建议强制区分：

## 必填

```text
observer
date
country
province
locality
photos
```

朋友至少必须填这些。

---

## 推荐填写

```text
scientific_name_guess
sex
life_stage
habitat
microhabitat
behavior
latitude
longitude
elevation
notes
```

---

## 专业字段

由你负责：

```text
identification_status
identified_by
determination_date
voucher
specimen_repository
taxon_id
taxonomic_notes
coordinate_precision
coordinate_visibility
publication_status
```

朋友不需要面对这些。

这是非常重要的 UX 原则：

> **投稿表单是自然观察表单，不是博物馆数据库录入表。**

---

# 7. 上传页面 UX

不要做一页 40 个字段。

应该是：

```text
Step 1
照片

Step 2
什么时候、在哪里？

Step 3
你看到什么？

Step 4
有什么想记录的？

Step 5
提交
```

---

## Step 1｜上传照片

支持：

```text
JPG
JPEG
PNG
HEIC
```

单条 observation：

建议最多：

```text
20 images
```

首图可以选择：

```text
Cover photo
```

上传以后允许拖动排序。

---

## Step 2｜时间和地点

```text
Date
Province
City / County
Locality
Map pin
Elevation
```

如果照片带 EXIF：

自动提取：

```text
datetime
GPS
```

但必须：

> 显示给上传者确认。

不要静默写入。

---

# 8. 地点数据必须区分三个层次

这是野外生物数据网站必须从第一天做好的。

数据库：

```text
exact_latitude
exact_longitude

public_latitude
public_longitude

locality_text
```

再加：

```text
location_visibility
```

取值：

```text
exact
blurred
locality_only
hidden
```

例如：

### 常见城市种

```text
exact
```

### 普通野外记录

```text
blurred
```

### 新种

```text
locality_only
```

### 极敏感记录

```text
hidden
```

---

# 9. 图片同样要分公开级别

字段：

```text
media_visibility
```

例如：

```text
public
private
embargoed
```

因为以后很可能出现：

> 朋友给你传一个尚未发表的新种。

不能因为 observation 未发布就默认所有图片管理逻辑都很简单。

---

# 10. Observation ID 永远不能变

每条记录建立永久 ID。

例如：

```text
CSFN-2026-000001
CSFN-2026-000002
```

不要放：

```text
species_name
province
observer_name
```

到主 ID 里。

因为这些都会变化。

URL：

```text
/observations/CSFN-2026-000182
```

永远有效。

---

# 11. Taxonomy 的定位要弱化

因为不是数据库，所以 Taxon 表保持轻量。

```text
Taxon
├── id
├── rank
├── scientific_name
├── author
├── parent_id
├── accepted_name_id
└── status
```

只录：

> 网站实际需要的 taxa。

不要从 WSC 导入两万条蜘蛛。

---

# 12. Identification 必须独立成表

绝对不要：

```text
Observation.species = "Siler cupreus"
```

而应该：

```text
Observation

Identification
    observation_id
    taxon_id
    identified_by
    date
    confidence
    evidence
    remarks
    current
```

因此可以出现：

```text
2026
Siler cf. cupreus

↓

2027
Siler sp. A

↓

2029
Siler yangi
```

网页显示：

### Current identification

*Siler yangi*

然后专业区域可以看到：

### Identification history

这会非常有价值。

---

# 13. 鉴定状态统一规范

第一版只使用五级。

```text
tentative
photo_based
specimen_examined
genitalia_confirmed
molecularly_supported
```

UI 不要写得太技术化。

例如：

```text
Likely identification

Photo confirmed

Specimen examined

Confirmed by genital morphology

Supported by molecular data
```

---

# 14. Contributors 不等于 Authors

设计三个概念：

```text
observer
contributor
identifier
```

例如：

> 张三观察并拍照  
> 李四上传  
> 杨智勇鉴定

就是：

```text
observer = 张三
contributor = 李四
identified_by = 杨智勇
```

不要混在一个 `user` 字段里。

---

# 15. Contributor Profile

朋友应该可以有自己的个人页。

例如：

# Tao Li

```text
23 observations

Yunnan
Guangdong
Hebei
```

照片墙。

简介可以只有：

> Interested in jumping spiders and natural history photography.

但是是否公开 profile：

```text
profile_visibility
```

由本人决定。

---

# 16. 网站信息架构

第一版正式确定为：

```text
/
│
├── /observations
│
├── /observations/[id]
│
├── /species
│
├── /species/[slug]
│
├── /places
│
├── /trips
│
├── /trips/[slug]
│
├── /contributors
│
├── /about
│
│
├── /login
│
└── /studio
```

`studio` 是管理后台。

不是：

```text
admin
```

我反而推荐叫：

# Field Studio

很符合网站气质。

---

# 17. Field Studio

登录后：

```text
Field Studio
│
├── Dashboard
├── Observations
├── Submissions
├── Trips
├── Species
├── Media
└── Contributors
```

你的 Dashboard：

```text
4 submissions awaiting review

8 draft observations

3 unidentified records

2 sensitive observations
```

---

# 18. Observation 页面规范

固定结构：

```text
Hero photo

Scientific name
Common / Chinese name
Date · Place
Observer
```

然后：

## Field note

这部分最重要。

不要表格化。

应该像自然史笔记。

---

然后：

## Photographs

照片墙。

---

然后：

## Observation

```text
Sex
Life stage
Habitat
Microhabitat
Behavior
Elevation
```

---

然后：

## Location

地图。

---

然后：

## Identification

```text
Identified as
Identified by
Evidence
Confidence
```

---

然后：

## Specimen

如果存在才显示。

---

# 19. Species 页面规范

Species 页面不是百科。

原则：

> 只总结网站内部 observation。

例如：

# *Siler cupreus*

下面：

```text
18 observations
Guangxi · Guangdong · Hainan
```

---

### From my field notes

你的自然语言总结：

> 我在华南多次观察到该种……

这个内容是灵魂。

---

### Observations

照片墙。

---

### Where we found it

网站内部地图。

一定写：

> Observations shown here represent records documented on this site and should not be interpreted as the species' complete distribution.

否则很容易被误解成分布数据库。

---

### Identification notes

可以写专业内容。

---

### Similar species

---

### Taxonomic notes

需要时才出现。

---

# 20. Trip 是一级实体

我强烈建议保留。

例如：

```text
/trips/2026-xishuangbanna
```

页面：

# Xishuangbanna · July 2026

Hero 是森林。

然后：

> 六天野外记录……

路线。

观察照片。

当天日记。

Species seen：

```text
24 species
76 observations
```

这种内容才真正体现“个人网站”。

---

# 21. Notes 不应该全部结构化

数据库负责：

```text
who
when
where
what
```

但：

```text
what happened
what I noticed
why it was interesting
```

应该保留 Markdown / rich text。

所以 Observation 有：

```text
field_note
```

Trip 有：

```text
story
```

Species 有：

```text
personal_note
```

允许你真正“写东西”。

---

# 22. 推荐技术栈

针对现在这个需求，我会从之前的 Astro 建议调整为：

# Next.js

因为现在已经明确存在：

- 登录
- 权限
- 上传
- moderation
- dashboard
- 数据库写入

因此 Next.js 更自然。

推荐：

```text
Frontend + Backend
Next.js
TypeScript

UI
Tailwind CSS
shadcn/ui

Database
PostgreSQL

Backend services
Supabase

Authentication
Supabase Auth

Image storage
Cloudflare R2

Image delivery
Cloudflare

Map
MapLibre GL JS

Deployment
Vercel

Repository
GitHub
```

---

# 23. 为什么数据库用 PostgreSQL

因为数据关系已经明显是：

```text
User
 └── Observation
       ├── Media
       ├── Identification
       ├── Location
       └── Specimen

Observation
 └── Trip

Identification
 └── Taxon
```

SQLite/JSON/Markdown 很快就会难以维护。

---

# 24. 为什么 Supabase 比自己写后端合适

它直接解决：

```text
PostgreSQL
Auth
Row Level Security
API
database migration
```

尤其 Contributor 权限可以通过 RLS 控制：

```text
Contributor:
can insert own observations
can update own drafts
cannot publish
cannot edit taxonomy

Owner:
full access
```

非常适合这个网站。

---

# 25. 图片不要进 Supabase Storage 也可以

我更倾向：

```text
Cloudflare R2
```

原图：

```text
original/
```

Web：

```text
large/
medium/
thumb/
```

但数据库只保存：

```text
media_id
storage_key
width
height
mime
file_size
```

---

# 26. 图片处理 SOP

用户上传：

```text
DSC_02819.JPG
```

→ 保存原图

→ 自动读取：

```text
EXIF
dimensions
datetime
GPS
camera
lens
```

→ 生成：

```text
thumbnail 400px
medium 1200px
large 2400px
```

→ Web 使用：

```text
AVIF/WebP
```

→ 原始图片保持 JPEG。

---

# 27. 不允许覆盖原图

严格规范：

```text
Original media = immutable
```

任何：

- 裁切
- 旋转
- 调色
- 压缩

都生成 derivative。

不能直接修改 original。

---

# 28. EXIF 隐私

尤其 GPS。

前端图片必须：

> **默认剥离公开图片中的 GPS EXIF。**

否则你把地图模糊了，人家下载 JPEG 一看 EXIF 又拿到经纬度。

这是必须进入开发规范的。

---

# 29. 数据库核心表

第一版控制在这些：

```text
users
profiles

observations
observation_people

locations

media

taxa
identifications

trips
trip_observations

specimens

audit_logs
```

不要继续膨胀。

---

# 30. Observations 表

建议：

```sql
id
public_id

observer_id
contributor_id

observed_at

location_id

sex
life_stage

habitat
microhabitat
behavior

field_note

status

visibility

created_at
updated_at
published_at
```

---

# 31. Media 表

```text
id
observation_id

storage_key

media_type

view_type

sex
life_stage

caption

sort_order
is_cover

visibility

uploaded_by
created_at
```

---

# 32. view_type 标准

保持有限枚举：

```text
live_dorsal
live_frontal
live_lateral

behavior
habitat

specimen_dorsal
specimen_ventral

male_palp
epigyne
vulva

microscopy
other
```

不要让每个人随便创建标签。

---

# 33. Observation status

数据库严格限制：

```text
draft
submitted
review
revision_requested
approved
published
archived
```

不能在前端自己拼字符串。

---

# 34. 删除策略

科学记录网站不要 hard delete。

例如用户删除：

```text
DELETE observation
```

不执行物理删除。

改为：

```text
archived_at
```

只有 Owner 可以做真正 purge。

---

# 35. Audit Log

这是上传功能出现后必须增加的。

记录：

```text
who
what
when
old_value
new_value
```

比如：

```text
Tao submitted OBS-182

Zhiyong changed identification
Siler cf. cupreus
→
Siler cupreus

Zhiyong published OBS-182
```

以后非常省事。

---

# 36. 数据版权必须从第一天明确

朋友上传照片时：

不能默认：

> 版权转让给你。

应设计：

```text
Copyright © photographer
```

上传时选择：

```text
All rights reserved

CC BY 4.0

CC BY-NC 4.0
```

默认我建议：

```text
All rights reserved
```

之后本人主动选择 CC。

---

# 37. 网站署名

每张照片显示：

> © Tao Li

每条记录显示：

```text
Observed by Tao Li
Identified by Zhiyong Yang
```

不要变成：

> China Salticid Field Notes

拥有照片版权。

---

# 38. Contributor Agreement

加入简单条款。

受邀朋友第一次上传时确认：

> 我拥有或获授权上传这些照片；
> 我允许网站展示相关照片和观察信息；
> 图片版权仍属于原作者；
> 网站管理员可以为排版、鉴定和数据质量目的修改元数据；
> 涉及敏感位置时网站可能隐藏准确地点。

足够。

没必要一开始搞复杂法律协议。

---

# 39. 搜索设计

搜索目标不是 taxonomy database。

统一一个 Search：

输入：

```text
Siler
察隅
西藏
灌木
Tao
2025
```

都可以找到。

搜索结果分类：

```text
Species
Observations
Trips
Contributors
```

---

# 40. 标签不要泛滥

避免：

```text
tags: red
tags: beautiful
tags: tree
tags: fast
tags: forest
...
```

最后会完全失控。

固定 ontology：

```text
habitat
microhabitat
behavior
sex
life_stage
```

个人自由描述放：

```text
field_note
```

---

# 41. 中文名不要成为主键

主展示可以：

> 柯氏瑟跳蛛  
> *Siler collingwoodi*

但所有连接用：

```text
taxon_id
```

中文名字段：

```text
vernacular_names
```

因为中文名也可能变化。

---

# 42. Unknown 是一等公民

数据库必须允许：

```text
taxon_id = NULL
```

展示：

> Unidentified jumping spider

或者：

> Chrysillini sp.

而不是强迫 species。

甚至主页可以有：

# Unidentified

这很有自然观察感。

---

# 43. 网站视觉规范

我不建议做：

> 蓝白数据库管理平台。

而应该：

**自然历史摄影杂志 + 野外笔记本**

推荐：

```text
大面积照片
大量留白
低饱和自然色
Serif + Sans 字体组合
非常轻的 UI chrome
```

内容视觉优先级：

```text
Photo
↓
Place + date
↓
Species
↓
Story
↓
Metadata
```

而不是：

```text
Species
Taxonomy
Metadata
Metadata
Photo
```

---

# 44. 首页规范

第一屏：

```text
China Salticid Field Notes

Jumping spiders encountered
across my fieldwork in China.
```

或者中文。

大图。

下面：

### Recent field notes

---

### Recently observed

---

### From the field

Trips。

---

### Explore the map

---

### Friends' observations

---

这已经足够。

不要：

```text
中国共有 xxx 种跳蛛
数据库收录 xxx 种
数据完整率 xxx%
```

那会把产品又带回数据库方向。

---

# 45. 开发目录规范

建议：

```text
china-salticid-notes/
│
├── app/
│   ├── observations/
│   ├── species/
│   ├── trips/
│   ├── contributors/
│   ├── studio/
│   └── api/
│
├── components/
│   ├── observation/
│   ├── species/
│   ├── trip/
│   ├── media/
│   ├── maps/
│   ├── forms/
│   └── ui/
│
├── lib/
│   ├── auth/
│   ├── database/
│   ├── media/
│   ├── taxonomy/
│   └── permissions/
│
├── database/
│   ├── migrations/
│   ├── seeds/
│   └── schema/
│
├── content/
│   ├── about/
│   └── guides/
│
├── public/
│
├── tests/
│
├── scripts/
│
└── docs/
```

---

# 46. Git 分支规范

简单即可：

```text
main
develop
feature/*
fix/*
```

例如：

```text
feature/observation-upload
feature/map-view
feature/trip-pages
fix/exif-location-leak
```

---

# 47. Commit 规范

推荐 Conventional Commits：

```text
feat: add observation submission form

fix: hide exact coordinates for sensitive records

refactor: separate identification from observation

docs: update contributor guidelines

chore: upgrade dependencies
```

---

# 48. Pull Request 必须检查

每个 PR：

```text
Purpose

Changes

Screenshots

Database changes

Privacy impact

Tested
```

尤其新增字段时必须回答：

> 是否可能暴露 GPS？

---

# 49. 环境规范

必须分：

```text
development
preview
production
```

绝对不要开发时直接连生产数据库。

数据库：

```text
salticid_dev
salticid_prod
```

---

# 50. Migration-first

数据库不能手动：

> “进去 Supabase 点一下加字段”。

任何 schema 修改：

```text
migration
```

例如：

```text
20260906_create_observations.sql
20260908_add_location_visibility.sql
```

这样整个项目可追溯。

---

# 51. 测试最低要求

重点不是追求 100% coverage。

必须测试：

### Permissions

Contributor 是否能：

```text
修改别人的 observation? NO
publish? NO
看隐藏 GPS? NO
```

### Upload

```text
large image
bad file
duplicate image
EXIF
```

### Privacy

最重要：

```text
hidden coordinates
EXIF stripping
private media
draft URLs
```

---

# 52. 发布前检查

每次 production deploy：

```text
[ ] build passes
[ ] migration reviewed
[ ] auth tested
[ ] contributor permissions tested
[ ] private observations inaccessible
[ ] GPS privacy checked
[ ] responsive layout checked
[ ] image loading checked
[ ] metadata backup completed
```

---

# 53. Backup SOP

数据库：

```text
Daily backup
```

照片：

R2 versioning / backup。

另外每个月导出：

```text
observations.csv
identifications.csv
taxa.csv
media.csv
locations.csv
```

这点非常关键：

> 即使网站以后不开了，你的观察数据也不能跟着网站消失。

---

# 54. 数据可移植原则

任何核心内容不能只存在：

> 前端 HTML。

必须可以导出：

```text
CSV
JSON
```

以后再增加：

```text
Darwin Core
```

但这不是当前开发重点。

---

# 55. MVP 范围

第一版千万不要超过：

### Public

```text
Home
Observations
Observation
Species
Species page
Trips
Trip page
Map
About
```

### Account

```text
Login
Profile
```

### Contributor

```text
New Observation
My Drafts
My Submissions
```

### Owner Studio

```text
Review
Publish
Edit observation
Identification
Species
Trips
Contributors
```

这就是完整 MVP。

---

# 56. Phase 1｜项目骨架

目标：

> 网站能够运行。

完成：

```text
Next.js
TypeScript
Tailwind
Supabase
GitHub
Vercel
```

建立：

```text
dev
preview
production
```

---

# 57. Phase 2｜Data Model

这一阶段甚至比首页重要。

完成：

```text
User
Profile
Observation
Location
Media
Taxon
Identification
Trip
Specimen
AuditLog
```

并完成 RLS。

之后先暂停写页面。

检查：

> 朋友投稿后，整个生命周期能不能正确表达？

---

# 58. Phase 3｜Observation MVP

只实现：

```text
New Observation
Observation detail
Observation list
```

先用：

> 你自己的 20 条真实记录

测试。

不要 fake data 测半年。

---

# 59. Phase 4｜Upload Pipeline

实现：

```text
drag/drop
multiple upload
progress
EXIF
thumbnail
cover image
sorting
caption
```

以及：

```text
R2
```

---

# 60. Phase 5｜Contributor

邀请一个朋友实际测试。

完整跑：

```text
Invitation
↓
Account
↓
Upload
↓
Submit
↓
You review
↓
Identification
↓
Publish
```

只有这个闭环跑通以后，才叫上传功能完成。

---

# 61. Phase 6｜Species

之后再根据：

```text
published observations
```

自动生成 species 页面。

这时候会发现：

Species 并不是主数据输入。

它是：

> observation 数据的聚合页面。

---

# 62. Phase 7｜Trips

加入你自己的：

```text
云南
西藏
海南
广东
广西
```

等调查。

这一步网站开始真正产生人格。

---

# 63. Phase 8｜Map

地图只展示：

```text
public coordinates
```

API 永远不能把：

```text
exact_latitude
exact_longitude
```

传给浏览器以后再让 JS 模糊。

这是严重错误。

必须：

> **服务端就不给。**

---

# 64. Phase 9｜Visual polish

最后再统一：

```text
typography
spacing
photo ratio
transitions
mobile
dark/light
```

不要开发第一周就在调按钮圆角。

---

# 65. Phase 10｜Launch

首发不用追求：

> 300 species。

我认为很理想的是：

```text
30–50 species

100–200 observations

5–10 trips

1000 左右照片

2–5 contributors
```

这种规模已经会非常有内容。

---

# 66. 第一年的开发原则

我甚至建议你写到 README 顶部：

> **Do not build features for hypothetical scale.**

现在最容易踩的坑就是：

```text
公众注册
评论
点赞
关注
排行榜
社区
AI 鉴定
聊天
论坛
物种完整名录
复杂 API
```

全部暂时不要。

真正应该持续加强的是：

```text
Observation
Photography
Field notes
Trips
Identification
Contributor workflow
```

---

# 67. README 中的项目宣言

我建议写成：

> **China Salticid Field Notes is a personal, curated natural-history project documenting jumping spiders encountered during fieldwork and everyday observations in China.**
>
> **It is not intended to provide a complete checklist or authoritative database of Chinese Salticidae. Records reflect the observations, photographs, specimens and identifications contributed by the project owner and invited collaborators.**

然后再写一句很关键的：

> **Every record begins with an observation, not a species entry.**

这句话可以成为整个系统架构的最高原则。

---

# 68. Definition of Done

以后 vibe coding 或让 AI 开发任何功能，都必须用这个规则。

一个 feature 只有同时满足以下条件才算完成：

```text
□ UI complete
□ mobile usable
□ database migration committed
□ TypeScript passes
□ permissions checked
□ privacy checked
□ loading state
□ empty state
□ error state
□ production build passes
□ real observation tested
□ documentation updated
```

不是：

> 页面看起来能用了。

---

# 69. AI / Vibe Coding 开发规则

这个项目尤其适合 vibe coding，但你要约束 AI。

在根目录建立：

```text
AGENTS.md
```

或者：

```text
DEVELOPMENT.md
```

明确写：

```text
1. Never change the database schema without a migration.

2. Never expose exact coordinates through public APIs.

3. Never modify original uploaded images.

4. Never allow contributors to publish directly.

5. Never hard-code scientific names into observation records.

6. Every identification must reference a taxon record.

7. Every observation must remain valid if its identification changes.

8. Unknown species are valid observations.

9. Do not add public registration.

10. Do not add community features unless explicitly requested.

11. Prioritize photography and field-note readability over database-style UI.

12. Do not turn this project into a comprehensive Chinese Salticidae database.
```

这一份实际上比技术栈本身更重要。

---

# 70. 我建议最后把整个项目控制成三个核心对象

虽然数据库底层很多表，但从产品设计角度永远记住：

```text
OBSERVATION
我看到了一只蜘蛛

TRIP
我去了一次地方

SPECIES
这些观察后来告诉我关于这个物种什么
```

Contributor 只是帮你增加：

```text
OBSERVATION
```

而你的编辑和鉴定工作负责把这些 observation 变成一个有质量、有审美、有科学可信度的个人自然史档案。

所以我现在会把整个网站概括成一句：

> **不是“中国跳蛛有哪些”，而是“我们在哪里、什么时候、以怎样的方式遇见过这些跳蛛”。**

这就是这个项目和数据库、iNaturalist、WSC 最根本的区别。

而从开发优先级来说，我会固定为：

**Data model → Observation → Media → Contributor submission → Review → Species aggregation → Trips → Map → Visual polish。**

在这条主线上走，基本不会跑偏。
