# claude-guard 使用手册

> 一句话：`scripts/claude-guard.js` 是一个**单文件、零依赖**的命令行工具，用来给 Claude Code
> 配置「哪些文件不许模型读、哪些不许模型改」，并生成配套的双层拦截配置。
>
> 原理、验证过程和为什么这么设计，见 [`大模型文件访问限制方案.md`](./大模型文件访问限制方案.md)。
> 本文只讲**怎么用**。

---

## 一、适用场景

### 该用它的情况

| 场景 | 怎么配 |
|---|---|
| 密钥、环境变量、证书私钥不想被模型读到 | `add ".env" "*.pem" "secrets/**"` |
| 客户数据、脱敏前的样本数据 | `add "data/raw/**"` |
| 权限配置、CI 脚本、发布脚本「能看但不许模型改」 | `add -r "deploy/**" ".github/workflows/**"` |
| 生成物 / 第三方产物，防止模型误改源头 | `add -r "dist/**" "vendor/**"` |
| 有对外契约的文件（接口定义、已上线的 DB migration） | `add -r "migrations/**"` |
| 团队里想统一一套红线，跟着仓库走 | 把 `.claude/` 三个文件提交进 git |

### 不该指望它的情况

- **约束有意绕过的人。** 开发者删掉 `.claude/settings.json`、删掉 hook、或加 `--dangerously-skip-permissions`
  就全绕开了。这套是**防手滑 / 防误操作**，不是防内鬼。真要强制，需要管理员下发
  `managed-settings.json`，见方案文档 §五。
- **约束一个主动想绕的模型。** 只要模型能执行任意 shell，靠「路径文本匹配」就一定有缝——
  **已知存在两条**，见 §八 坑 3。它防的是模型「顺手读了不该读的」，不是模型「有意要读」。
- **限制任意自定义命令。** 工具已内置禁止 Git、前端启动、预览和打包命令，并禁用 WebFetch、WebSearch；其他命令仍需按项目补充 `Bash(...)` / `PowerShell(...)` 规则。
- **绝对防止主动绕过。** Hook 可以识别常见 Shell 包装形式，但自定义程序、编码参数和复杂子进程仍需管理员级配置或操作系统策略补强。
- **非 Claude Code 的场景。** 生成的是 Claude Code 专有的 `permissions.deny` + `PreToolUse` hook，
  对 Cursor / Copilot 等其他工具无效。

---

## 二、它生成了什么

跑一次 `init`，项目里会多出/改动这几个文件：

| 文件 | 谁维护 | 作用 |
|---|---|---|
| `scripts/claude-guard.js` | 你手工放置（§三 第 0 步） | 配置工具本身，单文件无依赖 |
| `.claude/protected-paths.json` | **工具维护，也是唯一该手改的地方** | 保护清单（两类） |
| `.claude/settings.json` | 工具维护（合并写入） | L1：`permissions.deny` 规则 + hook 注册 |
| `.claude/hooks/guard-paths.js` | 工具生成，**别手改** | L2：`PreToolUse` 拦截脚本 |
| `.gitignore` | 工具按需追加两行 | 补上 `.env.local` / `.env.*.local`；用 `--no-gitignore` 可完全跳过 |
| `CLAUDE.md` | **你手写** | 给模型看的红线说明（L0，见 §七） |

### 两层拦截的分工

```
模型发起工具调用
   │
   ├─ L1  permissions.deny        —— Claude Code 内置权限层
   │      按 Read()/Edit() 规则匹配，锚定项目根（./ 开头）
   │      优点：改不了配置就绕不过；缺点：看不穿 shell 里的间接读取写法
   │
   └─ L2  PreToolUse hook          —— guard-paths.js
          按工具挑路径字段：command / file_path / path / notebook_path，
          Grep 另加 glob、Glob 另加 pattern
          （Grep 的 pattern 是搜索词不是路径，扫它会误伤检索操作）
          优点：cat / node -e / base64 这类间接读取也能拦
          缺点：正则匹配，偏严，可能误伤同名路径
```

两层都由同一份 `protected-paths.json` 驱动，改一处两边同步。

---

## 三、快速上手

### 第 0 步：把脚本放到新项目里

整个方案**只有 `claude-guard.js` 这一个文件需要手工搬**（其余全由 `init` 生成）。放置位置：

```
<新项目根>/
├── scripts/
│   └── claude-guard.js     ← 放这里
├── .claude/                ← init 自动创建，不用管
└── package.json
```

**两条位置约束：**

1. **必须在项目根执行。** 脚本用 `process.cwd()` 当项目根，不是按脚本自身位置推算。
   在子目录里跑，配置会被生成到那个子目录去。
2. **位置可以改，但要连带改清单。** 默认 readonly 清单里写死了 `scripts/claude-guard.js`
   （用来保护工具自身不被模型改）。如果你放在别处，`init` 之后补一条并把旧的移掉：

   ```bash
   node tools/claude-guard.js add -r "tools/claude-guard.js"
   node tools/claude-guard.js remove "scripts/claude-guard.js"
   ```

拷贝时**存成 UTF-8**（脚本里有中文提示语，存成 GBK 会乱码）。
放好之后确认文件是完整的——不带参数跑一次，能打印用法就说明没截断：

```bash
node scripts/claude-guard.js
# claude-guard — Claude Code 文件访问守卫配置工具
#   init / list / add / add -r / remove / check ...
```

