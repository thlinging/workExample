<template>
  <div class="home">
    <!-- 顶部英雄区：Mintlify 大气渐变横幅 -->
    <section class="hero">
      <div class="hero-inner">
        <span class="hero-eyebrow m-micro-up">组件演示中心</span>
        <h1 class="hero-title">为交互而生的<br />组件与指令集</h1>
        <p class="hero-subtitle">可拖拽/缩放弹窗、联动表格、双日期区间、富文本编辑 —— 一处演示，随取随用。</p>
        <div class="hero-actions">
          <a-button class="m-btn-accent" size="large" @click="modalVisible = true">开始体验</a-button>
          <a-button size="large" @click="$router.push('/theme')">查看主题系统</a-button>
        </div>
      </div>
    </section>

    <!-- 弹窗演示 -->
    <a-card class="panel" :bordered="false">
      <template #title>
        <span class="panel-title"><a-icon type="appstore" /> 弹窗演示</span>
      </template>

      <a-row :gutter="[16, 16]">
        <a-col
          v-for="item in demos"
          :key="item.key"
          :xs="24"
          :sm="12"
          :lg="6"
        >
          <div class="demo-card" @click="item.action">
            <div class="demo-icon">
              <a-icon :type="item.icon" />
            </div>
            <div class="demo-meta">
              <div class="demo-name">{{ item.name }}</div>
              <div class="demo-desc">{{ item.desc }}</div>
            </div>
          </div>
        </a-col>
      </a-row>
    </a-card>

    <!-- 日期组件示例 -->
    <a-card class="panel" :bordered="false">
      <template #title>
        <span class="panel-title">
          <a-icon type="calendar" /> 日期范围选择
        </span>
      </template>
      <template #extra>
        <span class="panel-extra">双独立日期 + 粒度切换</span>
      </template>

      <div class="date-block">
        <dual-date-range-picker
          :start-value.sync="startVal"
          :end-value.sync="endVal"
          allow-clear
          @update:mode="mode = $event"
        />
        <span class="date-result">
          已选：<b>{{ startVal || '—' }}</b> ~ <b>{{ endVal || '—' }}</b>
          <a-tag color="blue">{{ modeLabel }}</a-tag>
        </span>
      </div>

      <a-divider class="date-divider" />

      <div class="date-block">
        <span class="date-hint">回显示例（点按钮看前面类型框自动切换）：</span>
        <a-space wrap>
          <a-button size="small" @click="echo('2022', '2024')">按年</a-button>
          <a-button size="small" @click="echo('2024-01', '2024-06')">按年月</a-button>
          <a-button size="small" @click="echo('2024-06-01', '2024-06-15')">按年月日</a-button>
          <a-button size="small" @click="echo('20240601', '20240615')">紧凑 YYYYMMDD</a-button>
          <a-button size="small" @click="echo('202401', '202406')">紧凑 YYYYMM</a-button>
          <a-button size="small" @click="echo(null, null)">清空</a-button>
        </a-space>
      </div>
    </a-card>

    <!-- 材料份数组件示例 -->
    <a-card class="panel" :bordered="false">
      <template #title>
        <span class="panel-title">
          <a-icon type="profile" /> 材料份数
        </span>
      </template>
      <div class="material-block">
        <!-- 录入态：可编辑，改动实时写回 formData -->
        <div class="material-case">
          <a-tag color="blue">录入态</a-tag>
          <material-count-list
            v-model="materialForm"
            :list="materials"
            show-total
            total-field="total"
            total-sync
            total-suffix
          >
            <!-- 尾端插槽：内容由使用者自定义，可按 item 渲染不同内容
                 （文档=提示图标，视频=文字链接）；展示与否由 item.suffix 控制 -->
            <template #suffix="{ item }">
              <a-tooltip v-if="item.icon" :title="item.tip">
                <a-icon :type="item.icon" class="material-tip" />
              </a-tooltip>
              <a v-else-if="item.link" class="material-link" @click="$message.info(item.label + '：示例')">
                {{ item.link }}
              </a>
            </template>
            <!-- 总计专属插槽：与各项 #suffix 区分开，只挂在总计后面；
                 透出的 count 为当前总计份数，这里做个「清空」快捷操作 -->
            <template #total-suffix="{ count }">
              <a
                class="material-link"
                @click="$message.warning('当前共 ' + count + ' 份，已清空')"
              >清空</a>
            </template>
          </material-count-list>
        </div>

        <a-divider class="date-divider" />

        <!-- 详情态：纯文本展示，与上面共用同一份 formData，改上面这里实时跟随。
             hide-zero-in-detail：份数为 0 的项详情态不展示（如上方把某项改成 0，这里会消失；
             录入态始终可见便于改回）。总计默认也跟随该开关，为 0 时一并隐藏。 -->
        <div class="material-case">
          <a-tag color="green">详情态</a-tag>
          <material-count-list
            v-model="materialForm"
            :list="materials"
            show-total
            total-field="total"
            total-sync
            hide-zero-in-detail
            detail
          />
        </div>

        <a-divider class="date-divider" />
        <span class="date-hint">当前 formData：</span>
        <pre class="material-json">{{ materialForm }}</pre>
      </div>
    </a-card>

    <demo-modal v-model="modalVisible" title="新增记录" @submit="onModalSubmit" />
    <directive-demo-modal v-model="directiveModalVisible" />
    <iframe-demo-modal v-model="iframeModalVisible" />
    <linked-table-modal v-model="linkedTableModalVisible" />
    <UEditorModal v-model="ueditorModalVisible" />
  </div>
