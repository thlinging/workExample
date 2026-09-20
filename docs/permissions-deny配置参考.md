# `permissions.deny` 配置参考

> 整理自 Claude Code 官方文档（2026-09 抓取），本机版本 **2.1.236**
> 出处：https://code.claude.com/docs/en/permissions
> 凡标注版本要求的条目，都注明了本机是否满足

---

## 一、规则的总形状

```
Tool              # 裸工具名：匹配该工具的所有调用
Tool(specifier)   # 带限定符：匹配特定调用
```

括号里的括号是字面量，路径或命令里含 `()` 不用转义。

**裸名与带限定符的区别很重要：**

| 写法 | 效果 |
|---|---|
| `"Bash"` 或 `"Bash(*)"` | **把工具从 Claude 的上下文里整个移除**，模型根本看不到这个工具 |
| `"Bash(rm *)"` | 工具仍可用，只在匹配时拦截 |

唯一例外是 `EndConversation`：只要还有别的工具在，deny 规则移除不掉它。

---

## 二、各工具支持的限定符

| 工具 | 限定符语法 | 例子 |
|---|---|---|
| `Read` / `Edit` | 路径（gitignore 语法） | `Read(./.env)`、`Edit(./secrets/**)` |
| `Bash` / `PowerShell` | 命令文本，`*` 通配 | `Bash(git push *)`、`PowerShell(Remove-Item *)` |
| `WebFetch` | `domain:` 前缀 | `WebFetch(domain:example.com)` |
| `Agent` | 子代理名 | `Agent(Explore)`、`Agent(my-custom-agent)` |
| `Cd` | 路径（**非** gitignore 语义，见 §七） | `Cd(**/node_modules)` |
| MCP | 服务器名 + 可选工具名 | `mcp__puppeteer`、`mcp__github__get_*` |
| 任意内置工具 | `param:value` 参数匹配 | `Agent(model:opus)`、`Bash(run_in_background:true)` |

### ⚠️ 只有 `Read` 和 `Edit` 会被文件权限检查查询

给 `Write`、`NotebookEdit`、`Glob`、`MultiEdit` 写**路径**规则，Claude Code 会接受但**永远不查**，
并在启动时警告。替换关系：

| 别写 | 改写 |
|---|---|
| `Write(docs/**)` | `Edit(docs/**)` |
| `NotebookEdit(docs/**)` | `Edit(docs/**)` |
| `MultiEdit(docs/**)` | `Edit(docs/**)` |
| `Glob(docs/**)` | `Read(docs/**)` |

（不带路径的裸 `Write` 是有效的，那是工具级匹配。）

### 参数匹配的限制

`Tool(param:value)` **只能用在 deny 和 ask 规则**（allow 规则不支持）。

- 只能匹配顶层字段，嵌套在对象/数组里的匹配不到
- 一条规则一个参数，要卡两个就写两条
- 值支持 `*` 通配；不带 `*` 是精确匹配
- 模型没传的参数永远不匹配，所以 `Agent(model:*)` 匹配不到没写 `model` 的调用
- **匹配不了工具的主内容字段**：Bash/PowerShell 的 `command`、Read/Edit/Write 的 `file_path`、
  Grep/Glob 的 `path`、NotebookEdit 的 `notebook_path`、WebFetch 的 `url`。
  写 `Bash(command:rm *)` 会被忽略并在启动时警告（因为复合命令能绕过它），要写成 `Bash(rm *)`

---

## 三、路径规则（`Read` / `Edit`）

### 3.1 四种锚定前缀 —— **最容易搞错的地方**

| 写法 | 含义 | 例子解析为 |
|---|---|---|
| `//path` | **文件系统根**的绝对路径 | `Read(//Users/alice/secrets/**)` → `/Users/alice/secrets/**` |
| `~/path` | 家目录 | `Read(~/Documents/*.pdf)` |
| `/path` | **配置文件所在位置**，不是文件系统根 | 见下表 |
| `path` 或 `./path` | 当前目录 | `Read(*.env)` → `<cwd>/*.env` |

> ⚠️ `/Users/alice/file` **不是**绝对路径。单个前导斜杠锚定的是配置来源，绝对路径要写 `//`。

`/path` 具体锚到哪，取决于规则写在哪个文件里：

| 规则定义在 | `/path` 解析为 |
|---|---|
| 项目 `.claude/settings.json` | `<主工作目录>/path` |
| `.claude/settings.local.json` | `<主工作目录>/path` |
| 用户 `~/.claude/settings.json` | **`~/.claude/path`** |
| `--settings <file>` | `<该文件所在目录>/path` |

所以写在用户设置里的 `Read(/secrets/**)` 挡的是 `~/.claude/secrets/**`，**不是**你项目里的 `secrets`。
要在用户设置里写一条对所有项目生效的规则，用 `//` 或 `~/`。

### 3.2 gitignore 语义与匹配深度

