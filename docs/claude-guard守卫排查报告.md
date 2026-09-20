# claude-guard 守卫问题排查与修复记录

> 2026-09-09 排查 + 修复
> 行号指修复后的 `scripts/claude-guard.js`
> `Bash(git:*)` 全面禁 git 属项目要求，不列为问题

| # | 严重度 | 问题 | 状态 |
|---|---|---|---|
| 1 | 🔴 | deny 里的 `Grep()`/`Glob()`/`Write()`/`NotebookEdit()` 路径规则永不生效，每次启动刷警告 | ⚖️ 按规程保留 |
| 2 | 🔴 | 命令规则在整条命令文本里找单词，误伤 6/8 | ✅ 已修 |
| 3 | 🟠 | 自己跑 guard 的只读命令被拦 | ✅ 已修 |
| 4 | 🟠 | 备份文件不受保护、无限累积、不在 .gitignore | ✅ 已修 |
| 5 | 🟡 | 旧 matcher 不会被升级 | ✅ 已修 |
| 6 | 🟡 | `shellPathVariants` 只处理 `&&`，漏 `;` | ✅ 已修 |
| 7 | ⚪ | shell 参数展开形式仍绕得过 | ✅ 已修 |

**整体验证**：`check` 36/36；测试套件 0 项与预期不符（修前 6 项）；`sync` 幂等；
记账覆盖全部路径规则。第 1 条为规程取舍，不是缺陷，详见该节。

---

## 1. 🔴 47 条 deny 里 14 条永不生效

**位置** `denyRulesFrom`

**实测** 默认清单跑 `init` 生成 47 条，启动会话时 Claude Code 自己报出 14 行警告：

```
Permission deny rule (.claude\settings.json): Write(./dist/**) is not matched by
file permission checks — only Edit(path) rules are. Use Edit(./dist/**) instead
(Edit rules cover all file-editing tools).
```

被警告的构成：`Glob` 3 + `Write` 7 + `NotebookEdit` 4 = 14 条。
`Grep` 的 3 条没有被警告——官方失效名单是 `Write`/`NotebookEdit`/`Glob`/`MultiEdit`，不含 `Grep`。

**根因** 文件权限检查只查 `Read(path)` 和 `Edit(path)`：

> Claude Code checks file permissions against `Edit(path)` and `Read(path)` rules only.
> If you write a path rule for `Write`, `NotebookEdit`, `Glob`, or the legacy `MultiEdit` tool instead,
> Claude Code accepts the rule but never consults it, and warns at startup.
> —— https://code.claude.com/docs/en/permissions

**结论：按项目规程保留全量工具名。**

一度收窄为 `Read` + `Edit`（规则 47 → 31，警告归零），后按项目要求恢复：
规程要求把覆盖面在配置里逐个工具列出来，不依赖 Claude Code 的内部等价关系。
现状是 `protected` 生成 5 类、`readonly` 生成 3 类，默认清单 50 条规则。

`denyRulesFrom` 的函数注释里记了这个决定和警告原文，避免后人当成 bug 改窄。
**每次会话启动会刷 19 行提示，属预期行为。**

**同步改动** `parseDenyRule` 的识别范围随之扩到七类工具名
（`Read`/`Grep`/`Glob`/`Edit`/`Write`/`NotebookEdit`/`MultiEdit`），
与 `denyRulesFrom` 生成的范围对齐——否则手写的 `Write(./x)` 在反向同步里会被当成不存在，
既不报告也不回填。`adoptRules` 的归类改为「出现任一读类工具 → protected」。

**验证** 记账覆盖全部 30 条路径规则（sync 不会把自己生成的规则误判成清单外规则）；
反解析认全七类、正确忽略 `Bash(git:*)` 和 `WebFetch`；`check` 36/36；`sync` 幂等。

---

## 2. 🔴 命令规则误伤 6/8

**位置** `blockedCommand`

**实测（修前）**

```
←← 拦截  echo "use git for vcs"
←← 拦截  grep git README.md
←← 拦截  cat notes.md | grep git
←← 拦截  ls webpack
←← 拦截  echo "npm run build first"
←← 拦截  echo "run npm run dev to start"
```

