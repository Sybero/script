// ==UserScript==
// @name         Discuz! 帖子预览
// @namespace    http://tampermonkey.net/
// @version      0.1.11
// @description  添加一个预览按钮到帖子列表中，并记录已预览的帖子
// @author       Your name
// @match        http://*/*
// @match        https://*/*
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const THREAD_SELECTOR = 'tbody[id^="normalthread_"]';
  const THREAD_CELL_SELECTOR = "th.new, td.new, th.common, td.common";
  const PREVIEW_MARK_ATTRIBUTE = "data-preview-button-added";
  const STORAGE_KEY = "discuz_previewed_posts";
  const previewStyle = document.createElement("style");
  previewStyle.textContent = `
    .discuz-preview-body > tr > td { padding: 0 !important; }
    .discuz-preview-panel { position: relative; width: 100%; max-width: 100%; box-sizing: border-box; border-bottom: 2px solid #f8f8f8; background: #fff; }
    .discuz-preview-toolbar { display: flex; align-items: center; gap: 6px; padding: 4px 8px; min-height: 40px; box-sizing: border-box; }
    .discuz-preview-toolbar a { display: inline-flex; align-items: center; min-height: 36px; padding: 0 8px; color: #1677ff; touch-action: manipulation; font-size: 13px; }
    .discuz-preview-status { min-width: 0; overflow: hidden; color: #666; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
    .discuz-preview-frame { display: block; width: 100%; max-width: 100%; height: 600px; border: 0; }
    .discuz-preview-drawer { position: fixed; inset: auto 0 0; z-index: 2147483646; height: min(95dvh); background: #fff; border-radius: 14px 14px 0 0; box-shadow: 0 -4px 20px rgba(0,0,0,.24); overflow: hidden; transform: translateY(100%); transition: transform .24s ease-out; }
    .discuz-preview-drawer.is-visible { transform: translateY(0); }
    .discuz-preview-drawer.is-closing { transform: translateY(100%); }
    .discuz-preview-drawer .discuz-preview-frame { height: calc(100% - 49px); min-height: 0; overflow: auto; }
    .discuz-preview-drawer-backdrop { position: fixed; inset: 0; z-index: 2147483645; background: rgba(0,0,0,0); transition: background .24s ease-out; }
    .discuz-preview-drawer-backdrop.is-visible { background: rgba(0,0,0,.35); }
    .discuz-preview-drawer-backdrop.is-closing { background: rgba(0,0,0,0); }
    .discuz-preview-drawer .discuz-preview-toolbar { position: sticky; top: 0; z-index: 1; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,.12); }
    .discuz-preview-close { margin-left: auto; min-width: 36px; min-height: 36px; border: 0; border-radius: 6px; background: #eee; font-size: 20px; touch-action: manipulation; }
  `;
  document.head.appendChild(previewStyle);
  let activeDrawer = null;

  function isMobileViewport() {
    const narrowViewport = window.matchMedia("(max-width: 767px)").matches;
    const touchPointer = window.matchMedia("(pointer: coarse)").matches;
    const touchDevice = navigator.maxTouchPoints > 0 || "ontouchstart" in window;
    return narrowViewport || (touchPointer && touchDevice);
  }

  function closeDrawer() {
    if (!activeDrawer) return;
    const drawer = activeDrawer;
    drawer.drawer.classList.remove("is-visible");
    drawer.drawer.classList.add("is-closing");
    drawer.backdrop.classList.remove("is-visible");
    drawer.backdrop.classList.add("is-closing");
    document.body.style.overflow = drawer.previousOverflow;
    window.removeEventListener("popstate", drawer.onPopState);
    window.removeEventListener("resize", drawer.syncViewport);
    window.visualViewport?.removeEventListener("resize", drawer.syncViewport);
    window.visualViewport?.removeEventListener("scroll", drawer.syncViewport);
    activeDrawer = null;
    window.setTimeout(() => {
      drawer.backdrop.remove();
      drawer.drawer.remove();
      drawer.onClose?.();
    }, 240);
  }

  function openDrawer(href, title, onClose) {
    closeDrawer();
    const backdrop = document.createElement("div");
    backdrop.className = "discuz-preview-drawer-backdrop";
    const drawer = document.createElement("section");
    drawer.className = "discuz-preview-drawer";
    drawer.setAttribute("role", "dialog");
    drawer.setAttribute("aria-label", title || "帖子预览");
    const toolbar = document.createElement("div");
    toolbar.className = "discuz-preview-toolbar";
    const status = document.createElement("span");
    status.className = "discuz-preview-status";
    status.textContent = "正在加载…";
    const openLink = document.createElement("a");
    openLink.href = href;
    openLink.target = "_blank";
    openLink.rel = "noopener noreferrer";
    openLink.textContent = "打开原帖";
    const closeButton = document.createElement("button");
    closeButton.className = "discuz-preview-close";
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "关闭预览");
    closeButton.textContent = "×";
    const iframe = document.createElement("iframe");
    iframe.className = "discuz-preview-frame";
    iframe.title = title || "帖子预览";
    iframe.loading = "eager";
    iframe.src = href;
    toolbar.append(status, openLink, closeButton);
    drawer.append(toolbar, iframe);
    document.body.append(backdrop, drawer);
    const entry = { backdrop, drawer, previousOverflow: document.body.style.overflow, onClose };
    entry.syncViewport = () => {
      const viewport = window.visualViewport;
      drawer.style.left = `${viewport?.offsetLeft ?? 0}px`;
      drawer.style.right = "auto";
      drawer.style.width = `${viewport?.width ?? window.innerWidth}px`;
      drawer.style.boxSizing = "border-box";
    };
    entry.syncViewport();
    window.addEventListener("resize", entry.syncViewport);
    window.visualViewport?.addEventListener("resize", entry.syncViewport);
    window.visualViewport?.addEventListener("scroll", entry.syncViewport);
    entry.onPopState = () => closeDrawer();
    activeDrawer = entry;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => {
      drawer.classList.add("is-visible");
      backdrop.classList.add("is-visible");
    });
    history.pushState({ discuzPreview: true }, "", `${location.href.split("#")[0]}#discuz-preview`);
    const finish = () => {
      if (activeDrawer === entry && location.hash === "#discuz-preview") history.back();
      else if (activeDrawer === entry) closeDrawer();
    };
    closeButton.addEventListener("click", finish);
    backdrop.addEventListener("click", finish);
    iframe.addEventListener("load", () => {
      status.textContent = "已加载";
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        iframeDoc.querySelectorAll('[id="hd"], [id^="hd"], [id$="hd"], .vwthd, .pls, .pattl, .authi').forEach((element) => element.remove());
      } catch (error) {
        status.textContent = "已加载";
      }
    });
    iframe.addEventListener("error", () => { status.textContent = "无法嵌入此帖子，请打开原帖"; });
    window.addEventListener("popstate", entry.onPopState);
    closeButton.focus();
  }

  // 检查是否为Discuz!论坛
  function isDiscuzForum() {
    // 检查特征1：页面上是否存在Discuz的特征meta标签
    const metaGenerator = document.querySelector('meta[name="generator"]');
    if (metaGenerator?.content?.toLowerCase().includes("discuz")) {
      return true;
    }

    // 检查特征2：是否存在Discuz特有的CSS类名
    if (document.querySelector("#ft.wp, .discuz_tips, .dz_chart, " + THREAD_SELECTOR)) {
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

  // 管理已预览帖子的存储
  const previewedPosts = {
    // 获取所有已预览的帖子
    getAll() {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const posts = stored ? JSON.parse(stored) : {};
        return posts && typeof posts === "object" && !Array.isArray(posts) ? posts : {};
      } catch (error) {
        console.warn("无法读取已预览帖子记录:", error);
        return {};
      }
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
    }
  };

  // 设置按钮为已预览状态
  function setButtonState(button, state) {
    const states = {
      preview: { text: "预览", background: "darkgray", opacity: "1", decoration: "none" },
      previewed: { text: "预览", background: "darkgray", opacity: "0.7", decoration: "line-through" },
      open: { text: "关闭", background: "red", opacity: "1", decoration: "none" },
    };
    const style = states[state];
    button.textContent = style.text;
    button.style.textDecoration = style.decoration;
    button.style.background = style.background;
    button.style.opacity = style.opacity;
    button.dataset.previewState = state;
  }

  // 创建预览按钮
  function createPreviewButton(thElement, tbody) {
    const postId = tbody.id.slice("normalthread_".length);
    const href = thElement.querySelector(":scope > a")?.href;
    if (!postId || !href) {
      return;
    }
    
    // 创建按钮元素
    const button = document.createElement("button");
    button.textContent = "预览";
    button.style.color = "#fff";
    button.style.borderRadius = "3px";
    button.style.border = "none";
    button.style.background = "darkgray";
    button.style.cursor = "pointer";
    button.type = "button";

    // 检查是否已预览过，设置相应的样式
    if (previewedPosts.isPostPreviewed(postId)) {
      setButtonState(button, "previewed");
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
        setButtonState(button, "previewed");
        return;
      }

      if (isMobileViewport()) {
        openDrawer(href, thElement.textContent.trim().slice(0, 80), () => {
          setButtonState(button, previewedPosts.isPostPreviewed(postId) ? "previewed" : "preview");
        });
        previewedPosts.markAsPreviewed(postId);
        setButtonState(button, "open");
        return;
      }

      // 创建新的tbody元素
      const newTbody = document.createElement("tbody");

      newTbody.dataset.previewBody = "true";
      newTbody.className = "discuz-preview-body";

      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = tbody.querySelector("tr")?.cells.length || 1;
      const panel = document.createElement("div");
      panel.className = "discuz-preview-panel";
      const iframeElement = document.createElement("iframe");
      iframeElement.src = `${href}`;
      iframeElement.title = "帖子预览";
      iframeElement.loading = "lazy";
      iframeElement.className = "discuz-preview-frame";

      // 监听iframe加载完成事件
      iframeElement.onload = function () {
        try {
          // 获取iframe中的文档对象
          const iframeDoc =
            iframeElement.contentDocument ||
            iframeElement.contentWindow.document;

          // 查找并移除id为hd或者以hd开头/结尾的元素
          iframeDoc.querySelectorAll('[id="hd"], [id^="hd"], [id$="hd"], .vwthd, .pls, .pattl, .authi').forEach((element) => {
            element.remove();
          });
        } catch (error) {
          console.warn("无法访问 iframe 内容，保留原始页面:", error);
        }
      };

      iframeElement.onerror = function () {
        console.warn("帖子 iframe 加载失败:", href);
      };

      panel.appendChild(iframeElement);
      cell.appendChild(panel);
      row.appendChild(cell);
      newTbody.appendChild(row);

      // 在原tbody后面插入新tbody
      tbody.parentNode.insertBefore(newTbody, tbody.nextSibling);

      // 保存新tbody的引用
      associatedTbody = newTbody;
      setButtonState(button, "open");
    });

    // 将按钮添加到th元素中
    thElement.insertBefore(button, thElement.firstChild);
  }

  // 处理帖子列表
  function processThreadList() {
    // 查找所有tbody元素,其id符合normalthread_数字格式
    const tbodies = document.querySelectorAll(THREAD_SELECTOR);

    tbodies.forEach((tbody) => {
      // 检查是否已经添加过按钮
      if (tbody.hasAttribute(PREVIEW_MARK_ATTRIBUTE)) {
        return;
      }

      // 在每个tbody中查找class为new或common的th元素
      const thElements = tbody.querySelectorAll(THREAD_CELL_SELECTOR);

      thElements.forEach((thElement) => {
        createPreviewButton(thElement, tbody);
      });

      // 标记已添加按钮
      tbody.setAttribute(PREVIEW_MARK_ATTRIBUTE, "true");
    });
  }

  // 初始处理
  processThreadList();

  // 监听页面变化
  const observer = new MutationObserver((mutations) => {
    let shouldProcess = false;

    mutations.forEach((mutation) => {
      // 检查是否有新的tbody添加
      if (mutation.addedNodes.length > 0) shouldProcess = true;
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
