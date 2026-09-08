# 中国跳蛛观察志 · China Salticid Field Notes

> 记录我们在中国野外调查与日常观察中遇见的跳蛛。

**China Salticid Field Notes** is a personal, curated natural-history project documenting jumping spiders encountered during fieldwork and everyday observations in China. It is NOT intended to provide a complete checklist or authoritative database of Chinese Salticidae.

**Every record begins with an observation, not a species entry.**
每条记录都始于一次观察，而不是一个物种条目。

## 当前状态

纯静态实现（Astro + TypeScript + 构建期数据管线），部署于 GitHub Pages：

**https://zyyang0124.github.io/Salticid_Notes/**

站点内容为开发阶段示例数据（基于 `examples/` 示例照片构建），用于展示数据模型与版式，并非正式发表的科学记录。

## 本地开发

```bash
npm install          # 安装依赖
npm run dev          # 开发服务器（http://localhost:4321/Salticid_Notes/）
npm run media        # 生成 Web 派生图（缩略图/中图/大图，剥离 EXIF）
npm run build        # 媒体管线 + 静态构建到 dist/
npm run preview      # 预览构建产物
npm run test:privacy # 公开数据安全测试（坐标泄露/未发布记录/非公开媒体/EXIF）
```

## 目录结构

```text
src/data/     「数据库」— 类型化 JSON 源表（含精确坐标等私有字段，绝不直接公开）
src/lib/      store（装载+完整性校验）· privacy（公开 DTO 管线）· queries（聚合）· format
src/pages/    公开页面（首页/观察/物种/调查/地点/伙伴/关于/搜索）
src/components/  卡片、图库灯箱、学名排版等组件
scripts/      process-media.mjs（图像派生）· test-privacy.mjs（安全测试）
media/originals/  原图副本（不可变，永不修改）
public/       favicon 与构建期生成的媒体派生图（gitignore）
```

## 核心设计原则

1. **Observation First** — 最基本实体是观察，物种页由「已发布观察 + 当前鉴定」聚合而来。
2. **隐私在数据层强制执行** — 地点四级可见性（exact / blurred / locality_only / hidden）；模糊化在构建期完成，公开 HTML/JSON 从源头不携带精确坐标；公开图片一律剥离 EXIF（含 GPS）。不依赖前端脚本隐藏位置。
3. **鉴定与观察分离** — 观察记录不存储权威学名；鉴定独立成表、引用 taxon 记录、带证据等级（暂定/照片/标本/生殖器/分子），保留完整鉴定历史；观察的永久编号（`CSFN-YYYY-NNNNNN`）与 URL 不因鉴定改变而变化。
4. **未知是一等公民** — 科级、属级、cf.、形态种（如 *Heliophanus* sp. GD01）与完全未鉴定的记录都是有效观察。
5. **Curated, not crowdsourced** — 邀请制投稿，投稿永不直接公开；本版本不含公开注册与社区功能。
6. **摄影优先** — 原图不可变，Web 派生图（400/1200/2000px）单独生成。

## 发布流程（GitHub Pages）

```bash
npm run build
git push origin main                 # 源码
# 静态产物推送 gh-pages 分支后，在仓库 Settings → Pages 选择 gh-pages 分支
```

注意：`public/.nojekyll` 必须存在——GitHub Pages 项目站点默认运行 Jekyll，
会忽略下划线开头的目录（Astro 的 `_astro/` 样式与脚本），缺该文件会导致线上样式全部 404。

## 路线图

按 `prompt.md` / `开发规范SOP.md` 的规划，后续阶段将接入 Supabase（PostgreSQL + RLS）、
邀请制账号、投稿工作流与 Field Studio 审核后台。当前版本的数据模型（`src/lib/types.ts`）
与内容管线即按该架构设计，迁移时可直接映射为数据库表。