**根因** 正则在**整条命令文本**里找独立单词，不区分它是否处在执行位置。
这与守卫模板自己写的原则矛盾——「内容里提到某个受保护路径的名字不算触碰它，
用路径名匹配内容会造成大面积误伤」，命令规则犯的是同一个错，只换了匹配对象。

**修法** 新增 `commandHeads`：按 shell 操作符拆子命令，取每条的可执行名；
剥掉前导环境变量赋值与包装器（`timeout`/`npx`/`xargs` 等）；
`$(...)` 和反引号内容换成分隔符，让子 shell 里的命令也被当成一条子命令检查。
`blockedCommand` 改为基于 head 匹配，npm 必须带 `run`，pnpm / yarn 可省略。

**修复过程中的一次回归**：改成执行位置匹配后，`cmd /c git status` 和
`powershell -Command "git diff"` 漏了（head 是 `cmd`/`powershell`）。
补 `RUNNERS` 处理——剥掉解释器及其开关，取内层命令名。

**验证** 误伤 6 → 0；`echo $(git push)` 仍拦、`echo "use git"` 放行；
Vue 项目高频命令 0 误伤（`vite.config.js`、`webpack.config.js`、`npm run lint` 等）。

---

## 3. 🟠 自己跑 guard 的只读命令被拦

**实测（修前）**

```
←← 拦截  node scripts/claude-guard.js list
←← 拦截  node scripts/claude-guard.js check
←← 拦截  grep "a>b" .claude/settings.json
```

**根因** 两条：脚本自身在 readonly 清单里，而 `isShellMutation` 把含 `node` 的命令
一律判为写操作；另外它的重定向正则不剥引号，把 `"a>b"` 里的 `>` 也当成写入。

**修法** 新增 `isGuardReadOnlyCommand` 白名单，只放行本工具的 `list` / `check`
（`init`/`sync`/`add`/`remove` 一律不在此列）；`isShellMutation` 找重定向前先剥掉引号内容。

**验证** `list`/`check` 放行，`remove` 仍拦；`grep "a>b" 配置文件` 放行。

---

## 4. 🟠 备份文件不受保护、无限累积

**位置** `backupSettings`

**实测（修前）** 连跑 4 次 `init` → 4 个备份文件，且可读可删：

```
←← 放行  cat .claude/settings.json.backup-2026-...
←← 放行  rm  .claude/settings.json.backup-2026-...
```

**根因** 文件名 `settings.json.backup-<时间戳>` 匹配不上 readonly 清单里的
`.claude/settings.json`——glob 转正则后右边界要求分隔符，而备份名在 `settings.json`
后面跟的是 `.`，不在右边界字符类里。`ensureGitignore` 也没覆盖这个模式。

**修法** `DEFAULT_READONLY` 增加 `.claude/settings.json.backup-*`（`FALLBACK` 同步加）；
新增 `pruneBackups` 只保留最近 `BACKUP_KEEP`（5）份；`ensureGitignore` 追加该模式。

**验证** 连跑 8 次 `init` 留 5 份；备份可读、不可 Edit 改、不可 `rm` 删；`.gitignore` 已写入。

**⚠️ 附带发现** 这条修复暴露了另一个问题：`loadConfig` 尊重已有清单、不会跟进
`DEFAULT_READONLY` 的新增项，所以老项目跑 `init` 时新保护**不会自动生效**。
已另行修复——见下方「附加修复」。

---

## 5. 🟡 旧 matcher 不会被升级

**位置** `upgradeGuardHook`（原 `cmdInit` 内的 `already` 判断）

**实测（修前）** 构造一份 matcher 停在 `Read|Edit` 的旧配置跑 `init`：

```
改前 matcher: Read|Edit  →  init 后: Read|Edit
```

**根因** 判重命中即整组跳过，不比对字段。后果是旧配置的守卫只在 Read/Edit 上生效，
**Bash / PowerShell / Grep / Glob / Write 全部绕过 hook**，而 `init` 照常输出成功。

**修法** 抽出 `upgradeGuardHook`：逐字段比对 `matcher`/`timeout`/`statusMessage`/`command`，
停在旧版本就地升级并打印差异；判重认完整路径 `.claude/hooks/guard-paths.js`
（别处的同名脚本不受影响）；守卫与别人的命令同组时拆成独立一组，原组 matcher 不动。

