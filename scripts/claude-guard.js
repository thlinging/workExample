#!/usr/bin/env node
/**
 * claude-guard —— Claude Code 文件访问守卫的一键配置工具
 *
 * 用法（在项目根执行）：
 *   node scripts/claude-guard.js init             生成/合并全部配置
 *   node scripts/claude-guard.js sync             双向同步清单与 settings.json
 *   node scripts/claude-guard.js list             查看当前保护清单
 *   node scripts/claude-guard.js add <glob...>    增加「禁读禁写」路径
 *   node scripts/claude-guard.js add -r <glob...> 增加「可读禁写」路径
 *   node scripts/claude-guard.js remove <glob...> 从两类清单里移除
 *   node scripts/claude-guard.js check            离线自检（不调模型，秒出结果）
 *
 * 加 --dry-run 只预览不落盘（配 sync 就是纯体检）。
 * 加 --adopt 让 sync 把清单外的路径规则反向并入清单。
 * 加 --no-gitignore 让 init 完全不碰 .gitignore。
 *
 * sync 是双向的：
 *   正向  清单 → settings.json 的 deny 规则、hook 注册、守卫脚本本体
 *   反向  settings.json 里清单外的路径规则 → 清单（默认只报告，--adopt 才写）
 * 另外强制补齐守卫的自我保护项，避免脚本升级后老项目的新保护不生效。
 *
 * 两类保护：
 *   protected  禁读禁写 —— 密钥、环境变量、客户数据
 *   readonly   可读禁写 —— 权限配置、守卫脚本自身（要能看，但不许模型改）
 *
 * 单文件工具，无外部依赖，直接拷到别的项目里跑 init 即可。
 *
 * 提示：在 Claude Code 里跑本脚本时，命令文本若包含受保护路径会被守卫拦下。
 * 用 ! 前缀在终端直接执行可绕过工具层：  ! node scripts/claude-guard.js add "secrets/**"
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const CLAUDE_DIR = path.join(ROOT, '.claude');
const HOOKS_DIR = path.join(CLAUDE_DIR, 'hooks');
const CONFIG_PATH = path.join(CLAUDE_DIR, 'protected-paths.json');
const SETTINGS_PATH = path.join(CLAUDE_DIR, 'settings.json');
const GUARD_PATH = path.join(HOOKS_DIR, 'guard-paths.js');
const GITIGNORE_PATH = path.join(ROOT, '.gitignore');

const DRY = process.argv.includes('--dry-run');

/**
 * 跳过 .gitignore 追加。
 * 有些项目的 env 文件是要提交的构建配置（vue-cli 约定里 .env.development /
 * .env.production 就属于这类），替用户决定忽略它们会造成静默漏提交。
 */
const NO_GITIGNORE = process.argv.includes('--no-gitignore');

/**
 * 反向同步开关：把 settings.json 里清单外的路径保护规则并进 protected-paths.json。
 *
 * 默认不开，因为反解析区分不了「你手写的规则」和「旧版本残留」。真实案例：
 * 早期版本给 .env 补过 .env/** 的递归规则，记账机制上线前生成的，现在它既不在
 * 记账里也不该再生成，自动回填就会把这个毫无意义的 glob（.env 是文件不是目录）
 * 固化进清单。所以反向必须由人点头。
 */
const ADOPT = process.argv.includes('--adopt');

/** 默认禁读禁写路径 */
const DEFAULT_PROTECTED = [
  'dist/**',
  '.env.development',
  '.env.production',
];

/** 所有项目默认禁止的命令规则 */
const DEFAULT_COMMAND_DENY = [
  'Bash(git:*)',
  'Bash(npm run dev:*)',
  'Bash(npm run serve:*)',
  'Bash(npm run start:*)',
  'Bash(npm run preview:*)',
  'Bash(npm run build:*)',
  'Bash(pnpm dev:*)',
  'Bash(pnpm serve:*)',
  'Bash(pnpm start:*)',
  'Bash(pnpm preview:*)',
  'Bash(pnpm build:*)',
  'Bash(yarn dev:*)',
  'Bash(yarn serve:*)',
  'Bash(yarn start:*)',
  'Bash(yarn preview:*)',
  'Bash(yarn build:*)',
  'Bash(vite:*)',
  'Bash(webpack:*)',
  'WebFetch',
  'WebSearch',
];

/** 可读禁写——配置和守卫本身，要能查看，但不许模型改 */
const DEFAULT_READONLY = [
  '.claude/settings.json',
  // 备份里是完整的 settings，不保护的话等于给权限配置留了个可改的副本
  '.claude/settings.json.backup-*',
  '.claude/protected-paths.json',
  '.claude/hooks/**',
  'scripts/claude-guard.js',
];

/** 保留多少份 settings 备份，超出的从旧到新删掉 */
const BACKUP_KEEP = 5;

const HOOK_MATCHER = 'Bash|PowerShell|Read|Edit|Write|Grep|Glob|NotebookEdit|MultiEdit';
const HOOK_COMMAND = 'node .claude/hooks/guard-paths.js';

/** hook 注册块的期望形态，upgradeGuardHook 拿它逐字段比对已注册的那组 */
const HOOK_SPEC = {
  matcher: HOOK_MATCHER,
  hooks: [{ type: 'command', command: HOOK_COMMAND, timeout: 10, statusMessage: '安全守卫检查中' }],
};

// ---------------------------------------------------------------- 小工具

const c = {
  dim: (s) => '\x1b[2m' + s + '\x1b[0m',
  green: (s) => '\x1b[32m' + s + '\x1b[0m',
  red: (s) => '\x1b[31m' + s + '\x1b[0m',
  yellow: (s) => '\x1b[33m' + s + '\x1b[0m',
  bold: (s) => '\x1b[1m' + s + '\x1b[0m',
};

/** 按显示宽度补空格：中文/全角算 2 列，否则表格会错位 */
function padTo(s, width) {
  let w = 0;
  for (const ch of String(s)) w += /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠]/.test(ch) ? 2 : 1;
  return s + ' '.repeat(Math.max(1, width - w));
}

function readJson(p, fallback) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    return fallback;
  }
}

