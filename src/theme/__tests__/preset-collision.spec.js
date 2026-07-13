import { describe, it, expect } from 'vitest'
import varyColor from 'webpack-theme-color-replacer/client/varyColor'
import { generate } from '@ant-design/colors'
import { listPresets, getPreset } from '@/theme/presets'
import { getThemeSerials } from '@/theme/colorSeries'

// 功能色"防劫持"把关：运行时换肤按颜色字符串匹配替换，分不清语义。
// 固定功能色（success/warning/error/info/highlight）及其全部会出现在编译产物里的
// 派生色，都不能与任何方案主色的替换序列（getThemeSerials）撞值——撞了就意味着
// 换主色时危险按钮/错误提示等会被一并染成主色。改功能色、加主题方案时本测试兜底。
// 详见 docs/主题换肤方案说明.md 方案边界第 7 条。

// 跟随主色是刻意设计的变量（@processing-color/@link-color 等）不在检查之列
const FIXED_FUNCTIONAL_VARS = [
  '@success-color',
  '@warning-color',
  '@error-color',
  '@info-color',
  '@highlight-color'
]

// 功能色在编译产物里的全部派生形态：
// element 的 mix 浅色阶(light-1~9)与按钮 active(mix 黑 10%)、antd 的 colorPalette 十档
function derivations(color) {
  const list = [color]
  for (let i = 1; i <= 9; i++) list.push(varyColor.mix('#fff', color, i / 10))
  list.push(varyColor.mix('#000', color, 0.1))
  return list.concat(generate(color))
}

describe('功能色与方案主色替换序列不相撞', () => {
  const presets = listPresets()

  presets.forEach(preset => {
    const serials = new Set(getThemeSerials(preset.modifyVars['@primary-color']).map(String))

    FIXED_FUNCTIONAL_VARS.forEach(varName => {
      it(`${preset.key} 方案：${varName} 的派生色不落入主色序列`, () => {
        const value = preset.modifyVars[varName]
        expect(value, `${varName} 应在 baseVars 中定义`).toBeTruthy()
        const hits = derivations(value).filter(d => serials.has(d))
        expect(hits, `${varName}=${value} 的派生色与 ${preset.key} 主色序列撞值`).toEqual([])
      })
    })
  })

  it('未知 key 回退 default 且功能色齐全', () => {
    const p = getPreset('不存在的方案')
    expect(p.key).toBe('default')
    FIXED_FUNCTIONAL_VARS.forEach(v => expect(p.modifyVars[v]).toBeTruthy())
  })
})
