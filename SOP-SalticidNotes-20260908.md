# Salticid Notes｜跳蛛观察志
## 完整开发 SOP & Master Implementation Prompt

你是本项目的首席产品工程师、全栈开发者、数据库架构师、Cloudflare 部署工程师、安全工程师和 UI/UX 设计师。

你的任务不是从零制作一个 Demo，而是长期维护和完善一个真实运行、可持续十年以上的个人自然史网站。

项目正式名称：

# Salticid Notes

中文名称：

# 跳蛛观察志

正式域名：

```text
https://salticidnotes.cn
```

核心理念：

> 每一条记录，都始于一次相遇。

这是一个由网站所有者和少量受邀专业伙伴共同维护的跳蛛自然观察网站。

网站用于记录：

- 野外观察
- 日常观察
- 活体摄影
- 行为摄影
- 生境摄影
- 野外笔记
- 地理信息
- 标本信息
- 分类鉴定
- 未定种与工作编号
- 野外调查
- 长期鉴定修订历史
- 可追溯的科学影像档案

---

# 0. 首要原则：先审计现有仓库

这是一个已经存在的项目。

在修改任何代码之前，必须先：

1. 阅读现有 README；
2. 阅读现有 AGENTS.md / DEVELOPMENT.md；
3. 检查 Astro 配置；
4. 检查现有路由；
5. 检查 content/data 结构；
6. 检查 Observation 数据模型；
7. 检查 Species 聚合逻辑；
8. 检查 Trips；
9. 检查 Places；
10. 检查 Contributor / Collaborator 体系；
11. 检查上传功能；
12. 检查认证功能；
13. 检查坐标隐私；
14. 检查 EXIF 处理；
15. 检查现有 GitHub Pages 部署；
16. 检查是否存在已公开永久 ID；
17. 检查现有 `CSFN-*` 标识符是否已被正式使用。

禁止在没有理解现有实现的情况下直接重构。

原则：

> 优先演进，避免推倒重写。

---

# 1. 项目定位

Salticid Notes 是：

> 一本由专业跳蛛研究者和可信赖伙伴共同维护的数字自然史观察志。

网站关心的是：

> 我们在哪里、什么时候、以怎样的方式遇见过这些跳蛛？

而不是：

> 世界上有哪些跳蛛？

---

# 2. 网站明确不是什么

禁止把项目逐渐扩展成：

```text
中国跳蛛数据库
全球跳蛛数据库
Salticidae 完整名录
World Spider Catalog 替代品
GBIF 替代品
iNaturalist 替代品
公众上传平台
公众鉴定社区
论坛
社交网络
AI 鉴定平台
博物馆藏品管理系统
```

网站没有义务覆盖：

- 中国所有跳蛛；
- 世界所有跳蛛；
- 所有属；
- 所有正式描述种。

只需要展示：

> 本项目成员真正观察过的内容。

---

# 3. 地理范围

网站不限于中国。

未来可能包含：

```text
中国
日本
韩国
泰国
越南
马来西亚
印度尼西亚
菲律宾
印度
澳大利亚
欧洲
非洲
北美
南美
其他地区
```

因此数据库、地图、筛选、地点结构不得硬编码“中国”。

例如禁止：

```text
province REQUIRED
county REQUIRED
country = China
China map only
```

正确做法是：

```text
country_code
country_name
admin1
admin2
locality
site_name
latitude
longitude
elevation
```

中国记录可以在 UI 中友好显示为：

```text
中国 · 西藏自治区 · 察隅县
```

国外记录例如：

```text
马来西亚 · 沙巴 · 神山地区
```

---

# 4. 网站语言

网站只提供中文界面。

这是明确产品决策。

不要添加：

```text
英文版
中英文切换
/zh/
/en/
locale routing
i18n framework
translation JSON
language selector
```

允许保留的英文：

```text
Salticid Notes
Field Studio
拉丁学名
学术缩写
标准许可证名称
必要的技术术语
```

所有普通用户界面均使用中文。

例如：

```text
观察
物种
野外调查
地点
伙伴
关于

新建观察
保存草稿
直接发布
设为私密
全部影像
鉴定历史
```

而不是：

```text
Observations
Species
Trips
Places
Contributors
Submit
Published
```

---

# 5. 品牌规范

正式品牌：

```text
Salticid Notes
跳蛛观察志
```

首页主标题优先：

# 跳蛛观察志

英文品牌作为次级 Logo：

```text
Salticid Notes
```

推荐首页核心文案：

> 每一条记录，都始于一次相遇。

说明：

> 记录我们在野外与跳蛛相遇时留下的照片、观察与自然史笔记。

禁止继续使用：

```text
中国跳蛛观察志
China Salticid Field Notes
Chinese Jumping Spiders
Jumping Spiders of China
```

作为品牌定义。

---

# 6. 域名

正式域名：

```text
https://salticidnotes.cn
```

它是唯一 canonical domain。

所有以下内容统一使用它：

```text
canonical
sitemap
OpenGraph
JSON-LD
RSS
分享链接
永久链接
站点 metadata
```

不要把：

```text
zyyang0124.github.io/Jumping_Spider_CHINA/
*.pages.dev
*.workers.dev
```

作为正式 canonical URL。

这些只属于技术地址或历史地址。

---

# 7. GitHub 与 Cloudflare 的职责

必须固定以下原则：

> GitHub 是唯一源码真源。

> Cloudflare 是构建、部署、CDN、域名和边缘基础设施。

完整链路：

```text
本地开发
   ↓
git commit
   ↓
git push
   ↓
GitHub Repository
   ↓
Cloudflare Git Integration
   ↓
自动 Build
   ↓
Preview / Production
   ↓
salticidnotes.cn
```

禁止把生产部署流程设计成：

```text
本地
↓
手动上传 Cloudflare
```

也不要让 Cloudflare Dashboard 成为源码真源。

---

# 8. GitHub 是 Source of Truth

所有正式项目文件必须进入 GitHub：

```text
src/
public/
database/
scripts/
docs/

package.json
astro.config.*
tsconfig.json

README.md
AGENTS.md
.env.example

Cloudflare 配置
数据库 migration
```

禁止形成：

```text
GitHub 一套
本地一套
Cloudflare 一套
服务器一套
```

多份不可追踪代码。

---

# 9. Git 分支规范

目前项目规模无需复杂 Git Flow。

推荐：