/** settings.json 已存在但无法解析时必须中止，禁止用空配置覆盖 */
function loadSettingsStrict() {
  if (!fs.existsSync(SETTINGS_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
  } catch (e) {
    console.error(c.red('\n✗ .claude/settings.json 不是合法 JSON，已中止且未修改任何文件。'));
    console.error(c.dim('  请先修复该文件后重新执行 init。解析错误：' + e.message + '\n'));
    process.exit(1);
  }
}

/** init 前备份已有 settings，保留每次初始化前的原始版本 */
function backupSettings() {
  if (!fs.existsSync(SETTINGS_PATH)) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = SETTINGS_PATH + '.backup-' + stamp;
  if (DRY) {
    console.log(c.yellow('  [dry-run] 将备份 ') + path.relative(ROOT, SETTINGS_PATH) +
      ' -> ' + path.relative(ROOT, backupPath));
    return backupPath;
  }
  fs.copyFileSync(SETTINGS_PATH, backupPath);
  console.log(c.green('  ✓ ') + path.relative(ROOT, backupPath) + c.dim(' — 原 settings.json 备份'));
  pruneBackups();
  return backupPath;
}

/** 只留最近 BACKUP_KEEP 份，否则反复跑 init 会在 .claude/ 里堆一地备份 */
function pruneBackups() {
  let names;
  try {
    names = fs.readdirSync(CLAUDE_DIR);
  } catch (e) {
    return;
  }
  // 文件名里的时间戳是 ISO 格式，字典序即时间序
  const backups = names.filter((n) => n.startsWith('settings.json.backup-')).sort();
  const stale = backups.slice(0, Math.max(0, backups.length - BACKUP_KEEP));
  for (const name of stale) {
    try {
      fs.unlinkSync(path.join(CLAUDE_DIR, name));
    } catch (e) {
      /* 删不掉就算了，不值得为清理中断 init */
    }
  }
  if (stale.length) console.log(c.dim('  · 清理旧备份 ' + stale.length + ' 份，保留最近 ' + BACKUP_KEEP + ' 份'));
}

function writeFile(p, content, label) {
  if (DRY) {
    console.log(c.yellow('  [dry-run] 将写入 ') + path.relative(ROOT, p) + c.dim(' (' + label + ')'));
    return;
  }
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, 'utf8');
  console.log(c.green('  ✓ ') + path.relative(ROOT, p) + c.dim(' — ' + label));
}

function loadConfig() {
  const cfg = readJson(CONFIG_PATH, null);
  if (!cfg) {
    return { protected: DEFAULT_PROTECTED.slice(), readonly: DEFAULT_READONLY.slice(), managed: [] };
  }

  let prot = Array.isArray(cfg.protected) ? cfg.protected.slice() : DEFAULT_PROTECTED.slice();
  let ro = Array.isArray(cfg.readonly) ? cfg.readonly.slice() : [];

  // 旧格式迁移：配置类路径从 protected 挪进 readonly，否则连查看都做不到
  if (!Array.isArray(cfg.readonly)) {
    const isConfigPath = (g) => g.startsWith('.claude/') || g.startsWith('scripts/claude-guard');
    ro = prot.filter(isConfigPath);
    prot = prot.filter((g) => !isConfigPath(g));
    for (const d of DEFAULT_READONLY) if (!ro.includes(d)) ro.push(d);
  }
  return {
    protected: prot,
    readonly: ro,
    managed: Array.isArray(cfg._managedDenyRules) ? cfg._managedDenyRules : [],
  };
}

function saveConfig(cfg) {
  const out = {
    _comment:
      '受保护路径清单。protected=禁读禁写，readonly=可读禁写。' +
      '改完重启 Claude Code 或打开一次 /hooks 生效。' +
      '用 `node scripts/claude-guard.js add [-r] <glob>` 增删更省事。',
    protected: cfg.protected,
    readonly: cfg.readonly,
    // 记账：本工具生成过哪些 deny 规则，下次同步时先撤销它们，避免旧规则留在配置里
    _managedDenyRules: cfg.managed || [],
  };
  writeFile(CONFIG_PATH, JSON.stringify(out, null, 2) + '\n', '保护清单');
}

/**
 * protected 生成 Read / Grep / Glob / Edit / Write 五类；
 * readonly 生成 Edit / Write / NotebookEdit 三类。
 *
 * 工具名按项目规程逐个写全。反解析（parseDenyRule）的识别范围必须与这里保持一致，
 * 否则反向同步会漏掉认不出来的那几类。
 */
