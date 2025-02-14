// ==UserScript==
// @name         Discuz! 帖子预览
// @namespace    http://tampermonkey.net/
// @version      0.1.2
// @description  添加一个预览按钮到帖子列表中
// @author       Your name
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  // 查找所有tbody元素,其id符合normalthread_数字格式
  const tbodies = document.querySelectorAll('tbody[id^="normalthread_"]');
  const width = tbodies[0]?.clientWidth || 938;

  tbodies.forEach((tbody) => {
    // 在每个tbody中查找class为new或common的th元素
    const thElements = tbody.querySelectorAll("th.new, th.common");

    thElements.forEach((thElement) => {
      // 创建按钮元素
      const button = document.createElement("button");
      button.textContent = "预览";
      button.style.marginLeft = "5px";
      button.style.border = "none";

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
          button.style.background = "rgb(107, 107, 107)";
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
        iframeElement.style.width = `${width}px`;
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
        button.style.background = 'red';

        console.log("已添加新的tbody:", randomId);
      });

      // 将按钮添加到th元素中
      // thElement.appendChild(button);
      thElement.insertBefore(button, thElement.firstChild);
    });
  });
})();
