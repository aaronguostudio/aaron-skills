# Workflow benchmarks

Benchmarks evaluate real tasks separately from unit tests, routing-only evaluations,
platform acceptance and owner approval. Keep task definitions, scoring rules and
execution evidence distinct. A baseline can expose a blocker; it is not required
to produce a high score.

- [Blog v0](blog-v0/README.md): a committed snapshot of Aaron Guo's bilingual blog;
  no login, three fresh-adapter native-host trials, presentation feedback and handoff.
  [Baseline results](blog-v0/results/baseline.md) retain strict integration blockers
  separately from the three offline artifact-quality trials.
- Authenticated read-only and write-recovery cases: planned in the blog case registry;
  not yet executed or certified.
- [Onboarding v0](onboarding-v0/README.md): a fresh-profile installation and first
  artifact journey with synthetic voices, cover/body previews, and repeat output.
  Scripted CI, native-agent execution and human novice acceptance are separate.

These are development resources and sanitized result records. They do not change
the installed Demo runtime or register additional skills.

Read the [public/private boundary](PRIVACY.md) before adding a case or result.
The [public case registry](public-cases.json) permits the blog and synthetic onboarding cases.
Eligible future cases use licensed open-source projects or wholly fictional test
applications, including fictional login flows. Private project benchmarks are disabled.
Raw execution artifacts stay outside Git, even for public cases. Enable the local
index check with `git config --local core.hooksPath .githooks`; CI and source export
also enforce the boundary. New clones must enable the hook themselves.

公开仓库保存测试框架、已登记公开案例和经过审阅的结果；原始日志、截图、录屏和登录状态放在 Git 外。
暂不接入私有项目。需要登录的 benchmark 使用虚构测试应用和测试账号。