function denyRulesFrom(cfg) {
  const rules = [];
  const protectedTools = ['Read', 'Grep', 'Glob', 'Edit', 'Write'];
  const readonlyTools = ['Edit', 'Write', 'NotebookEdit'];
  const expand = (g) => {
    const clean = g.replace(/^\.\//, '');
    const out = [clean];
    // 目录形态补一条递归，避免只写 `secrets` 漏掉里面的文件。
    // 注意 path.extname('.env') 是空串——点开头的隐藏文件不能当成目录。
    const base = path.basename(clean);
    if (!clean.includes('*') && !path.extname(clean) && !base.startsWith('.')) {
      out.push(clean + '/**');
    }
    return out;
  };
  for (const g of cfg.protected) {
    for (const p of expand(g)) {
      for (const tool of protectedTools) rules.push(tool + '(./' + p + ')');
    }
  }
  for (const g of cfg.readonly) {
    for (const p of expand(g)) {
      for (const tool of readonlyTools) rules.push(tool + '(./' + p + ')');
    }
  }
  rules.push(...DEFAULT_COMMAND_DENY);
  return Array.from(new Set(rules));
}

// ---------------------------------------------------------------- guard 模板

const GUARD_TEMPLATE = String.raw`#!/usr/bin/env node
/**
 * PreToolUse 守卫：拦住触及受保护路径的工具调用。
 * 由 scripts/claude-guard.js 生成——改保护清单请编辑 ../protected-paths.json，别改这里。
 *
 * 两类保护：
 *   protected  禁读禁写（密钥、环境变量）
 *   readonly   可读禁写（权限配置、守卫自身）——只拦写工具，读放行
 *
 * 只检查「路径字段」，不检查文件内容。内容里提到某个受保护路径的名字
 * （比如文档里写了 .env）不算触碰它——用路径名匹配内容会造成大面积误伤。
 * readonly 的 shell 写入（echo x > 配置文件）由 permissions.deny 的 Edit() 规则兜住。
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const CONFIG_PATH = path.join(PROJECT_ROOT, '.claude', 'protected-paths.json');

// 配置读不到时的保底清单——绝不静默失效
const FALLBACK = {
  protected: [
    'dist/**',
    '.env.development',
    '.env.production',
  ],
  readonly: [
    '.claude/settings.json',
    '.claude/settings.json.backup-*',
    '.claude/protected-paths.json',
    '.claude/hooks/**',
    'scripts/claude-guard.js',
  ],
};

/** 明确的写入类工具 */
const WRITE_TOOLS = ['Edit', 'Write', 'NotebookEdit', 'MultiEdit'];

/** 按工具提取真正承载路径的字段，避免把 Grep 搜索词误当路径 */
function pathValues(toolName, input) {
  const fields = ['command', 'file_path', 'path', 'notebook_path'];
  if (toolName === 'Grep') fields.push('glob');
  if (toolName === 'Glob') fields.push('pattern');
  return fields.map((f) => input[f]).filter((v) => typeof v === 'string' && v);
}

function globToRegExp(glob) {
  const normalized = String(glob).replace(/\\/g, '/').replace(/^\.\//, '');
  let body = '';
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    if (ch === '*') {
      if (normalized[i + 1] === '*') {
        body += '.*';
        i++;
        if (normalized[i + 1] === '/') i++; // 让 a/** 也匹配 a 本身
      } else {
        body += '[^/]*';
      }
    } else if (ch === '$' || '.+?^{}()|[]\\'.includes(ch)) {
      body += '\\' + ch;
    } else {
      body += ch;
    }
  }
  // 左右边界只锚定路径分隔符和命令里常见的定界符
  return new RegExp('(^|[/\\s"\'=:(,<\\{\\x60])' + body + '($|[/\\s"\'&|;)>,\\x60\\}])', 'i');
}

function loadConfig() {
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    const prot = Array.isArray(raw.protected) ? raw.protected.filter(Boolean) : [];
    const ro = Array.isArray(raw.readonly) ? raw.readonly.filter(Boolean) : [];
    if (prot.length || ro.length) return { cfg: { protected: prot, readonly: ro }, degraded: false };
    return { cfg: FALLBACK, degraded: true, error: '保护清单为空' };
  } catch (e) {
    return { cfg: FALLBACK, degraded: true, error: e.message };
  }
}

function matchAny(list, haystack) {
  for (const glob of list) {
    const candidates = [glob];
    if (glob.endsWith('/**')) candidates.push(glob.slice(0, -3));
    for (const candidate of candidates) {
      let re;
      try { re = globToRegExp(candidate); } catch (e) { continue; }
      if (re.test(haystack)) return glob;
    }
  }
  return null;
}

/**
 * shell 参数展开的默认值，即 bash 的 :- / := / :+ 形式（冒号可省）。
 * 注意本文件由 String.raw 模板生成，注释里不能出现裸的美元花括号，会被当成插值。
 *
 * 把默认值单独抽成一个变体来匹配。不走「把 - 加进边界字符类」那条路——实测那样
 * 会误伤 kebab-case 命名：清单项是 config.json 时，app-config.json、dev-config.json
 * 全都会被拦，而 kebab-case 在本项目是主流命名。抽变体则零误伤。
 */
function paramExpansionVariants(command) {
  const text = String(command || '').replace(/\\/g, '/');
  const out = [];
  const re = /\$\{[^}]*?:?[-=+]([^}]*)\}/g;
  let m;
  while ((m = re.exec(text)) !== null) if (m[1]) out.push(m[1]);
  return out;
}

function shellPathVariants(command) {
  const text = String(command || '').replace(/\\/g, '/');
  const variants = [text].concat(paramExpansionVariants(text));
  // 分隔符含 ; 和 ||，否则 「cd build; cat keys/k」 这种拼接后才命中的形式漏网
  const cdRe = /(?:^|[;&|]\s*)cd\s+(?:\/d\s+)?(?:"([^"]+)"|'([^']+)'|([^\s;&|]+))\s*(?:&&|;|\|\|)\s*([\s\S]+)$/i;
  const match = text.match(cdRe);
  if (match) {
    const dir = (match[1] || match[2] || match[3] || '').replace(/^\.\//, '').replace(/\/$/, '');
    const rest = match[4] || '';
    if (dir && rest) variants.push(rest.replace(/(["']?)(\.\/)?([^\s"';&|<>\x60]+)\1/g, (all, quote, dot, token) => {
      if (/^(?:cat|type|more|get-content|base64|node|python|npm|pnpm|yarn)$/i.test(token)) return all;
      return quote + dir + '/' + token + quote;
    }));
  }
  return variants;
}

function isShellMutation(command) {
  const text = String(command || '');
  // 找重定向前先剥掉引号内容，否则 grep "a>b" 配置文件 里的 > 会被当成写入
  const unquoted = text.replace(/"[^"]*"|'[^']*'/g, ' ');
  return /(^|[\s;&|()"'])(?:rm|del|erase|rmdir|mv|move|cp|copy|touch|truncate|tee|sed\s+-i|perl\s+-i|set-content|add-content|clear-content|remove-item|move-item|copy-item|rename-item)(?=\s|$)/i.test(text) ||
    /(?:^|[^<])>{1,2}(?!>)/.test(unquoted) ||
    /(^|[\s;&|()"'])(?:node|python|python3|ruby|php|sh|bash|cmd|powershell|pwsh)(?=\s|$)/i.test(text);
}

/**
 * 本工具自身的只读子命令。
 *
 * 守卫脚本在 readonly 清单里，而 isShellMutation 把「跑解释器」一律算作写操作，
 * 于是 「node scripts/claude-guard.js list」 这种纯查看命令也被拦。这两个子命令
 * 不写任何文件，放行；init / add / remove 一律不在此列，照旧拦。
 */
function isGuardReadOnlyCommand(command) {
  const heads = commandHeads(command);
  if (!heads.length) return false;
  // 逐段判断，不能对整条命令文本做匹配——那样「guard list && rm 守卫脚本」
  // 会整条搭便车放行。必须每一段都是只读的 guard 调用。
  return heads.every(function (h) {
    const argv = h.rest.map(function (t) { return String(t).toLowerCase(); });
    const viaNode = argv.some(function (t) { return /claude-guard\.js$/.test(t); });
    const viaNpm = /^npm(?:\.cmd)?$/i.test(h.head) && argv[0] === 'run' &&
      /^guard(?::[a-z]+)?$/.test(argv[1] || '');
    if (!viaNode && !viaNpm) return false;
    const subs = argv.filter(function (t) {
      return /^(?:list|check|init|add|remove|sync)$/.test(t) || /^guard:[a-z]+$/.test(t);
    });
    if (!subs.length) return false;
    return subs.every(function (s) {
      return s === 'list' || s === 'check' || s === 'guard:check' || s === 'guard:list';
    });
  });
}

function deny(reason, degraded) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
    systemMessage: '⛔ 安全守卫拦截：该操作违反项目保护规则' +
      (degraded ? '（注意：protected-paths.json 读取失败，正在用保底清单）' : ''),
  }));
  process.exit(0);
}

/**
 * 把命令拆成子命令，取每条的可执行名。
 *
 * 只看执行位置，是为了不重蹈「用名字匹配整段文本」的覆辙——那样
 * 「grep git README.md」、「echo "npm run build first"」 这种根本没在跑被禁命令的
 * 操作也会被拦，和守卫开头写的「不拿路径名匹配内容」是同一个错误。
 *
 * 命令替换 $(...) 和反引号里的内容换成分隔符，好让子 shell 里的命令也被当成
 * 一条子命令检查——「echo $(git push)」 该拦，「echo "use git"」 不该拦。
 */
function commandHeads(command) {
  const text = String(command || '').replace(/\\/g, '/').replace(/\$\(|\)|\x60/g, '\n');
  const heads = [];
  const WRAPPERS = /^(?:timeout|time|nice|nohup|stdbuf|command|builtin|noglob|xargs|npx|sudo|env)$/i;
  // cmd /c git status、powershell -Command "git diff"、sh -c 'git push'
  // 这类解释器把后面的内容当命令执行，剥掉它和它的开关，内层才是真正的执行位置
  const RUNNERS = /^(?:cmd|sh|bash|zsh|dash|powershell|pwsh)(?:\.exe)?$/i;
  const FLAG_WITH_VALUE = /^-(?:ExecutionPolicy|WindowStyle|InputFormat|OutputFormat)$/i;
  for (const part of text.split(/\|\||&&|[;&|\n]/)) {
    let tokens = part.trim().split(/\s+/).filter(Boolean);
    // 剥掉前导的环境变量赋值和包装器，让 「timeout 30 git push」 也能认出 git
    while (tokens.length) {
      const t = tokens[0].replace(/^["']|["']$/g, '');
      if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(t) || WRAPPERS.test(t)) {
        tokens = tokens.slice(1);
        // timeout 30 xxx / stdbuf -o0 xxx：顺带跳过它们自己的参数
        if (/^(?:timeout|stdbuf|nice)$/i.test(t)) {
          while (tokens.length && /^[-\d]/.test(tokens[0])) tokens = tokens.slice(1);
        }
        continue;
      }
      if (RUNNERS.test(t)) {
        tokens = tokens.slice(1);
        while (tokens.length && /^[-/]/.test(tokens[0])) {
          const flag = tokens[0];
          tokens = tokens.slice(1);
          if (FLAG_WITH_VALUE.test(flag)) tokens = tokens.slice(1);
        }
        continue;
      }
      break;
    }
    if (tokens.length) {
      heads.push({
        head: tokens[0].replace(/^["']|["']$/g, '').replace(/^.*\//, ''),
        rest: tokens.slice(1).map((t) => t.replace(/^["']|["']$/g, '')),
      });
    }
  }
  return heads;
}

/** npm 必须写 run；pnpm / yarn 可以省略 */
function isBlockedScript(rest, requireRun) {
  let args = rest.slice();
  if (args[0] && /^run$/i.test(args[0])) args = args.slice(1);
  else if (requireRun) return false;
  return /^(?:dev|serve|start|preview|build)(?::|$)/i.test(args[0] || '');
}

/** 禁止 Git，以及前端启动、预览和打包命令 */
function blockedCommand(command) {
  const patterns = [
    { name: 'Git 命令', test: (h) => /^git(?:\.exe)?$/i.test(h.head) },
    { name: 'npm 启动/预览/打包命令', test: (h) => /^npm(?:\.cmd)?$/i.test(h.head) && isBlockedScript(h.rest, true) },
    { name: 'pnpm 启动/预览/打包命令', test: (h) => /^pnpm(?:\.cmd)?$/i.test(h.head) && isBlockedScript(h.rest, false) },
    { name: 'yarn 启动/预览/打包命令', test: (h) => /^yarn(?:\.cmd)?$/i.test(h.head) && isBlockedScript(h.rest, false) },
    { name: 'Vite 命令', test: (h) => /^vite(?:\.cmd)?$/i.test(h.head) },
    { name: 'Webpack 命令', test: (h) => /^webpack(?:\.cmd)?$/i.test(h.head) },
  ];
  for (const h of commandHeads(command)) {
    const hit = patterns.find((p) => p.test(h));
    if (hit) return hit;
  }
  return null;
}

let raw = '';
process.stdin.on('data', (d) => (raw += d));
process.stdin.on('error', (e) => deny('无法读取工具调用信息：' + e.message, true));
process.on('uncaughtException', (e) => deny('守卫运行异常：' + e.message, true));
process.on('unhandledRejection', (e) => deny('守卫运行异常：' + String(e), true));
process.stdin.on('end', () => {
  let payload;
  try {
    payload = JSON.parse(raw);
    if (!payload || typeof payload !== 'object') throw new Error('payload 不是对象');
  } catch (e) {
    deny('工具调用信息无法解析，按安全策略拒绝。', true);
  }

  const toolName = (payload && payload.tool_name) || '';
  const input = (payload && payload.tool_input) || {};
  const values = pathValues(toolName, input);
  if (toolName === 'Bash' || toolName === 'PowerShell') {
    values.push(...shellPathVariants(input.command).slice(1));
  }
  const haystack = values.join('\n').replace(/\\/g, '/');

  if (!haystack) process.exit(0);

  const { cfg, degraded } = loadConfig();
  const tail =
    '\n这是预期行为，不是故障。请不要改写命令、换工具或修改权限配置来绕过——' +
    '如确需访问，请让用户手动提供内容，或由用户自己在终端用 ! 前缀执行。' +
    '\n清单位置：.claude/protected-paths.json';

  if (toolName === 'Bash' || toolName === 'PowerShell') {
    const hitCommand = blockedCommand(input.command);
    if (hitCommand) deny('该操作命中禁止规则（' + hitCommand.name + '）。' + tail, degraded);
  }

  const hitProtected = matchAny(cfg.protected, haystack);
  if (hitProtected) {
    deny('该操作触及受保护路径（命中 protected 规则 "' + hitProtected + '"，禁读禁写）。' + tail, degraded);
  }

  const hitReadonly = matchAny(cfg.readonly, haystack);
  if (hitReadonly) {
    const shellWrite = (toolName === 'Bash' || toolName === 'PowerShell') &&
      isShellMutation(input.command) && !isGuardReadOnlyCommand(input.command);
    if (WRITE_TOOLS.includes(toolName) || shellWrite) {
      deny(
        '该文件为只读保护（命中 readonly 规则 "' + hitReadonly + '"）：可以读，但不允许模型修改。' +
        '\n如确需改动，请由用户自己编辑，或在终端用 ! 前缀执行。' + tail,
        degraded
      );
    }
  }

  process.exit(0);
});
`;

// ---------------------------------------------------------------- 命令

/**
 * 注册 / 升级守卫 hook。
 *
 * 不能只判断「注册过没有」：老版本装的 hook，matcher 可能还停在 Read|Edit，
 * 那样 Bash / PowerShell / Grep 全都绕过守卫，而 init 照常输出成功。
 * 所以命中之后要逐字段比对，停在旧版本就地升级。
 *
 * 认全路径而不只认文件名——别人放在 tools/ 下的同名脚本不该被当成自己的改掉。
 * 守卫与别人的命令混在同一组时拆成独立一组，原组的 matcher 一个字都不动，
 * 否则「顺手升级 matcher」会连带放大别人那条命令的触发范围。
 */
function upgradeGuardHook(pre, quiet) {
  const isGuard = (h) =>
    h && typeof h.command === 'string' && h.command.includes('.claude/hooks/guard-paths.js');
  const groups = pre.filter((g) => Array.isArray(g && g.hooks) && g.hooks.some(isGuard));

  if (!groups.length) {
    if (!quiet) console.log(c.dim('  · 注册 PreToolUse 守卫 hook'));
    return pre.concat([JSON.parse(JSON.stringify(HOOK_SPEC))]);
  }

  const drift = [];
  const g = groups[0];
  const shares = g.hooks.some((h) => !isGuard(h));
  if (groups.length > 1) drift.push('守卫注册了 ' + groups.length + ' 组，收敛为 1 组');
  if (shares) drift.push('守卫与其它命令同组，拆成独立一组');
  else if (g.matcher !== HOOK_SPEC.matcher) drift.push('matcher: ' + g.matcher + ' → ' + HOOK_SPEC.matcher);
  const want = HOOK_SPEC.hooks[0];
  const got = g.hooks.find(isGuard) || {};
  for (const k of ['type', 'command', 'timeout', 'statusMessage']) {
    if (got[k] !== want[k]) drift.push(k + ': ' + JSON.stringify(got[k]) + ' → ' + JSON.stringify(want[k]));
  }
  if (!drift.length) return pre;

  if (!quiet) console.log(c.yellow('  ! 升级已注册的守卫 hook：') + drift.join('；'));
  const out = [];
  for (const grp of pre) {
    const hooks = Array.isArray(grp && grp.hooks) ? grp.hooks : [];
    if (!hooks.some(isGuard)) {
      out.push(grp);
      continue;
    }
    const rest = hooks.filter((h) => !isGuard(h));
    if (rest.length) out.push(Object.assign({}, grp, { hooks: rest }));
  }
  return out.concat([JSON.parse(JSON.stringify(HOOK_SPEC))]);
}

function cmdInit() {
  console.log(c.bold('\nclaude-guard init') + c.dim('  —  ' + ROOT) + '\n');

  // 先严格校验，避免 settings 损坏时后续写入覆盖原文件
  const existingSettings = loadSettingsStrict();
  if (fs.existsSync(SETTINGS_PATH)) {
    console.log(c.yellow('  ! 检测到已有 .claude/settings.json，将保留原配置并增量合并守卫规则'));
  }
  const cfg = loadConfig();
  const baselineAdded = ensureBaseline(cfg);
  if (baselineAdded.length) {
    console.log(c.yellow('  ! 补回守卫自我保护项：') + baselineAdded.join('、'));
  }
  const settings = applyDeny(cfg, existingSettings);

  // 所有计算完成后再备份和落盘
  backupSettings();
  writeFile(GUARD_PATH, GUARD_TEMPLATE, 'PreToolUse 守卫脚本');
  saveConfig(cfg); // 总是重写，顺带完成旧格式迁移并记账

  settings.hooks = settings.hooks || {};
  settings.hooks.PreToolUse = upgradeGuardHook(
    Array.isArray(settings.hooks.PreToolUse) ? settings.hooks.PreToolUse : []
  );
  writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2) + '\n', 'deny 规则 + hook 注册');

  if (!NO_GITIGNORE) ensureGitignore();

  console.log('\n' + c.bold('下一步：'));
  console.log('  1. ' + c.yellow('重启 Claude Code') + '，或打开一次 /hooks 让配置生效');
  console.log('  2. 跑 ' + c.bold('node scripts/claude-guard.js check') + ' 做离线自检');
  console.log('  3. 保护清单在 .claude/protected-paths.json，用 add / add -r / remove 增删\n');
}

