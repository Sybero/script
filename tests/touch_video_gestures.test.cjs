const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Execute the actual controller and adapters without installing document-wide discovery.
function harness({ orientation, saved = '{}', host = 'example.com' } = {}) {
    const scheduled = new Map();
    let timer = 0;
    function element() {
        return {
            style: {}, dataset: {}, hidden: false, children: [],
            append(...children) { this.children.push(...children); },
            remove() {}, setAttribute() {}, addEventListener() {}, removeEventListener() {},
            contains() { return true; }, closest() { return null; }, matches() { return false; }
        };
    }
    const root = element();
    const document = { createElement: element, fullscreenElement: null };
    const context = {
        document, location: { hostname: host }, navigator: { maxTouchPoints: 2 },
        screen: { orientation }, console, GM_getValue: () => saved,
        setTimeout(fn) { scheduled.set(++timer, fn); return timer; },
        clearTimeout(id) { scheduled.delete(id); }
    };
    vm.createContext(context);
    const source = fs.readFileSync(require.resolve('../tampermonkey/touch_video_gestures.user.js'), 'utf8');
    vm.runInContext(source.slice(0, source.indexOf('    GM_addStyle(`')) +
        'globalThis.api = { VideoGesture, instances, seekTarget, settings, unlockOrientation }; })();', context);
    const video = {
        ...element(), parentElement: root, isConnected: true, currentSrc: 'movie.mp4',
        playbackRate: 1.5, currentTime: 100, duration: 600, paused: false,
        videoWidth: 1920, videoHeight: 1080,
        getBoundingClientRect() { return { left: 0, top: 0, right: 400, bottom: 200, width: 400, height: 200 }; }
    };
    const controller = new context.api.VideoGesture(video);
    context.api.instances.set(video, controller);
    const point = (id, x, y = 100) => ({ identifier: id, clientX: x, clientY: y });
    const event = (touches, changedTouches = [], cancelable = true) => ({
        target: video, touches, changedTouches, cancelable, prevented: false,
        preventDefault() { this.prevented = true; }, composedPath() { return [video, root]; }
    });
    return { ...context.api, context, video, root, controller, point, event, scheduled };
}

test('touchcancel restores temporary rate and never commits a seek', () => {
    const h = harness();
    h.controller.onStart(h.event([h.point(1, 100)]));
    h.controller.onMove(h.event([h.point(1, 180)]));
    h.controller.onCancel();
    assert.equal(h.video.currentTime, 100);
    assert.equal(h.controller.gesture, null);
    h.controller.onStart(h.event([h.point(1, 100), h.point(2, 120)]));
    assert.equal(h.video.playbackRate, 4);
    h.controller.onCancel();
    assert.equal(h.video.playbackRate, 1.5);
});

test('seek previews during movement and commits once on release', () => {
    const h = harness();
    h.controller.onStart(h.event([h.point(1, 100)]));
    const move = h.event([h.point(1, 180)]);
    h.controller.onMove(move);
    assert.equal(h.video.currentTime, 100);
    assert.equal(move.prevented, true);
    h.controller.onEnd(h.event([], [h.point(1, 180)]));
    assert.equal(h.video.currentTime, 148);
    h.controller.onEnd(h.event([], [h.point(1, 180)]));
    assert.equal(h.video.currentTime, 148);
});

test('adding a third finger restores original rate and cannot start a partial gesture', () => {
    const h = harness();
    h.controller.onStart(h.event([h.point(1, 100)]));
    h.controller.onStart(h.event([h.point(1, 100), h.point(2, 120)]));
    assert.equal(h.video.playbackRate, 4);
    h.controller.onStart(h.event([h.point(1, 100), h.point(2, 120), h.point(3, 140)]));
    assert.equal(h.video.playbackRate, 1.5);
    assert.equal(h.controller.gesture, null);
    h.controller.onStart(h.event([h.point(1, 100), h.point(2, 120)]));
    assert.equal(h.controller.gesture, null);
    h.controller.onEnd(h.event([], [h.point(1, 100)]));
    h.controller.onStart(h.event([h.point(1, 100)]));
    assert.ok(h.controller.gesture);
});

test('vertical gestures allow scrolling and cancel temporary acceleration', () => {
    const h = harness();
    assert.equal(h.controller.options.forbidScrollNFS, false);
    h.controller.onStart(h.event([h.point(1, 100), h.point(2, 120)]));
    const move = h.event([h.point(1, 100, 140), h.point(2, 120, 140)]);
    h.controller.onMove(move);
    assert.equal(move.prevented, false);
    assert.equal(h.video.playbackRate, 1.5);
    assert.equal(h.controller.gesture, null);
});

test('uncancelable browser-owned movement never commits', () => {
    const h = harness();
    h.controller.onStart(h.event([h.point(1, 100)]));
    h.controller.onMove(h.event([h.point(1, 180)], [], false));
    h.controller.onEnd(h.event([], [h.point(1, 180)]));
    assert.equal(h.video.currentTime, 100);
});

test('double-finger speed adjustment has symmetric steps and persists after release', () => {
    for (const [dx, rate] of [[50, 1.75], [-50, 1.25]]) {
        const h = harness();
        h.controller.onStart(h.event([h.point(1, 150), h.point(2, 170)]));
        h.controller.onMove(h.event([h.point(1, 150 + dx), h.point(2, 170 + dx)]));
        assert.equal(h.video.playbackRate, 1.5);
        h.controller.onEnd(h.event([h.point(2, 170 + dx)], [h.point(1, 150 + dx)]));
        assert.equal(h.video.playbackRate, rate);
    }
});