**验证** 旧配置升级成功，用户自己的 hook、`model` 等字段全部保留。
真实项目跑 `init` 时实际触发过一次：`...NotebookEdit` → `...NotebookEdit|MultiEdit`。

---

## 6. 🟡 `shellPathVariants` 只处理 `&&`

**实测（修前）** 清单为 `build/keys/**`，命令文本里不出现该路径：

```
   拦截  cd build && cat keys/k
←← 放行  cd build; cat keys/k
```

**根因** 正则末段写死 `\s*&&\s*`。

**修法** 分隔符改为 `(?:&&|;|\|\|)`。

**验证** `&&` / `;` / `||` 三种形式全拦，`cat keys/k`（未 cd）正常放行。

---

## 7. ⚪ shell 参数展开形式仍绕得过

**实测（修前）** 用 `变量:-默认值` 语法把受保护路径写成默认值，放行。

**根因** 边界字符类已补 `<`、`{`、反引号，但 `-` 仍被当作路径字符。

**这条不是「动边界」能解决的。** 把 `-` 加进左边界字符类，实测**比不修更差**
（8/14 vs 不修的 11/14）：修好 3 个目标用例，却引入 6 条 kebab-case 误伤——
清单项是 `config.json` 时，`app-config.json`、`vue-config.json`、`dev-config.json`
全部被误拦，而 kebab-case 在本项目是主流命名。

**修法** 不动边界，新增 `paramExpansionVariants`：把展开的默认值抽成额外的匹配变体，
与 `shellPathVariants` 同一模式。覆盖 `:-` / `:=` / `:+` 及不带冒号的形式。

**验证** 14/14——目标用例全拦，6 条 kebab-case 全部正常放行，原本该拦的无回归。

---

## 附加修复：自我保护基线补齐

不在原始问题清单里，是修第 4 条时暴露出来的。

**问题** `loadConfig` 读已有清单、不跟进脚本里 `DEFAULT_READONLY` 的新增项。
于是给脚本加了新保护项之后，老项目跑 `init` 依然不生效——备份文件的保护就这么漏掉了。
真实项目 `init` 后实测：清单仍是旧的 3 项，缺 `.claude/settings.json.backup-*`
和 `scripts/claude-guard.js`，备份和工具自身都没有保护。

**修法** 新增 `ensureBaseline`，`init` 和 `sync` 都强制补齐缺失的自我保护项并打印；
`cmdRemove` 拒绝移除这些项（放开等于模型能改权限配置或守卫脚本本身）。

---

## 同期新增：双向同步（`sync` 命令）

**正向** 清单 → `settings.json` 的 deny 规则、hook 注册、守卫脚本本体，外加基线补齐。

**反向** `settings.json` 里清单外的路径规则 → 清单。靠 `_managedDenyRules` 记账识别
「既不在记账里、又不是本次该生成的」路径规则。**默认只报告**，`--adopt` 才写入。

反向之所以不默认自动执行：反解析分不清「用户手写的」和「旧版本残留」。
本项目 `settings.json` 里的 `Read(./.env/**)` / `Edit(./.env/**)` 就是后者——
早期版本给所有 protected 项无脑补 `/**` 递归规则留下的，而 `.env` 是文件不是目录，
这个 glob 匹配不到任何东西。自动回填会把废规则永久固化进清单。

用法与归类规则见 `docs/claude-guard使用手册.md` §四。

---

## 修复过程中踩到的两个坑

**`String.raw` 模板的两个终止符**。`GUARD_TEMPLATE` 是 `String.raw` 模板，
注释里出现裸的反引号会终止模板，出现裸的美元花括号会被当成插值表达式——
两个我都踩了一次。往模板里加注释时要避开，正则里需要反引号写 `\x60`。

**测试 payload 别用 shell 拼 JSON**。用 `printf`/`echo` 拼 JSON 时 `\\` 和反引号会被
shell 二次解释，喂进去的是非法 JSON，而守卫对畸形 payload 是放行的——于是测出「漏洞」，
实际是自己的 shell 在捣鬼。这个坑让我一度误报「Windows 反斜杠路径不被拦」（实际正常）。
正确做法：用 Node 脚本构造 payload 并 `execFileSync` 喂进去。