function ensureGitignore() {
  // 只忽略真正装密钥的那两类。.env.development / .env.production 在 vue-cli 约定里
  // 通常是要提交的非敏感构建配置，替用户决定忽略会造成静默漏提交。
  // settings 备份含完整权限配置，不该进仓库
  const wanted = ['.env.local', '.env.*.local', '.claude/settings.json.backup-*'];
  let content = '';
  try {
    content = fs.readFileSync(GITIGNORE_PATH, 'utf8');
  } catch (e) {
    /* 没有 .gitignore 就新建 */
  }
  const lines = content.split(/\r?\n/).map((l) => l.trim());
  const missing = wanted.filter((w) => !lines.includes(w));
  if (!missing.length) {
    console.log(c.dim('  · .gitignore 已覆盖环境变量文件'));
    return;
  }
  const block = '\n# claude-guard 保护的文件\n' + missing.join('\n') + '\n';
  if (DRY) {
    console.log(c.yellow('  [dry-run] 将向 .gitignore 追加: ') + missing.join(', '));
    return;
  }
  fs.writeFileSync(GITIGNORE_PATH, content + block, 'utf8');
  console.log(c.green('  ✓ ') + '.gitignore' + c.dim(' — 追加 ' + missing.join(', ')));
}

function cmdList() {
  const cfg = loadConfig();
  console.log(c.bold('\n受保护路径') + c.dim('  .claude/protected-paths.json') + '\n');
  console.log(c.bold('  protected') + c.dim(' — 禁读禁写 (' + cfg.protected.length + ')'));
  cfg.protected.forEach((g) => console.log('    · ' + g));
  console.log('\n' + c.bold('  readonly') + c.dim(' — 可读禁写 (' + cfg.readonly.length + ')'));
  cfg.readonly.forEach((g) => console.log('    · ' + g));
  console.log('\n' + c.dim('  共生成 ' + denyRulesFrom(cfg).length + ' 条 permissions.deny 规则') + '\n');
}

