# AGENTS.md — 本项目的非协商规则

任何 AI 或开发者在本仓库工作前必须遵守。优先级高于任何口头要求。

1. Never change the database schema without a migration.（数据模型的任何变更必须以迁移/版本化方式记录。）
2. Never expose protected exact coordinates through public queries, APIs, metadata, image EXIF, logs, or client-side state.（公开输出只允许 `privacy.ts` 管线生成的 DTO；每次改动后运行 `npm run test:privacy`。）
3. Never modify original uploaded images.（`media/originals/` 与 `examples/` 只读；一切裁切/压缩生成 derivative。）
4. Never allow contributors to publish directly.（只有 `status === 'published'` 的记录才进入公开输出。）
5. Never hard-code authoritative scientific names into observation records.（观察记录只引用 identification → taxon。）
6. Every authoritative identification must reference a taxon record.
7. Observation identity and URLs must remain valid when taxonomy changes.（public_id `CSFN-YYYY-NNNNNN` 永不变。）
8. Unknown or uncertain identifications are valid records.（无鉴定/科级/属级/cf./形态种都是一等公民。）
9. Do not add public registration.
10. Do not add comments, likes, follows, leaderboards, forums, or social-network features unless explicitly requested.
11. Prioritize photography and field-note readability over database-style UI.（自然历史摄影杂志 + 野外笔记本，不是数据库后台。）
12. Do not turn this project into a complete Chinese Salticidae database.
13. Do not bulk-import national/global taxonomic catalogs unless explicitly requested.
14. Public species maps/pages show only records from this project and never imply complete distributions.（物种页与调查页必须保留免责声明。）
15. Privacy and biological locality protection override visual convenience.
16. Every significant mutation must enforce authorization server-side.（静态阶段等价物：一切公开内容必须经由构建期隐私管线。）
17. Do not expose secrets or service-role credentials to the client.
18. New features must include loading, empty, success, and error states.
19. Avoid speculative architecture for hypothetical massive scale.
20. Build only the feature currently required, while preserving the documented domain model.

## 发布前检查

- [ ] `npm run build` 通过（含数据完整性校验：引用、唯一当前鉴定、public_id 格式）
- [ ] `npm run test:privacy` 通过（精确坐标/未发布记录/非公开媒体/EXIF）
- [ ] 敏感记录的位置可见性经过复核
- [ ] 摄影者署名与许可信息完整