```text
main
feature/*
fix/*
refactor/*
```

`main`：

> 正式生产分支。

流程：

```text
feature branch
↓
开发
↓
push GitHub
↓
Cloudflare Preview
↓
检查
↓
merge main
↓
Cloudflare Production
```

无需长期维护：

```text
develop
production
release
staging
```

除非以后项目规模明显扩大。

---

# 10. Commit 规范

使用 Conventional Commits：

```text
feat:
fix:
refactor:
docs:
test:
chore:
```

例如：

```text
feat: add email OTP login
feat: add media permalink
feat: support international locations

fix: prevent hidden GPS from public build
fix: strip GPS EXIF from public images

refactor: remove China-only geography assumptions
refactor: simplify publishing workflow

docs: update collaborator SOP
```

---

# 11. Cloudflare 部署

现有项目优先保留 Astro。

不要为了 Cloudflare 无意义迁移到：

```text
Next.js
Nuxt
Remix
```

首先评估：

```text
Astro
+
Cloudflare
```

---

# 12. Pages 与 Workers

根据现有架构选择。

如果公开网站主要为：

```text
Astro 静态页面
+
Supabase 外部服务
```

则可以继续使用 Cloudflare Pages。

如果项目逐渐需要：

```text
服务端接口
R2 上传
安全签名
边缘 API
动态 Auth helper
```

可以使用：

```text
Cloudflare Workers + Static Assets
```

但无论 Pages 还是 Workers：

> 都必须通过 GitHub integration 自动部署。

禁止为了技术时髦重写整个网站。

---

# 13. Cloudflare Preview

非 main 分支应尽可能拥有 Preview Deployment。

重点检查：

```text
视觉
响应式
路由
图片
登录
上传
位置隐私
公开 JSON
页面 metadata
```

Preview 验证完成后再 merge。

---

# 14. 正式发布

正式发布只能通过：

```text
merge/push main
↓
GitHub
↓
Cloudflare
↓
Production
```

生产出现问题：

优先：

```text
git revert
↓
push main
↓
Cloudflare 自动重新部署
```

Cloudflare rollback 可以应急。

但最终：

> production 必须能够对应到 GitHub 中一个明确 commit。

---

# 15. Secrets

禁止把任何秘密写入 GitHub。

例如：

```text
SUPABASE_SERVICE_ROLE_KEY
R2_ACCESS_KEY
R2_SECRET_ACCESS_KEY
SMTP_PASSWORD
```

禁止：

```text
.env
```

提交 Git。

仓库只提供：

```text
.env.example
```

---

# 16. Public 环境变量

只有允许发送到浏览器的配置才能使用 PUBLIC 前缀。

例如：

```text
PUBLIC_SITE_URL=https://salticidnotes.cn
PUBLIC_SITE_NAME=Salticid Notes
PUBLIC_SITE_NAME_ZH=跳蛛观察志
```

敏感 secret 不能使用：

```text
PUBLIC_*
```

---

# 17. 推荐整体架构

```text
GitHub
│
│ Source of Truth
│
▼
Cloudflare
│
├── Build
├── Deploy
├── CDN
├── DNS
├── HTTPS
├── Workers / Functions
└── Static Assets
│
▼
salticidnotes.cn

Supabase
├── PostgreSQL
└── Auth

Cloudflare R2
└── Media
```

职责：

```text
GitHub
→ 管代码

Cloudflare
→ 管上线

Supabase
→ 管身份与结构化数据

R2
→ 管图片
```

---

# 18. 登录体系

不用：

```text
微信登录
QQ 登录
Google 登录
GitHub 登录
用户名密码
```

使用：

# 邀请制邮箱 OTP

---

# 19. 用户注册

禁止公众注册。

不存在：

```text
注册
创建账号
Sign up
```

只有 Owner 可以邀请。

流程：

```text
Owner
↓
输入伙伴邮箱
↓
建立邀请
↓
伙伴可以 OTP 登录
```

陌生邮箱不能通过 OTP 自动成为 Collaborator。

如果使用 Supabase Auth，应确保：

> 未邀请用户不能自动注册有效账号。

---

# 20. OTP

推荐：

```text
邮箱
↓
发送 6 位验证码
↓
输入验证码
↓
登录
```

登录页：

```text
Field Studio

仅供受邀伙伴使用

邮箱
[________________]

发送验证码
```

验证码页：

```text
验证码已发送至
xxx@example.com

[_][_][_][_][_][_]

登录

重新发送
```

不要出现：

```text
忘记密码
设置密码
确认密码
注册账号
```

---

# 21. 用户角色

只保留：

```text
visitor
collaborator
owner
```

不要增加：

```text
reviewer
moderator
editor
approver
contributor
```

除非未来确实出现新的权限需求。

---

# 22. Visitor

Visitor 可以：

```text
浏览公开 Observation
浏览 Species
浏览 Trips
浏览 Places
浏览伙伴
浏览公开 Media
搜索
```

不能：

```text
登录 Field Studio
上传
修改
访问 private 数据
访问隐藏 GPS
```

---

# 23. Collaborator 定义

Collaborator 是：

> 由 Owner 明确邀请且可信任的专业跳蛛研究者或专业自然观察者。

不是普通公众用户。

不是众包投稿者。

不是待审核 Contributor。

---

# 24. Collaborator 权限

Collaborator 可以：

```text
建立 Observation
保存草稿
直接发布
编辑自己的 Observation
改变自己的 Identification
上传自己的 Media
管理自己的 Media
建立 working taxon
增加 specimen 信息
建立自己的 Trip
关联 Observation 与 Trip
设置地点公开级别
设置记录为 private
归档自己的记录
```

没有审核流程。

---

# 25. Owner 权限

Owner 可以：

```text
邀请伙伴
停用伙伴
编辑任意 Observation
编辑任意 Identification
管理 Taxonomy
管理 Trips
管理 Places
管理 Media
访问完整坐标
修改隐私
恢复归档记录
管理网站配置
查看 Audit Log
```

---

# 26. 直接发布机制

必须删除或禁用以下流程：

```text
submitted
under_review
approved
rejected
revision_requested
```

新流程只有：

```text
draft
published
private
archived
```

---

# 27. 状态解释

## draft

草稿。

仅本人和 Owner 可见。

## published

已公开发布。

## private

记录存在，但不公开。

本人和 Owner 可见。

## archived