（完整文件约 500 行，首行是 `#!/usr/bin/env node`。）

### 默认内置规则

执行 `init` 后无需手工添加，默认禁止访问：

```text
dist/**
.env.development
.env.production
```

敏感源目录和打包临时目录因项目命名不同，不作为工具默认值。初始化后按项目实际路径添加，例如：

```bash
node scripts/claude-guard.js add "protected-resources/**" ".build-protected-assets/**"
```

每个 `protected` 路径生成 `Read`、`Grep`、`Glob`、`Edit`、`Write` 五类 deny，
每个 `readonly` 路径生成 `Edit`、`Write`、`NotebookEdit` 三类，并由 Hook 拦截 Shell 间接访问。

> 本项目规程要求把覆盖面在配置里逐个工具列出来，所以工具名写全。
> Claude Code 的文件权限检查只查 `Read(path)` 和 `Edit(path)`，其余工具的路径规则
> 会在会话启动时各刷一行提示（一份默认配置实测 19 行），属正常现象。

同时默认禁止：

- 所有 Git 命令；
- npm、pnpm、yarn 的 dev、serve、start、preview、build 命令；
- Vite、Webpack 直接命令；
- WebFetch 和 WebSearch。

`npm run test`、`npm run lint`、`npm run typecheck` 默认放行。

### 然后四步跑完

```bash
# 1. 先干跑，看它打算改哪些文件
node scripts/claude-guard.js init --dry-run --no-gitignore

# 2. 正式生成（幂等，可反复跑）
node scripts/claude-guard.js init --no-gitignore

# 3. 查看默认清单；需要时再增加项目专属路径
node scripts/claude-guard.js list
node scripts/claude-guard.js add "secrets/**" "*.pem"

# 4. 离线自检
node scripts/claude-guard.js check
```

然后做两件手工的事：

**a. `package.json` 加两条 script**（非 Node 项目跳过，直接敲 `node scripts/claude-guard.js`）

```json
"scripts": {
  "guard": "node scripts/claude-guard.js",
  "guard:check": "node scripts/claude-guard.js check"
}
```

**b. `CLAUDE.md` 写红线段落**，见 §七。

最后 **重启 Claude Code，或打开一次 `/hooks`**——不重启，新配置不会加载。

> ⚠️ **上面这四步请在你自己的终端里跑，或在 Claude Code 里用 `!` 前缀。**
> 原因见 §八「三个必踩的坑」第 1 条。

---

## 四、命令详解

```
node scripts/claude-guard.js <命令> [参数] [--dry-run] [--adopt] [--no-gitignore]

  init              生成/合并全部配置
  sync              双向同步清单与 settings.json
  list              查看当前保护清单
  add <glob...>     增加「禁读禁写」路径
  add -r <glob...>  增加「可读禁写」路径
  remove <glob...>  从两类清单里移除
  check             离线自检

  --dry-run         只预览不落盘（配 sync 就是纯体检）
  --adopt           让 sync 把清单外的路径规则反向并入清单
  --no-gitignore    让 init 完全不碰 .gitignore
```

### `init` —— 生成/合并全部配置

**幂等**，可以反复跑。检测到已有 `.claude/settings.json` 时，会先明确提示用户，然后备份原文件并增量合并：

- 原文件合法时，备份为 `.claude/settings.json.backup-<时间戳>`；
- 原文件不是合法 JSON 时，立即中止，不生成或覆盖任何 `.claude` 文件；
- 原有自定义字段、无冲突的 `permissions.allow`、手写 `permissions.deny` 和其他 Hook均保留；
- 守卫的 deny 优先级最高，与新增 deny 冲突的原有 allow 会被自动移除并在终端列出；
- 上一次由工具生成、但本次已经失效的规则会被回收；
- 重复执行不会重复注册 Hook，而且会**逐字段比对**已注册的那组（`matcher`、`timeout`、
  `statusMessage`、`command`），停在旧版本就地升级——只判断「注册过没有」是不够的，
  老版本装的 hook matcher 可能还停在 `Read|Edit`，那样 Bash / PowerShell / Grep
  全部绕过守卫，而 `init` 照常输出成功；
- 备份只保留最近 5 份，更旧的自动清掉。备份本身在 readonly 清单里（可读不可改）
  并写进 `.gitignore`——里面是完整权限配置，不保护等于给配置留了个可改的副本。

`init` 还会**强制补齐守卫的自我保护项**。`loadConfig` 尊重你改过的清单，不会自动跟进
脚本里 `DEFAULT_READONLY` 的新增项，所以升级脚本后老项目的新保护不会自己生效——
备份文件的保护就这么漏掉过一次。缺哪项补哪项，并在终端列出。

合并后的样子（注释标出哪些是原有的）：

```jsonc
{
  "permissions": {
    "deny": [
      "Read(./手写规则/**)",                 // ← 你原来写的，保留
      "Read(./secrets)", "Edit(./secrets)"   // ← 工具生成的
    ],
    "allow": ["Bash(npm run test)"]          // ← 你原来的非冲突规则，保留
  },
  "hooks": {
    "PreToolUse": [
      { "matcher": "Bash", "hooks": [] },                  // ← 你原来的 hook
      { "matcher": "Bash|PowerShell|Read|Edit|Write|Grep|Glob|NotebookEdit|MultiEdit",
        "hooks": [{ "type": "command", "command": "node .claude/hooks/guard-paths.js",
                    "timeout": 10, "statusMessage": "安全守卫检查中" }] }
    ]
  }
}
```