路径用 **gitignore 模式语法**：`*` 在单个路径段内匹配，`**` 跨目录匹配。

**裸文件名任意深度匹配**，所以这两条等价：

```
Read(.env)  ≡  Read(**/.env)
```

**单段目录模式在 deny 和 allow 里深度不同**（这条很反直觉）：

| 规则 | allow 时 | deny / ask 时 |
|---|---|---|
| `Read(secrets/**)` | 只匹配 `<cwd>/secrets` | **任意深度**的 `secrets` 目录都匹配 |
| `Read(/secrets/**)` | 只匹配锚定位置 | 只匹配锚定位置 |
| `Read(**/secrets/**)` | 任意深度 | 任意深度 |

其余形态在两种规则类型里深度一致。

### 3.3 Windows 路径

匹配前会归一化成 POSIX 形式：`C:\Users\alice` → `/c/Users/alice`。

- 匹配 C 盘任意位置的 `.env`：`Read(//c/**/.env)`
- 匹配所有盘：`Read(//**/.env)`

### 3.4 符号链接

deny 检查**符号链接本身和它指向的目标**，任一匹配就拦。
（allow 相反，要两者都匹配才放行，否则仍然提示。）

### 3.5 `Read` deny 的连带效果

- **`Read` deny 会同时阻止 Edit 和 Write 工具**（含在该路径新建文件）。
  需要 v2.1.208+（Edit）/ v2.1.228+（Write）—— **本机 2.1.236 满足**
- **NotebookEdit 不在覆盖范围内**，任何工具都不许改的路径要另外加 `Edit` 规则
- Grep / Glob 受 `Read` deny 约束，但官方措辞是 **best-effort**
- `@file` 提及、IDE 共享的选中内容和打开文件，也受 `Read` 规则约束

---

## 四、`Bash` / `PowerShell` 规则

规则匹配**整条命令文本**，`*` 代表任意文本（含空格）。不带 `*` 就是精确匹配。

### 4.1 通配符位置决定一切

`*` 之前的部分是逐字匹配的，所以**星号放在子命令之后**：

| 你写 | 匹配 | 不匹配 |
|---|---|---|
| `Bash(npm run build)` | `npm run build` | `npm run build --watch` |
| `Bash(npm run *)` | `npm run build`、`npm run` | `npm install` |
| `Bash(git * main)` | `git merge main`、`git push origin main` | `git log` |
| `Bash(* --version)` | `node --version` | `node -v` |
| `Bash(ls *)` | `ls -la`、`ls` | `lsof` |
| `Bash(ls*)` | `ls -la`、`lsof` | |

三条规律：

1. `*` 站在哪就代表哪部分的任意文本。`Bash(git * main)` 里它代表子命令，
   所以连 `git -c core.fsmonitor=<script> diff main` 都匹配
2. **结尾的 `*` 前面有空格时，也匹配裸命令**：`Bash(ls *)` 匹配 `ls`。
   但只有当尾部 `*` 是唯一通配符时成立
3. **尾部 `*` 前的空格是规则的一部分**：`Bash(ls *)` 不匹配 `lsof`，`Bash(ls*)` 匹配

`:*` 后缀等价于尾部 ` *`，即 `Bash(ls:*)` ≡ `Bash(ls *)`。**但 `:*` 只在模式末尾被识别**，
`Bash(git:* push)` 里的冒号是字面字符，匹配不到 git 命令。

### 4.2 复合命令

Claude Code 认识 shell 操作符：`&&`、`||`、`;`、`|`、`|&`、`&`、换行。

**deny / ask 规则只要任一子命令匹配就生效**，包括子 shell、命令替换、`for` 循环体内的命令。
`Bash(git clean *)` 作为 ask 规则，对 `cd /tmp && git clean -f` 和 `echo "$(git clean -f)"` 都会提示。

（allow 规则相反，必须每个子命令都被覆盖。）

### 4.3 包装器剥离

匹配前会剥掉一组固定包装器：`timeout`、`time`、`nice`、`nohup`、`stdbuf`、
shell 内建的 `command` / `builtin`、zsh 的 `noglob`、无参数的 `xargs`。
所以 `Bash(npm test *)` 也匹配 `timeout 30 npm test`。

**deny 规则会匹配过任意前导环境变量赋值**，`Bash(rm *)` 仍然匹配 `FOO=bar rm -rf tmp/`。

⚠️ **环境运行器不在剥离列表里**：`direnv exec`、`devbox run`、`mise exec`、`npx`、`docker exec`。
它们会把参数当命令执行，所以 `Bash(devbox run *)` 这类 allow 规则等于放行 `devbox run rm -rf .`。

### 4.4 重定向 —— ⚠️ 本机版本有缺口

| 形式 | 检查什么 | 版本要求 |
|---|---|---|
| `> file`、`>> file`、`2> file` | `Edit` 的 allow / deny 规则 | 一直支持 |
| `< file` | `Read` 的 allow / deny 规则 | **v2.1.257+，本机 2.1.236 不满足** |