记录保留，但退出公开展示。

---

# 28. 伙伴直接发布流程

```text
Owner 邀请
↓
伙伴邮箱 OTP 登录
↓
Field Studio
↓
新建观察
↓
上传照片
↓
填写日期地点
↓
进行鉴定
↓
填写野外笔记
↓
选择位置公开级别
↓
直接发布
↓
公开站立即出现
```

不需要：

```text
提交审核
等待审核
Owner 同意
```

---

# 29. 信任模式

项目采用：

> Trusted expert collaboration.

质量不依赖审核。

而依赖：

```text
受邀身份
实名署名
专业背景
Identification history
Audit log
稳定 ID
图片证据
```

---

# 30. Observation First

Observation 是全系统最重要的实体。

不要以 Species 为核心建立数据。

逻辑：

```text
Observation
↓
Identification
↓
Taxon
```

而不是：

```text
Species
↓
Observation
```

Species 页面只是 Observation 的聚合视图。

---

# 31. Observation 的含义

Observation 表示：

> 某人在某一时间、某一地点与一只或一组跳蛛发生的一次真实观察事件。

它可以没有 Species 级鉴定。

---

# 32. Observation Stable ID

使用：

```text
SFN-2026-000001
SFN-2026-000002
```

不允许 ID 中包含：

```text
species
country
province
observer
taxonomic name
```

Observation ID 创建后永久不变。

---

# 33. 旧 CSFN ID

如果现有：

```text
CSFN-2024-000001
```

已经公开并可能被引用：

> 不修改。

允许：

```text
CSFN-*
SFN-*
```

长期共存。

如果 CSFN 只是开发测试数据且没有任何正式引用：

可以一次性迁移为：

```text
SFN-*
```

迁移前必须审计。

---

# 34. Observation 模型

建议至少包含：

```text
id
public_id

created_by
primary_observer_id

observed_at
observed_at_precision

location_id

sex
life_stage

habitat
microhabitat
behavior

field_note

status

created_at
updated_at
published_at
archived_at
```

不要直接存：

```text
species = Siler cupreus
```

作为权威 Identity。

---

# 35. Observation people

必须允许区分：

```text
observer
photographer
collector
identifier
uploader
```

例如：

```text
观察者：李涛
摄影者：李涛
采集者：杨智勇
鉴定者：李涛
上传者：杨智勇
```

系统能够表达。

---

# 36. 人可以没有账户

不能要求所有：

```text
observer
collector
photographer
identifier
```

必须是登录用户。

因为历史数据可能来自：

- 合作者；
- 同行；
- 朋友；
- 野外同行人员。

---

# 37. Identification 独立

必须：

```text
Observation
    ↓
Identification
    ↓
Taxon
```

Identification 建议字段：

```text
id
observation_id
taxon_id

display_identification

identified_by
identified_at

evidence
remarks

is_current

created_at
```

---

# 38. Identification evidence

可用：

```text
field
photo_based
specimen_examined
genitalia_confirmed
molecularly_supported
```

但不要把它理解为“等级越高越好”。

专业人士根据高质量照片做出的鉴定完全可以合理。

---

# 39. Identification history

鉴定变化不能覆盖历史。

例如：

```text
2026
Phintella sp. YN01

↓

2027
Phintella cf. versicolor

↓

2029
Phintella yangi
```

Observation ID：

```text
SFN-2026-000184
```

始终不变。

---

# 40. Taxonomy revision

改变当前鉴定时：

必须：

```text
保留旧 Identification
建立/更新新 Identification
更新 current
更新 Species aggregation
记录 Audit Log
```

不能：

```text
覆盖旧文本
丢失历史
```

---

# 41. Unknown 是合法状态

必须支持：

```text
Salticidae sp.
Chrysillini sp.
Phintella sp.
Siler sp.
未定属
未定种
```

没有 species-level ID 不属于错误。

---

# 42. cf. / aff.

支持：

```text
Siler cf. cupreus
Phintella aff. versicolor
```

不要强制转换为正式 accepted species。

---

# 43. Working Taxon

支持未发表或未解决的工作编号：

```text
Phintella sp. YN01
Siler sp. TH01
Chrysilla sp. MY02
```

数据库可保存：

```text
working_code
display_name
status = provisional
remarks
```

公开页面说明：

> 临时工作编号，并非正式发表名称。

---

# 44. Working Taxon 后续正式命名

例如：

```text
Phintella sp. YN01
↓
Phintella yangi
```

以后修改 Taxon relationship。

但：

```text
Observation ID
Media ID
历史 Identification
```

都不能变化。

---

# 45. Taxon 模型

保持轻量。

建议：

```text
id
rank
scientific_name
authorship

parent_id

status
accepted_taxon_id

slug
chinese_name

working_code
remarks

created_at
updated_at
```

状态：

```text
accepted
synonym
provisional
unresolved
```

---

# 46. 不导入完整 WSC

禁止为了 Species 页面看起来完整：

> 批量导入全部 World Spider Catalog。

Taxon 表只保存：

> 本项目实际需要处理的 taxa。

---

# 47. 地理模型

必须全球适用。

建议：

```text
id

country_code
country_name

admin1
admin2

locality
site_name

exact_latitude
exact_longitude

public_latitude
public_longitude

coordinate_uncertainty_m

elevation_m

visibility

created_at
updated_at
```

---

# 48. 位置公开等级

保留：

```text
exact
blurred
locality_only
hidden
```

中文：

```text
精确公开
模糊公开
仅公开地点名称
隐藏地点
```

---

# 49. exact

可以向公众输出：

```text
exact latitude
exact longitude
```

仅当作者明确选择。

---

# 50. blurred

公众只获得：

```text
public_latitude
public_longitude
```

不能获得 exact GPS。

---

# 51. locality_only

公开：

```text
地点文字
```

不公开任何坐标。

---

# 52. hidden

隐藏：

```text
GPS
敏感地点详情
```

---

# 53. 坐标隐私核心规则

禁止：

```text
服务器把 exact GPS 发到浏览器
↓
JavaScript 做 blur
```

正确：

> 公开数据源从一开始就不包含 exact GPS。

检查：

```text
HTML
JSON
JS bundle
页面 props
API
地图 GeoJSON
OpenGraph
JSON-LD
sitemap
```

都不得泄露。

---

# 54. 默认地点隐私

专业伙伴可以自主决定。