function cmdAdd(globs, asReadonly) {
  if (!globs.length) return usage('add 需要至少一个路径，例：add "secrets/**"');
  const cfg = loadConfig();
  const key = asReadonly ? 'readonly' : 'protected';
  const added = globs.filter((g) => !cfg[key].includes(g));
  if (!added.length) {
    console.log(c.dim('\n这些路径已在 ' + key + ' 清单中\n'));
    return;
  }
  cfg[key] = cfg[key].concat(added);
  syncDeny(cfg);
  console.log(
    c.green('\n已加入 ' + key + '（' + (asReadonly ? '可读禁写' : '禁读禁写') + '）：') + added.join(', ')
  );
  console.log(c.yellow('记得重启 Claude Code 或打开一次 /hooks 生效\n'));
}

function cmdRemove(globs) {
  if (!globs.length) return usage('remove 需要至少一个路径');
  const cfg = loadConfig();

  // 自我保护项摘不得：放开之后模型就能改 deny 规则或守卫脚本，剩下的保护一并失效。
  // 真要放开得手动改 protected-paths.json，但那基本等于把整套防护关掉。
  const baseline = globs.filter((g) => DEFAULT_READONLY.includes(g));
  if (baseline.length) {
    console.log(c.red('\n拒绝移除守卫自我保护项：') + baseline.join('、'));
    console.log(c.dim('  放开这几项，模型就能改掉权限配置或守卫脚本本身。'));
    globs = globs.filter((g) => !DEFAULT_READONLY.includes(g));
    if (!globs.length) {
      console.log('');
      return;
    }
  }

  const before = cfg.protected.length + cfg.readonly.length;
  cfg.protected = cfg.protected.filter((g) => !globs.includes(g));
  cfg.readonly = cfg.readonly.filter((g) => !globs.includes(g));
  if (cfg.protected.length + cfg.readonly.length === before) {
    console.log(c.dim('\n清单里没有这些路径\n'));
    return;
  }
  syncDeny(cfg);
  console.log(c.green('\n已移出保护：') + globs.join(', '));
  console.log(c.yellow('记得重启 Claude Code 或打开一次 /hooks 生效\n'));
}

