// ==UserScript==
// @name         Discuz! 帖子预览
// @namespace    http://tampermonkey.net/
// @version      0.1.9
// @description  添加一个预览按钮到帖子列表中，并记录已预览的帖子
// @author       Your name
// @match        http://*/*
// @match        https://*/*
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  // 检查是否为Discuz!论坛
  function isDiscuzForum() {
    // 检查特征1：页面上是否存在Discuz的特征meta标签
    const metaGenerator = document.querySelector('meta[name="generator"]');
    if (metaGenerator && metaGenerator.content.toLowerCase().includes('discuz')) {
      return true;
    }

    // 检查特征2：是否存在Discuz特有的CSS类名
    if (document.querySelector('#ft.wp, .discuz_tips, .dz_chart')) {
      return true;
    }

    // 检查特征3：是否存在normalthread_前缀的tbody
    if (document.querySelector('tbody[id^="normalthread_"]')) {
      return true;
    }

    return false;
  }

  // 如果不是Discuz!论坛，直接返回
  if (!isDiscuzForum()) {
    return;
  }

  // 获取帖子列表宽度
  const getThreadListWidth = () => {
    const tbodies = document.querySelectorAll('tbody[id^="normalthread_"]');
    return tbodies[0]?.clientWidth || 938;
  };

  // 管理已预览帖子的存储
  const previewedPosts = {
    storageKey: 'discuz_previewed_posts',
    
    // 获取所有已预览的帖子
    getAll() {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : {};
    },
    
    // 检查帖子是否已预览
    isPostPreviewed(postId) {
      const posts = this.getAll();
      return !!posts[postId];
    },
    
    // 标记帖子为已预览
    markAsPreviewed(postId) {
      const posts = this.getAll();
      posts[postId] = Date.now();
      localStorage.setItem(this.storageKey, JSON.stringify(posts));
    },
    
    // 移除帖子的预览标记
    removePreviewMark(postId) {
      const posts = this.getAll();
      delete posts[postId];
      localStorage.setItem(this.storageKey, JSON.stringify(posts));
    }
  };

  // 设置按钮为已预览状态
  function setButtonPreviewedStyle(button) {
    button.textContent = "预览";
    button.style.textDecoration = "line-through";
    button.style.background = "darkgray";
    button.style.opacity = 0.7;
  }

  // 设置按钮为未预览状态
  function setButtonNormalStyle(button) {
    button.textContent = "预览";
    button.style.textDecoration = "none";
    button.style.background = "darkgray";
    button.style.opacity = 1;
  }

  // 创建预览按钮
  function createPreviewButton(thElement, tbody) {
    const postId = tbody.id.replace('normalthread_', '');
    
    // 创建按钮元素
    const button = document.createElement("button");
    button.textContent = "预览";
    button.style.color = "#fff";
    button.style.borderRadius = "3px";
    button.style.border = "none";
    button.style.background = "darkgray";
    button.style.cursor = "pointer";

    // 检查是否已预览过，设置相应的样式
    if (previewedPosts.isPostPreviewed(postId)) {
      setButtonPreviewedStyle(button);
    }

    // 用于存储关联的tbody引用
    let associatedTbody = null;

    // 添加点击事件
    button.addEventListener("click", function (e) {
      e.preventDefault();

      // 如果已经有关联的tbody，则移除它并重置状态
      if (associatedTbody) {
        associatedTbody.remove();
        associatedTbody = null;
        button.textContent = "预览";
        setButtonPreviewedStyle(button);
        previewedPosts.markAsPreviewed(postId);
        return;
      }

      // 获取th中a标签的href
      const a = thElement.querySelector(":scope > a");
      const href = a.href;

      // 创建新的tbody元素
      const newTbody = document.createElement("tbody");

      // 生成一个随机ID
      const randomId = "normalthread_" + Math.floor(Math.random() * 10000);
      newTbody.id = randomId;

      // 添加一个iframe到新tbody
      const iframeElement = document.createElement("iframe");
      iframeElement.src = `${href}`;
      iframeElement.style.height = "600px";
      iframeElement.style.width = `${getThreadListWidth()}px`;
      iframeElement.style.border = "none";
      iframeElement.style.borderBottom = "2px solid #F8F8F8";

      // 监听iframe加载完成事件
      iframeElement.onload = function () {
        try {
          // 获取iframe中的文档对象
          const iframeDoc =
            iframeElement.contentDocument ||
            iframeElement.contentWindow.document;

          // 查找并移除id为hd或者以hd开头/结尾的元素
          const hdElements = iframeDoc.querySelectorAll(
            '[id="hd"], [id^="hd"], [id$="hd"]',
          );
          hdElements.forEach((element) => {
            element.remove();
          });

          // 查找所有class为pls的元素
          const plsElements = iframeDoc.getElementsByClassName("pls");
          for (let element of plsElements) {
            element.style.display = "none"; // 隐藏元素
          }
        } catch (error) {
          console.log("无法访问iframe内容:", error);
        }
      };

      newTbody.appendChild(iframeElement);

      // 在原tbody后面插入新tbody
      tbody.parentNode.insertBefore(newTbody, tbody.nextSibling);

      // 保存新tbody的引用
      associatedTbody = newTbody;
      button.textContent = "关闭";
      button.style.background = "red";
    });

    // 将按钮添加到th元素中
    thElement.insertBefore(button, thElement.firstChild);
  }

  // 处理帖子列表
  function processThreadList() {
    // 查找所有tbody元素,其id符合normalthread_数字格式
    const tbodies = document.querySelectorAll('tbody[id^="normalthread_"]');

    tbodies.forEach((tbody) => {
      // 检查是否已经添加过按钮
      if (tbody.hasAttribute('data-preview-button-added')) {
        return;
      }

      // 在每个tbody中查找class为new或common的th元素
      const thElements = tbody.querySelectorAll("th.new, td.new, th.common, td.common");

      thElements.forEach((thElement) => {
        createPreviewButton(thElement, tbody);
      });

      // 标记已添加按钮
      tbody.setAttribute('data-preview-button-added', 'true');
    });
  }

  // 初始处理
  processThreadList();

  // 监听页面变化
  const observer = new MutationObserver((mutations) => {
    let shouldProcess = false;

    mutations.forEach((mutation) => {
      // 检查是否有新的tbody添加
      if (mutation.addedNodes) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeName === 'TBODY' && node.id && node.id.startsWith('normalthread_')) {
            shouldProcess = true;
          }
        });
      }
    });

    if (shouldProcess) {
      processThreadList();
    }
  });

  // 获取论坛列表容器
  const forumlistContainer = document.getElementById('threadlisttableid') || document.querySelector('table.datatable');
  if (forumlistContainer) {
    observer.observe(forumlistContainer, {
      childList: true,
      subtree: true
    });
  }
})();