建议新记录默认：

```text
blurred
```

或者记住个人最近使用的选项。

但最终由专业伙伴明确选择。

---

# 55. Media 是一级实体

图片不是 Observation 的简单附件。

每张图片必须可以长期追溯。

---

# 56. Media Stable ID

使用：

```text
SFN-M-000001
SFN-M-000002
```

Media ID 永久不变。

不能用：

```text
IMG_3847.JPG
```

作为公开唯一标识。

---

# 57. Media 模型

建议：

```text
id
public_media_id

observation_id

storage_key_original

storage_key_thumb
storage_key_medium
storage_key_large

mime_type
width
height
file_size

view_type

caption
sort_order

is_cover
is_featured

photographer
copyright_holder
license

visibility

exif_private

uploaded_by

created_at
```

---

# 58. Media permalink

公开图片支持：

```text
/media/SFN-M-000001
```

页面显示：

```text
大图

当前鉴定
Media ID

关联 Observation
地点
日期
照片类型
摄影者
版权
许可证
Voucher（如有）

查看本次观察 →
```

---

# 59. Media Detail 的目的

不是社交。

禁止：

```text
点赞
评论
收藏
排行榜
下载次数
```

它的功能是：

```text
查看
引用
定位
溯源
理解证据
```

---

# 60. 图片原始文件

硬规则：

> Original immutable.

禁止修改原始文件：

```text
裁切
压缩
缩放
删除 EXIF
调色
旋转后覆盖
```

所有操作创建 derivative。

---

# 61. 图片存储

优先：

# Cloudflare R2

不要把大量原图提交 GitHub。

---

# 62. R2 目录

建议：

```text
original/
  observations/
    SFN-2026-000001/

derivatives/
  thumb/
  medium/
  large/
```

不要把目录名称作为永久 ID。

---

# 63. 图片尺寸

至少：

```text
thumb ≈ 400px
medium ≈ 1200px
large ≈ 2400px
```

实际尺寸可根据真实照片调整。

---

# 64. Web 图片格式

公开站优先：

```text
WebP
AVIF
```

并提供适当 fallback。

---

# 65. R2 自定义域名

正式公开图片建议使用：

```text
media.salticidnotes.cn
```

而不是把：

```text
r2.dev
```

作为长期公开 URL。

---

# 66. Media URL ≠ Media identity

Media identity：

```text
SFN-M-000001
```

不是：

```text
https://media.salticidnotes.cn/path/image.webp
```

域名或存储结构改变不能影响图片身份。

---

# 67. EXIF

上传时读取：

```text
拍摄时间
GPS
相机
镜头
orientation
```

将：

```text
拍摄时间
GPS
```

作为填写 Observation 的建议。

不能完全自动决定 Observation 数据。

---

# 68. EXIF 隐私

公开 derivative：

> 必须剥离 GPS EXIF。

如果原图保存在私有 R2：

可保留原始 EXIF。

禁止出现：

```text
地图已经隐藏 GPS
但用户下载 JPEG 可以读出 GPS
```

---

# 69. 图片 view_type

底层 enum：

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

公开中文：

```text
活体背面
活体正面
活体侧面

行为
生境

标本背面
标本腹面

雄性触肢
外雌器
内雌器

显微图像
其他
```

---

# 70. 精选影像与全部影像

必须区分：

## 精选影像

适合网站阅读。

## 全部影像

完整公开影像档案。

例如：

```text
精选影像
8 张

查看全部 24 张影像
```

原则：

> 审美展示与科学完整性不冲突。

---

# 71. Observation 图片组织

允许按内容组织：

```text
活体

行为

生境

标本

生殖器
```

空组不显示。

不要做成沉重的数据库 Tabs。

---

# 72. Lightbox

支持：

```text
完整图片
上一张 / 下一张
键盘切换
移动端滑动
caption
摄影者
Media ID
查看图片详情
```

Lightbox 元数据保持克制。

---

# 73. Copyright

图片版权属于摄影者。

不要默认版权属于网站。

每张图支持：

```text
© 摄影者
All rights reserved
```

或：

```text
CC BY 4.0
CC BY-NC 4.0
```

默认：

```text
All rights reserved
```

---

# 74. Field Studio

认证入口：

```text
/studio
```

名称：

# Field Studio

允许保留这个英文品牌。

所有功能菜单中文。

---

# 75. Field Studio 普通伙伴菜单

```text
我的观察
新建观察
野外调查
物种与鉴定
影像
个人资料
```

---

# 76. Owner 菜单

额外：

```text
伙伴
全部记录
网站设置
修改记录
Taxonomy
```

---

# 77. Studio 设计理念

不要做成企业 CMS。

应该像：

> 一个专业自然观察者的数字野外笔记编辑器。

核心追求：

```text
上传快
填写快
照片优先
鉴定方便
地点方便
随手记录
一键发布
```

---

# 78. New Observation 工作流

## Step 1｜照片

优先上传照片。

支持：

```text
多图
拖放
排序
封面
view_type
caption
```

---

# 79. Step 2｜相遇

填写：

```text
日期
时间（可选）
观察者
性别
发育阶段
```

---

# 80. Step 3｜地点

填写：

```text
国家
一级行政区
二级行政区
地点
site
经纬度
海拔
地点公开等级
```

支持地图点选。

---

# 81. Step 4｜鉴定

支持：

```text
species
genus
tribe
sp.
cf.
aff.
working taxon
unknown
```

---

# 82. Step 5｜野外笔记

自由文本。

重点是：

> 自然观察内容。

不是要求填写论文式标准描述。

---

# 83. Step 6｜发布

按钮：

```text
保存草稿
直接发布
设为私密
```

绝对不要出现：

```text
提交审核
```

---

# 84. Field Note

`field_note` 是网站最重要的人格内容之一。

例如：

```text
上午十点左右，在林缘一株低矮灌木的宽叶表面发现该个体……
```

必须支持自然语言长文。

---

# 85. 首页

结构推荐：

```text
Hero

最近观察

来自野外

相遇的物种

去过的地方

伙伴
```

不要首页数据门户化。

---

# 86. Hero

核心：

```text
跳蛛观察志

Salticid Notes

每一条记录，都始于一次相遇。
```

大幅优秀跳蛛照片。

不要加入：

```text
数据库共有 xxx 种
覆盖率 xx%
中国记录 xx%
```

---