</template>

<script>
import DemoModal from '@/components/DemoModal.vue'
import DirectiveDemoModal from '@/components/DirectiveDemoModal.vue'
import IframeDemoModal from '@/components/IframeDemoModal.vue'
import LinkedTableModal from '@/components/LinkedTableModal.vue'
import UEditorModal from '@/components/UEditorModal.vue'
import DualDateRangePicker from '@/components/DualDateRangePicker.vue'
import MaterialCountList from '@/components/MaterialCountList.vue'

export default {
  name: 'Home',
  components: { DemoModal, DirectiveDemoModal, IframeDemoModal, LinkedTableModal, UEditorModal, DualDateRangePicker, MaterialCountList },
  data() {
    return {
      modalVisible: false,
      directiveModalVisible: false,
      iframeModalVisible: false,
      linkedTableModalVisible: false,
      ueditorModalVisible: false,
      mode: 'date',
      startVal: null,
      endVal: null,
      // 材料份数组件演示
      materials: [
        { field: 'doc', label: '文档', suffix: true, icon: 'info-circle', tip: '支持 Word / PDF 等文档' },
        { field: 'image', label: '图片', unit: '张', color: 'green' },
        { field: 'video', label: '视频', color: 'orange', suffix: true, link: '查看示例' },
        { field: 'audio', label: '音频', color: 'purple' }
      ],
      materialForm: { doc: '2', image: '3', video: '', audio: '1' }
    }
  },
  computed: {
    modeLabel() {
      return { year: '按年', month: '按年月', date: '按年月日' }[this.mode]
    },
    demos() {
      return [
        {
          key: 'modal',
          name: '弹窗组件',
          desc: '可拖拽 / 调整尺寸',
          icon: 'block',
          action: () => { this.modalVisible = true }
        },
        {
          key: 'directive',
          name: '指令版弹窗',
          desc: 'v-drag / v-resize',
          icon: 'thunderbolt',
          action: () => { this.directiveModalVisible = true }
        },
        {
          key: 'iframe',
          name: 'iframe 弹窗',
          desc: '内嵌页面演示',
          icon: 'layout',
          action: () => { this.iframeModalVisible = true }
        },
        {
          key: 'linked',
          name: '联动表格弹窗',
          desc: '左右联动高亮',
          icon: 'table',
          action: () => { this.linkedTableModalVisible = true }
        },
        {
          key: 'ueditor',
          name: 'UEditor 弹窗',
          desc: '富文本 + 拖拽/缩放/全屏',
          icon: 'edit',
          action: () => { this.ueditorModalVisible = true }
        }
      ]
    }
  },
  methods: {
    echo(start, end) {
      // 模拟后端回填：只给字符串，组件按格式自动反推粒度并切换类型框
      this.startVal = start
      this.endVal = end
    },
    onModalSubmit(payload) {
      this.$message.success('弹窗提交：' + JSON.stringify(payload))
    }
  }
}
</script>

