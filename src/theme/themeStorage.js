// 主题偏好存储层 —— 默认 localStorage 实现。
// 将来要按用户"存库"记忆主题：照同样的签名写一个走接口的实现，
// 登录后 ThemeManager.setStorage(apiThemeStorage) 换掉即可，ThemeManager 及业务代码一行不动。
//
// 接口约定（两个方法都返回 Promise，方便接口实现直接 async）：
//   load(): Promise<{ key: string|null, primary: string|null }>
//     key     用户选的方案 key；primary 用户手动选的主题色
//   save(patch): Promise<void>
//     patch.key / patch.primary：undefined = 不动，null = 清除，其他 = 写入

const THEME_KEY = 'app-theme-key' // 用户选的方案 key
const PRIMARY_KEY = 'app-custom-primary' // 用户手动选的主题色

function write(storageKey, value) {
  if (value === undefined) return
  if (value === null) localStorage.removeItem(storageKey)
  else localStorage.setItem(storageKey, value)
}

export default {
  async load() {
    return {
      key: localStorage.getItem(THEME_KEY),
      primary: localStorage.getItem(PRIMARY_KEY)
    }
  },

  async save(patch) {
    write(THEME_KEY, patch.key)
    write(PRIMARY_KEY, patch.primary)
  }
}