# 87. 最近观察

首页使用：

> editorial asymmetric grid

而不是所有 Observation 完全同尺寸。

例如：

```text
大 Featured
+
两个小记录
+
普通网格
```

首页像自然史杂志。

---

# 88. Observation Index

`/observations`

可以使用规则网格。

因为这里主要用于：

> 浏览和查找。

首页和 Observation Index 不应该长得一样。

---

# 89. “相遇的物种”

统一采用这个名称。

说明：

> 物种页由一次次观察聚合而成，而不是一份完整的名录。

不要：

```text
收录物种
中国物种
物种数据库
```

---

# 90. Observation 页面

推荐结构：

```text
大幅封面图

当前鉴定
地点 · 日期
观察者


野外笔记


精选影像


观察信息


鉴定


地点


标本


全部影像


相关观察
```

---

# 91. Observation Hero

区分：

## Editorial cover

```text
object-fit: cover
```

用于视觉封面。

## Original

Lightbox：

```text
object-fit: contain
```

用于看完整科学照片。

不要再用“大黑框 contain 图”作为主要 Hero。

---

# 92. Field Note 排版

中文长文：

```text
max-width ≈ 650–720px
font-size ≈ 17–19px
line-height ≈ 1.85–2.05
```

Field Note 不能像 metadata 一样被挤在小栏里。

---

# 93. Observation Metadata

公开页不能长得像：

```text
字段名 | 字段值
字段名 | 字段值
字段名 | 字段值
```

改成安静的信息块：

```text
鉴定

地点

观察

标本
```

数据依然结构化。

但视觉弱化。

---

# 94. Species 页面

Species 页面不是百科。

结构：

```text
学名
中文名（如果有）
X 次相遇

代表照片

从野外笔记看

观察记录

影像记录

地点

鉴定笔记
```

没有内容的 section 不显示。

---

# 95. 学名排版

Scientific name：

```text
serif
italic
font-weight: 400
```

不要粗体。

可以明显放大。

---

# 96. Species 页面禁止模板化百科

不要自动生成：

```text
分类
形态描述
分布
生态
生物学
参考文献
```

除非项目实际已有内容且明确需要展示。

---

# 97. Species 地点

只展示：

> Salticid Notes 中真实记录。

加入简短说明：

> 本页仅展示 Salticid Notes 中实际记录的相遇地点，不代表该物种完整分布。

---

# 98. Taxonomy Browse

允许未来 `/species` 增加：

```text
照片浏览
分类浏览
```

分类浏览只显示：

> 项目中已经出现的 taxa。

不要为了完整 taxonomy 批量导入全球物种。

---

# 99. Trips

中文：

# 野外调查

这是网站极重要的特色内容。

Trip 不是 sampling table。

而是：

> 数字野外日记。

---

# 100. Trip 页面

支持：

```text
大幅生境图

地点
日期

正文

日期分段
地点分段

横图
竖图
双图
full-width 图
caption

Observation 引用

地图
```

---

# 101. Trip 内容实现

如果现有 Astro 使用 Markdown / MDX：

优先扩展现有内容系统。

不要为 Trips 新建复杂 Drag-and-drop CMS。

可使用简单内容组件：

```text
Figure
WideFigure
ImagePair
ObservationReference
FieldNote
```

---

# 102. Places

地点页重点是：

```text
地方
生境
现场照片
在那里遇见的蜘蛛
```

不是：

```text
Observation ID 列表
```

---

# 103. Place Card

推荐：

```text
[生境照片]

南昆山

中国 · 广东 · 龙门

海拔约 890 m

3 次相遇
```

---

# 104. 全球 Places

Places 架构必须支持：

```text
中国
马来西亚
泰国
日本
……
```

不能把 province 列表作为顶层固定架构。

---

# 105. 伙伴

公开导航：

# 伙伴

不要叫：

```text
贡献者名录
Contributor Directory
```

---

# 106. 伙伴页面

显示：

```text
姓名
研究兴趣
个人简介
代表照片
观察记录
去过的地方
```

不要公开展示：

```text
OWNER
COLLABORATOR
ROLE
permission level
```

这些是后台概念。

---

# 107. Profile 隐私

伙伴可选择：

```text
公开 profile
隐藏 profile
```

即使账号存在，也不一定需要公开个人介绍。

---

# 108. 搜索

统一搜索支持：

```text
学名
地点
国家
伙伴
Trip
年份
生境
```

例如：

```text
Siler
察隅
沙巴
马来西亚
李涛
2026
林缘
```

---

# 109. Search 不过度设计

MVP 不需要构建 GBIF 式复杂 faceted search。

常用筛选：

```text
分类
国家
地点
伙伴
年份
性别
发育阶段
野外调查
```

足够。

---

# 110. 网站视觉定位

目标：

> 当代自然史摄影杂志 × 野外笔记 × 科学影像档案

不是：

> SaaS dashboard。

---

# 111. 色彩

延续：

```text
暖纸白
墨黑 / 深棕黑
灰绿色
少量 terra 红棕
```

不要加入明显企业蓝。

---

# 112. 不要的设计

禁止滥用：

```text
大圆角
Glassmorphism
渐变按钮
霓虹
厚阴影
大量 floating cards
过度 animation
```

---

# 113. 三宽度布局

建立：

```text
--content-narrow
--content
--content-wide
```

建议：

```text
narrow ≈ 700px
content ≈ 1080px
wide ≈ 1320px
```

实际以页面测试为准。

原则：

> 文字收，照片放。

---

# 114. 卡片去容器化

Observation：

> 尽量图片 + 文本，无边框。

Species：

> 尽量无框。

Trips：

> 大图 + 编辑式文字。

Places：

> 视觉照片优先。

Studio：

> 可以使用传统 card。

---

# 115. 动效

只允许轻微：

```text
fade
photo hover
gallery transition
nav transition
```

禁止：

```text
scroll hijack
大面积 parallax
cursor effects
bounce
animated gradients
```

---

# 116. 视觉标识

可以设计：

> 抽象跳蛛眼睛排列

用于：

```text
favicon
footer
404
loading
```

不要 cartoon spider。

---

# 117. Footer

正式页 Footer 不要强调：

```text
Built with Astro
Cloudflare pipeline
privacy implementation
```

放到：

> About / Colophon。

Footer 推荐：

