/**
 * layui 2.4.5 表格：操作列「整列按需隐藏」案例（解决隐藏后表头/表体错位）
 *
 * 需求：每次切换分页 / 刷新时，判断当前页所有数据的操作列是否有按钮显示
 *      （任意一行有任意一个按钮就算有）；当整页都没有按钮时，隐藏操作列。
 *
 * 为什么不用 display:none 隐藏单元格：
 *   layui 的表头、表体是两个独立的 <table>，靠列宽一致来对齐。
 *   用 display:none 隐藏某列的 th/td 时，表格总宽不变，腾出的宽度会被
 *   浏览器按「内容」自动重排给其余列；表头是短标题、表体是长内容，
 *   两边重排结果不同 → 同一列表头/表体中心对不齐，居中内容就歪了。
 *
 * 正确做法：
 *   把列定义抽成「带操作列 / 不带操作列」两份，当整页有无按钮的状态发生
 *   翻转时，用 table.reload 只切换 cols（url、分页都保持不变）。layui 会
 *   把表头表体一起重新渲染、重新算宽，宽度天然一致，不会错位。
 *   代价：仅在「显隐状态翻转」的那一次会重新请求一次当前页数据（很少发生）。
 *
 * 全程不使用 ES6 语法（无 let/const、无箭头函数、无模板字符串）。
 */
layui.use(['table', 'jquery'], function () {
  var table = layui.table;
  var $ = layui.$;

  // 操作列当前是否在列配置中，作为「翻转」判断的标记
  var OPERATE_SHOWN = true;

  // 分页配置：每页条数默认值与可选项（重建时要原样带上，否则会被打回默认）
  var DEFAULT_LIMIT = 10;
  var LIMITS = [10, 20, 30, 50];

  // 从 layui 分页下拉框读取当前「每页条数」，重建时回放，避免切换条数被重置
  function getCurrentLimit(tableId, fallback) {
    var $sel = $('.layui-table-view[lay-id="' + tableId + '"] .layui-laypage-limits select');
    var v = $sel.length ? parseInt($sel.val(), 10) : NaN;
    return v > 0 ? v : fallback;
  }

  /* ------------------------------------------------------------------ *
   * ① 唯一的「按钮显示规则」——把你真实的业务条件写在这里
   *    返回这一行应该显示的按钮标识数组，空数组表示这一行没有按钮
   * ------------------------------------------------------------------ */
  function getRowBtns(d) {
    var btns = [];
    if (d.status === 1) {
      btns.push('edit'); // 例：状态为「启用」才能编辑
    }
    if (d.canDelete) {
      btns.push('del'); // 例：有删除权限
    }
    // ...继续补充你的其它按钮规则
    return btns;
  }

  /* ------------------------------------------------------------------ *
   * ② 操作列模板，复用同一份 getRowBtns 判断
   * ------------------------------------------------------------------ */
  function operateTpl(d) {
    var btns = getRowBtns(d);
    var html = '';
    if (indexOf(btns, 'edit') > -1) {
      html += '<a class="layui-btn layui-btn-xs" lay-event="edit">编辑</a>';
    }
    if (indexOf(btns, 'del') > -1) {
      html += '<a class="layui-btn layui-btn-xs layui-btn-danger" lay-event="del">删除</a>';
    }
    return html;
  }

  /* ------------------------------------------------------------------ *
   * ③ 列定义工厂：withOperate 决定是否带上操作列
   *    其它列照常配置；操作列只是「加 / 不加」到末尾
   * ------------------------------------------------------------------ */
  function buildCols(withOperate) {
    var cols = [
      { field: 'name', title: '名称', align: 'center' },
      { field: 'status', title: '状态', align: 'center', templet: function (d) {
        return d.status === 1 ? '启用' : '停用';
      } }
      // ...其它列
    ];
    if (withOperate) {
      cols.push({
        field: 'operate',
        title: '操作',
        width: 160,
        align: 'center',
        templet: function (d) {
          return operateTpl(d);
        }
      });
    }
    return [cols]; // 注意 layui 的 cols 是二维数组
  }

  /* ------------------------------------------------------------------ *
   * ④ 表格渲染
   *    切换列必须用 table.render 重建，不能用 table.reload：
   *    reload 内部用 $.extend(true,...) 深合并 cols，数组按下标合并，
   *    新 cols 变短时删不掉末尾的操作列（旧下标会被保留），导致“传了
   *    不含操作列的配置，操作列却还在”。render 是按传入配置从头重建，
   *    cols 给什么就是什么，删列才真正生效。
   * ------------------------------------------------------------------ */
  function onDone(res, curr, count) {
    // 当前页只要有一行有按钮就显示；整页都没有才隐藏
    var data = res.data || [];
    var hasBtn = some(data, function (d) {
      return getRowBtns(d).length > 0;
    });

    // 只有「显隐状态翻转」时才重建，避免每页都重渲染、也避免死循环
    if (hasBtn !== OPERATE_SHOWN) {
      // 同时回放当前页码 + 当前每页条数，否则切换条数会被打回默认
      renderTable(hasBtn, curr, getCurrentLimit('tb', DEFAULT_LIMIT));
    }
  }

  function renderTable(withOperate, curr, limit) {
    OPERATE_SHOWN = withOperate; // 先更新标记，重建触发的 onDone 不会再次进入
    table.render({
      elem: '#tb',
      id: 'tb',
      url: '/your/api', // 换成你的接口
      page: { curr: curr || 1 }, // 保持当前页码
      limit: limit || DEFAULT_LIMIT, // 保持当前每页条数
      limits: LIMITS, // 每页条数可选项（每次重建都要带上）
      cols: buildCols(withOperate),
      done: onDone
    });
  }

  // 首次渲染（带操作列，第 1 页，默认条数）
  renderTable(true, 1, DEFAULT_LIMIT);

  /* ------------------------------------------------------------------ *
   * 操作列按钮事件（示例）
   * ------------------------------------------------------------------ */
  table.on('tool(tb)', function (obj) {
    var d = obj.data;
    if (obj.event === 'edit') {
      layer.msg('编辑：' + d.name);
    } else if (obj.event === 'del') {
      layer.confirm('确定删除「' + d.name + '」？', function (index) {
        // ...调用删除接口后 table.reload('tb')
        layer.close(index);
      });
    }
  });

  /* ------------------------------------------------------------------ *
   * 兼容性小工具（避免依赖较新的数组方法，老环境也能跑）
   * ------------------------------------------------------------------ */
  function indexOf(arr, item) {
    for (var i = 0; i < arr.length; i++) {
      if (arr[i] === item) {
        return i;
      }
    }
    return -1;
  }

  function some(arr, fn) {
    for (var i = 0; i < arr.length; i++) {
      if (fn(arr[i], i)) {
        return true;
      }
    }
    return false;
  }
});
