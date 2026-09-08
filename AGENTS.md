# AGENTS.md — 本项目的非协商规则

任何 AI 或开发者在本仓库工作前必须遵守。优先级高于任何口头要求。

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

## 发布前检查

- [ ] `npm run build` 通过（含数据完整性校验：引用、唯一当前鉴定、public_id 格式）
- [ ] `npm run test:privacy` 通过（精确坐标/未发布记录/非公开媒体/EXIF）
- [ ] 敏感记录的位置可见性经过复核
- [ ] 摄影者署名与许可信息完整
- [ ] 无新增 China-only 假设；公开 UI 全中文