#### 项目里已经有 `PreToolUse` hook 怎么办

**通常什么都不用做**，合并是自动的。但按已有 hook 的性质分三种情况：

| 已有 hook 的性质 | 结果 |
|---|---|
| 只做格式化 / 日志 / 埋点（不返回 `permissionDecision`） | **零冲突**，两个并存，守卫照常拦截。最常见 |
| 会主动返回 `"permissionDecision": "allow"` | ⚠️ **行为未确认**：一个说 allow、一个说 deny 时谁赢，不要凭推测。在真实会话里故意触碰一次受保护路径，看是拦还是放行 |
| 你自己也有个脚本叫 `guard-paths.js`（放在别处，如 `tools/`） | 不受影响。判重认的是完整路径 `.claude/hooks/guard-paths.js`，不是光看文件名 |
| 你把守卫和自己的命令挂在了**同一组** | 守卫会被拆成独立一组，你的命令留在原组、`matcher` 一个字都不动。否则「顺手升级 matcher」会连带放大你那条命令的触发范围 |

matcher 重叠不影响——两组各跑各的。

排查手段：会话里输入 `/hooks`，能看到当前实际生效的全部 hook。注意项目级、
用户级（`~/.claude/settings.json`）、企业级 managed 三处是**叠加**的，
`init` 只动项目级那一份。

`init` 时若 `protected-paths.json` 不存在，会使用内置默认清单：

- `protected`：`dist/**`、`.env.development`、`.env.production`
  （敏感源目录和打包临时目录因项目命名不同，不作为默认值，见 §三）
- `readonly`：`.claude/settings.json`、`.claude/settings.json.backup-*`、
  `.claude/protected-paths.json`、`.claude/hooks/**`、`scripts/claude-guard.js` 共五项

此外会自动写入 Git、启动、预览、打包、WebFetch 和 WebSearch 的禁止规则。

### `sync` —— 双向同步清单与 `settings.json`

```bash
npm run guard:sync                  # 双向检测 + 正向修复
npm run guard -- sync --dry-run     # 纯体检，不写盘
npm run guard -- sync --adopt       # 连反向回填一起做
```

存在的意义是：**「`settings.json` 里有这个 hook」不等于「守卫还管用」**。
四样东西会各自漂移，光看一眼看不出来：

| 漂移 | 怎么发生的 | 后果 |
|---|---|---|
| `deny` 规则与清单对不上 | 手改了 `protected-paths.json` 没重跑同步 | L1 缺一层，只剩 hook 兜底 |
| hook 的 `matcher` 是旧版本的 | 早期版本装的 | **Bash / PowerShell / Grep 全部绕过守卫**，最危险 |
| `guard-paths.js` 是旧版生成的 | 升级了脚本但没重跑 | 判定逻辑停在老版本 |
| 清单缺了自我保护项 | 脚本加了新的 `DEFAULT_READONLY` 项，老清单没跟进 | 新保护形同虚设 |

#### 正向：清单 → `settings.json`

重算 deny 规则、升级 hook 注册块、重写守卫脚本本体，并补齐自我保护项。
无漂移时一行输出就结束；有漂移时逐条列出：

```
  正向（清单 → settings.json）：
    · 补回守卫自我保护项：.claude/settings.json.backup-*、scripts/claude-guard.js
    · 新增 2 条 deny 规则
```

#### 反向：`settings.json` → 清单

有些 deny 规则在 `settings.json` 里、清单却不知道它们存在。三种来路：你没走 `add`
直接手写的、旧版本工具生成的残留、别人或别的工具加的。工具靠 `_managedDenyRules`
记账认出它们——既不在记账里、又不是本次该生成的路径规则，就判定为「清单外」。

**默认只报告，不动它们**：

```
  反向：发现 2 条清单外的路径规则（settings.json 里有、清单里没有）
    · Read(./.env/**)
    · Edit(./.env/**)
  它们原样保留。确认要并进清单，加 --adopt 重跑。
```

加 `--adopt` 才回填，归类规则：

| `settings.json` 里的形态 | 回填成 |
|---|---|
| 同一路径既有 `Read()` 又有 `Edit()` | `protected`（禁读禁写） |
| 只有 `Edit()` | `readonly`（可读禁写） |
| 只有 `Read()` | 也归 `protected`——读都不许了，写更不该放开 |

反解析认得的工具名是 `Read`/`Grep`/`Glob`/`Edit`/`Write`/`NotebookEdit`/`MultiEdit` 七类，
与 `denyRulesFrom` 生成的范围一致——只认 `Read`/`Edit` 的话，手写的 `Write(./x)`
在反向同步里会被当成不存在，既不报告也不回填。

命令类规则（`Bash(git:*)`）和裸工具名（`WebFetch`）不参与反向，它们跟文件保护无关。

#### 回填与否的区别

规则本身**回不回填都照常生效**，区别在管理权：

| | 不回填 | 回填后 |
|---|---|---|
| deny 是否生效 | 生效 | 生效 |
| `list` 能看到 | 看不到 | 能看到 |
| 能否 `remove` 删掉 | 不能 | 能 |
| 两边是否一致 | 长期分叉 | 一致 |