function conflictsWithGuardAllow(rule, cfg) {
  const text = String(rule || '');
  if (text === 'WebFetch' || text === 'WebSearch') return true;
  if (/^Bash\((?:git|npm run (?:dev|serve|start|preview|build)|pnpm (?:dev|serve|start|preview|build)|yarn (?:dev|serve|start|preview|build)|vite|webpack)(?::|\s|\*)/i.test(text)) return true;

  const pathRule = text.match(/^(?:Read|Grep|Glob|Edit|Write)\((.*)\)$/);
  if (!pathRule) return false;
  const allowedPath = pathRule[1].replace(/^\.\//, '').replace(/\\/g, '/');
  return cfg.protected.some((glob) => {
    const protectedPath = String(glob).replace(/^\.\//, '').replace(/\\/g, '/').replace(/\/\*\*$/, '');
    return allowedPath === protectedPath || allowedPath.startsWith(protectedPath + '/') ||
      allowedPath.startsWith(protectedPath + '/**');
  });
}

/**
 * 重算 settings.json 的 deny 规则。
 *
 * 关键在于「先减后加」：先去掉上次由本工具生成的规则（记在 _managedDenyRules），
 * 再写入按当前清单生成的新规则。这样 remove 才是真的能移除，
 * 而用户手写的 deny 规则不在记账里，不会被误删。
 *
 * 返回更新后的 settings 对象，并把本次生成的规则记回 cfg.managed。
 */
function applyDeny(cfg, suppliedSettings, quiet) {
  const settings = suppliedSettings || loadSettingsStrict();
  settings.permissions = settings.permissions || {};
  const existing = Array.isArray(settings.permissions.deny) ? settings.permissions.deny : [];
  const lastManaged = cfg.managed || [];
  const handwritten = existing.filter((r) => !lastManaged.includes(r));
  const fresh = denyRulesFrom(cfg);
  settings.permissions.deny = Array.from(new Set(handwritten.concat(fresh)));

  const existingAllow = Array.isArray(settings.permissions.allow) ? settings.permissions.allow : [];
  const removedAllow = existingAllow.filter((rule) => conflictsWithGuardAllow(rule, cfg));
  if (removedAllow.length) {
    settings.permissions.allow = existingAllow.filter((rule) => !removedAllow.includes(rule));
    if (!quiet) console.log(c.yellow('  ! 守卫规则优先，已移除与新增 deny 冲突的 allow：'));
    if (!quiet) removedAllow.forEach((rule) => console.log('    · ' + rule));
  }

  cfg.managed = fresh;
  return settings;
}

/** add / remove 用：重算 deny 并连同清单一起落盘 */
function syncDeny(cfg) {
  const settings = applyDeny(cfg);
  saveConfig(cfg);
  writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2) + '\n', 'deny 规则已同步');
}

// ---------------------------------------------------------------- 双向同步

/**
 * 补齐守卫的自我保护基线，返回补了哪些。
 *
 * loadConfig 尊重已有清单、不会自动跟进 DEFAULT_READONLY 的新增项，于是给脚本加了
 * 新保护项之后，老项目跑 init 依然不生效——settings 备份的保护就是这么漏掉的。
 * 这些项失守等于模型能改权限配置或守卫脚本本身，所以由 init / sync 强制补齐。
 */
function ensureBaseline(cfg) {
  const missing = DEFAULT_READONLY.filter(
    (g) => !cfg.readonly.includes(g) && !cfg.protected.includes(g)
  );
  if (missing.length) cfg.readonly = cfg.readonly.concat(missing);
  return missing;
}

/** 反解析认得的工具名。必须与 denyRulesFrom 生成的那两组保持一致 */
const PATH_RULE_TOOLS = /^(Read|Grep|Glob|Edit|Write|NotebookEdit|MultiEdit)\((.+)\)$/;

/** 读类工具，用来把反解析出来的规则归到 protected 还是 readonly */
const READ_TOOLS = /^(?:Read|Grep|Glob)$/;

/**
 * deny 规则反解析：'Grep(./secrets/**)' → { tool: 'Grep', glob: 'secrets/**' }
 *
 * 认得的工具名与 denyRulesFrom 生成的范围一致，少认一类反向同步就漏一类。
 *
 * 命令类规则（Bash(git:*)）和裸工具名（WebFetch）返回 null，
 * 否则反向同步会把跟文件保护无关的规则也吸进清单。
 */
function parseDenyRule(rule) {
  const m = PATH_RULE_TOOLS.exec(String(rule).trim());
  if (!m) return null;
  const glob = m[2].trim().replace(/^\.\//, '');
  if (!glob || glob.includes(':')) return null; // 冒号是工具参数分隔符，不是路径
  return { tool: m[1], glob: glob };
}

/**
 * 把清单外的规则归拢成清单项：
 * 出现任一读类工具（Read/Grep/Glob）→ protected；只有写类工具 → readonly。
 * 只禁读不禁写也归 protected——读都不许了，写更不该放开。
 */
function adoptRules(rules) {
  const byGlob = new Map();
  for (const r of rules) {
    const p = parseDenyRule(r);
    if (!p) continue;
    const hit = byGlob.get(p.glob) || { read: false, edit: false };
    if (READ_TOOLS.test(p.tool)) hit.read = true;
    else hit.edit = true;
    byGlob.set(p.glob, hit);
  }
  const out = { protected: [], readonly: [] };
  for (const entry of byGlob) out[entry[1].read ? 'protected' : 'readonly'].push(entry[0]);
  return out;
}

/** settings.json 里既不在记账、也不是本次要生成的路径规则 */
function orphanRules(cfg, settings) {
  const existing = Array.isArray(settings.permissions && settings.permissions.deny)
    ? settings.permissions.deny
    : [];
  const managed = cfg.managed || [];
  const fresh = denyRulesFrom(cfg);
  return existing.filter((r) => !managed.includes(r) && !fresh.includes(r) && parseDenyRule(r));
}

/**
 * 双向对齐。
 *
 *   正向  清单 → settings.json 的 deny 规则、hook 注册、守卫脚本本体
 *   反向  settings.json 里清单外的路径规则 → 清单（仅在 opts.adopt 时执行）
 *
 * 另外补齐守卫的自我保护基线：改了脚本里的 DEFAULT_READONLY 之后，已有清单不会
 * 自动跟进（loadConfig 尊重用户改过的清单），缺的项在这里补，否则新增的保护
 * 形同虚设——备份文件保护就是这么漏掉的。
 *
 * 返回 { changes, orphans }；changes 为空即两边已经一致。会就地改 cfg 和 settings。
 */
function planSync(cfg, settings, opts) {
  const options = opts || {};
  const changes = [];

  const missing = ensureBaseline(cfg);
  if (missing.length) changes.push('补回守卫自我保护项：' + missing.join('、'));

  const orphans = orphanRules(cfg, settings);
  if (orphans.length && options.adopt) {
    const taken = adoptRules(orphans);
    const addedP = taken.protected.filter((g) => !cfg.protected.includes(g));
    const addedR = taken.readonly.filter(
      (g) => !cfg.readonly.includes(g) && !cfg.protected.includes(g)
    );
    cfg.protected = cfg.protected.concat(addedP);
    cfg.readonly = cfg.readonly.concat(addedR);
    if (addedP.length) changes.push('反向回填 protected：' + addedP.join('、'));
    if (addedR.length) changes.push('反向回填 readonly：' + addedR.join('、'));
  }

  const before = Array.isArray(settings.permissions && settings.permissions.deny)
    ? settings.permissions.deny.slice()
    : [];
  applyDeny(cfg, settings, options.quiet);
  const after = settings.permissions.deny;
  const added = after.filter((r) => !before.includes(r));
  const dropped = before.filter((r) => !after.includes(r));
  if (added.length) changes.push('新增 ' + added.length + ' 条 deny 规则');
  if (dropped.length) changes.push('撤销 ' + dropped.length + ' 条过期 deny 规则：' + dropped.join('、'));

  settings.hooks = settings.hooks || {};
  const preBefore = JSON.stringify(settings.hooks.PreToolUse || []);
  settings.hooks.PreToolUse = upgradeGuardHook(
    Array.isArray(settings.hooks.PreToolUse) ? settings.hooks.PreToolUse : [],
    options.quiet
  );
  if (JSON.stringify(settings.hooks.PreToolUse) !== preBefore) changes.push('hook 注册已更新');

  let current = null;
  try {
    current = fs.readFileSync(GUARD_PATH, 'utf8');
  } catch (e) {
    /* 不存在 */
  }
  if (current !== GUARD_TEMPLATE) {
    changes.push(current === null ? '守卫脚本缺失，重新生成' : '守卫脚本不是当前版本，重写');
  }
  return { changes: changes, orphans: orphans, guardStale: current !== GUARD_TEMPLATE };
}

/** 报告反向差异。默认只提示，加 --adopt 才并入清单 */
function reportOrphans(orphans, adopted) {
  if (!orphans.length) return;
  if (adopted) {
    console.log(c.green('  ✓ 已反向并入清单 ' + orphans.length + ' 条'));
    return;
  }
  console.log(
    '\n  ' + c.yellow('反向：发现 ' + orphans.length + ' 条清单外的路径规则') +
    c.dim('（settings.json 里有、清单里没有）')
  );
  orphans.forEach((r) => console.log('    · ' + r));
  console.log(
    c.dim('  它们原样保留。确认要并进清单，加 ') + c.bold('--adopt') + c.dim(' 重跑。') + '\n' +
    c.dim('  注意反解析分不出「你手写的」和「旧版本残留」，并入前先看一眼上面的清单。')
  );
}

function cmdSync() {
  console.log(c.bold('\nclaude-guard sync') + c.dim('  —  ' + ROOT) + '\n');

  const settings = loadSettingsStrict();
  if (!fs.existsSync(SETTINGS_PATH)) {
    console.log(c.yellow('  .claude/settings.json 不存在，将新建') + '\n');
  }
  const cfg = loadConfig();

  // 先在副本上预演，好让漂移报告排在写入动作前面，dry-run 也能拿到完整结果
  const preview = planSync(
    JSON.parse(JSON.stringify(cfg)),
    JSON.parse(JSON.stringify(settings)),
    { adopt: ADOPT, quiet: true }
  );

  if (!preview.changes.length && !preview.orphans.length) {
    console.log(c.green('  ✓ 已同步') + c.dim('  —  清单、deny 规则、hook 注册、守卫脚本四者一致') + '\n');
    return;
  }

  if (preview.changes.length) {
    console.log(c.bold('  正向（清单 → settings.json）：'));
    preview.changes.forEach((ch) => console.log('    · ' + ch));
  }

  if (DRY) {
    // 带 --adopt 时回填已经列在正向清单里了，别再提示一次「加 --adopt 重跑」
    if (!ADOPT) reportOrphans(preview.orphans, false);
    console.log('\n  ' + c.yellow('[dry-run] 未写入任何文件') + '\n');
    return;
  }

  console.log('');
  const plan = planSync(cfg, settings, { adopt: ADOPT });
  if (plan.guardStale) writeFile(GUARD_PATH, GUARD_TEMPLATE, 'PreToolUse 守卫脚本');
  saveConfig(cfg);
  writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2) + '\n', 'deny 规则 + hook 注册');
  reportOrphans(plan.orphans, ADOPT);
  console.log('\n  ' + c.yellow('记得重启 Claude Code 或打开一次 /hooks 生效') + '\n');
}

