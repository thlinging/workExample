import { describe, it, expect } from 'vitest'
import varyColor from 'webpack-theme-color-replacer/client/varyColor'
import { listPresets } from '@/theme/presets'
import { getElementSerials } from '@/theme/colorSeries'

// 树「当前高亮行」的底色在 element 的 tree.scss 里写死成
// mix($--color-white, $--color-primary, 92%)，不走 light-1~9 那套 10% 步进，
// 因此不在 element 官方（forElementUI）的色序里。少了这一档，构建期抽取不到
// .el-tree--highlight-current 那条规则，运行时换主色时 el-tree / vue-easy-tree
// 的选中行就不会跟着变。colorSeries.js 末尾专门补了它，这里钉住防止被重构掉。
// 背景见 docs/vue-easy-tree接入说明.md。
describe('element 派生色序覆盖树的选中行', () => {
  listPresets().forEach(preset => {
    const primary = preset.modifyVars['@primary-color']

    it(`${preset.key} 方案：色序含 mix(白, 主色, 92%) 一档`, () => {
      const expected = varyColor.mix('#fff', primary, 0.92)
      expect(getElementSerials(primary)).toContain(expected)
    })

    it(`${preset.key} 方案：92% 档确实是额外一档，不与 light-1~9 重合`, () => {
      const lights = new Array(9).fill().map((t, i) => varyColor.mix('#fff', primary, (i + 1) / 10))
      expect(lights).not.toContain(varyColor.mix('#fff', primary, 0.92))
    })
  })
})
