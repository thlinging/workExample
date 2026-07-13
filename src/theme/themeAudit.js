// 运行时换肤"级联误伤"自检工具（启发式排查，详见 docs/主题换肤方案说明.md）。
//
// 背景：替换引擎只抽含主题色的声明，追加到 <body> 尾；选择器过宽时会同优先级后来居上，
// 盖掉原样式的白字/透明边框（如 el-tag--dark 白字、主按钮悬浮白字、link 悬浮冒边框）。
//
// 原理：对每条追加声明，用真实 DOM 找证人元素，再在原始样式表里做迷你级联仿真——同状态、
// 命中同证人的原规则按 (优先级, 文档顺序) 选出"原本的赢家"；若追加规则能压过它，且赢家值
// 不属主题色系（否则它有自己的替换双胞胎、属正常换色），即上报。只和真实赢家比，避免误报。
//
// 用法：先切一次主题色（让追加样式表存在）再调用；/theme 页有"级联自检"按钮，
// 结果也挂在 window.__lastThemeAudit。命中范围受当前页面 DOM 覆盖面限制。

// 状态伪类：两条规则状态签名一致才有可比性（.ant-btn:hover 和 .ant-btn-link:hover 可比，
// 和 .ant-btn-link 静态态不可比——状态不同本来就该值不同）
const STATE_PSEUDO = /:(hover|focus-within|focus|active|visited)\b/g
// 伪元素同理需要一致
const PSEUDO_ELEMENT = /::?(before|after|placeholder|selection|first-line|first-letter)\b/g