/** 离线自检：直接把模拟 payload 喂给守卫脚本，不需要调模型 */
function cmdCheck() {
  const { spawnSync } = require('child_process');
  if (!fs.existsSync(GUARD_PATH)) {
    console.log(c.red('\n✗ 守卫脚本不存在，先跑 init\n'));
    process.exit(1);
  }

  const cases = [
    // [期望拦截?, 说明, tool_name, tool_input]
    [true, '读取构建产物', 'Read', { file_path: path.join(ROOT, 'dist', 'assets', 'a.png') }],
    [true, '搜索构建目录', 'Grep', { pattern: 'systemName', path: path.join(ROOT, 'dist') }],
    [true, '列出完整构建目录', 'Glob', { pattern: 'dist/**', path: ROOT }],
    [true, '修改构建产物', 'Edit', { file_path: path.join(ROOT, 'dist', 'app.js') }],
    [true, '写入构建产物', 'Write', { file_path: path.join(ROOT, 'dist', 'app.js') }],
    [true, '读取开发环境文件', 'Read', { file_path: path.join(ROOT, '.env.development') }],
    [true, '读取生产环境文件', 'Bash', { command: 'cat .env.production' }],
    [true, 'Grep glob 搜环境文件', 'Grep', { pattern: 'KEY', glob: '.env.production' }],
    [false, 'Grep 文档提及环境名', 'Grep', { pattern: '.env.production', path: 'docs' }],
    [true, '反引号读取环境文件', 'Bash', { command: '`cat .env.production`' }],
    [true, '重定向读取环境文件', 'Bash', { command: 'base64<.env.production' }],
    [true, 'cd 后读取构建目录', 'Bash', { command: 'cd dist && cat assets/a.js' }],
    [true, 'Git 直接命令', 'Bash', { command: 'git status' }],
    [true, 'Git cmd 包装', 'Bash', { command: 'cmd /c git status' }],
    [true, 'Git PowerShell 包装', 'PowerShell', { command: 'powershell -Command "git diff"' }],
    [true, 'npm 开发启动', 'Bash', { command: 'npm run dev' }],
    [true, 'npm 预览', 'Bash', { command: 'npm run preview' }],
    [true, 'npm 生产打包', 'Bash', { command: 'npm run build:prod' }],
    [true, 'pnpm 生产打包', 'Bash', { command: 'pnpm build' }],
    [true, 'yarn 生产打包', 'Bash', { command: 'yarn build' }],
    [true, 'Vite 直接执行', 'Bash', { command: 'npx vite build' }],
    [true, 'Webpack 直接执行', 'Bash', { command: 'webpack --mode production' }],
    [true, '改权限配置', 'Edit', { file_path: path.join(CLAUDE_DIR, 'settings.json') }],
    [false, 'Shell 读取权限配置', 'Bash', { command: 'cat .claude/settings.json' }],
    [true, 'Shell 删除权限配置', 'Bash', { command: 'rm .claude/settings.json' }],
    [true, 'Shell 重定向配置', 'Bash', { command: 'echo x > .claude/settings.json' }],
    [true, '脚本修改权限配置', 'Bash', { command: 'node scripts/change.js .claude/settings.json' }],
    [true, '改守卫脚本', 'Write', { file_path: GUARD_PATH }],
    [true, '改本工具', 'Edit', { file_path: path.join(ROOT, 'scripts', 'claude-guard.js') }],
    [false, '读权限配置', 'Read', { file_path: path.join(CLAUDE_DIR, 'settings.json') }],
    [false, '写普通文档', 'Write', { file_path: path.join(ROOT, 'docs', 'note.md') }],
    [false, '读普通源码', 'Read', { file_path: path.join(ROOT, 'src', 'example.js') }],
    [false, '执行单元测试', 'Bash', { command: 'npm run test' }],
    [false, '执行 Lint', 'Bash', { command: 'npm run lint' }],
    [false, '执行类型检查', 'Bash', { command: 'npm run typecheck' }],
    [false, '读项目清单', 'Read', { file_path: path.join(ROOT, 'package.json') }],
  ];

  /** 把用例实际喂进去的那个值摘出来显示，别让人猜「正常 git 操作」测的是什么 */
  const subject = (input) => {
    const raw = input.command || input.file_path || input.path || input.pattern || '';
    const rel = String(raw).split(ROOT + path.sep).join('').split(ROOT + '/').join('');
    return rel.length > 42 ? rel.slice(0, 41) + '…' : rel;
  };

  console.log(c.bold('\n离线自检') + c.dim('  直接喂 payload 给 guard-paths.js，不调用模型') + '\n');

  let pass = 0;
  let fail = 0;
  for (const [shouldBlock, label, toolName, toolInput] of cases) {
    const res = spawnSync(process.execPath, [GUARD_PATH], {
      input: JSON.stringify({ tool_name: toolName, tool_input: toolInput }),
      encoding: 'utf8',
    });
    const blocked = (res.stdout || '').includes('"permissionDecision":"deny"');
    const ok = blocked === shouldBlock;
    ok ? pass++ : fail++;
    console.log(
      '  ' + (ok ? c.green('✓') : c.red('✗')) + ' ' + padTo(label, 28) +
      c.dim(padTo(subject(toolInput), 44)) +
      c.dim('应' + (shouldBlock ? '拦截' : '放行') + ' / 实际' + (blocked ? '拦截' : '放行'))
    );
  }

  console.log('\n  ' + (fail === 0 ? c.green('全部通过 ' + pass + '/' + cases.length) : c.red(fail + ' 项未通过')));

  console.log(
    '\n' + c.dim('本自检验证默认路径及命令守卫的判定逻辑。') + '\n' +
    c.dim('permissions.deny 是否生效需重启 Claude Code 后在真实会话里验证。') + '\n'
  );

  process.exit(fail === 0 ? 0 : 1);
}