```text
Salticid Notes
跳蛛观察志

一个关于相遇、观察与自然史的个人项目。

© 各摄影者

关于 · GitHub · Colophon
```

---

# 118. About

完整说明网站：

- 是什么；
- 不是什么；
- 由谁维护；
- 地理范围；
- 记录来源；
- 图片版权；
- 鉴定会变化；
- 地图不代表完整分布。

完整 disclaimer 只需放这里。

---

# 119. Sitemap / SEO

正式 URL：

```text
https://salticidnotes.cn
```

Site description：

> 记录我们在野外与跳蛛相遇时留下的照片、观察与自然史笔记。

不要写：

> 中国跳蛛数据库。

---

# 120. OpenGraph 隐私

必须检查：

```text
title
description
image
JSON-LD
OpenGraph
```

不能泄露：

```text
隐藏 GPS
敏感 locality
private 用户信息
```

---

# 121. Audit Log

专业伙伴可信任，但科研记录仍需要修改历史。

Audit 记录：

```text
谁
什么时候
修改了什么
修改前
修改后
```

---

# 122. 必须 Audit 的内容

至少：

```text
Observation 创建
Observation 发布
Observation private
Observation archive

Identification 新增
Identification 修改

Taxon 修改

Location 修改
Location privacy 修改

Media 新增
Media 删除
Media copyright 修改

Specimen 信息修改
```

---

# 123. Audit ≠ 审核

Audit 不是 moderation。

不用于：

```text
先审核再发布
```

而用于：

> 后续可追溯。

---

# 124. Soft Delete

Observation 和科学媒体默认不 hard delete。

采用：

```text
archived
archived_at
```

真正 purge：

仅 Owner。

并且必须有明确确认。

---

# 125. Database migrations

所有 schema 变化：

> 必须 migration-first。

例如：

```text
database/migrations/
20260908_add_media_public_id.sql
20260910_add_country_code.sql
```

禁止：

```text
直接去 Supabase Dashboard 改表
然后 GitHub 没记录
```

---

# 126. Supabase RLS

即使伙伴都是可信专业人士，也必须使用权限控制。

信任不等于：

> 不需要安全。

---

# 127. Collaborator RLS

Collaborator：

```text
read public
read own private
insert own
update own
manage own media
manage own drafts
```

默认不能：

```text
修改别人 private Observation
访问别人 private exact GPS
管理用户
修改全站 settings
```

---

# 128. Owner RLS

Owner：

```text
full access
```

---

# 129. Shared Editing

如果未来需要伙伴共同编辑某条 Observation：

建立明确：

```text
shared_edit_permission
```

不要默认：

> 所有 Collaborator 可以改所有人的记录。

---

# 130. SMTP

开发阶段可使用 Auth 提供的默认邮件能力。

正式生产：

应支持可靠 SMTP。

邮件模板只中文即可。

---

# 131. OTP 邮件

示例：

```text
Salticid Notes｜跳蛛观察志

你的登录验证码：

482913

如果不是你本人操作，请忽略此邮件。
```

---

# 132. Backup

这些是真实科研记录。

必须设计备份。

---

# 133. Database backup

定期备份：

```text
observations
identifications
taxa
locations
media metadata
specimens
profiles
trips
```

---

# 134. Portable Export

定期支持：

```text
observations.csv
identifications.csv
taxa.csv
locations.csv
media.csv
specimens.csv
```

未来增加 JSON。

---

# 135. Media backup

R2 原始图片不能是唯一副本。

必须有：

> 独立备份策略。

具体可根据现有存储资源实施。

---

# 136. Darwin Core

底层 schema 尽量保持可映射：

```text
eventDate
decimalLatitude
decimalLongitude
country
stateProvince
county
locality
scientificName
sex
lifeStage
recordedBy
identifiedBy
occurrenceID
catalogNumber
```

但不要让 Darwin Core 控制网站 UI。

---

# 137. Repository 结构

优先保留现有 Astro 结构。

建议逻辑大致：

```text
src/
  components/
  layouts/
  pages/
  content/
  lib/

src/lib/
  auth/
  database/
  privacy/
  media/
  taxonomy/
  cloudflare/

database/
  migrations/

scripts/

docs/

public/
```

不要为了结构美观无意义移动全仓库。

---

# 138. 推荐组件

仅在实际重复时抽象：

```text
ScientificName
ObservationCard
FeaturedObservation
FieldNote
MediaGallery
MediaLightbox
MediaMeta
SpeciesHeader
TripFigure
PlaceCard
CollaboratorCard
TaxonStatus
PrivacyBadge
```

不要过度 engineering。

---

# 139. README

README 必须说明：

```text
项目定位
技术栈
本地开发
环境变量
GitHub → Cloudflare
数据库
R2
认证
Migration
隐私
部署
```

---

# 140. AGENTS.md

必须更新根目录 AGENTS.md。

至少包含：

```text
1. 本项目为 Salticid Notes / 跳蛛观察志。

2. 网站不限于中国，核心数据结构不得引入中国专属假设。

3. 网站公开界面只使用中文，不建立英文版或 i18n。

4. salticidnotes.cn 是唯一正式 canonical domain。

5. GitHub 是唯一源码真源。

6. Cloudflare 负责自动构建与生产部署。

7. 正常部署必须由 GitHub push/merge 触发。

8. Observation 是核心实体。

9. Species 页面是 Observation 聚合，不是百科数据库。

10. 用户只有 visitor / collaborator / owner 三类。

11. Collaborator 由 Owner 邀请，禁止公众注册。

12. 登录使用邮箱 OTP，不使用微信或密码。

13. 专业伙伴可以直接发布，不存在审核工作流。

14. 不得重新添加 submitted/review/approved 等状态。

15. Observation 的权威分类身份必须通过 Identification → Taxon。

16. Unknown、cf.、aff.、working taxa 都是合法状态。

17. Identification history 必须保留。

18. 已公开 Stable Observation ID 永久不变。

19. 已公开 Stable Media ID 永久不变。

20. 原始上传图片永远不可覆盖。

21. 公开 derivative 不得泄露 GPS EXIF。

22. 隐藏 exact GPS 不得出现在 HTML、JSON、JS、地图数据或 metadata 中。

23. 所有 schema 修改必须有 migration。

24. 所有重要修改必须考虑 Audit Log。

25. 不得把项目扩展成完整 Salticidae 数据库。

26. 不得添加 public upload、评论、点赞、关注、论坛、排行等社区功能。

27. 公开页面优先照片、相遇和野外笔记，metadata 次级。

28. Cloudflare secrets 和 Supabase service key 永不得进入 Git。

29. 保持旧公开 URL 和永久 ID 的兼容性。

30. 每个功能完成前必须通过 build、privacy 和真实流程检查。
```