不检查的目标：`/dev/null`、文件描述符形式（`2>&1`、`<&3`）、here-doc、here-string。

---

## 五、工具名通配

deny 和 ask 规则的**工具名位置**也接受 glob，必须匹配完整工具名：

```json
{ "permissions": { "deny": ["mcp__*"] } }
```

- `"*"` 匹配所有工具，`"mcp__*"` 匹配所有 MCP 工具
- 被裸名 glob deny 的工具会从上下文移除
- allow 规则的 glob 必须带字面 `mcp__<server>__` 前缀，服务器段不能含 glob；
  `"*"` / `"B*"` / `"mcp__*"` 这类会被跳过并警告

工具名写错会在启动时警告（含 `_` 或 `*` 的名字豁免检查）。注意**规则匹配的是规范名**，
不是界面上显示的标签——比如显示为 `Stop Task` 的工具规范名是 `TaskStop`。

---

## 六、其他工具

### WebFetch

用 `domain:` 前缀匹配 hostname，大小写不敏感，支持 `*`，两边的结尾 `.` 会被剥掉。

### MCP

```
mcp__puppeteer                        # 该服务器的所有工具
mcp__puppeteer__*                     # 同上
mcp__puppeteer__puppeteer_navigate    # 指定工具
```

⚠️ 从**设置文件**加载时，带括号的 `mcp__` 规则会被跳过（在启动的无效设置对话框和
`claude doctor` 里列出）。要对 MCP 工具做参数匹配，只能走 `--disallowedTools`。

### Agent

```json
{ "permissions": { "deny": ["Agent(Explore)"] } }
```

### Cd

只对你自己敲的 `/cd` 生效，模型调不了。**路径语义与 Read/Edit 不同**：
锚定整个目录路径而非 gitignore 风格，`*` 精确匹配一个路径段，`**` 跨段，尾部 `/**` 也匹配其根。

| 规则 | 匹配 | 不匹配 |
|---|---|---|
| `Cd(~/code/*)` | `~/code/app` | `~/code/app/src`、`~/code` |
| `Cd(~/code/**)` | `~/code` 及其下任意目录 | `~/code` 外 |

裸 `Cd` deny 直接禁用 `/cd`。

---

## 七、优先级与作用范围

**求值顺序：deny → ask → allow，第一个匹配决定结果，规则的具体程度不影响顺序。**

所以宽泛的 deny 挡得住更精确的 allow：`Bash(aws *)` 在 deny 里会挡掉 `Bash(aws s3 ls)` 的 allow。
**deny 规则无法携带白名单例外。**

其他要点：

- 规则由 **Claude Code 强制执行，不是模型**。prompt 和 `CLAUDE.md` 只影响模型想做什么，
  不改变 Claude Code 允许什么
- deny 只会收窄权限：任何设置层级都能加，**没有层级能移除别的层级加的 deny**
- `/permissions` 能查看所有规则及其来源文件

### 与沙箱的关系

`permissions.deny` 拦的是 **Claude Code 认识的操作**——内置工具、它能识别的 Bash 文件命令
（`cat`、`head`、`tail`、`sed`）、重定向目标。

**它拦不住间接读写文件的任意子进程**，比如一个自己打开文件的 Python 或 Node 脚本。
要做 OS 级强制（所有进程都拦），需要启用 sandbox——但 **原生 Windows 不支持，须在 WSL2 内运行**。

---

## 八、对本项目的直接影响

| 事项 | 结论 |
|---|---|
| guard 只生成 `Read()` / `Edit()` 规则 | ✅ 正确。生成 `Write()` / `Glob()` 会被接受但永不查询 |
| guard 为 protected 同时生成 Read + Edit | 略冗余（`Read` deny 已连带挡住 Edit/Write），但**不能省**——NotebookEdit 不在连带范围内 |
| guard 生成 `./` 前缀 | ✅ 正确锚定当前目录 |
| 清单里的 `.env` | 等价于 `**/.env`，已经是任意深度匹配 |
| 排查报告问题 4（`base64<file` 绕过 hook） | ⚠️ **本机版本 L1 也不管**。输入重定向检查要 v2.1.257+，本机 2.1.236。之前说"L1 大概率兜住"不成立 |
| 排查报告问题 5（`cd x && cat y`） | deny 对每个子命令独立匹配，但 `cat y` 里没有受保护路径字面量，所以 L1 同样匹配不到 |
| memory 记的"L1 锚定项目根，`src/secrets/a.txt` 不被 deny 拦" | ⚠️ **与文档矛盾**。文档说 deny 的单段目录模式（`secrets/**`）任意深度匹配。可能是版本差异或测试方法差异，**建议复测** |

---

## 出处

- [Configure permissions](https://code.claude.com/docs/en/permissions)
- [Configure the sandboxed Bash tool](https://code.claude.com/docs/en/sandboxing)
- [All settings](https://code.claude.com/docs/en/settings-reference)