#### ⚠️ 为什么反向默认不自动做

**反解析分不清「你有意手写的」和「旧版本的垃圾」。**

真实案例就是上面那两条：早期版本给所有 protected 项无脑补 `/**` 递归规则，于是
`.env` 生出了 `.env/**`。而 `.env` 是文件不是目录，这个 glob 匹配不到任何东西。
`--adopt` 会把这条废规则永久固化进清单，往后 `list` 里一直挂着。

所以反向必须由人点头。**并入前先看一眼报告里列出的清单**；确认是垃圾的话，
从 `settings.json` 里手删比回填干净。

### `list` —— 查看清单

```
受保护路径  .claude/protected-paths.json

  protected — 禁读禁写 (2)
    · ...

  readonly — 可读禁写 (4)
    · .claude/settings.json
    · ...

  共生成 8 条 permissions.deny 规则
```

末行的条数用来跟 `settings.json` 对账——对不上说明没同步（重跑 `init`）。

### `add` / `add -r` —— 加保护

```bash
node scripts/claude-guard.js add "secrets/**"        # 禁读禁写
node scripts/claude-guard.js add -r "deploy/**"      # 可读禁写
node scripts/claude-guard.js add "a/**" "b/**"       # 一次多个
```

加完立即重算并写回 `settings.json`。**glob 要加引号**，否则 shell 会先展开 `*`。

### `remove` —— 撤销保护

```bash
node scripts/claude-guard.js remove "secrets/**"
```

参数要跟清单里的**字面量完全一致**（`list` 里怎么显示就怎么写）。
移除会真正清掉对应的 deny 规则。例如 `add "vaultdir"` 生成 4 条规则，
`remove "vaultdir"` 后残留 0 条，同时手写规则完好无损。

> 这背后是 `protected-paths.json` 里的 `_managedDenyRules` 记账字段：
> 同步时**先减去上次工具生成的规则，再加入本次生成的**。手写规则不在记账里，
> 所以既不会被误删，工具生成的旧规则也不会赖着不走。**别手动编辑这个字段。**

### `check` —— 离线自检

不调用模型，直接把模拟 payload 喂给 `guard-paths.js`，验证默认路径和命令规则：

```text
  ✓ 读取构建产物         dist/assets/...          应拦截 / 实际拦截
  ✓ 读取生产环境文件     cat .env.production      应拦截 / 实际拦截
  ✓ Git 直接命令         git status               应拦截 / 实际拦截
  ✓ npm 生产打包         npm run build:prod       应拦截 / 实际拦截
  ✓ 执行单元测试         npm run test             应放行 / 实际放行
  ...
```

退出码 0 表示全部通过，1 表示存在失败。

`check` 验证 L2 Hook 判定逻辑；`permissions.deny` 是否生效，需要重启 Claude Code 后在真实会话中验证。若主动删除默认保护项，自检会按默认安全基线报错。

### `--dry-run` —— 只预览不落盘

对 `init` / `sync` / `add` / `remove` 都生效。配 `sync` 用尤其顺手——
`sync --dry-run` 就是一次纯体检，只报告漂移不改任何文件：

```bash
node scripts/claude-guard.js init --dry-run
#   [dry-run] 将写入 .claude\hooks\guard-paths.js (PreToolUse 守卫脚本)
#   [dry-run] 将向 .gitignore 追加: ...

node scripts/claude-guard.js sync --dry-run
#   正向（清单 → settings.json）：
#     · 补回守卫自我保护项：...
#   反向：发现 2 条清单外的路径规则
#   [dry-run] 未写入任何文件
```

**改配置前先 dry-run 一遍**是个好习惯，尤其是在守卫已经生效之后（见 §八）。

### `--no-gitignore` —— 让 `init` 完全不碰 `.gitignore`

`init` 默认会检查 `.gitignore` 里有没有 `.env.local` / `.env.*.local`，缺了就追加。
加上这个 flag 就一行都不写：

```bash
node scripts/claude-guard.js init --no-gitignore
```

**什么时候该加**：项目的 env 文件本身要提交进版本库，你不希望工具替你做忽略决定。

> **为什么默认只认 `.local` 这两条**
>
> vue-cli 的约定里，`.env.development` / `.env.production` 装的是 `VUE_APP_API_BASE`
> 这类**非敏感构建配置，通常是要提交的**；真正的密钥放在 `.env.local` / `.env.*.local`。
> 早期版本默认往 `.gitignore` 里写 `.env` / `.env.development` / `.env.production` 三行，
> 在这类项目上会造成**静默漏提交**——所以改成了现在这样。
>
> 注意 `.gitignore` **只对未跟踪的文件生效**。已经在版本库里的文件加进去也照常提交，
> 所以老项目风险小，**新项目才是真会踩坑的那个**。

### `.gitignore` 与环境文件保护的区别

`--no-gitignore` 只是不让工具修改 `.gitignore`，不会取消 `.env.development` 和 `.env.production` 的模型访问保护。本方案要求这两个文件默认禁读禁写，但是否提交到版本库仍由项目自行决定。

如需保护其他本地密钥文件，可追加：

```bash
node scripts/claude-guard.js add ".env.local" ".env.*.local"
```

删除默认环境文件保护会使安全基线自检失败，除非经过项目安全负责人确认，否则不建议移除。