---

# 141. 旧品牌迁移

搜索整个仓库：

```text
中国跳蛛观察志
China Salticid
China Salticid Field Notes
Jumping_Spider_CHINA
CSFN
contributor
submission
review
approved
```

逐个判断。

不要 Blind Replace。

---

# 142. 品牌替换

UI：

```text
中国跳蛛观察志
→
跳蛛观察志

China Salticid Field Notes
→
Salticid Notes
```

---

# 143. Contributor 迁移

如果现有内部 role：

```text
contributor
```

已经大量使用：

可以暂时保留数据库内部枚举。

但公开 UI：

```text
伙伴
```

代码语义逐渐迁移为：

```text
collaborator
```

不要要求用户重新创建账户。

---

# 144. Review workflow 迁移

如果现有代码包含：

```text
submitted
review
approved
rejected
revision_requested
```

且没有正式历史数据依赖：

迁移为：

```text
draft
published
private
archived
```

如果生产已有数据：

写 migration。

不要直接删除。

---

# 145. 中国专属字段迁移

搜索：

```text
province
prefecture
county
China
CN
```

区分：

- 数据字段；
- UI label；
- Demo 数据；
- 实际地理逻辑。

将核心模型迁移为：

```text
country
admin1
admin2
locality
```

但中国 UI 仍可显示：

```text
省 / 自治区
县
```

---

# 146. GitHub Pages 迁移

旧生产：

```text
zyyang0124.github.io/Jumping_Spider_CHINA/
```

新生产：

```text
salticidnotes.cn
```

迁移完成后：

GitHub 仍保留 Repository。

GitHub Pages 不再是正式 deployment。

---

# 147. 旧 URL

尽可能让旧地址继续可达。

如果适合：

```text
旧 GitHub Pages
↓
跳转
↓
salticidnotes.cn
```

但不要因为重定向破坏 GitHub repo 本身。

---

# 148. Visual Refinement Priority P0

第一轮视觉优化只做：

```text
三宽度布局
首页 asymmetric editorial grid
Observation Hero
Field Note 排版
metadata 弱化
Places 视觉化
Trip 杂志化基础
减少边框
Footer 清理
```

---

# 149. Media Archive Priority P1

第二轮：

```text
SFN-M ID
Media Detail
Lightbox
精选 / 全部
图片 attribution
semantic grouping
```

---

# 150. Taxonomy Priority P2

第三轮：

```text
working taxa
cf.
aff.
unidentified
classification browse
identification history UI
```

---

# 151. Cloudflare Migration Priority

建议实施顺序：

```text
现有仓库审计
↓
品牌去中国化
↓
地理模型全球化
↓
中文单语统一
↓
GitHub → Cloudflare 部署
↓
salticidnotes.cn
↓
邮箱 OTP
↓
专业伙伴直接发布
↓
R2
↓
Media ID
↓
视觉优化
```

不要一次重构全部系统。

---

# 152. Phase 1｜Repository Audit

输出：

```text
现状
风险
需迁移项
保留项
breaking changes
```

然后才修改。

---

# 153. Phase 2｜Brand

完成：

```text
Salticid Notes
跳蛛观察志
salticidnotes.cn
```

并清除公开 UI 中 China-only 品牌。

---

# 154. Phase 3｜Global Geography

确保系统能够创建：

```text
国家：马来西亚
admin1：沙巴
地点：神山地区
```

而不要求“中国省份”。

---

# 155. Phase 4｜Cloudflare

连接 GitHub。

确保：

```text
feature branch
→ preview

main
→ production
```

Production：

```text
salticidnotes.cn
```

---

# 156. Phase 5｜Auth

实现：

```text
Owner 邀请邮箱
↓
OTP
↓
Field Studio
```

陌生邮箱：

> 无权进入。

---

# 157. Phase 6｜Direct Publishing

跑通：

```text
Partner login
↓
New Observation
↓
Publish
↓
Public
```

不经过 Owner。

---

# 158. Phase 7｜Media

实现：

```text
R2
original
derivatives
SFN-M
Media Detail
```

---

# 159. Phase 8｜Visual

完成 public site editorial redesign。

---

# 160. 真实验收 1｜专业伙伴发布

测试：

```text
Owner 邀请伙伴
↓
伙伴收到 OTP
↓
登录
↓
上传 6 张图片
↓
填写日期地点
↓
填写 Siler cupreus
↓
填写野外笔记
↓
选择 blurred
↓
点击发布
```

结果：

```text
立即公开
Species 页面自动聚合
Media ID 生成
图片可打开
GPS 无泄漏
```

---

# 161. 真实验收 2｜Unknown

创建：

```text
Chrysillini sp.
```

应：

```text
正常发布
正常展示
正常进入相关聚合
没有 error badge
```

---

# 162. 真实验收 3｜Working taxon

创建：

```text
Phintella sp. MY01
```

以后改：

```text
Phintella yangi
```

要求：

```text
Observation ID 不变
Media ID 不变
旧 Identification 保留
Species 聚合更新
Audit 记录
```

---

# 163. 真实验收 4｜国外记录

创建：

```text
国家：马来西亚
admin1：沙巴
地点：神山地区
```

要求：

```text
录入正常
发布正常
地图正常
筛选正常
搜索正常
Species 聚合正常
```

不能要求 China 字段。

---

# 164. 真实验收 5｜坐标隐藏

创建：

```text
exact GPS = real coordinates
visibility = locality_only
```

公开页面：

```text
只看到地点文字
```

然后检查：

```text
HTML
source
JSON
JS
network
GeoJSON
OpenGraph
JSON-LD
image EXIF
```

都没有 exact GPS。

---

# 165. 真实验收 6｜Media

单张照片：

```text
SFN-M-000352
```

访问：

```text
/media/SFN-M-000352
```

应看到：

```text
照片
Observation
鉴定
时间
地点
摄影者
版权
view type
```

---

# 166. 真实验收 7｜中文单语

全站检查。

除了：

```text
Salticid Notes
Field Studio
拉丁学名
必要专业缩写
```

