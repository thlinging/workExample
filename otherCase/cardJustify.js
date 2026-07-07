/**
 * cardJustify.js
 * 卡片两端对齐布局工具（纯 ES5，兼容老旧浏览器，不依赖 gap / flex 的 space-between）
 *
 * 原理：
 *   1. 根据 容器宽度 / 卡片宽度 / 最小间隔，算出每行能放几个卡片；
 *   2. 把每行剩下的空隙均分给 (每行个数 - 1) 个间隔；
 *   3. 均分产生的余数像素（老浏览器对小数 margin 支持差）逐个补给前几个间隔，
 *      保证每行最后一个卡片严格贴住容器右边缘；
 *   4. 通过给每个卡片设置 margin-right（每行最后一个为 0）来实现；
 *   5. 监听 window resize（带防抖）自动重新计算。
 *
 * 使用示例：
 *   var handle = cardJustify.bind(document.getElementById('cardBox'), {
 *     cardWidth: 200,   // 卡片固定宽度（px）
 *     minGap: 16,       // 卡片之间允许的最小间隔（px）
 *     rowGap: 16        // 行与行之间的间隔（px），可省略，默认等于 minGap
 *   });
 *   // 卡片数量变化后手动刷新：
 *   handle.refresh();
 *   // 页面销毁时解绑：
 *   handle.destroy();
 */
(function (global) {
  'use strict';

  /**
   * 核心算法：计算每行个数和各个间隔的具体像素值
   * @param {Number} containerWidth 容器可用宽度（px）
   * @param {Number} cardWidth      卡片宽度（px）
   * @param {Number} minGap         最小间隔（px）
   * @returns {Object} { countPerRow: 每行个数, gaps: 长度为 countPerRow-1 的数组，每个间隔的像素值 }
   */
  function calcRowLayout(containerWidth, cardWidth, minGap) {
    // 容器连一个卡片都放不下时，也至少放一个
    var countPerRow = Math.floor((containerWidth + minGap) / (cardWidth + minGap));
    if (countPerRow < 1) {
      countPerRow = 1;
    }

    var gaps = [];
    if (countPerRow === 1) {
      return { countPerRow: 1, gaps: gaps };
    }

    // 该行卡片之外剩余的总空隙
    var totalSpace = containerWidth - countPerRow * cardWidth;
    var gapCount = countPerRow - 1;
    // 基础间隔取整，余数像素从左往右逐个 +1，保证总和精确等于 totalSpace
    var baseGap = Math.floor(totalSpace / gapCount);
    var remainder = totalSpace - baseGap * gapCount;

    for (var i = 0; i < gapCount; i++) {
      gaps.push(i < remainder ? baseGap + 1 : baseGap);
    }
    return { countPerRow: countPerRow, gaps: gaps };
  }

  /**
   * 获取容器的内容区宽度（去掉 padding 和边框）
   */
  function getInnerWidth(el) {
    var width = el.clientWidth; // clientWidth = 内容 + padding
    var style;
    if (global.getComputedStyle) {
      style = global.getComputedStyle(el, null);
      width -= (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
    } else if (el.currentStyle) { // IE8 及以下
      width -= (parseFloat(el.currentStyle.paddingLeft) || 0) + (parseFloat(el.currentStyle.paddingRight) || 0);
    }
    return width;
  }

  /**
   * 取容器内的元素子节点（跳过文本节点、注释节点）
   */
  function getChildren(container) {
    var result = [];
    var nodes = container.childNodes;
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].nodeType === 1) {
        result.push(nodes[i]);
      }
    }
    return result;
  }

  /**
   * 对容器内所有卡片应用一次两端对齐布局
   * @param {HTMLElement} container 卡片的父容器
   * @param {Object} options { cardWidth, minGap, rowGap }
   */
  function apply(container, options) {
    var cardWidth = options.cardWidth;
    var minGap = options.minGap;
    var rowGap = (typeof options.rowGap === 'number') ? options.rowGap : minGap;

    var cards = getChildren(container);
    if (cards.length === 0) {
      return;
    }

    var containerWidth = getInnerWidth(container);
    var layout = calcRowLayout(containerWidth, cardWidth, minGap);
    var countPerRow = layout.countPerRow;
    var gaps = layout.gaps;

    // 容器为 flex 布局：保证允许换行，间隔全部交给 margin 控制
    container.style.flexWrap = 'wrap';

    for (var i = 0; i < cards.length; i++) {
      var indexInRow = i % countPerRow;
      var isLastInRow = (indexInRow === countPerRow - 1) || (i === cards.length - 1);
      var isFirstRow = i < countPerRow;

      var style = cards[i].style;
      // 固定卡片宽度，禁止 flex 拉伸/压缩，否则实际宽度和计算用的 cardWidth 对不上
      style.flexGrow = '0';
      style.flexShrink = '0';
      style.flexBasis = cardWidth + 'px';
      style.width = cardWidth + 'px';

      style.marginRight = isLastInRow ? '0px' : gaps[indexInRow] + 'px';
      style.marginTop = isFirstRow ? '0px' : rowGap + 'px';
    }
  }

  /**
   * 简单防抖
   */
  function debounce(fn, wait) {
    var timer = null;
    return function () {
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(fn, wait);
    };
  }

  /**
   * 绑定：立即布局一次，并监听窗口尺寸变化自动重新布局
   * @returns {Object} { refresh: 手动刷新, destroy: 解绑事件 }
   */
  function bind(container, options) {
    var refresh = function () {
      apply(container, options);
    };
    var onResize = debounce(refresh, 100);

    refresh();

    if (global.addEventListener) {
      global.addEventListener('resize', onResize, false);
    } else if (global.attachEvent) { // IE8 及以下
      global.attachEvent('onresize', onResize);
    }

    return {
      refresh: refresh,
      destroy: function () {
        if (global.removeEventListener) {
          global.removeEventListener('resize', onResize, false);
        } else if (global.detachEvent) {
          global.detachEvent('onresize', onResize);
        }
      }
    };
  }

  var cardJustify = {
    calcRowLayout: calcRowLayout,
    apply: apply,
    bind: bind
  };

  // 同时支持 <script> 直接引入 和 CommonJS 引入
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = cardJustify;
  } else {
    global.cardJustify = cardJustify;
  }
})(typeof window !== 'undefined' ? window : this);
