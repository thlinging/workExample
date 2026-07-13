<template>
  <div class="about">
    <a-card title="关于本项目" :bordered="false">
      <p>这是一个基于以下技术栈搭建的脚手架：</p>
      <ul>
        <li>Vue <a-tag color="green">2.6.2</a-tag></li>
        <li>Vue Router <a-tag color="blue">3.x</a-tag></li>
        <li>ant-design-vue <a-tag color="purple">1.7.8</a-tag></li>
        <li>@vue/cli-service <a-tag color="orange">4.5.x</a-tag></li>
        <li>babel-plugin-import 按需加载</li>
      </ul>

      <a-divider />

      <a-table
        :columns="columns"
        :data-source="data"
        :pagination="false"
        row-key="id"
      >
        <span slot="status" slot-scope="text">
          <a-tag :color="text === 'OK' ? 'green' : 'red'">{{ text }}</a-tag>
        </span>
      </a-table>
    </a-card>
  </div>
</template>

<script>
export default {
  name: 'About',
  data() {
    return {
      columns: [
        { title: '依赖', dataIndex: 'name', key: 'name' },
        { title: '版本', dataIndex: 'version', key: 'version' },
        {
          title: '状态',
          dataIndex: 'status',
          key: 'status',
          scopedSlots: { customRender: 'status' }
        }
      ],
      data: [
        { id: 1, name: 'vue', version: '2.6.2', status: 'OK' },
        { id: 2, name: 'ant-design-vue', version: '1.7.8', status: 'OK' },
        { id: 3, name: 'vue-router', version: '^3.5.3', status: 'OK' }
      ]
    }
  }
}
</script>

<style scoped>
.about {
  width: 100%;
}
</style>