<style scoped>
.home {
  width: 100%;
}

/* 英雄区：大气渐变横幅（sky-from → sky-to），墨色文字 */
.hero {
  margin: -8px 0 32px;
  padding: 72px 48px;
  border-radius: var(--m-r-xxl);
  background: linear-gradient(160deg, var(--m-hero-sky-from) 0%, var(--m-hero-sky-to) 100%);
  border: 1px solid var(--m-hairline-soft);
  overflow: hidden;
}

.hero-inner {
  max-width: 640px;
}

.hero-eyebrow {
  display: inline-block;
  margin-bottom: 16px;
  color: rgba(10, 10, 10, 0.55);
}

.hero-title {
  margin: 0;
  font-size: 48px;
  line-height: 1.1;
  letter-spacing: -1px;
  font-weight: 600;
  color: var(--m-ink);
}

.hero-subtitle {
  margin: 20px 0 0;
  max-width: 520px;
  color: var(--m-slate);
  font-size: 18px;
  line-height: 1.5;
}

.hero-actions {
  margin-top: 32px;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

/* 通用面板：扁平卡片由全局 .ant-card 覆盖层接管，这里只管间距 */
.panel {
  margin-bottom: 20px;
}

.panel-title {
  font-weight: 600;
  color: var(--m-ink);
}

.panel-extra {
  color: var(--m-steel);
  font-size: 13px;
}

/* 演示卡片：Mintlify card-base + 薄荷绿点缀 */
.demo-card {
  display: flex;
  align-items: center;
  gap: 14px;
  height: 100%;
  padding: 16px;
  border: 1px solid var(--m-hairline);
  border-radius: var(--m-r-lg);
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
  background: var(--m-canvas);
}

.demo-card:hover {
  border-color: var(--m-mint);
  box-shadow: var(--m-shadow-2);
  transform: translateY(-2px);
}

.demo-icon {
  flex: none;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--m-r-md);
  font-size: 20px;
  color: var(--m-mint-deep);
  background: rgba(0, 212, 164, 0.1);
}

.demo-meta {
  min-width: 0;
}

.demo-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--m-ink);
}

.demo-desc {
  margin-top: 2px;
  font-size: 12px;
  color: var(--m-steel);
}

/* 日期区 */
.date-block {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

.date-divider {
  margin: 20px 0;
}

.date-result {
  color: var(--m-slate);
}

.date-result b {
  color: var(--m-ink);
}

.date-hint {
  color: var(--m-steel);
}

/* 材料份数区 */
.material-case {
  display: flex;
  align-items: center;
  gap: 12px;
}

.material-tip {
  margin-left: 4px;
  color: var(--m-stone);
  cursor: help;
}

.material-link {
  margin-left: 4px;
  font-size: 12px;
}

/* JSON 预览：深色文档风代码块 */
.material-json {
  margin: 8px 0 0;
  padding: 12px 14px;
  border-radius: var(--m-r-md);
  background: var(--m-surface-code);
  color: var(--m-on-dark);
  font-family: var(--m-font-mono);
  font-size: 13px;
}

@media (max-width: 768px) {
  .hero {
    padding: 48px 24px;
  }
  .hero-title {
    font-size: 36px;
  }
}
</style>