// 简化版 specificity：id*1e6 + (类/属性/伪类)*1e3 + 元素。:not 本身不计、内部照计，
// 与浏览器规则一致（正则里排除 not 这个名字、其括号内的 .xx 会被类选择器正则命中）
function specificity(selector) {
  const s = selector.replace(PSEUDO_ELEMENT, ' x')
  const ids = (s.match(/#[\w-]+/g) || []).length
  const classes = (s.match(/\.[\w-]+|\[[^\]]*\]|:(?!not\()[\w-]+/g) || []).length
  const elems = (s.match(/(^|[\s>+~])[a-z][\w-]*/gi) || []).length
  return ids * 1e6 + classes * 1e3 + elems
}

function statePseudos(selectorPart) {
  return (selectorPart.match(STATE_PSEUDO) || []).sort().join()
}

function pseudoElements(selectorPart) {
  return (selectorPart.match(PSEUDO_ELEMENT) || []).sort().join()
}

// 去掉状态伪类/伪元素，用于真实 DOM 匹配
function stripStates(selectorPart) {
  return selectorPart.replace(STATE_PSEUDO, '').replace(PSEUDO_ELEMENT, '').trim()
}

// 递归展开样式表为 CSSStyleRule 数组（进入 @media / @supports）
function flattenRules(rules, out) {
  for (const rule of rules) {
    if (rule.style && rule.selectorText) out.push(rule)
    else if (rule.cssRules) flattenRules(rule.cssRules, out)
  }
  return out
}

// 颜色值归一化（'#fff' / 'white' / 'rgb(255,255,255)' → 同一形式），非颜色值原样返回
const normalizeCache = {}
let probeEl = null
function normalizeColor(value) {
  if (value in normalizeCache) return normalizeCache[value]
  if (!probeEl) {
    probeEl = document.createElement('div')
    probeEl.style.display = 'none'
    document.body.appendChild(probeEl)
  }
  probeEl.style.color = ''
  probeEl.style.color = value
  const normalized = probeEl.style.color ? getComputedStyle(probeEl).color : value
  normalizeCache[value] = normalized
  return normalized
}

// 审计的属性范围：颜色类 + 会携带颜色的复合属性（box-shadow / text-shadow / fill / stroke）。
// border-*-color / background-color / outline-color 已含 "color"，被同一正则覆盖。
const THEMED_PROP = /color|shadow|fill|stroke/

// 取声明值里的「颜色」用于比对：纯颜色值直接归一化；box-shadow 等复合值先抽出颜色 token
// （否则整串复合值无法与主题色集比对，会漏判或误判）。
const COLOR_TOKEN = /#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|\b(?:transparent|currentcolor|white|black)\b/i
function valueColor(value) {
  const m = value.match(COLOR_TOKEN)
  return normalizeColor(m ? m[0] : value)
}

// 取 rgb 三元组做键、忽略透明度：替换引擎只认 rgb，焦点环等 rgba(主色, α) 应被识别为
// "同属主题色系"（否则会把随主色正常变化的半透明阴影误报成误伤）。
function rgbKey(normalized) {
  const m = normalized.match(/(\d+),\s*(\d+),\s*(\d+)/)
  return m ? m[1] + ',' + m[2] + ',' + m[3] : normalized
}

export default function auditThemeOverrides() {
  const appendedStyleEls = Array.from(document.querySelectorAll('body > style[id^="css_"]'))
  if (!appendedStyleEls.length) {
    return { ran: false, reason: '尚未发生运行时换色，先切一次主题色再自检', findings: [] }
  }
  const cfg = window.__theme_COLOR_cfg || {}
  const oldColorSet = new Set((cfg.colors || []).map(c => rgbKey(normalizeColor('#' + String(c).replace('#', '')))))

  const appendedSheets = appendedStyleEls.map(el => el.sheet)
  const originalRules = []
  for (const sheet of document.styleSheets) {
    if (appendedStyleEls.includes(sheet.ownerNode)) continue
    try { flattenRules(sheet.cssRules, originalRules) } catch (e) { /* 跨域样式表跳过 */ }
  }

  // 原始规则按"颜色类属性"建索引：prop -> [{part, state, pseudoEl, value, spec, order}]
  // order = 文档顺序，级联仿真里同优先级靠后者赢
  const index = {}
  let docOrder = 0
  for (const rule of originalRules) {
    docOrder++
    const props = []
    for (let i = 0; i < rule.style.length; i++) {
      const p = rule.style.item(i)
      if (THEMED_PROP.test(p)) props.push(p)
    }
    if (!props.length) continue
    for (const part of rule.selectorText.split(',')) {
      const entry = {
        part: part.trim(),
        state: statePseudos(part),
        pseudoEl: pseudoElements(part),
        spec: specificity(part),
        order: docOrder
      }
      for (const p of props) {
        const v = rule.style.getPropertyValue(p).trim()
        if (!v) continue
        ;(index[p] = index[p] || []).push(Object.assign({ value: v }, entry))
      }
    }
  }

  const queryCache = {}
  function elementsFor(selector) {
    if (!(selector in queryCache)) {
      try { queryCache[selector] = new Set(document.querySelectorAll(selector)) }
      catch (e) { queryCache[selector] = new Set() }
    }
    return queryCache[selector]
  }

  const findings = []
  const seen = new Set()
  const appendedRules = []
  appendedSheets.forEach(s => { try { flattenRules(s.cssRules, appendedRules) } catch (e) { /* ignore */ } })

  for (const aRule of appendedRules) {
    for (let i = 0; i < aRule.style.length; i++) {
      const prop = aRule.style.item(i)
      if (!THEMED_PROP.test(prop) || !index[prop]) continue
      const aValue = aRule.style.getPropertyValue(prop).trim()
      for (const aPart of aRule.selectorText.split(',').map(t => t.trim())) {
        const aState = statePseudos(aPart)
        const aPseudoEl = pseudoElements(aPart)
        const aSpec = specificity(aPart)
        const aStripped = stripStates(aPart)
        // 证人元素：按 class 签名去重，最多查 10 个，避免长列表重复扫描
        const witnesses = []
        const sigs = new Set()
        for (const el of elementsFor(aStripped)) {
          const sig = el.tagName + '|' + el.className
          if (sigs.has(sig)) continue
          sigs.add(sig)
          witnesses.push(el)
          if (witnesses.length >= 10) break
        }
        for (const witness of witnesses) {
          // 级联仿真：同状态、命中该证人的原规则里，按 (优先级, 文档顺序) 选出原本的赢家
          let winner = null
          for (const o of index[prop]) {
            if (o.state !== aState || o.pseudoEl !== aPseudoEl) continue
            if (!elementsFor(stripStates(o.part)).has(witness)) continue
            if (!winner || o.spec > winner.spec || (o.spec === winner.spec && o.order > winner.order)) {
              winner = o
            }
          }
          if (!winner) continue
          if (aSpec < winner.spec) continue // 原赢家优先级更高，追加规则压不过，无误伤
          const wValue = valueColor(winner.value)
          if (wValue === valueColor(aValue)) continue // 颜色相同无影响
          if (oldColorSet.has(rgbKey(wValue))) continue // 赢家颜色属主题色系（忽略透明度）→ 有替换双胞胎，正常换色
          const key = [prop, aPart, winner.part, winner.value].join('|')
          if (seen.has(key)) continue
          seen.add(key)
          findings.push({
            属性: prop,
            追加规则选择器: aPart,
            追加值: aValue,
            被盖的原规则: winner.part,
            被盖的原值: winner.value,
            证人元素: witness.tagName.toLowerCase() + '.' + Array.from(witness.classList).join('.')
          })
        }
      }
    }
  }

  const result = { ran: true, findings }
  window.__lastThemeAudit = result
  if (findings.length) {
    // eslint-disable-next-line no-console
    console.table(findings)
  }
  return result
}