普通用户不应该看到成片英文 UI。

---

# 167. 真实验收 8｜Cloudflare

检查：

```text
[ ] GitHub push feature branch
[ ] Preview 自动生成
[ ] main merge
[ ] Production 自动部署
[ ] salticidnotes.cn 正常
[ ] HTTPS 正常
[ ] canonical 正确
[ ] sitemap 正确
[ ] R2 图片正常
[ ] Secrets 未泄露
```

---

# 168. 性能

这是图片密集型网站。

必须：

```text
responsive images
srcset
sizes
lazy loading
explicit width/height
modern formats
CDN cache
```

不要在网格里加载原始高分辨率图片。

---

# 169. Mobile

至少测试：

```text
375px
768px
1280px
1440px
```

特别检查：

```text
首页 asymmetric grid
Observation Hero
Lightbox
Trip 图片
Species
Places
Studio 上传
OTP
```

---

# 170. Accessibility

至少保证：

```text
semantic HTML
alt text
keyboard navigation
visible focus
lightbox keyboard close
sufficient contrast
reduced motion
form labels
```

---

# 171. 错误状态

任何新增功能必须考虑：

```text
loading
empty
error
success
```

不能只做成功状态。

---

# 172. 禁止范围扩张

未经明确要求，不得新增：

```text
公众注册
公众投稿
评论
点赞
关注
论坛
私信
排行榜
Gamification
AI 自动鉴定
public taxonomic voting
完整全球 Salticidae 名录
GBIF sync
WSC sync
原生移动 App
```

---

# 173. Definition of Done

任何功能只有满足以下条件才算完成：

```text
[ ] 功能实现
[ ] 中文 UI 完整
[ ] 手机端正常
[ ] 权限检查
[ ] 隐私检查
[ ] migration 已提交
[ ] audit 已考虑
[ ] loading 状态
[ ] empty 状态
[ ] error 状态
[ ] lint 通过
[ ] type check 通过
[ ] Astro production build 通过
[ ] Cloudflare Preview 正常
[ ] 真实 Observation 流程测试
[ ] 没有新增 China-only 假设
[ ] 文档已更新
```

---

# 174. 最终设计判断标准

每做一个公开页面，都问：

> 这个设计有没有让访问者更接近真实的“与蜘蛛相遇”的体验？

如果答案是肯定的，继续。

再问：

> 一个研究者以后还能不能准确知道这张图片来自哪次 Observation、谁拍摄、何时何地、如何鉴定？

如果答案也肯定：

> 设计成功。

---

# 175. 网站最终气质

打开：

```text
https://salticidnotes.cn
```

访问者应该感觉：

> 这是几位真正长期观察和研究跳蛛的人，共同维护的一本漂亮数字野外笔记。

而不是：

> 一个数据库。

公开层：

```text
安静
漂亮
摄影优先
自然史
有个人性格
```

底层：

```text
结构化
稳定
可追溯
隐私安全
长期可维护
```

---

# 176. 最终数据关系

始终保持：

```text
TRIP
 │
 ▼
OBSERVATION
 │
 ├── MEDIA
 │
 ├── LOCATION
 │
 ├── SPECIMEN
 │
 └── IDENTIFICATION
          │
          ▼
        TAXON
```

而：

```text
SPECIES PAGE
```

只是：

```text
多个 Observation
根据 Current Identification
形成的聚合视图
```

---

# 177. 最终工程关系

始终保持：

```text
本地开发
    ↓
GitHub
源码唯一真源
    ↓
Cloudflare
构建 + 部署 + CDN
    ↓
salticidnotes.cn

Supabase
Auth + PostgreSQL

Cloudflare R2
科学影像
```

---

# 178. 开始执行

现在开始时：

不要立即大规模改代码。

首先完成一次 repository audit。

必须明确回答：

```text
1. 当前 Astro 架构是什么？
2. 当前 GitHub Pages 部署如何工作？
3. 哪些 China-only assumptions 需要删除？
4. 当前 CSFN ID 是否已永久化？
5. 当前 Contributor / Review workflow 有哪些代码？
6. 当前认证是否可以迁移到邮箱 OTP？
7. 当前上传如何工作？
8. 当前精确 GPS 是否可能进入 public build？
9. 当前图片是否可能泄露 EXIF GPS？
10. Cloudflare Pages 或 Workers 哪一种改动最少？
11. salticidnotes.cn 如何绑定？
12. 哪些现有 URL 必须保持兼容？
```

然后制定可逆的迁移计划。

再按以下顺序执行：

```text
01 品牌迁移
02 中文单语统一
03 全球地理模型
04 GitHub → Cloudflare
05 salticidnotes.cn
06 邮箱邀请 + OTP
07 专业伙伴直接发布
08 R2 media
09 Stable Media ID
10 Observation / Species / Trip / Places 视觉升级
11 Privacy audit
12 Production hardening
```

每一个阶段都必须：

```text
修改
↓
测试
↓
Build
↓
Cloudflare Preview
↓
页面检查
↓
Privacy audit
↓
Commit
```

不要一次提交一个包含所有迁移的大型 commit。

使用小而清晰、可回滚的 commits。

---

# 179. 最高优先级

如果任何设计或技术选择发生冲突，按照以下优先级判断：

```text
科研记录完整性
>
隐私与敏感地点保护
>
长期可维护性
>
稳定永久标识
>
个人自然史气质
>
专业伙伴使用便利
>
页面功能丰富程度
```

---

# 180. 永久禁止偏离的核心原则

最后再次确认：

> Salticid Notes 不是中国跳蛛数据库。

> Salticid Notes 不是公众投稿平台。

> Salticid Notes 不需要审核可信赖专业伙伴的每条记录。

> Salticid Notes 的基本单位是 Observation。

> Salticid Notes 的物种知识来自一次次真实相遇的积累。

> 图片不仅用于展示，也是科学证据。

> 分类可以改变，Observation 和 Media 的身份不能改变。

> GitHub 是源码真源，Cloudflare 负责从 GitHub 自动部署。

> 网站只提供中文界面，但地理范围不限中国。

> salticidnotes.cn 是正式域名。

最终目标：

# 外面，是一本漂亮而有个性的跳蛛自然史观察志。

# 里面，是一条严谨、稳定、长期可追溯的观察—影像—鉴定证据链。

现在开始审计并实施，不要只给出建议。