test('live seeking clamps to seekable ranges and unknown unseekable media is rejected', () => {
    const h = harness();
    h.video.duration = Infinity;
    assert.equal(h.seekTarget(h.video, 200), null);
    h.video.seekable = { length: 2, start: i => [100, 200][i], end: i => [150, 250][i] };
    assert.equal(h.seekTarget(h.video, 10), 100);
    assert.equal(h.seekTarget(h.video, 999), 249.95);
    assert.equal(h.seekTarget(h.video, Infinity), null);
});

test('settings entry is attached, disable removes listeners and restores touch-action', () => {
    const h = harness();
    assert.ok(h.root.children.includes(h.controller.settingsButton));
    assert.equal(h.root.style.touchAction, 'pan-y');
    h.settings.website['example.com'] = { wSwitchEnable: false };
    h.controller.refresh();
    assert.equal(h.controller.listener, null);
    assert.equal(h.root.style.touchAction, undefined);
});

test('destroy cancels long press and releases active temporary acceleration', () => {
    const h = harness();
    h.controller.options.speedx4single = true;
    h.controller.onStart(h.event([h.point(1, 100)]));
    const callback = h.scheduled.get(h.controller.longPressTimer);
    callback();
    assert.equal(h.video.playbackRate, 4);
    h.controller.destroy();
    assert.equal(h.video.playbackRate, 1.5);
    assert.equal(h.controller.gesture, null);
    assert.equal(h.controller.listener, null);
    assert.equal(h.scheduled.size, 0);
});

test('orientation is optional and rejected lock does not retain ownership', async () => {
    const h = harness();
    h.document = h.context.document;
    h.document.fullscreenElement = h.root;
    await h.controller.lockOrientation();
    assert.equal(h.controller.unlock.hidden, true);
    h.context.screen.orientation = { lock: () => Promise.reject(new Error('unsupported')) };
    await h.controller.lockOrientation();
    assert.equal(h.controller.unlock.hidden, true);
    let calls = 0;
    h.context.screen.orientation = { lock: async () => { calls++; }, unlock() {} };
    await h.controller.lockOrientation();
    assert.equal(calls, 1);
    assert.equal(h.controller.unlock.hidden, false);
    h.unlockOrientation();
    assert.equal(h.controller.unlock.hidden, true);
});

test('adapter keeps non-fullscreen scroll setting and disables unsupported options only explicitly', () => {
    const h = harness({ host: 'weibo.com', saved: JSON.stringify({ website: { 'weibo.com': { wSwitchForbidScrollNFS: true } } }) });
    assert.equal(h.controller.options.forbidScrollNFS, true);
    assert.equal(h.controller.options.speed, true);
});

test('explicit non-fullscreen scroll blocking persists throughout vertical gesture', () => {
    const h = harness({ saved: JSON.stringify({ website: { 'example.com': { wSwitchForbidScrollNFS: true } } }) });
    assert.equal(h.root.style.touchAction, 'none');
    h.controller.onStart(h.event([h.point(1, 100)]));
    for (const y of [140, 160]) {
        const move = h.event([h.point(1, 100, y)]);
        h.controller.onMove(move);
        assert.equal(move.prevented, true);
    }
    h.controller.onEnd(h.event([], [h.point(1, 100, 160)]));
    assert.equal(h.video.currentTime, 100);
});

test('two controllers sharing a container restore touch-action only after both detach', () => {
    const h = harness();
    const second = new h.VideoGesture({ ...h.video, paused: true });
    h.instances.set(second.video, second);
    h.controller.destroy();
    assert.equal(h.root.style.touchAction, 'pan-y');
    second.destroy();
    assert.equal(h.root.style.touchAction, undefined);
});

test('shared containers dispatch gesture to a single playing video', () => {
    const h = harness();
    const second = new h.VideoGesture({ ...h.video, paused: true });
    h.instances.set(second.video, second);
    const event = h.event([h.point(1, 100)]);
    event.target = h.root;
    event.composedPath = () => [h.root];
    h.controller.onStart(event);
    second.onStart(event);
    assert.ok(h.controller.gesture);
    assert.equal(second.gesture, null);
});

test('interactive controls do not start gestures', () => {
    const h = harness();
    const event = h.event([h.point(1, 100)]);
    event.composedPath = () => [{ matches: () => true }, h.root];
    h.controller.onStart(event);
    assert.equal(h.controller.gesture, null);
});

test('late orientation completion after leaving fullscreen releases lock', async () => {
    let complete;
    let unlocks = 0;
    const h = harness({ orientation: {
        lock: () => new Promise(resolve => { complete = resolve; }),
        unlock: () => { unlocks++; }
    } });
    h.context.document.fullscreenElement = h.root;
    const pending = h.controller.lockOrientation();
    h.context.document.fullscreenElement = null;
    h.unlockOrientation();
    complete();
    await pending;
    assert.equal(h.controller.unlock.hidden, true);
    assert.equal(unlocks, 2);
});

test('settings button CSS pins desktop icon to a small fixed square', () => {
    const source = require('node:fs').readFileSync(require.resolve('../tampermonkey/touch_video_gestures.user.js'), 'utf8');
    assert.match(source, /\.TouchGesture_SettingsButton,[^\{]+\{[^}]*width:36px !important/);
    assert.match(source, /\.TouchGesture_SettingsButton,[^\{]+\{[^}]*height:36px !important/);
    assert.match(source, /\.TouchGesture_SettingsButton,[^\{]+\{[^}]*font:20px\/36px system-ui,sans-serif !important/);
});
