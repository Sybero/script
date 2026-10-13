// ==UserScript==
// @name         触摸屏视频优化
// @namespace    https://github.com/Sybero/script
// @version      2.26
// @description  触摸屏视频播放手势支持，单指横滑调进度、双指横滑调倍速
// @author       Sybero (based on HeroChanSysu's original script)
// @match        https://*/*
// @match        http://*/*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function () {
    "use strict";

    const TouchGestureWhiteList = {
        "www.bilibili.com":{
            container:function(video_element,callback){
                var parent = video_element.parentElement;
                if(parent.classList.contains("bpx-player-video-wrap")){
                    if(tg_IsFullscreen()==true){
                        var root_element = seekGrandParentByClass(parent,"bpx-player-video-area");
                        var listen_element = seekGrandParentByClass(root_element,"video-container-v1");
                        callback(root_element,listen_element,{progress:true,speed:true,speedx4:true,speedx4single:true,state:true});
                    }
                    else{
                        var root_element = seekGrandParentByClass(parent,"bpx-player-video-area");
                        var listen_element = seekGrandParentByClass(root_element,"player-wrap");
                        callback(root_element,listen_element,{progress:true,speed:true,speedx4:true,speedx4single:true,state:true});
                    }
                }
                else{
                    callback(null,null,{progress:true,speed:true,speedx4:true,speedx4single:true,state:true});
                }
            },
        },
        "m.bilibili.com":{
            container:function(video_element,callback){
                var parent = video_element.parentElement;
                if(parent.classList.contains("mplayer-video-wrap")){
                    var root_element = seekGrandParentByClass(parent,"mplayer");
                    callback(root_element,root_element,{progress:true,speed:true,speedx4:true,speedx4single:true,state:true});
                }
                else{
                    callback(null,null,{progress:true,speed:true,speedx4:true,speedx4single:true,state:true});
                }
            },
        },
        "weibo.com":{
            container:function(video_element,callback){
                callback(null,null,{progress:true,speed:true,speedx4:true,speedx4single:true,state:true});
            },
        },
        "www.youtube.com":{
            container:function(video_element,callback){
                var parent = video_element.parentElement;
                if(parent.classList.contains("html5-video-container")){
                    var root_element = seekGrandParentByClass(parent,"ytd-player");
                    callback(root_element,root_element,{progress:true,speed:true,speedx4:true,speedx4single:true,state:true});
                }
                else{
                    callback(null,null,{progress:true,speed:true,speedx4:true,speedx4single:true,state:true});
                }
            },
        },
        "m.youtube.com":{
            container:function(video_element,callback){
                var parent = video_element.parentElement;
                if(parent.classList.contains("html5-video-container")){
                    var root_element = seekGrandParentByClass(parent,"player-container");
                    var listen_element = root_element && root_element.querySelector(".player-controls-background");
                    callback(root_element,listen_element || root_element,{progress:true,speed:true,speedx4:true,speedx4single:true,state:true});

                }
                else{
                    callback(null,null,{progress:true,speed:true,speedx4:true,speedx4single:true,state:true});
                }
            },
        },
        "v.youku.com":{
            container:function(video_element,callback){
                var parent = video_element.parentElement;
                if(parent.classList.contains("youku-film-player")){
                    var root_element = seekGrandParentByClass(parent,"youku-film-player");
                    callback(root_element,root_element,{progress:true,speed:true,speedx4:true,speedx4single:true,state:true});
                }
                else if(parent.classList.contains("video-layer")){
                    var root_element = seekGrandParentByClass(parent,"youku-player");
                    callback(root_element,root_element,{progress:true,speed:true,speedx4:true,speedx4single:true,state:true});
                }
                else{
                    callback(null,null,{progress:true,speed:true,speedx4:true,speedx4single:true,state:true});
                }
            },
        },
        "www.facebook.com":{
            container:function(video_element,callback){
                callback(null,null,{progress:true,speed:true,speedx4:true,speedx4single:true,state:true});
            },
        },
        "v.qq.com":{
            container:function(video_element,callback){
                var parent = video_element.parentElement;
                if(parent.classList.contains("txp_video_container")){
                    var root_element = seekGrandParentByClass(parent,"txp_player");
                    callback(root_element,root_element,{progress:true,speed:true,speedx4:true,speedx4single:true,state:true});
                }
                else{
                    callback(null,null,{progress:true,speed:true,speedx4:true,speedx4single:true,state:true});
                }
            },
        }

    };



    const defaults = {
        global: {
            gSwitchState: true, gSwitchProgress: true, gSwitchSpeed: true,
            gActivationMode: "auto",
            gSwitchSpeedX4: true, gSwitchSpeedX4Sigle: false, gSelectToastPos: "middle"
        },
        website: {}
    };
    const siteDefaults = {
        wSwitchEnable: true, wSwitchState: true, wSwitchProgress: true,
        wSwitchSpeed: true, wSwitchSpeedX4: true, wSwitchSpeedX4Sigle: true,
        wSwitchForbidScrollNFS: false
    };
    const host = location.hostname;
    const instances = new Map();
    const touchActionOwners = new Map();
    let orientationOwner = null;
    let settings = loadSettings();
    if (!settings.website[host] && settings.website[location.host]) {
        settings.website[host] = { ...settings.website[location.host] };
    }
    let settingsPanel = null;
    let discoveryTimer = null;

    function loadSettings() {
        try {
            const stored = GM_getValue("tg_setting", "{}");
            const value = typeof stored === "string" ? JSON.parse(stored) : stored;
            const result = { global: { ...defaults.global }, website: {} };
            if (!value || typeof value !== "object") return result;
            for (const key of Object.keys(defaults.global)) {
                if (typeof value.global?.[key] === typeof defaults.global[key]) {
                    result.global[key] = value.global[key];
                }
            }
            if (!["top", "middle", "bottom"].includes(result.global.gSelectToastPos)) {
                result.global.gSelectToastPos = "middle";
            }
            if (!["auto", "enabled", "disabled"].includes(result.global.gActivationMode)) {
                result.global.gActivationMode = "auto";
            }
            for (const [domain, entry] of Object.entries(value.website || {})) {
                if (!entry || typeof entry !== "object") continue;
                const site = { ...siteDefaults };
                for (const key of Object.keys(siteDefaults)) {
                    if (typeof entry[key] === "boolean") site[key] = entry[key];
                }
                result.website[domain] = site;
            }
            return result;
        } catch (error) {
            console.warn("[TouchGesture] Invalid saved settings; using defaults.", error);
            return { global: { ...defaults.global }, website: {} };
        }
    }

    function hasTouchCapability() {
        return (navigator.maxTouchPoints || 0) > 0 ||
            matchMedia("(pointer: coarse)").matches || matchMedia("(any-pointer: coarse)").matches;
    }

    function activationMode() {
        return settings.global.gActivationMode;
    }

    function shouldStart(mode = activationMode()) {
        return mode === "enabled" || (mode === "auto" && hasTouchCapability());
    }

    function optionsFor(video) {
        const site = settings.website[host] || siteDefaults;
        const options = {
            enabled: site.wSwitchEnable,
            progress: settings.global.gSwitchProgress && site.wSwitchProgress,
            speed: settings.global.gSwitchSpeed && site.wSwitchSpeed,
            speedx4: settings.global.gSwitchSpeedX4 && site.wSwitchSpeedX4,
            speedx4single: settings.global.gSwitchSpeedX4Sigle && site.wSwitchSpeedX4Sigle,
            state: settings.global.gSwitchState && site.wSwitchState,
            forbidScrollNFS: site.wSwitchForbidScrollNFS
        };
        const adapter = TouchGestureWhiteList[host];
        if (video.parentElement && adapter) adapter.container(video, (root, listener, supported) => {
            for (const key of ["progress", "speed", "speedx4", "speedx4single", "state"]) {
                if (supported?.[key] === false) options[key] = false;
            }
        });
        return options;
    }

    function seekGrandParentByClass(child, name) {
        return child?.closest("." + name) || null;
    }

    function tg_IsFullscreen() {
        return !!fullscreenElement();
    }

    function fullscreenElement() {
        return document.fullscreenElement || document.webkitFullscreenElement || null;
    }

    function rootsFor(video) {
        const fullscreen = fullscreenElement();
        if (fullscreen?.contains(video)) return [fullscreen, fullscreen];
        let roots = null;
        const adapter = TouchGestureWhiteList[host];
        if (video.parentElement && adapter) adapter.container(video, (root, listener) => {
            if (root?.contains(video) && listener?.contains(video)) roots = [root, listener];
        });
        // Mobile YouTube's listener overlays the video rather than containing it.
        if (!roots && host === "m.youtube.com") {
            const root = video.closest(".player-container");
            if (root) roots = [root, root];
        }
        return roots || [video.parentElement || video, video.parentElement || video];
    }

    function timeText(seconds) {
        if (!Number.isFinite(seconds)) return "直播";
        const value = Math.max(0, Math.floor(seconds));
        const hours = Math.floor(value / 3600);
        const minutes = Math.floor(value / 60) % 60;
        const secs = String(value % 60).padStart(2, "0");
        return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${secs}` : `${minutes}:${secs}`;
    }

    function seekTarget(video, target) {
        if (!Number.isFinite(target)) return null;
        const ranges = video.seekable;
        if (ranges?.length) {
            let closest = null;
            for (let i = 0; i < ranges.length; i++) {
                const start = ranges.start(i);
                const end = Math.max(start, ranges.end(i) - 0.05);
                const candidate = Math.max(start, Math.min(end, target));
                if (closest === null || Math.abs(candidate - target) < Math.abs(closest - target)) {
                    closest = candidate;
                }
            }
            return closest;
        }
        if (Number.isFinite(video.duration) && video.duration > 0) {
            return Math.max(0, Math.min(video.duration - 0.05, target));
        }
        return null;
    }

    function unlockOrientation() {
        if (!orientationOwner) return;
        const owner = orientationOwner;
        orientationOwner = null;
        owner.orientationRequest++;
        owner.unlock.hidden = true;
        try { screen.orientation?.unlock?.(); } catch (_) { /* Platform does not support unlocking. */ }
    }

    class VideoGesture {
        constructor(video) {
            this.video = video;
            this.gesture = null;
            this.blockedTouches = false;
            this.longPressTimer = null;
            this.toastTimer = null;
            this.orientationRequest = 0;
            this.destroyed = false;
            this.root = null;
            this.listener = null;
            this.onStart = this.onStart.bind(this);
            this.onMove = this.onMove.bind(this);
            this.onEnd = this.onEnd.bind(this);
            this.onCancel = () => { this.finish(false); this.blockedTouches = false; };
            this.onContextMenu = event => {
                if (this.gesture?.temporaryRate) event.preventDefault();
            };
            this.onSourceChange = () => {
                this.finish(false);
                this.refresh();
                this.layout();
                this.lockOrientation();
            };
            this.toast = document.createElement("div");
            this.toast.className = "TouchGesture_Toast";
            this.toast.hidden = true;
            this.settingsButton = document.createElement("button");
            this.settingsButton.type = "button";
            this.settingsButton.className = "TouchGesture_SettingsButton";
            this.settingsButton.textContent = "⚙";
            this.settingsButton.setAttribute("aria-label", "视频手势设置");
            this.settingsButton.addEventListener("click", event => {
                event.stopPropagation();
                openSettings();
            });
            this.unlock = document.createElement("button");
            this.unlock.type = "button";
            this.unlock.className = "TouchGesture_Unlock";
            this.unlock.textContent = "解除横屏锁定";
            this.unlock.hidden = true;
            this.unlock.addEventListener("click", event => {
                event.stopPropagation();
                unlockOrientation();
            });
            video.addEventListener("emptied", this.onSourceChange);
            video.addEventListener("loadedmetadata", this.onSourceChange);
            try {
                this.refresh();
            } catch (error) {
                this.destroy();
                throw error;
            }
        }

        refresh() {
            if (this.destroyed) return;
            const options = optionsFor(this.video);
            const [root, listener] = rootsFor(this.video);
            if (this.listener && (this.root !== root || this.listener !== listener ||
                JSON.stringify(options) !== JSON.stringify(this.options) ||
                this.inFullscreen !== !!fullscreenElement()?.contains(this.video))) {
                this.finish(false);
                this.detach();
            }
            this.options = options;
            this.inFullscreen = !!fullscreenElement()?.contains(this.video);
            if (!options.enabled) {
                this.detach();
                return;
            }
            if (this.listener) return;
            this.root = root;
            this.listener = listener;
            if (options.progress || options.speed || options.forbidScrollNFS) {
                let entry = touchActionOwners.get(listener);
                if (!entry) {
                    entry = { original: listener.style.touchAction, applied: "", owners: new Set() };
                    touchActionOwners.set(listener, entry);
                }
                entry.owners.add(this);
                entry.applied = [...entry.owners].some(owner => owner.options.forbidScrollNFS &&
                    !fullscreenElement()?.contains(owner.video)) ? "none" : "pan-y";
                listener.style.touchAction = entry.applied;
            }
            this.listener.addEventListener("touchstart", this.onStart, { passive: true });
            this.listener.addEventListener("touchmove", this.onMove, { passive: false });
            this.listener.addEventListener("touchend", this.onEnd);
            this.listener.addEventListener("touchcancel", this.onCancel);
            this.listener.addEventListener("contextmenu", this.onContextMenu);
            const overlayHost = fullscreenElement()?.contains(this.video) ? this.root : (document.body || this.root);
            overlayHost.append(this.toast, this.settingsButton, this.unlock);
            for (const element of [this.toast, this.settingsButton, this.unlock]) {
                // The top layer avoids transformed ancestors changing fixed coordinates.
                if (typeof element.togglePopover === "function") element.setAttribute("popover", "manual");
            }
            this.layout();
        }

        detach() {
            if (this.listener) {
                const entry = touchActionOwners.get(this.listener);
                if (entry) {
                    entry.owners.delete(this);
                    if (!entry.owners.size) {
                        if (this.listener.style.touchAction === entry.applied) this.listener.style.touchAction = entry.original;
                        touchActionOwners.delete(this.listener);
                    } else {
                        entry.applied = [...entry.owners].some(owner => owner.options.forbidScrollNFS &&
                            !fullscreenElement()?.contains(owner.video)) ? "none" : "pan-y";
                        this.listener.style.touchAction = entry.applied;
                    }
                }
                this.listener.removeEventListener("touchstart", this.onStart);
                this.listener.removeEventListener("touchmove", this.onMove);
                this.listener.removeEventListener("touchend", this.onEnd);
                this.listener.removeEventListener("touchcancel", this.onCancel);
                this.listener.removeEventListener("contextmenu", this.onContextMenu);
            }
            this.listener = null;
            this.root = null;
            this.toast.remove();
            this.settingsButton.remove();
            this.unlock.remove();
            if (orientationOwner === this) unlockOrientation();
        }

        accepts(event) {
            if (!this.options.enabled || !this.video.isConnected) return false;
            const path = event.composedPath?.() || [event.target];
            if (path.some(element => element.matches?.(
                "button,a,input,select,textarea,[contenteditable],[role=button],[role=slider]," +
                ".TouchGesture_SettingsPanel,[class*=progress],[class*=slider]"
            ))) return false;
            const touch = event.touches[0];
            if (!touch) return false;
            const rect = this.video.getBoundingClientRect();
            if (!rect.width || !rect.height || touch.clientX < rect.left || touch.clientX > rect.right ||
                touch.clientY < rect.top || touch.clientY > rect.bottom) return false;
            // Shared containers must dispatch to only one visible video.
            const candidates = [...instances.values()].filter(instance => {
                if (!instance.options.enabled || instance.listener !== this.listener) return false;
                const bounds = instance.video.getBoundingClientRect();
                return bounds.width && bounds.height && touch.clientX >= bounds.left &&
                    touch.clientX <= bounds.right && touch.clientY >= bounds.top && touch.clientY <= bounds.bottom;
            });
            candidates.sort((a, b) => Number(b.video === event.target) - Number(a.video === event.target) ||
                Number(a.video.paused) - Number(b.video.paused));
            return !candidates.length || candidates[0] === this;
        }

        onStart(event) {
            if (this.blockedTouches) return;
            if (this.gesture) {
                // Adding a finger may switch a pending single-finger gesture to two fingers.
                if (this.gesture.mode === "pending" && this.gesture.ids.length === 1 &&
                    event.touches.length === 2 && this.closeFingers(event.touches)) {
                    clearTimeout(this.longPressTimer);
                    this.gesture.ids = Array.from(event.touches, touch => touch.identifier);
                    this.gesture.x = event.touches[0].clientX;
                    this.gesture.y = event.touches[0].clientY;
                    if (this.options.speedx4) this.temporaryRate();
                } else {
                    this.finish(false);
                    this.blockedTouches = true;
                }
                return;
            }
            if (!this.accepts(event) || !Number.isFinite(this.video.currentTime) ||
                !(this.video.currentSrc || this.video.src || this.video.srcObject)) return;
            if (event.touches.length > 2 || (event.touches.length === 2 && !this.closeFingers(event.touches))) return;
            const touch = event.touches[0];
            this.gesture = {
                ids: Array.from(event.touches, point => point.identifier),
                x: touch.clientX, y: touch.clientY, mode: "pending",
                originalRate: this.video.playbackRate, startTime: this.video.currentTime,
                target: null, temporaryRate: false
            };
            if (event.touches.length === 2) {
                if (this.options.speedx4) this.temporaryRate();
            } else if ((this.options.speedx4 && this.options.speedx4single) || this.options.state) {
                this.longPressTimer = setTimeout(() => {
                    if (!this.gesture || this.gesture.mode !== "pending") return;
                    if (this.options.speedx4 && this.options.speedx4single) {
                        this.gesture.mode = "hold";
                        this.temporaryRate();
                    } else {
                        this.showToast(`${timeText(this.video.currentTime)} / ${timeText(this.video.duration)}`);
                    }
                }, 500);
            }
        }

        closeFingers(touches) {
            const rect = this.video.getBoundingClientRect();
            return Math.hypot(touches[0].clientX - touches[1].clientX,
                touches[0].clientY - touches[1].clientY) <= Math.max(rect.width, rect.height) / 2;
        }

        setRate(rate) {
            try {
                this.video.playbackRate = rate;
                return true;
            } catch (_) {
                this.showToast("此播放器不支持该倍速");
                return false;
            }
        }

        temporaryRate() {
            if (this.setRate(4)) {
                this.gesture.temporaryRate = true;
                this.showToast("4 倍速播放", "top");
            }
        }

        restoreRate() {
            if (this.gesture?.temporaryRate) {
                this.setRate(this.gesture.originalRate);
                this.gesture.temporaryRate = false;
            }
        }

        onMove(event) {
            const gesture = this.gesture;
            if (!gesture) return;
            if (event.touches.length !== gesture.ids.length ||
                !gesture.ids.every(id => Array.from(event.touches).some(touch => touch.identifier === id))) {
                this.finish(false);
                this.blockedTouches = !!event.touches.length;
                return;
            }
            const touch = Array.from(event.touches).find(point => point.identifier === gesture.ids[0]);
            const dx = touch.clientX - gesture.x;
            const dy = touch.clientY - gesture.y;
            const rect = this.video.getBoundingClientRect();
            if (gesture.mode === "pending") {
                if (Math.hypot(dx, dy) < Math.max(10, Math.min(24, rect.width / 30))) return;
                clearTimeout(this.longPressTimer);
                if (Math.abs(dy) >= Math.abs(dx)) {
                    this.restoreRate();
                    if (this.options.forbidScrollNFS && !tg_IsFullscreen()) {
                        gesture.mode = "vertical";
                        this.toast.hidden = true;
                    } else {
                        this.finish(false);
                    }
                    if (gesture.mode === "vertical" && event.cancelable) event.preventDefault();
                    return;
                }
                this.restoreRate();
                gesture.mode = gesture.ids.length === 1 ? "seek" : "speed";
                if ((gesture.mode === "seek" && !this.options.progress) ||
                    (gesture.mode === "speed" && !this.options.speed)) {
                    this.finish(false);
                    return;
                }
            }
            // Do not commit if the browser already took ownership of this gesture.
            if (!event.cancelable) {
                this.finish(false);
                return;
            }
            event.preventDefault();
            if (gesture.mode === "seek") {
                // Linear mapping avoids exponential jumps on long videos.
                const span = Number.isFinite(this.video.duration) ? Math.min(240, this.video.duration) : 240;
                gesture.target = seekTarget(this.video, gesture.startTime + dx / Math.max(1, rect.width) * span);
                if (gesture.target === null) {
                    this.finish(false);
                    return;
                }
                const delta = Math.round(gesture.target - gesture.startTime);
                this.showToast(`${timeText(gesture.target)} (${delta >= 0 ? "+" : ""}${delta}s)`);
            } else if (gesture.mode === "speed") {
                const steps = Math.sign(dx) * Math.round(Math.abs(dx) / Math.max(1, rect.width) * 10);
                gesture.target = Math.max(0.25, Math.min(4, gesture.originalRate + steps * 0.25));
                this.showToast(`倍速 × ${Number(gesture.target.toFixed(2))}`);
            }
        }

        onEnd(event) {
            if (!event.touches?.length) this.blockedTouches = false;
            if (!this.gesture) return;
            // Any finger leaving ends the whole gesture; remaining fingers cannot re-commit it.
            if (Array.from(event.changedTouches || []).some(touch => this.gesture.ids.includes(touch.identifier))) {
                this.finish(true);
                this.blockedTouches = !!event.touches?.length;
            }
        }

        finish(commit) {
            clearTimeout(this.longPressTimer);
            const gesture = this.gesture;
            if (!gesture) return;
            this.restoreRate();
            if (commit && gesture.target !== null) {
                if (gesture.mode === "seek") {
                    const target = seekTarget(this.video, gesture.target);
                    if (target !== null) {
                        try { this.video.currentTime = target; }
                        catch (_) { this.showToast("此视频暂时无法跳转"); }
                    }
                } else if (gesture.mode === "speed") {
                    this.setRate(gesture.target);
                }
            }
            this.gesture = null;
            clearTimeout(this.toastTimer);
            this.toastTimer = setTimeout(() => { this.toast.hidden = true; }, 800);
        }

        showToast(text, position = settings.global.gSelectToastPos) {
            clearTimeout(this.toastTimer);
            this.toast.textContent = text;
            this.toast.dataset.position = position;
            this.toast.hidden = false;
            this.layout();
        }

        layout() {
            if (!this.root) return;
            const rect = this.video.getBoundingClientRect();
            // Fixed coordinates use the same viewport coordinate system as clientX/clientY.
            this.toast.style.left = `${rect.left + rect.width / 2}px`;
            const ratio = this.toast.dataset.position === "top" ? 0.18 :
                this.toast.dataset.position === "bottom" ? 0.82 : 0.5;
            this.toast.style.top = `${rect.top + rect.height * ratio}px`;
            this.settingsButton.style.left = `${Math.max(rect.left, rect.right - 42)}px`;
            this.settingsButton.style.top = `${rect.top + 8}px`;
            this.settingsButton.hidden = rect.width < 120 || rect.height < 80;
            this.unlock.style.left = `${rect.left + rect.width / 2}px`;
            this.unlock.style.top = `${rect.top + rect.height * 0.7}px`;
            for (const element of [this.toast, this.settingsButton, this.unlock]) {
                if (typeof element.togglePopover === "function") {
                    try { element.togglePopover(!element.hidden); } catch (_) { /* Detached player; discovery will retry. */ }
                }
            }
        }

        async lockOrientation() {
            if (orientationOwner || !this.options.enabled || !fullscreenElement()?.contains(this.video) ||
                !(this.video.videoWidth / this.video.videoHeight > 1.3) ||
                !(navigator.maxTouchPoints > 0) || typeof screen.orientation?.lock !== "function") return;
            const request = ++this.orientationRequest;
            orientationOwner = this;
            try {
                await screen.orientation.lock("landscape");
                if (this.destroyed || request !== this.orientationRequest ||
                    !fullscreenElement()?.contains(this.video)) {
                    if (orientationOwner === this) unlockOrientation();
                    else if (!orientationOwner) {
                        try { screen.orientation?.unlock?.(); } catch (_) { /* Optional platform API. */ }
                    }
                    return;
                }
                this.unlock.hidden = false;
                this.layout();
            } catch (_) {
                if (orientationOwner === this) orientationOwner = null;
                this.unlock.hidden = true;
            }
        }

        destroy() {
            this.finish(false);
            this.destroyed = true;
            this.orientationRequest++;
            clearTimeout(this.longPressTimer);
            clearTimeout(this.toastTimer);
            this.detach();
            this.video.removeEventListener("emptied", this.onSourceChange);
            this.video.removeEventListener("loadedmetadata", this.onSourceChange);
        }
    }

    function openSettings() {
        if (settingsPanel) {
            settingsPanel.remove();
            settingsPanel = null;
        }
        for (const instance of instances.values()) instance.finish(false);
        const panel = document.createElement("form");
        panel.className = "TouchGesture_SettingsPanel";
        panel.setAttribute("aria-label", "视频手势设置");
        const title = document.createElement("h2");
        title.textContent = `视频手势设置 · ${host}`;
        panel.append(title);
        const activationLabel = document.createElement("label");
        activationLabel.textContent = "运行模式 ";
        const activation = document.createElement("select");
        for (const [value, text] of [["auto", "自动（检测触摸设备）"], ["enabled", "始终启用"], ["disabled", "始终禁用"]]) {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = text;
            activation.append(option);
        }
        activation.value = settings.global.gActivationMode;
        activationLabel.append(activation);
        panel.append(activationLabel);
        const status = document.createElement("small");
        status.textContent = hasTouchCapability() ? "已检测到触摸或粗指针输入。" : "未检测到触摸输入，自动模式将休眠。";
        panel.append(status);
        const fields = [
            ["全局", settings.global, {
                gSwitchProgress: "单指横滑调进度", gSwitchSpeed: "双指横滑调倍速",
                gSwitchSpeedX4: "双指临时 4 倍速", gSwitchSpeedX4Sigle: "单指长按临时 4 倍速",
                gSwitchState: "长按显示播放时间"
            }],
            ["当前站点", { ...siteDefaults, ...settings.website[host] }, {
                wSwitchEnable: "启用本站手势", wSwitchProgress: "单指横滑调进度",
                wSwitchSpeed: "双指横滑调倍速", wSwitchSpeedX4: "双指临时 4 倍速",
                wSwitchSpeedX4Sigle: "允许单指长按 4 倍速", wSwitchState: "长按显示播放时间",
                wSwitchForbidScrollNFS: "页面内视频纵滑时阻止页面滚动"
            }]
        ];
        for (const [heading, values, labels] of fields) {
            const fieldset = document.createElement("fieldset");
            const legend = document.createElement("legend");
            legend.textContent = heading;
            fieldset.append(legend);
            for (const [key, text] of Object.entries(labels)) {
                const label = document.createElement("label");
                const input = document.createElement("input");
                input.type = "checkbox";
                input.name = key;
                input.checked = values[key];
                label.append(input, document.createTextNode(text));
                fieldset.append(label);
            }
            panel.append(fieldset);
        }
        const positionLabel = document.createElement("label");
        positionLabel.textContent = "提示位置 ";
        const position = document.createElement("select");
        for (const [value, text] of [["top", "顶部"], ["middle", "中部"], ["bottom", "底部"]]) {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = text;
            position.append(option);
        }
        position.value = settings.global.gSelectToastPos;
        positionLabel.append(position);
        panel.append(positionLabel);
        const actions = document.createElement("div");
        for (const text of ["保存", "恢复默认", "关闭"]) {
            const button = document.createElement("button");
            button.type = text === "保存" ? "submit" : "button";
            button.textContent = text;
            if (text === "关闭") button.onclick = () => { panel.remove(); settingsPanel = null; };
            if (text === "恢复默认") button.onclick = () => {
                settings = { global: { ...defaults.global }, website: {} };
                GM_setValue("tg_setting", JSON.stringify(settings));
                discover();
                openSettings();
            };
            actions.append(button);
        }
        panel.append(actions);
        panel.addEventListener("submit", event => {
            event.preventDefault();
            settings.website[host] = { ...siteDefaults, ...settings.website[host] };
            for (const input of panel.querySelectorAll("input")) {
                (input.name.startsWith("g") ? settings.global : settings.website[host])[input.name] = input.checked;
            }
            settings.global.gSelectToastPos = position.value;
            settings.global.gActivationMode = activation.value;
            GM_setValue("tg_setting", JSON.stringify(settings));
            if (shouldStart()) startRuntime();
            panel.remove();
            settingsPanel = null;
        });
        (fullscreenElement() || document.body).append(panel);
        settingsPanel = panel;
        panel.querySelector("input")?.focus();
    }

    function discover() {
        for (const [video, instance] of instances) {
            if (!video.isConnected) {
                instance.destroy();
                instances.delete(video);
            }
        }
        const selector = host === "www.bilibili.com" ? "video,bwp-video" : "video";
        for (const video of document.querySelectorAll(selector)) {
            // A custom tag is useful only if it exposes the media API.
            if (typeof video.playbackRate !== "number" || typeof video.currentTime !== "number") continue;
            try {
                if (!instances.has(video)) instances.set(video, new VideoGesture(video));
                else { instances.get(video).refresh(); instances.get(video).layout(); }
            } catch (error) {
                console.warn("[TouchGesture] Player initialization failed; will retry.", error);
            }
        }
    }

    function scheduleDiscovery() {
        if (discoveryTimer !== null) return;
        discoveryTimer = setTimeout(() => {
            discoveryTimer = null;
            discover();
        }, 100);
    }

    GM_addStyle(`
        .TouchGesture_Toast { inset:auto; margin:0; border:0; width:max-content; position:fixed; transform:translate(-50%,-50%); z-index:2147483647;
            padding:12px 18px; border-radius:10px; background:rgba(0,0,0,.78); color:white;
            font:16px/1.4 system-ui,sans-serif; pointer-events:none; white-space:nowrap; }
        .TouchGesture_SettingsButton,.TouchGesture_Unlock { inset:auto !important; margin:0 !important; box-sizing:border-box !important; width:36px !important; height:36px !important; min-width:36px !important; min-height:36px !important; max-width:36px !important; max-height:36px !important; padding:0 !important; position:fixed !important; z-index:2147483647 !important; display:block !important; border:0 !important; border-radius:8px !important; background:rgba(0,0,0,.65) !important; color:white !important; font:20px/36px system-ui,sans-serif !important; text-align:center !important; cursor:pointer !important; }
        .TouchGesture_Unlock { transform:translateX(-50%) !important; width:110px !important; min-width:110px !important; max-width:110px !important; font-size:13px !important; }
        .TouchGesture_SettingsPanel { position:fixed; z-index:2147483647; left:50%; top:50%;
            transform:translate(-50%,-50%); box-sizing:border-box; width:min(420px,92vw);
            max-height:85vh; overflow:auto; padding:18px; border-radius:12px; background:#202124;
            color:#fff; font:14px/1.6 system-ui,sans-serif; box-shadow:0 4px 30px #0008; }
        .TouchGesture_SettingsPanel h2 { font-size:18px; color:inherit; }
        .TouchGesture_SettingsPanel label { display:block; color:inherit; }
        .TouchGesture_SettingsPanel input { margin:0 8px 0 0; }
        .TouchGesture_SettingsPanel button { margin:12px 8px 0 0; padding:6px 12px; }
        .TouchGesture_Toast[hidden],.TouchGesture_SettingsButton[hidden],.TouchGesture_Unlock[hidden] { display:none!important; }
    `);
    let runtimeStarted = false;
    function startRuntime() {
        if (runtimeStarted || !shouldStart()) return;
        runtimeStarted = true;
            const observer = new MutationObserver(records => {
                // Ignore changes to our own overlays to avoid an observer feedback loop.
                if (records.some(record => [...record.addedNodes, ...record.removedNodes].some(node =>
                    node.nodeType === 1 && (node.matches?.("video,bwp-video") || node.querySelector?.("video,bwp-video"))))) {
                    scheduleDiscovery();
                }
            });
            observer.observe(document.documentElement, { childList: true, subtree: true });
            setInterval(discover, 5000);
            function relayout() {
                for (const instance of instances.values()) instance.layout();
            }
            function fullscreenChanged() {
                unlockOrientation();
                if (settingsPanel) (fullscreenElement() || document.body).append(settingsPanel);
                discover();
                for (const instance of instances.values()) instance.lockOrientation();
            }
            window.addEventListener("resize", relayout);
            window.addEventListener("scroll", relayout, { passive: true, capture: true });
            document.addEventListener("fullscreenchange", fullscreenChanged);
            document.addEventListener("webkitfullscreenchange", fullscreenChanged);
            document.addEventListener("visibilitychange", () => {
                if (document.hidden) for (const instance of instances.values()) instance.finish(false);
            });
            window.addEventListener("blur", () => {
                for (const instance of instances.values()) instance.finish(false);
            });
            window.addEventListener("pagehide", () => {
                clearTimeout(discoveryTimer);
                discoveryTimer = null;
                for (const instance of instances.values()) instance.destroy();
                instances.clear();
                unlockOrientation();
            });
            window.addEventListener("pageshow", scheduleDiscovery);
            discover();
    }

    if (typeof GM_registerMenuCommand === "function") GM_registerMenuCommand("视频手势设置", openSettings);
    if (shouldStart()) {
        startRuntime();
    } else {
        window.addEventListener("pointerdown", event => {
            if (event.pointerType === "touch" || event.pointerType === "pen") startRuntime();
        }, { passive: true });
    }
})();