function usage(err) {
  if (err) console.log(c.red('\n错误：' + err));
  console.log(
    '\n' + c.bold('claude-guard') + ' — Claude Code 文件访问守卫配置工具\n\n' +
    '  init              生成/合并全部配置\n' +
    '  sync              双向同步清单与 settings.json\n' +
    '  list              查看当前保护清单\n' +
    '  add <glob...>     增加「禁读禁写」路径\n' +
    '  add -r <glob...>  增加「可读禁写」路径\n' +
    '  remove <glob...>  从两类清单移除\n' +
    '  check             离线自检\n\n' +
    c.dim('  加 --dry-run 只预览不落盘（配 sync 就是纯体检）\n') +
    c.dim('  加 --adopt 让 sync 把清单外的路径规则反向并入清单\n') +
    c.dim('  加 --no-gitignore 让 init 完全不碰 .gitignore\n') +
    c.dim('  在 Claude Code 里跑请用 ! 前缀，否则命令会被守卫自己拦下\n')
  );
  process.exit(err ? 1 : 0);
}

const [, , cmd, ...rest] = process.argv;
const readonlyFlag = rest.includes('-r') || rest.includes('--readonly');
const args = rest.filter(
  (a) => !['--dry-run', '-r', '--readonly', '--no-gitignore', '--adopt'].includes(a)
);

switch (cmd) {
  case 'init': cmdInit(); break;
  case 'sync': cmdSync(); break;
  case 'list': cmdList(); break;
  case 'add': cmdAdd(args, readonlyFlag); break;
  case 'remove': cmdRemove(args); break;
  case 'check': cmdCheck(); break;
  default: usage(cmd ? '未知命令 ' + cmd : null);
}