---

## 五、配置详解：`protected-paths.json`

```jsonc
{
  "_comment": "...",
  "protected": ["<禁读禁写的 glob>"],
  "readonly":  [".claude/hooks/**"],          // 可读禁写
  "_managedDenyRules": ["Read(./...)"]        // 工具记账，别手改
}
```

### 为什么是两个文件，不能合并成一个

**`protected-paths.json` 是源，`settings.json` 里那几条 deny 规则是编译产物**，
关系跟 `src/` 和 `dist/` 一样。分开有五个理由：

1. **所有者不同。** `settings.json` 是 Claude Code 的文件，schema 由官方定义。
   往里塞自定义键，官方对未知键怎么处理没有承诺——可能忽略，也可能警告，将来可能校验。
2. **「两类保护」的语义在 deny 规则里表达不出来。** deny 只有 `Read()` / `Edit()` 两种动作。
   光看 `Edit(./.claude/hooks/**)`，判断不出它是 readonly 生成的、还是 protected 但少了一条。
   原始意图一丢，`list` 显示不出来，`remove` 也没法精确回收。
3. **一份清单要喂两个格式完全不同的消费者。** L1 要规则字符串（一条路径展开成 2~4 条），
   L2 hook 要**原始 glob** 拿去做正则匹配。只存 deny 规则的话，hook 得反解析
   `Read(./x/**)` → `x/**`，还要靠「有没有配套 Read 规则」猜它属于哪一类，脆弱。
4. **记账要有地方放。** `_managedDenyRules` 必须持久化，才能做到「先减后加」——
   这是 `remove` 真正生效、同时不误删手写规则的前提。放进 `settings.json` 就是污染官方 schema。
5. **隔离写入风险。** `settings.json` 里还有你的手写 deny、别的 hook、env 变量。
   工具只对自己记账的那部分负责，其余原样保留；合并后每次都要整体重写这个文件，
   格式差异会产生噪音 diff，团队协作的冲突面也更大。

附带好处：hook 每次工具调用都要跑一次，读一个二十来行的小 JSON，
比解析一个可能有几百条 allow 规则的 `settings.json` 更快、更不容易出问题。

**反过来只留 `protected-paths.json` 不行**：`permissions.deny` 和 hook 注册必须写在
`settings.json` 里，那是 Claude Code 规定的读取位置，没得选。

### 两类保护的语义

| | L1 `permissions.deny` | L2 hook 行为 | 典型对象 |
|---|---|---|---|
| `protected` | 生成 `Read()`、`Grep()`、`Glob()`、`Edit()`、`Write()` | 任何工具触碰都拦 | 密钥、环境变量、原始客户数据 |
| `readonly` | 生成 `Edit()`、`Write()`、`NotebookEdit()` | Read/Grep/Glob 和 Shell 只读放行；Edit/Write/NotebookEdit/MultiEdit 及 Shell 写入、删除、重命名、脚本修改均拦截 | 权限配置、守卫自身、发布脚本 |

**为什么要分两类**：最初一刀切禁读禁写，结果连查看自己刚生成的配置都做不到，
排查问题时寸步难行。配置类文件必须「能看不能改」。

### 支持的 glob 语法

| 写法 | 含义 | 例 |
|---|---|---|
| `*` | 匹配任意字符，**不跨 `/`** | `*.pem` |
| `**` | 匹配任意层级，**跨 `/`**；`a/**` 也匹配 `a` 本身 | `secrets/**` |
| 目录名 | 自动展开（见下） | `secrets` |

### 目录支持：自动展开规则

直接写目录名就行，工具会**自动补一条递归规则**：

```
add "secrets"       →  Read(./secrets)      Edit(./secrets)
                       Read(./secrets/**)   Edit(./secrets/**)
add "config/keys"   →  同上四条（多级目录也认）
add -r "deploy"     →  Edit(./deploy)       Edit(./deploy/**)
```

hook 那层不需要展开：它的正则右边界包含 `/`，所以 `secrets` 一条规则天然覆盖
`secrets/api.key`、`secrets/deep/nested/a.txt`、`ls ./secrets/`。
Windows 反斜杠也没问题——hook 会先把 `\` 归一成 `/`，`<盘符>:\<项目>\secrets\a.key` 照样拦。

**⚠️ 两种目录名不会自动展开：点开头的（`.secrets`）和名字里带点的（`dist.old`）。**

判断条件是「不含 `*`、无扩展名、不以 `.` 开头」——这是为了别把隐藏文件当成目录。
代价是这两种目录只会生成 `Read(./.secrets)` 这样的单条规则，**子文件在 L1 层是漏的**
（L2 hook 仍然拦得住 `.secrets/a.key`，但别只靠一层）。

**遇到这两种目录，显式写通配**：

```bash
node scripts/claude-guard.js add ".secrets/**"    # 想连目录本身也锁就再加一条 ".secrets"
```

### 匹配范围的一个不对称

- **L1 deny 锚定项目根**：`Read(./secrets/**)` 只管根下的 `secrets/`。
- **L2 hook 不锚根**，是路径片段匹配：`src/secrets/a.txt` 也会被拦。

方向偏严，通常是好事。但如果项目里恰好有个同名的普通目录会被误伤，
就把清单写得更具体（用 `config/keys` 而不是 `keys`）。

近似名不会误伤：`mysecrets/`、`secretsbak/` 均放行。

### hook 只看路径字段，不看内容

只扫 `command` / `file_path` / `path` / `pattern` / `notebook_path` 五个字段，
**不扫 `content` / `old_string` / `new_string`**。

所以「文档里提到某个受保护路径的名字」不算触碰它——否则这份手册本身就写不出来。
防外泄要匹配密钥的**值**，用路径名去匹配内容是大面积误伤。

### 手动改配置（不通过脚本）

完全可以手改，但要知道**改一处不会自动同步另一处**。

#### 唯一该手改的文件

只有 `.claude/protected-paths.json` 的 `protected` / `readonly` 两个数组。
`_comment` 和 `_managedDenyRules` 对守卫没有意义，hook 只读前两个数组。

**别手改 `.claude/hooks/guard-paths.js`** —— 它由 `claude-guard.js` 里的 `GUARD_TEMPLATE`
生成，下次跑 `init` 会被整个覆盖。要持久改守卫逻辑，改模板。

#### 两层生效方式不同

| 你改了 | L2（hook） | L1（`permissions.deny`） |
|---|---|---|
| `protected-paths.json` | **立即生效**，hook 每次调用都重读清单 | **不变**，需要另行同步 |
| `settings.json` 的 deny | 不受影响 | 通常要重启 Claude Code 或打开一次 `/hooks` |

也就是说：只手改清单文件，等于**只加固了 L2，L1 还停在旧状态**。

#### 同步 L1 的两种做法

**做法 A（推荐）**：手改完清单，跑一次 `npm run guard:sync` 让工具重算 deny 规则。
它会保留你手写的规则、按新清单重新生成工具规则、顺带把记账对齐，还会一并校对
hook 注册块和守卫脚本版本——比只跑 `init` 覆盖得全，也比自己数规则条数靠谱。

**做法 B（全手工）**：自己在 `settings.json` 的 `permissions.deny` 里增删。生成规律是：

| 清单里的一条 | 生成的 deny 规则 |
|---|---|
| `protected: ["X"]` | `Read(./X)`、`Grep(./X)`、`Glob(./X)`、`Edit(./X)`、`Write(./X)` 五条 |
| `readonly: ["X"]` | `Edit(./X)`、`Write(./X)`、`NotebookEdit(./X)` 三条 |
| 目录形态（不含 `*`、无扩展名、不以 `.` 开头） | **再加一组** `X/**` 的同类规则 |

手工增删时按上表把对应的几条一起加或一起删，保持与工具生成的形态一致。

路径统一以 `./` 开头（锚定项目根），清单里写的 `./` 前缀会被去掉。

#### ⚠️ `_managedDenyRules` 是记账，不是配置

它记录「工具上次生成过哪些 deny 规则」，同步时**先减去上次记账、再加入本次生成**。
两个方向都会踩：

- **手写的规则不要塞进去**——塞进去下次 `init` 会把它当成自己生成的，直接回收掉。
- **不要从里面删条目**——删掉等于告诉工具「这条是用户手写的」，那条 deny 规则从此
  **再也不会被回收**，改清单也删不掉它。

最省心的原则：**手工加规则就完全不碰这个字段**，让它继续只记工具生成的那些。

#### 改完必须验证 JSON

尾逗号、少引号这类错误会让 `JSON.parse` 失败，后果是**双向静默降级**：

- hook 走内置 `FALLBACK` 保底清单，你的自定义保护**全部失效**，
  拦截提示里会附带「配置读取失败」的警告
- 工具侧读不到清单会**回退到默认清单**，这时跑任何 `init` / `add` / `remove`
  都会拿默认值把你的自定义**覆盖掉**

所以改完先验一次：

```bash
node scripts/claude-guard.js list
```

显示的清单跟你写的对不上（或者条数不对），就是 JSON 坏了或者被回退了。

## 六、生效与验证

1. 改完配置 → **重启 Claude Code，或在会话里打开一次 `/hooks`**。不做这一步等于没改。
2. `node scripts/claude-guard.js check` → 验证 L2 判定逻辑（秒级）。
3. 真实会话里试一次读受保护文件 → 验证 L1。看到下面这类提示就是**正常工作**：

```
⛔ 安全守卫拦截：该操作触及受保护路径
该操作触及受保护路径（命中 protected 规则 "..."，禁读禁写）。
这是预期行为，不是故障。...
```

或者 Claude Code 权限层直接报 `denied by your permission settings`。

---

## 七、配套的 `CLAUDE.md` 红线段落

工具不会生成这段，需要手写。下面是**只覆盖本工具这套配置**的通用骨架——
把 `<...>` 换成实际路径就能用；项目自己的其他约定（代码风格、目录规范、发布流程等）
另起章节写，不要塞进这一节。

```markdown
## 受保护路径（安全红线）

以下路径为敏感数据，**禁止读取、检索、复制、摘要或写入**：

- <逐条列出密钥 / 凭据 / 环境变量文件，与 protected 清单保持一致>

以下路径**可以读，但不允许你修改**（改动由人来做）：

- `.claude/settings.json` —— 权限配置
- `.claude/protected-paths.json` —— 受保护路径清单
- `.claude/hooks/**` —— 守卫脚本
- `scripts/claude-guard.js` —— 守卫配置工具

### 规则

1. 不要用任何工具（Read / Grep / Glob / Edit / Write / Bash / PowerShell）访问受保护路径，
   也不要用 `cat`、`type`、`node -e`、`python -c`、`base64` 等间接方式读取。
2. 需要其中的配置项时，**只引用键名，不要读取和输出值**。
   例如可以说「读取 `<某个配置键>`」，但不要打印它的实际值。
3. 如果任务确实需要这些内容，**停下来告诉我，由我手动提供脱敏后的片段**，不要自行尝试。
4. 上述规则由 `.claude/settings.json` 的 `permissions.deny` 和 `.claude/hooks/guard-paths.js`
   双层强制执行。遇到「denied by your permission settings」或「安全守卫拦截」是**预期行为**，
   **不要尝试换工具、换路径写法、或建议我放宽权限** —— 直接报告受阻并继续其他任务。
5. 需要调整保护范围时，告诉我，由我在终端执行：
   ```
   ! npm run guard -- add "<路径>"        # 禁读禁写
   ! npm run guard -- add -r "<路径>"     # 可读禁写
   ! npm run guard -- remove "<路径>"     # 移出保护
   ! npm run guard:check                  # 离线自检
   ```
   注意 `!` 前缀是必需的：不带前缀走工具层，命令文本里的受保护路径会被守卫拦下。
```

### 为什么这么写

- **第 2 条**给了一条「合作路径」。只说「不许读」，模型遇到需要配置的任务就卡住了；
  说清「可以引用键名」，它就知道怎么在不越线的前提下把活干完。
- **第 4 条最关键**。没有它，模型碰壁后会不停试各种绕法——换工具、换路径写法、
  建议你放宽权限——浪费大量轮次。写明「这是预期行为」，它才会直接报告受阻然后继续别的事。
- **第 5 条**把解锁口明确指向人。工具自身在 readonly 清单里，模型改不了，
  不写这条它只会反复撞墙。

提示词本身**拦不住任何东西**（模型可以不遵守）。它的价值是让模型知道边界在哪、
碰壁时该怎么办，从而不浪费轮次去绕。真正的强制在 L1 + L2。

---

## 八、四个必踩的坑

### 坑 1：在 Claude Code 里跑 guard 命令，会被守卫自己拦下

```
node scripts/claude-guard.js remove "<某个受保护路径>"
→ ⛔ 安全守卫拦截
```

因为 hook 扫的是 `command` 字段，而你的命令文本里就写着受保护路径。
**同理，用 heredoc / `echo >` 写一份提到这些路径的文档也会被拦**——
这种情况改用 Write 工具（内容走 `content` 字段，不在扫描范围内）。

**解法：用 `!` 前缀在终端直接执行**（不走工具层，hook 不触发）：

```
! node scripts/claude-guard.js remove "<路径>"
! npm run guard -- add "secrets/**"
```

**例外：`list` 和 `check` 不受此限。** 脚本自身在 readonly 清单里，而守卫把「跑解释器」
一律算作写操作，于是这两个纯查看命令一度也被拦。现在它们走白名单放行，模型可以直接
跑；`init` / `sync` / `add` / `remove` 照旧要 `!` 前缀。

### 坑 2：容易把自己锁在门外

默认清单把 `scripts/claude-guard.js` 和 `.claude/hooks/**` 设成 readonly——
**生效后模型改不了它们**。配置迭代期如果发现守卫本身有 bug，会陷入「改不了也修不了」的死锁。

（这个死锁在实际改造中出现过，破解方式就是让人在终端用 `!` 执行。）

**这是设计意图：解锁口只对着人，不对着模型。**
但代价是配置期比较别扭，所以：**先用 `--dry-run` + `check` 把清单调对，再让它生效。**

### 坑 3：让模型执行本脚本，等于把钥匙递给它

**先说定位：如果你的威胁模型是「防手滑」——不想让模型顺手读到不该读的——
那么默认配置已经够了，本节可以整节跳过。**
下面讨论的是「模型明知有守卫、主动去摘自己的锁」，那是另一个威胁模型，
真按那个标准，任何基于文本匹配的方案都不成立（见 §一「不该指望它的情况」）。

工具自身可以修改保护清单，因此初始化和规则调整必须由开发人员执行。当前守卫对 readonly 的判定如下：

| 操作 | 结果 | 说明 |
|---|---|---|
| Edit/Write/NotebookEdit/MultiEdit 修改 | DENY | 写工具直接拦截 |
| Bash/PowerShell 读取（如 `cat`） | allow | readonly 允许查看，这是设计意图 |
| Bash 删除、覆盖、移动或重命名 | DENY | 识别 `rm`、重定向、PowerShell 写命令等 |
| Bash 通过 Node/Python/脚本修改 | DENY | 命令触及 readonly 路径且启动可写脚本解释器 |
| 执行 `claude-guard.js remove ...` | DENY | 命令触及 readonly 的守卫工具或配置路径 |

这修复了“readonly 只拦文件写工具、整条 Bash 通道敞开”的问题。`permissions.deny` 负责直接工具调用，PreToolUse Hook 负责 Shell 子进程写入，两层互补。

仍需注意：基于命令文本判断无法解析所有自定义程序和编码参数。初始化、增删保护项和守卫升级仍应在 AI 会话外执行；需要更强边界时使用 managed settings 或隔离环境。

### 坑 4：通配写法会连带示例文件

`.env.*` 这类写法会把 `.env.example` / `.env.template` 一起拦掉，
而这些示例文件通常是**需要**给模型看的。`check` 会主动提醒这一条。

解法是把通配换成显式列举：

```
! node scripts/claude-guard.js remove "<通配写法>"
! node scripts/claude-guard.js add "<具体文件1>" "<具体文件2>"
```

---

## 九、其他注意事项

- **`settings.local.json` 里的 `allow` 不会覆盖 deny**——deny 优先级更高，不用管。
- **要提交进 git 的**：`.claude/settings.json`、`.claude/protected-paths.json`、
  `.claude/hooks/guard-paths.js`、`scripts/claude-guard.js`。
  **不要提交** `.claude/settings.local.json`（个人本地配置）。
- **`init` 只往 `.gitignore` 补 `.env.local` / `.env.*.local` 两行**，别的密钥文件要自己加；
  完全不想让它碰就加 `--no-gitignore`。
- **环境要求**：Node（只用 `fs` / `path` / `child_process`，无第三方依赖）。
  非 Node 项目也能用，只要机器上有 node。
- **`MultiEdit` 的 matcher**：守卫脚本内部把 `MultiEdit` 算作写工具，但 hook 注册的
  matcher 字符串里没有显式列出它。若真实会话里发现 `MultiEdit` 漏拦，
  在 `.claude/settings.json` 的 matcher 末尾补上 `|MultiEdit`
  （该文件是 readonly，需要你手动改）。

---

## 十、迁移到其他项目

真正需要手工搬的只有 **一个文件**：

| 项 | 怎么来 |
|---|---|
| `scripts/claude-guard.js` | **手工放到 `<项目根>/scripts/`**，取得方式见 §三 第 0 步 |
| `.claude/hooks/guard-paths.js` | `init` 从脚本内嵌模板生成，别手拷（会版本漂移） |
| `.claude/settings.json` | `init` 合并生成 |
| `.claude/protected-paths.json` | `init` 生成默认清单，之后用 `add`/`remove` 改 |
| `.gitignore` 两行 | `init` 按需追加，`--no-gitignore` 可跳过 |
| `CLAUDE.md` 红线段落 | **手工拷贝并改路径**（§七） |
| `package.json` 两条 script | 手工加 |

步骤见 §三。顺序上唯一的要求是：**清单调对了再让它生效**，避免坑 2。

---

## 十一、速查表

```bash
# 装（在你自己的终端里跑，或 Claude Code 里加 ! 前缀）
node scripts/claude-guard.js init --dry-run   # 预览
node scripts/claude-guard.js init             # 生成（幂等）

# 用
node scripts/claude-guard.js list             # 看清单
node scripts/claude-guard.js add "secrets/**" # 禁读禁写
node scripts/claude-guard.js add -r "dist/**" # 可读禁写
node scripts/claude-guard.js remove "x/**"    # 撤销
node scripts/claude-guard.js check            # 自检（退出码 0/1）

# 体检 / 修漂移
node scripts/claude-guard.js sync --dry-run   # 只看有没有漂
node scripts/claude-guard.js sync             # 修（正向）
node scripts/claude-guard.js sync --adopt     # 修 + 清单外规则反向并入

# 别忘了
重启 Claude Code 或打开一次 /hooks  ← 不做等于没改
```

| 症状 | 原因 | 处理 |
|---|---|---|
| 改了清单没生效 | 没重启 | 重启 / 打开 `/hooks` |
| 手改清单后 L1 没跟着变 | 手改只影响 L2，deny 规则不会自动重算 | `npm run guard:sync` |
| 不确定配置还全不全 | 升过级 / 手改过 / 装了很久了 | `sync --dry-run` 体检一遍 |
| Bash、Grep 没被拦，Read 却拦得住 | hook 的 matcher 停在旧版本 | `npm run guard:sync` |
| 升级脚本后新保护没生效 | 已有清单不会自动跟进新的默认项 | `init` 或 `sync` 会强制补齐自我保护项 |
| 启动时刷一堆 `is not matched by file permission checks` | 规程要求把工具名写全，而 Claude Code 只查 `Read()`/`Edit()` | **预期行为**，见 §三 |
| 手改后保护全失效 | JSON 语法错误，两边都静默降级到默认/保底清单 | `list` 验一下清单对不对，见 §五 |
| 跑 guard 命令被自己拦 | 命令文本含受保护路径 | 用 `!` 前缀 |
| 写文档被拦 | heredoc 内容进了 `command` 字段 | 改用 Write 工具 |
| `check` 大面积报红 | 清单偏离默认，用例是硬编码的 | 正常，确认是不是你有意移除的 |
| 示例配置文件读不了 | 通配写法连带 | 换成显式列举 |
| 目录子文件在 L1 层没被拦 | 点开头 / 带扩展名的目录名不自动展开 | 显式写 `xxx/**` |
| 同名子目录被误伤 | hook 层不锚定项目根 | 清单写得更具体 |
| 模型反复尝试绕过 | `CLAUDE.md` 没写「这是预期行为」 | 补 §七 第 4 条 |
| Git、启动、预览或打包命令没拦住 | 配置未重新生成或 Hook 未加载 | 重新执行 `init --no-gitignore` 并重启 Claude Code；再运行 `check` |
