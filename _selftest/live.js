/* ═══════════════════════════════════════════════════════════════════════════
   典藏司 · 十幕 —— 真实点击自测入口（#live=1）
   ═══════════════════════════════════════════════════════════════════════════
   设计约束（为什么长这样）：

   1) 本文件**从不 dispatch 任何 click**，也**不调用游戏里的任何函数、不改任何变量**。
      它只做三件事：
         · aim(i)  —— 把第 i 步"该点的那个像素"算出来，并用 elementFromPoint 当场证明
                      那个点上压着的确实是目标元素（命中点可核对）；
         · mark(i) —— 记录这一步之后的状态签名变化与断言结果，打一行 [live] 日志；
         · result() —— 交出整轮的自测记录。
      真正的鼠标事件由外部驱动（puppeteer-core + Edge，page.mouse.click）在**视口坐标**
      上发出，浏览器自己做命中判定。所以"点不动"在这里点不动 —— 这正是我们要的。

   2) 相对已有的 `#auto=` 入口：那是 `hit.dispatchEvent(new MouseEvent("click"))`
      （见各幕 §19 的自注释），事件被直接递给调用者选好的元素，**绕开浏览器命中判定**，
      因此它能报"全过"而真人点不动。本入口不复用它、也不改它的行为：
      `#auto=` 一行不动，日志行数不变；本入口只在 `#live=1` 时激活。
      默认访问（无 hash）下，本文件读完 PLANS 就 return，DOM / 存档 / 日志一律不碰。

   3) 每幕的步骤表照各幕 `runAuto()` 里已被真人走通过的路径抄下来，但把
      `click(id)` → 真点热点、`closePaper()`/`goRoom()` → 真点场景空白处（游戏自己的
      stage 点击判序就是这么用的）、`showLedger(true)` → 真点「簿」、`pickSlot(id)` →
      真点背包格、`setCam(x)` → 真按游戏的数字键，一处内部调用都不留。

   自测入口：<幕>.html#live=1     一条命令跑完十幕：node run_live.mjs
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var HASH = location.hash || "";
  if (!/[#&]live=1/.test(HASH) && !/[?&]live=1/.test(location.search)) return; /* ← 默认访问到此为止 */

  var SAVE = "diandangsi.rustylake.v1";

  /* ── 1. 存档读取（只读；不写）──────────────────────────────────────────── */
  function save() {
    try { return JSON.parse(localStorage.getItem(SAVE) || "null") || {}; } catch (e) { return {}; }
  }
  function flags() { return save().f || {}; }
  function inv() { return save().inv || []; }
  function doneArr() { return save().done || []; }

  /* ── 2. 状态签名：DOM 长度 + localStorage 校验和 ───────────────────────── */
  /* 存档里 ts / made 是每次 saveNow() 都会变的时间戳，跟"局面"无关，
     校验和里归一化掉，否则每一步都会假报"有变化"。 */
  function lsNorm() {
    var parts = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      var v = String(localStorage.getItem(k) == null ? "" : localStorage.getItem(k));
      v = v.replace(/"(ts|made)":\d+/g, '"$1":0');
      parts.push(k + "=" + v);
    }
    parts.sort();
    return parts.join("\u0001");
  }
  function hash33(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return h.toString(16);
  }
  function visibleCount() {
    var all = document.body.querySelectorAll("*"), n = 0;
    for (var i = 0; i < all.length; i++) {
      var e = all[i], tag = e.tagName.toLowerCase();
      if (tag === "script" || tag === "style" || tag === "title") continue;
      if (e.closest && e.closest("defs")) continue;
      var r = e.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) n++;
    }
    return n;
  }
  function sig() {
    var ls = lsNorm();
    return {
      dom: document.body.innerHTML.length,   /* 结构 DOM 长度 */
      nodes: document.body.querySelectorAll("*").length,
      vis: visibleCount(),                    /* 可见节点数 */
      lsLen: ls.length,
      lsHash: hash33(ls),                     /* localStorage 校验和 */
      txtHash: hash33(document.body.innerText || "")   /* 首屏正文校验和 */
    };
  }

  /* ── 3. 断言词表（只读 DOM 与存档）────────────────────────────────────── */
  function slotOfItem(itemId) {
    var i = inv().indexOf(itemId);
    if (i < 0) return null;
    return document.querySelector('#slots .slot[data-slot="' + i + '"]');
  }
  function activeView() {
    var v = document.querySelector('[id^="view-"].active');
    return v ? v.id.replace(/^view-/, "") : null;
  }
  function paperOpen() { return !!document.querySelector("#paper-layer .paper.show"); }
  function ledgerOn() { return document.getElementById("ledger").classList.contains("on"); }

  var PRED = {
    "flag":   function (x) { return !!flags()[x]; },
    "noflag": function (x) { return !flags()[x]; },
    "inv":    function (x) { return inv().indexOf(x) >= 0; },
    "noinv":  function (x) { return inv().indexOf(x) < 0; },
    "slotSel": function (x) { var s = slotOfItem(x); return !!(s && s.classList.contains("sel")); },
    "noSel":  function ()  { return !document.querySelector("#slots .slot.sel"); },
    "paper":  function ()  { return paperOpen(); },
    "noPaper": function () { return !paperOpen(); },
    "ledger": function ()  { return ledgerOn(); },
    "noLedger": function () { return !ledgerOn(); },
    "view":   function (x) { return activeView() === x; },
    "domOn":  function (x) { var n = document.getElementById(x); return !!(n && n.classList.contains("on")); },
    "domShown": function (x) { var n = document.getElementById(x); return !!(n && n.style.display !== "none"); },
    "done":   function (x) { return doneArr().indexOf(x) >= 0; },
    "pagerMore": function () { return !!document.querySelector('#paper-layer rect[x="566"]'); }
  };
  function pred(str) {
    if (!str) return null;
    if (str.indexOf(">=") > 0) {                    /* num:f_x>=3 */
      var p = str.split(">=");
      return { name: str, ok: (+flags()[p[0].split(":")[1]] || 0) >= (+p[1]) };
    }
    var i = str.indexOf(":");
    var k = i < 0 ? str : str.slice(0, i);
    var arg = i < 0 ? null : str.slice(i + 1);
    var fn = PRED[k];
    return { name: str, ok: fn ? !!fn(arg) : false };
  }

  /* ── 4. 目标解析：把"要点哪"变成一个像素，并当场证明命中 ───────────────── */
  function descr(el) {
    if (!el) return "(null)";
    var s = el.tagName.toLowerCase();
    if (el.id) s += "#" + el.id;
    if (el.getAttribute) {
      var hs = el.getAttribute("data-hs"); if (hs) s += "[data-hs=" + hs + "]";
      var sl = el.getAttribute("data-slot"); if (sl) s += "[data-slot=" + sl + "]";
    }
    return s;
  }
  function clipViewport(r) {
    var x0 = Math.max(r.left, 0), y0 = Math.max(r.top, 0);
    var x1 = Math.min(r.right, innerWidth - 1), y1 = Math.min(r.bottom, innerHeight - 1);
    if (x1 <= x0 || y1 <= y0) return null;
    return { x0: x0, y0: y0, x1: x1, y1: y1 };
  }
  /* 在目标矩形里找一点，使 elementFromPoint 之后确实是"这个元素"。
     优先中心，然后 5x5 网格 —— 这是"命中点可从 elementFromPoint 取"的硬证据。 */
  function pickPoint(rect, accept) {
    var c = clipViewport(rect);
    if (!c) return { ok: false, why: "目标不在视口内（rect 与视口无交集）" };
    var cx = (c.x0 + c.x1) / 2, cy = (c.y0 + c.y1) / 2;
    var cand = [[cx, cy]];
    for (var iy = 1; iy <= 5; iy++)
      for (var ix = 1; ix <= 5; ix++)
        cand.push([c.x0 + (c.x1 - c.x0) * ix / 6, c.y0 + (c.y1 - c.y0) * iy / 6]);
    var tries = [];
    for (var i = 0; i < cand.length; i++) {
      var x = Math.round(cand[i][0]), y = Math.round(cand[i][1]);
      var e = document.elementFromPoint(x, y);
      var d = descr(e);
      if (accept(e)) return { ok: true, x: x, y: y, hit: d };
      if (tries.length < 4) tries.push(x + "," + y + "→" + d);
    }
    return { ok: false, why: "矩形内没有一点的 elementFromPoint 命中目标", tried: tries };
  }
  function neutralPoint(strictLedger) {
    var st = document.getElementById("stage").getBoundingClientRect();
    var c = clipViewport(st);
    if (!c) return null;
    var bad = function (e) {
      if (!e) return true;
      if (e.closest && e.closest(".hs")) return true;          /* 空白处不该是热点 */
      if (strictLedger && e.closest && e.closest("#ledger")) return true;
      if (e.closest && (e.closest("#bk") || e.closest("#snd") || e.closest("#hud"))) return true;
      return false;
    };
    var cand = [];
    for (var iy = 1; iy < 14; iy++)
      for (var ix = 1; ix < 14; ix++)
        cand.push([c.x0 + (c.x1 - c.x0) * ix / 14, c.y0 + (c.y1 - c.y0) * iy / 14]);
    /* 从下往上找：场景空白多在下缘 */
    cand.sort(function (a, b) { return b[1] - a[1]; });
    for (var i = 0; i < cand.length; i++) {
      var x = Math.round(cand[i][0]), y = Math.round(cand[i][1]);
      var e = document.elementFromPoint(x, y);
      if (!bad(e)) return { x: x, y: y, hit: descr(e) };
    }
    return null;
  }

  function aim(st) {
    if (st.k === "hs") {
      var g = document.querySelector('.hs[data-hs="' + st.id + '"]');
      if (!g) return { ok: false, why: "找不到 .hs[data-hs=" + st.id + "]" };
      if (/\bgone\b/.test(g.getAttribute("class") || ""))
        return { ok: false, why: "热点带 .gone（游戏判它此刻不可点）" };
      var hit = g.querySelector(".hit") || g;
      var r = hit.getBoundingClientRect();
      var p = pickPoint(r, function (e) { return !!(e && e.closest && e.closest('.hs[data-hs="' + st.id + '"]')); });
      p.target = "hs:" + st.id; p.rect = { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
      return p;
    }
    if (st.k === "slot" || st.k === "unslot") {
      var s = slotOfItem(st.id);
      if (!s) return { ok: false, why: "背包里没有 " + st.id + "（存档 inv=" + inv().join(",") + "）" };
      if (st.k === "slot" && s.classList.contains("sel"))
        return { ok: true, already: true, x: 0, y: 0, hit: descr(s), target: "slot:" + st.id };
      if (st.k === "unslot" && !s.classList.contains("sel"))
        return { ok: true, already: true, x: 0, y: 0, hit: descr(s), target: "unslot:" + st.id };
      var r2 = s.getBoundingClientRect();
      var p2 = pickPoint(r2, function (e) { return !!(e && e.closest && e.closest(".slot") === s); });
      p2.target = st.k + ":" + st.id;
      p2.rect = { x: Math.round(r2.x), y: Math.round(r2.y), w: Math.round(r2.width), h: Math.round(r2.height) };
      return p2;
    }
    if (st.k === "bk") {
      var bk = document.getElementById("bk");
      var r3 = bk.getBoundingClientRect();
      var p3 = pickPoint(r3, function (e) { return !!(e && e.closest && e.closest("#bk") === bk); });
      p3.target = "bk"; p3.rect = { x: Math.round(r3.x), y: Math.round(r3.y), w: Math.round(r3.width), h: Math.round(r3.height) };
      return p3;
    }
    if (st.k === "dismiss" || st.k === "room") {
      /* dismiss：只要不是热点就行 —— 纸/台账底/场景都能把纸收掉（判序：热点 → 纸 → 台账 → 回主视图）
         room：必须避开台账底，否则台账开着时点了不穿透 */
      var np = neutralPoint(st.k === "room");
      if (!np) {
        var np2 = neutralPoint(false);
        if (np2 && st.k === "dismiss") np = np2;
      }
      if (!np) return { ok: false, why: "找不到可点的场景空白处（可能被覆盖层压满）" };
      return { ok: true, x: np.x, y: np.y, hit: np.hit, target: st.k };
    }
    if (st.k === "enter") {
      /* 推门入场：台账压着场景时才需要点「推門入…」；台账已经收起时人就在场景里，不需要点 */
      if (!ledgerOn()) return { ok: true, already: true, x: 0, y: 0, hit: "(台账已收起，人已在场)", target: "enter" };
      var ge = document.querySelector('.hs[data-hs="h_ledger_enter"]');
      if (!ge) return { ok: false, why: "找不到推门热点 h_ledger_enter" };
      var re2 = (ge.querySelector(".hit") || ge).getBoundingClientRect();
      var pe = pickPoint(re2, function (e) { return !!(e && e.closest && e.closest('.hs[data-hs="h_ledger_enter"]')); });
      pe.target = "enter"; pe.rect = { x: Math.round(re2.x), y: Math.round(re2.y), w: Math.round(re2.width), h: Math.round(re2.height) };
      return pe;
    }
    if (st.k === "pager") {
      var rect = document.querySelector('#paper-layer rect[x="566"]');
      if (!rect) return { ok: false, more: false, why: "校勘記已到末页（没有「後一條」命中面）" };
      var r4 = rect.getBoundingClientRect();
      var p4 = pickPoint(r4, function (e) { return !!(e && e === rect); });
      p4.target = "pager"; p4.more = true;
      return p4;
    }
    if (st.k === "key" || st.k === "assert") return { ok: true, x: 0, y: 0, hit: "(no click)", target: st.k };
    return { ok: false, why: "未知步骤类型 " + st.k };
  }

  /* ── 5. 记录与日志 ─────────────────────────────────────────────────────── */
  var R = { act: null, href: location.href, started: Date.now(), steps: [], errors: [] };
  var prevSig = null;

  function log(line) { console.log("[live] " + line); }

  function record(i, info, pr) {
    var st = PLANS[ACT].steps[i];
    info = info || {};
    var now = sig();
    var before = prevSig || now;
    var changed = (before.dom !== now.dom) || (before.lsHash !== now.lsHash);
    var rec = {
      i: i, name: st.n, kind: st.k, target: info.target || st.id || st.k,
      clicked: !!info.clicked,
      x: info.x, y: info.y, hit: info.hit, hitOk: info.hitOk,
      notMoved: !!info.already,
      sigBefore: before, sigAfter: now, changed: changed,
      assert: pr ? pr.name : null, assertOk: pr ? pr.ok : null,
      ok: info.forcedFail ? false : (pr ? pr.ok : true)
    };
    R.steps.push(rec);
    prevSig = now;
    log("#" + String(i).padStart(2, "0") + " " + st.n +
        " | " + st.k + ":" + (info.target || st.id || st.k) +
        (info.clicked ? " 点(" + info.x + "," + info.y + ")@" + info.hit : " 未点") +
        " | sig " + (changed ? "变化" : "未变") +
        " dom " + before.dom + "→" + now.dom + " ls " + before.lsHash + "→" + now.lsHash +
        " | 断言 " + (pr ? pr.name + "=" + (pr.ok ? "ok" : "MISS") : "—") +
        " | " + (rec.ok ? "PASS" : "FAIL"));
    return rec;
  }
  function mark(i, info) { return record(i, info, pred(PLANS[ACT].steps[i].a)); }
  /* 存档是 300ms 防抖写的，断言要给它落地的时间：轮询到成立或超时 */
  async function finish(i, info, ms) {
    var st = PLANS[ACT].steps[i];
    var pr = pred(st.a);
    var waited = 0, t0 = Date.now();
    while (pr && !pr.ok && (Date.now() - t0) < (ms || 0)) {
      await new Promise(function (r) { setTimeout(r, 120); });
      pr = pred(st.a);
    }
    waited = Date.now() - t0;
    var rec = record(i, info, pr);
    rec.assertWaitMs = waited;
    return rec;
  }
  function fail(i, why) {
    var st = PLANS[ACT].steps[i];
    R.steps.push({ i: i, name: st.n, kind: st.k, target: st.id || st.k, clicked: false,
                   why: why, ok: false, sigBefore: prevSig, sigAfter: sig(), changed: false });
    log("#" + String(i).padStart(2, "0") + " " + st.n + " | 无法定位： " + why + " | FAIL");
    return R.steps[R.steps.length - 1];
  }

  function next() {
    return { act: ACT, total: PLANS[ACT].steps.length, i: R.steps.length, sig: sig(),
             step: PLANS[ACT].steps[R.steps.length] || null };
  }
  function result() {
    var s = save();
    return {
      act: ACT, name: PLANS[ACT].name, finishedAt: new Date().toISOString(),
      ms: Date.now() - R.started,
      steps: R.steps,
      total: PLANS[ACT].steps.length,
      pass: R.steps.filter(function (x) { return x.ok; }).length,
      fail: R.steps.filter(function (x) { return !x.ok; }).map(function (x) { return x.i + ":" + x.name + (x.why ? " (" + x.why + ")" : ""); }),
      changed: R.steps.filter(function (x) { return x.changed; }).length,
      unchanged: R.steps.filter(function (x) { return !x.changed; }).length,
      errors: R.errors,
      actDoneFlag: !!(s.f && s.f["f_act" + ACT + "_done"]),
      done: s.done || [],
      inv: s.inv || [],
      saveRaw: localStorage.getItem(SAVE)
    };
  }
  window.addEventListener("error", function (e) { R.errors.push(String(e.message).slice(0, 200)); });

  /* ── 6. 十幕步骤表 ─────────────────────────────────────────────────────
     k: hs=热点 / slot=选中背包格 / unslot=取消选中 / dismiss=点空白收纸 /
        room=点空白回主视图 / bk=点「簿」回台账 / key=按数字键 / pager=校勘记翻页 /
        assert=只做断言不点
     a: 断言（flag: / noflag: / inv: / slotSel: / noSel: / paper: / view: / domOn: /
        domShown: / done: / num:f_x>=n）
     w: 点后等待（毫秒）
     err: 设计内的"错法"步骤（游戏会记一次错、可立即重放），单独统计
     ─────────────────────────────────────────────────────────────────── */
  var PLANS = {
1: { name: "第一幕 · 校書閣", steps: [
  { n: "自台账入閣",        k: "enter", a: "view:room", w: 460 },
  { n: "進案頭",            k: "hs",     id: "h_desk",         a: "view:desk", w: 460 },
  { n: "讀殘頁甲",          k: "hs",     id: "h_leaf_jia",     a: "paper", w: 340 },
  { n: "收起殘頁甲",        k: "dismiss", a: "noPaper", w: 200 },
  { n: "讀殘頁乙",          k: "hs",     id: "h_leaf_yi",      a: "paper", w: 340 },
  { n: "收起殘頁乙",        k: "dismiss", a: "flag:f_read_tea7", w: 220 },
  { n: "回閣(案頭→主視圖)",  k: "room",   a: "view:room", w: 300 },
  { n: "讀體例紙條",        k: "hs",     id: "h_rule",         a: "paper", w: 340 },
  { n: "收起體例紙條",      k: "dismiss", a: "noPaper", w: 200 },
  { n: "進書架",            k: "hs",     id: "h_shelf",        a: "view:shelf", w: 420 },
  { n: "讀爾雅釋木",        k: "hs",     id: "h_tag_erya",     a: "paper", w: 320 },
  { n: "收起",              k: "dismiss", a: "flag:f_read_erya_shimu", w: 180 },
  { n: "讀爾雅注疏",        k: "hs",     id: "h_tag_zhushu",   a: "paper", w: 320 },
  { n: "收起",              k: "dismiss", a: "flag:f_read_erya_zhushu09", w: 180 },
  { n: "讀釋名卷五",        k: "hs",     id: "h_tag_shiming",  a: "paper", w: 320 },
  { n: "收起",              k: "dismiss", a: "flag:f_read_shiming5", w: 180 },
  { n: "支線S1讀世說",      k: "hs",     id: "h_tag_shishuo",  a: "paper", w: 320 },
  { n: "收起",              k: "dismiss", a: "flag:f_side_shishuo_read", w: 180 },
  { n: "支線S2取舊拓",      k: "hs",     id: "h_box",          a: "inv:it_rubbing", w: 320 },
  { n: "回閣",              k: "room",   a: "view:room", w: 260 },
  { n: "回案頭",            k: "hs",     id: "h_desk",         a: "view:desk", w: 420 },
  { n: "取校印",            k: "hs",     id: "h_seal_jiao",    a: "inv:it_seal_jiao", w: 240 },
  { n: "選中校印",          k: "slot",   id: "it_seal_jiao",   a: "slotSel:it_seal_jiao", w: 200 },
  { n: "甲頁落校印",        k: "hs",     id: "h_leaf_jia",     a: "flag:f_leaf_jia_sealed", w: 420 },
  { n: "取異印",            k: "hs",     id: "h_seal_yi",      a: "inv:it_seal_yi", w: 240 },
  { n: "選中異印",          k: "slot",   id: "it_seal_yi",     a: "slotSel:it_seal_yi", w: 200 },
  { n: "乙頁落異印",        k: "hs",     id: "h_leaf_yi",      a: "flag:f_leaf_yi_sealed", w: 1300 },
  { n: "鏈①通_抽屜開",      k: "assert", a: "flag:f_chain1_done" },
  { n: "取木牌十三",        k: "hs",     id: "h_plaque13",     a: "inv:it_plaque_13", w: 260 },
  { n: "取木牌十五",        k: "hs",     id: "h_plaque15",     a: "inv:it_plaque_15", w: 260 },
  { n: "回閣",              k: "room",   a: "view:room", w: 260 },
  { n: "開高櫃",            k: "hs",     id: "h_cabinet",      a: "flag:f_cabinet_open", w: 1400 },
  { n: "取衣物丙",          k: "hs",     id: "h_garment_c",    a: "inv:it_garment_c", w: 260 },
  { n: "丙掛心衣簽下",      k: "hs",     id: "h_tag_xinyi",    a: "flag:f_garment_c_placed", w: 560 },
  { n: "取衣物甲",          k: "hs",     id: "h_garment_a",    a: "inv:it_garment_a", w: 260 },
  { n: "甲掛帕服簽下",      k: "hs",     id: "h_tag_pafu",     a: "flag:f_garment_a_placed", w: 560 },
  { n: "取衣物乙",          k: "hs",     id: "h_garment_b",    a: "inv:it_garment_b", w: 260 },
  { n: "乙掛襃服簽下",      k: "hs",     id: "h_tag_baofu",    a: "flag:f_chain2_done", w: 800 },
  { n: "取內襯殘紙",        k: "hs",     id: "h_lining_slip",  a: "inv:it_slip2", w: 480 },
  { n: "收起",              k: "dismiss", a: "noPaper", w: 220 },
  { n: "回閣",              k: "room",   a: "view:room", w: 260 },
  { n: "進營造圖",          k: "hs",     id: "h_scroll",       a: "view:scroll", w: 420 },
  { n: "選十三重",          k: "slot",   id: "it_plaque_13",   a: "slotSel:it_plaque_13", w: 200 },
  { n: "嵌十三重",          k: "hs",     id: "h_slot_layers",  a: "flag:f_fig_slot_13", w: 1200 },
  { n: "取下木牌",          k: "hs",     id: "h_slot_layers",  a: "inv:it_plaque_13", w: 400 },
  { n: "選十五重",          k: "slot",   id: "it_plaque_15",   a: "slotSel:it_plaque_15", w: 200 },
  { n: "嵌十五重",          k: "hs",     id: "h_slot_layers",  a: "flag:f_fig_slot_15", w: 1300 },
  { n: "暗格彈開",          k: "assert", a: "flag:f_secret_open" },
  { n: "取第十卷",          k: "hs",     id: "h_secret",       a: "flag:f_vol10_taken", w: 700 },
  { n: "一幕收束",          k: "assert", a: "flag:f_act1_done" },
  { n: "回台账",            k: "bk",     a: "ledger", w: 400 },
  { n: "入閣一次(触发重绘)", k: "enter",  a: "noLedger", w: 420 },
  { n: "回主視圖",          k: "room",   a: "view:room", w: 320 },
  { n: "摊开案头",          k: "hs",     id: "h_desk",         a: "view:desk", w: 460 },
  { n: "再回台账",          k: "bk",     a: "ledger", w: 400 },
  { n: "取閱校勘記",        k: "hs",     id: "h_ledger_notes", a: "paper", w: 500 },
  { n: "收起校勘記",        k: "dismiss", a: "noPaper", w: 260 },
  { n: "再入閣",            k: "enter",  a: "noLedger", w: 400 },
  { n: "回閣",              k: "room",   a: "view:room", w: 300 },
  { n: "進營造圖",          k: "hs",     id: "h_scroll",       a: "view:scroll", w: 400 },
  { n: "選舊拓",            k: "slot",   id: "it_rubbing",     a: "slotSel:it_rubbing", w: 200 },
  { n: "試擺一千尺",        k: "hs",     id: "h_scroll_fig",   a: "flag:f_fig_slot_1000", w: 1200 }
]},
2: { name: "第二幕 · 熔銅作", steps: [
  { n: "讀幕間",            k: "hs",     id: "h_ledger_bridge", a: "domOn:bridge", w: 420 },
  { n: "收起幕間",          k: "hs",     id: "h_bridge_go",     a: "view:room", w: 460 },
  { n: "推門入作",          k: "enter",  a: "view:room", w: 480 },
  { n: "開爐門",            k: "hs",     id: "h_furnace",       a: "flag:f_furnace_open", w: 1000 },
  { n: "送塚器入爐",        k: "hs",     id: "h_g_grave",       a: "flag:f_g_grave_out", w: 820 },
  { n: "送釵釧入爐",        k: "hs",     id: "h_g_hairpin",     a: "flag:f_g_hairpin_out", w: 820 },
  { n: "送溲器入爐",        k: "hs",     id: "h_g_lav",         a: "flag:f_g_lav_out", w: 820 },
  { n: "鏈①通_辱金不入爐",  k: "assert", a: "flag:f_chain1_done" },
  { n: "開高櫃",            k: "hs",     id: "h_cabinet",       w: 400 },
  { n: "讀本作卷十一",      k: "hs",     id: "h_cabinet",       a: "flag:f_vol_read", w: 400 },
  { n: "收起",              k: "dismiss", a: "noPaper", w: 220 },
  { n: "再開爐門取銅",      k: "hs",     id: "h_furnace",       a: "inv:it_cu_convex", w: 700 },
  { n: "取凹塊",            k: "assert", a: "inv:it_cu_concave" },
  { n: "讀殘卷上半段",      k: "hs",     id: "h_ledge_a",       a: "flag:f_ledge_a_read", w: 380 },
  { n: "收起",              k: "dismiss", a: "noPaper", w: 180 },
  { n: "讀體例紙",          k: "hs",     id: "h_rule",          a: "flag:f_rule_read", w: 380 },
  { n: "收起",              k: "dismiss", a: "noPaper", w: 180 },
  { n: "選凸起的一塊",      k: "slot",   id: "it_cu_convex",    a: "slotSel:it_cu_convex", w: 200 },
  { n: "入牡范",            k: "hs",     id: "h_slot_a",        a: "flag:f_cu_convex_in", w: 480 },
  { n: "選凹陷的一塊",      k: "slot",   id: "it_cu_concave",   a: "slotSel:it_cu_concave", w: 200 },
  { n: "入牝范",            k: "hs",     id: "h_slot_b",        a: "flag:f_cu_concave_in", w: 1000 },
  { n: "鏈②通_牡牝入范",    k: "assert", a: "flag:f_chain2_done" },
  { n: "進爐膛近景(按2)",   k: "key",    key: "2",              a: "view:right", w: 500 },
  { n: "取殘卷下半段",      k: "hs",     id: "h_scrap_half",    a: "flag:f_scrap2_taken", w: 480 },
  { n: "收起",              k: "dismiss", a: "noPaper", w: 200 },
  { n: "回作房",            k: "room",   a: "view:room", w: 280 },
  { n: "支線S1接風管",      k: "hs",     id: "h_duct",          w: 300 },
  { n: "支線S2看刻痕",      k: "hs",     id: "h_side_mark",     w: 300 },
  { n: "支線S2再看刻痕",    k: "hs",     id: "h_side_mark",     w: 300 },
  { n: "支線S3看長柄勺",    k: "hs",     id: "h_side_ladle",    w: 300 },
  { n: "支線S4看爐渣",      k: "hs",     id: "h_side_slag",     w: 300 },
  { n: "水火之器",          k: "hs",     id: "h_basin",         w: 300 },
  { n: "案上范槽",          k: "hs",     id: "h_bench",         w: 300 },
  { n: "木簽二",            k: "hs",     id: "h_ledge_b",       a: "flag:f_ledge_b_read", w: 340 },
  { n: "收起",              k: "dismiss", a: "noPaper", w: 180 },
  { n: "錯法五_素金留在原處", k: "hs",   id: "h_g_clean",       a: "num:f_misplaced_count>=1", w: 800, err: 1 },
  { n: "回台账",            k: "bk",     a: "ledger", w: 420 },
  { n: "取閱校勘記",        k: "hs",     id: "h_ledger_notes",  a: "paper", w: 500 },
  { n: "收起校勘記",        k: "dismiss", a: "noPaper", w: 260 },
  { n: "再入作",            k: "enter",  a: "view:room", w: 400 },
  { n: "收束_本幕已畢",     k: "assert", a: "flag:f_act2_done" }
]},
3: { name: "第三幕 · 校書堂", steps: [
  { n: "讀幕間",            k: "hs",     id: "h_ledger_bridge", w: 400 },
  { n: "收起幕間",          k: "hs",     id: "h_bridge_go",     a: "view:room", w: 400 },
  { n: "推門入堂",          k: "enter",  a: "view:room", w: 420 },
  { n: "讀顏氏家訓卷三",    k: "hs",     id: "h_vol_a",         a: "flag:f_vol_a_read", w: 340 },
  { n: "收起",              k: "dismiss", a: "noPaper", w: 180 },
  { n: "讀宋景文筆記卷上",  k: "hs",     id: "h_vol_b",         a: "flag:f_vol_b_read", w: 340 },
  { n: "收起",              k: "dismiss", a: "noPaper", w: 180 },
  { n: "讀齊民要術簽",      k: "hs",     id: "h_vol_c",         a: "flag:f_vol_c_read", w: 340 },
  { n: "收起",              k: "dismiss", a: "noPaper", w: 180 },
  { n: "書已翻",            k: "assert", a: "flag:f_vol_c_read" },
  { n: "黃紙疊入手",        k: "hs",     id: "h_case_yellow",   a: "flag:f_case_yellow_read", w: 340 },
  { n: "收起",              k: "dismiss", a: "noPaper", w: 180 },
  { n: "取雌黃",            k: "hs",     id: "h_dish",          a: "inv:it_ci", w: 300 },
  { n: "雌黃在手",          k: "assert", a: "slotSel:it_ci" },
  { n: "錯法一塗到白紙上",  k: "hs",     id: "h_case_yellow",   a: "flag:f_case_smear", w: 560, err: 1 },
  { n: "錯法一已記",        k: "assert", a: "num:f_misplaced_count>=1" },
  { n: "挪開白紙疊",        k: "hs",     id: "h_case_white",    a: "flag:f_case_white_moved", w: 680 },
  { n: "再塗_三處俱滅",     k: "hs",     id: "h_case_yellow",   a: "flag:f_chain1_done", w: 560 },
  { n: "塗後無浮塊",        k: "assert", a: "noflag:f_case_smear" },
  { n: "收束成立",          k: "assert", a: "flag:f_act3_done" },
  { n: "校勘簽一",          k: "hs",     id: "h_tan_a",         a: "flag:f_case_tan1", w: 320 },
  { n: "收起",              k: "dismiss", a: "noPaper", w: 180 },
  { n: "校勘簽二",          k: "hs",     id: "h_tan_b",         a: "flag:f_case_tan2", w: 320 },
  { n: "收起",              k: "dismiss", a: "noPaper", w: 180 },
  { n: "校勘簽三",          k: "hs",     id: "h_tan_c",         a: "flag:f_case_tan3", w: 320 },
  { n: "收起",              k: "dismiss", a: "noPaper", w: 180 },
  { n: "三簽已讀",          k: "assert", a: "flag:f_tan_read" },
  { n: "案上朱筆現",        k: "assert", a: "domShown:brush-done" },
  { n: "案面方位話",        k: "hs",     id: "h_case",          w: 240 },
  { n: "書架方位話",        k: "hs",     id: "h_shelf",         w: 240 },
  { n: "收束已成立",        k: "assert", a: "flag:f_act3_done" },
  { n: "回台账",            k: "bk",     a: "ledger", w: 360 },
  { n: "取閱校勘記",        k: "hs",     id: "h_ledger_notes",  a: "paper", w: 460 },
  { n: "收起校勘記",        k: "dismiss", a: "noPaper", w: 240 },
  { n: "再入堂",            k: "enter",  a: "view:room", w: 360 },
  { n: "收束_本幕已畢",     k: "assert", a: "flag:f_act3_done" }
]},
4: { name: "第四幕 · 書庫走廊", steps: [
  { n: "讀幕間",            k: "hs",     id: "h_ledger_bridge", a: "domOn:bridge", w: 380 },
  { n: "收起幕間",          k: "hs",     id: "h_bridge_go",     a: "view:room", w: 380 },
  { n: "推門入廊",          k: "enter",  a: "view:room", w: 420 },
  { n: "讀書庫體例",        k: "hs",     id: "h_rule",          a: "flag:f_rule_read", w: 340 },
  { n: "收起",              k: "dismiss", a: "noPaper", w: 180 },
  { n: "讀顏氏家訓勉學",    k: "hs",     id: "h_book_yanshi",   a: "flag:f_book_yanshi_read", w: 340 },
  { n: "收起",              k: "dismiss", a: "noPaper", w: 180 },
  { n: "讀漢書成帝紀",      k: "hs",     id: "h_book_hanshu",   a: "flag:f_book_hanshu_read", w: 340 },
  { n: "收起",              k: "dismiss", a: "noPaper", w: 180 },
  { n: "讀勘異一籤",        k: "hs",     id: "h_tan",           a: "flag:f_tan_read", w: 340 },
  { n: "收起",              k: "dismiss", a: "noPaper", w: 180 },
  { n: "三處已讀",          k: "assert", a: "flag:f_tan_read" },
  { n: "進券車近景",        k: "hs",     id: "h_cart",          a: "view:cart", w: 660 },
  { n: "在近景",            k: "assert", a: "view:cart" },
  { n: "翻左位那一紙",      k: "hs",     id: "h_paper_l",       a: "paper", w: 340 },
  { n: "收起",              k: "dismiss", a: "noPaper", w: 200 },
  { n: "翻中位那一紙",      k: "hs",     id: "h_paper_m",       a: "paper", w: 340 },
  { n: "收起",              k: "dismiss", a: "noPaper", w: 200 },
  { n: "翻右位那一紙",      k: "hs",     id: "h_paper_r",       a: "paper", w: 340 },
  { n: "收起",              k: "dismiss", a: "noPaper", w: 200 },
  { n: "回廊下",            k: "hs",     id: "h_cart_back",     a: "view:room", w: 520 },
  { n: "三紙已翻_左",       k: "assert", a: "flag:f_q_a_read" },
  { n: "三紙已翻_中",       k: "assert", a: "flag:f_q_b_read" },
  { n: "三紙已翻_右",       k: "assert", a: "flag:f_q_c_read" },
  { n: "架取「馬」籤",      k: "hs",     id: "h_sign_ma",       a: "inv:it_sign_ma", w: 380 },
  { n: "再進近景",          k: "hs",     id: "h_cart",          a: "view:cart", w: 660 },
  { n: "錯法一_押在舊籤未取之牌", k: "hs", id: "h_plate",       a: "num:f_misplaced_count>=1", w: 480, err: 1 },
  { n: "錯法一已記_牌未動",  k: "assert", a: "noflag:f_sign_ok" },
  { n: "放下「馬」籤",      k: "unslot", id: "it_sign_ma",      a: "noSel", w: 320 },
  { n: "取下舊籤",          k: "hs",     id: "h_plate",         a: "flag:f_old_taken", w: 480 },
  { n: "舊籤在手",          k: "assert", a: "slotSel:it_old_lu" },
  { n: "挪柄拿起左位",      k: "hs",     id: "h_move_l",        w: 340 },
  { n: "放下到右位",        k: "hs",     id: "h_move_r",        w: 480 },
  { n: "挪柄拿起中位",      k: "hs",     id: "h_move_m",        w: 340 },
  { n: "再放下到右位",      k: "hs",     id: "h_move_r",        a: "flag:f_order_ok", w: 580 },
  { n: "序記已現",          k: "assert", a: "domOn:order-marks" },
  { n: "錯法二_押舊籤",     k: "hs",     id: "h_plate",         a: "num:f_misplaced_count>=2", w: 580, err: 1 },
  { n: "驗未成立",          k: "assert", a: "noflag:f_sign_ok" },
  { n: "回廊下取籤",        k: "hs",     id: "h_cart_back",     a: "view:room", w: 460 },
  { n: "取「博士」籤",      k: "hs",     id: "h_sign_boshi",    a: "inv:it_sign_boshi", w: 380 },
  { n: "再進近景",          k: "hs",     id: "h_cart",          a: "view:cart", w: 660 },
  { n: "押上目籤",          k: "hs",     id: "h_plate",         a: "flag:f_sign_ok", w: 580 },
  { n: "收束成立",          k: "assert", a: "flag:f_act4_done" },
  { n: "籤已離手",          k: "assert", a: "noinv:it_sign_boshi" },
  { n: "回廊下",            k: "hs",     id: "h_cart_back",     a: "view:room", w: 460 },
  { n: "開台账",            k: "bk",     a: "ledger", w: 420 },
  { n: "取閱校勘記",        k: "hs",     id: "h_ledger_notes",  a: "paper", w: 500 },
  { n: "收起校勘記",        k: "dismiss", a: "noPaper", w: 260 },
  { n: "再入廊",            k: "enter",  a: "view:room", w: 400 },
  { n: "收束_本幕已畢",     k: "assert", a: "flag:f_act4_done" }
]},
5: { name: "第五幕 · 膳房", steps: [
  { n: "讀幕間",            k: "hs",     id: "h_ledger_bridge", w: 380 },
  { n: "收起幕間",          k: "hs",     id: "h_bridge_go",     a: "view:room", w: 380 },
  { n: "推門入廚",          k: "enter",  a: "view:room", w: 420 },
  { n: "讀膳房體例",        k: "hs",     id: "h_rule",          a: "flag:f_rule_read", w: 340 },
  { n: "收起",              k: "dismiss", a: "noPaper", w: 180 },
  { n: "讀世説新語",        k: "hs",     id: "h_book_ssxy",     a: "flag:f_ssxy_read", w: 340 },
  { n: "收起",              k: "dismiss", a: "noPaper", w: 180 },
  { n: "讀太平御覽",        k: "hs",     id: "h_book_yulan",    a: "flag:f_yulan_read", w: 340 },
  { n: "收起",              k: "dismiss", a: "noPaper", w: 180 },
  { n: "讀錄文一",          k: "hs",     id: "h_slip_a",        a: "flag:f_slip_a_read", w: 320 },
  { n: "收起",              k: "dismiss", a: "noPaper", w: 180 },
  { n: "讀錄文二",          k: "hs",     id: "h_slip_b",        a: "flag:f_slip_b_read", w: 320 },
  { n: "收起",              k: "dismiss", a: "noPaper", w: 180 },
  { n: "五處已讀",          k: "assert", a: "flag:f_slip_b_read" },
  { n: "錯法一_空手掩灶門", k: "hs",     id: "h_stove",         a: "num:f_misplaced_count>=1", w: 380, err: 1 },
  { n: "錯法一已記_灶門未掩", k: "assert", a: "noflag:f_stove_shut" },
  { n: "取勞牌",            k: "hs",     id: "h_tag_lao",       a: "inv:it_tag_lao", w: 380 },
  { n: "錯法二_勞牌往錄文二", k: "hs",   id: "h_slip_b",        a: "num:f_misplaced_count>=2", w: 480, err: 1 },
  { n: "錯法二已記_錄文二未填", k: "assert", a: "noflag:f_slip_b_filled" },
  { n: "勞牌補錄文一",      k: "hs",     id: "h_slip_a",        a: "flag:f_slip_a_filled", w: 520 },
  { n: "取蟧牌",            k: "hs",     id: "h_tag_liao",      a: "inv:it_tag_liao", w: 380 },
  { n: "蟧牌補錄文二",      k: "hs",     id: "h_slip_b",        a: "flag:f_slip_b_filled", w: 520 },
  { n: "兩形已兩存",        k: "assert", a: "domOn:keep-lead" },
  { n: "走近水台",          k: "hs",     id: "h_sink_go",       a: "view:sink", w: 660 },
  { n: "在水台近景",        k: "assert", a: "view:sink" },
  { n: "取蟹",              k: "hs",     id: "h_basket_crab",   a: "inv:it_crab", w: 380 },
  { n: "錯法三_蟹放小盆",   k: "hs",     id: "h_basin_small",   a: "num:f_misplaced_count>=3", w: 480, err: 1 },
  { n: "錯法三已記_小盆未記名", k: "assert", a: "noflag:f_basin_small_set" },
  { n: "蟹放進大盆",        k: "hs",     id: "h_basin_big",     a: "flag:f_basin_big_set", w: 520 },
  { n: "取彭蜞",            k: "hs",     id: "h_basket_pq",     a: "inv:it_pq", w: 380 },
  { n: "彭蜞放進中盆",      k: "hs",     id: "h_basin_mid",     a: "flag:f_basin_mid_set", w: 520 },
  { n: "取彭螖",            k: "hs",     id: "h_basket_px",     a: "inv:it_px", w: 380 },
  { n: "彭螖放進小盆",      k: "hs",     id: "h_basin_small",   a: "flag:f_basin_small_set", w: 520 },
  { n: "三物已分置三盆",    k: "assert", a: "flag:f_three_sorted" },
  { n: "回膳房",            k: "hs",     id: "h_sink_back",     a: "view:room", w: 460 },
  { n: "掩灶門",            k: "hs",     id: "h_stove",         a: "flag:f_stove_shut", w: 560 },
  { n: "收束成立",          k: "assert", a: "flag:f_act5_done" },
  { n: "開台账",            k: "bk",     a: "ledger", w: 420 },
  { n: "取閱校勘記",        k: "hs",     id: "h_ledger_notes",  a: "paper", w: 500 },
  { n: "收起校勘記",        k: "dismiss", a: "noPaper", w: 260 },
  { n: "再入廚",            k: "enter",  a: "view:room", w: 400 },
  { n: "收束_本幕已畢",     k: "assert", a: "flag:f_act5_done" }
]},
6: { name: "第六幕 · 類書庫", steps: [
  { n: "讀幕間",            k: "hs",     id: "h_ledger_bridge", w: 380 },
  { n: "收起幕間",          k: "hs",     id: "h_bridge_go",     a: "view:close", w: 380 },
  { n: "推門入庫",          k: "enter",  a: "view:close", w: 420 },
  { n: "在對勘案近景",      k: "assert", a: "view:close" },
  { n: "退回書庫",          k: "hs",     id: "h_back",          a: "view:room", w: 560 },
  { n: "讀類書庫體例",      k: "hs",     id: "h_rule",          a: "flag:f_rule_read", w: 340 },
  { n: "收起",              k: "dismiss", a: "noPaper", w: 190 },
  { n: "讀校勘之例",        k: "hs",     id: "h_rule2",         a: "flag:f_rule2_read", w: 340 },
  { n: "收起",              k: "dismiss", a: "noPaper", w: 190 },
  { n: "兩紙已讀",          k: "assert", a: "flag:f_rule2_read" },
  { n: "再走近對勘案",      k: "hs",     id: "h_go",            a: "view:close", w: 660 },
  { n: "讀太平御覽",        k: "hs",     id: "h_book_a",        a: "flag:f_book_a_read", w: 360 },
  { n: "收起",              k: "dismiss", a: "noPaper", w: 190 },
  { n: "讀北堂書鈔",        k: "hs",     id: "h_book_b",        a: "flag:f_book_b_read", w: 360 },
  { n: "收起",              k: "dismiss", a: "noPaper", w: 190 },
  { n: "兩部已讀",          k: "assert", a: "flag:f_book_b_read" },
  { n: "錯法一_越槽落引線", k: "hs",     id: "h_slot_b",        a: "num:f_misplaced_count>=1", w: 560, err: 1 },
  { n: "錯法一已記_乙槽仍空", k: "assert", a: "noflag:f_slot_b_set" },
  { n: "引線落甲本頁邊",    k: "hs",     id: "h_slot_a",        a: "flag:f_slot_a_set", w: 480 },
  { n: "引線落乙本頁邊",    k: "hs",     id: "h_slot_b",        a: "flag:f_slot_b_set", w: 480 },
  { n: "兩存未成立_存牌未上", k: "assert", a: "noflag:f_two_kept" },
  { n: "取回甲線",          k: "hs",     id: "h_slot_a",        a: "noflag:f_slot_a_set", w: 460 },
  { n: "甲線再畫回",        k: "hs",     id: "h_slot_a",        a: "flag:f_slot_a_set", w: 480 },
  { n: "錯法三_空手上勘異槽", k: "hs",   id: "h_keep",          a: "num:f_misplaced_count>=2", w: 440, err: 1 },
  { n: "錯法三已記_兩存未立", k: "assert", a: "noflag:f_two_kept" },
  { n: "取底本牌",          k: "hs",     id: "h_card_base",     a: "inv:it_card_base", w: 380 },
  { n: "選底本牌",          k: "slot",   id: "it_card_base",    a: "slotSel:it_card_base", w: 200 },
  { n: "錯法四_底本牌往乙槽", k: "hs",   id: "h_base_b",        a: "num:f_misplaced_count>=3", w: 560, err: 1 },
  { n: "錯法四已記_乙槽未立", k: "assert", a: "noflag:f_base_marked" },
  { n: "底本牌落甲槽",      k: "hs",     id: "h_base_a",        a: "flag:f_base_marked", w: 480 },
  { n: "底本已立",          k: "assert", a: "flag:f_base_marked" },
  { n: "取存牌",            k: "hs",     id: "h_card_keep",     a: "inv:it_card_keep", w: 380 },
  { n: "選存牌",            k: "slot",   id: "it_card_keep",    a: "slotSel:it_card_keep", w: 200 },
  { n: "存牌落勘異槽",      k: "hs",     id: "h_keep",          a: "flag:f_two_kept", w: 560 },
  { n: "兩存成立",          k: "assert", a: "flag:f_two_kept" },
  { n: "收束成立",          k: "assert", a: "flag:f_act6_done" },
  { n: "開台账",            k: "bk",     a: "ledger", w: 440 },
  { n: "取閱校勘記",        k: "hs",     id: "h_ledger_notes",  a: "paper", w: 520 },
  { n: "收起校勘記",        k: "dismiss", a: "noPaper", w: 260 },
  { n: "再入庫",            k: "enter",  a: "view:close", w: 400 },
  { n: "收束_本幕已畢",     k: "assert", a: "flag:f_act6_done" }
]},
7: { name: "第七幕 · 抄書齋", steps: [
  { n: "讀幕間",            k: "hs",     id: "h_ledger_bridge", w: 380 },
  { n: "收起幕間",          k: "hs",     id: "h_bridge_go",     a: "view:close", w: 380 },
  { n: "推門入齋",          k: "enter",  a: "view:close", w: 420 },
  { n: "在對攤近景",        k: "assert", a: "view:close" },
  { n: "退回書齋",          k: "hs",     id: "h_back",          a: "view:room", w: 560 },
  { n: "讀抄書齋體例",      k: "hs",     id: "h_rule",          a: "flag:f_rule_read", w: 340 },
  { n: "收起",              k: "dismiss", a: "noPaper", w: 190 },
  { n: "讀校勘之例",        k: "hs",     id: "h_rule2",         a: "flag:f_rule2_read", w: 340 },
  { n: "收起",              k: "dismiss", a: "noPaper", w: 190 },
  { n: "再走近抄書案",      k: "hs",     id: "h_go",            a: "view:close", w: 660 },
  { n: "讀源書",            k: "hs",     id: "h_src",           a: "flag:f_src_read", w: 360 },
  { n: "收起",              k: "dismiss", a: "noPaper", w: 190 },
  { n: "讀抄件",            k: "hs",     id: "h_copy",          a: "flag:f_copy_read", w: 360 },
  { n: "收起",              k: "dismiss", a: "noPaper", w: 190 },
  { n: "兩部已讀",          k: "assert", a: "flag:f_copy_read" },
  { n: "錯法一_空手落筆",   k: "hs",     id: "c1",              a: "num:f_misplaced_count>=1", w: 460, err: 1 },
  { n: "錯法一已記_抄件未圈", k: "assert", a: "noflag:f_mark_1" },
  { n: "取朱筆",            k: "hs",     id: "h_brush",         a: "inv:it_brush", w: 380 },
  { n: "選朱筆",            k: "slot",   id: "it_brush",        a: "slotSel:it_brush", w: 200 },
  { n: "蘸朱砂",            k: "hs",     id: "h_ink",           a: "inv:it_inkdish", w: 380 },
  { n: "選朱砂",            k: "slot",   id: "it_inkdish",      a: "slotSel:it_inkdish", w: 200 },
  { n: "用掉這一筆",        k: "hs",     id: "c1",              a: "flag:f_mark_1", w: 460 },
  { n: "錯法二_無硃再落",   k: "hs",     id: "c2",              a: "num:f_misplaced_count>=2", w: 460, err: 1 },
  { n: "錯法二已記_第二处未圈", k: "assert", a: "noflag:f_mark_2" },
  { n: "蘸硃再圈第二处",    k: "hs",     id: "h_ink",           w: 380 },
  { n: "圈第二处",          k: "hs",     id: "c2",              a: "flag:f_mark_2", w: 460 },
  { n: "蘸硃圈第三处",      k: "hs",     id: "h_ink",           w: 380 },
  { n: "圈第三处",          k: "hs",     id: "c3",              a: "flag:f_mark_3", w: 460 },
  { n: "蘸硃圈第四处",      k: "hs",     id: "h_ink",           w: 380 },
  { n: "圈第四处",          k: "hs",     id: "c4",              a: "flag:f_mark_4", w: 460 },
  { n: "四处已圈",          k: "assert", a: "flag:f_marks_done" },
  { n: "錯法三_空手落存案槽", k: "hs",   id: "h_file",          a: "num:f_misplaced_count>=3", w: 460, err: 1 },
  { n: "錯法三已記_校記未成", k: "assert", a: "noflag:f_filed" },
  { n: "取增牌",            k: "hs",     id: "h_card_zeng",     a: "inv:it_card_zeng", w: 360 },
  { n: "選增牌",            k: "slot",   id: "it_card_zeng",    a: "slotSel:it_card_zeng", w: 200 },
  { n: "增牌落增字格",      k: "hs",     id: "h_up_zeng",       a: "flag:f_up_zeng", w: 460 },
  { n: "取改牌",            k: "hs",     id: "h_card_gai",      a: "inv:it_card_gai", w: 360 },
  { n: "選改牌",            k: "slot",   id: "it_card_gai",     a: "slotSel:it_card_gai", w: 200 },
  { n: "錯法四_改牌往刪格", k: "hs",     id: "h_up_shan",       a: "num:f_misplaced_count>=4", w: 500, err: 1 },
  { n: "錯法四已記_刪格仍空", k: "assert", a: "noflag:f_up_shan" },
  { n: "改牌落改字格",      k: "hs",     id: "h_up_gai",        a: "flag:f_up_gai", w: 460 },
  { n: "取刪牌",            k: "hs",     id: "h_card_shan",     a: "inv:it_card_shan", w: 360 },
  { n: "選刪牌",            k: "slot",   id: "it_card_shan",    a: "slotSel:it_card_shan", w: 200 },
  { n: "刪牌落刪字格",      k: "hs",     id: "h_up_shan",       a: "flag:f_up_shan", w: 460 },
  { n: "三格各有其牌",      k: "assert", a: "flag:f_typed" },
  { n: "取存牌",            k: "hs",     id: "h_card_cun",      a: "inv:it_card_cun", w: 360 },
  { n: "選存牌",            k: "slot",   id: "it_card_cun",     a: "slotSel:it_card_cun", w: 200 },
  { n: "存牌落存案槽",      k: "hs",     id: "h_file",          a: "flag:f_filed", w: 500 },
  { n: "校記成",            k: "assert", a: "flag:f_filed" },
  { n: "收束成立",          k: "assert", a: "flag:f_act7_done" },
  { n: "開台账",            k: "bk",     a: "ledger", w: 440 },
  { n: "取閱校勘記",        k: "hs",     id: "h_ledger_notes",  a: "paper", w: 520 },
  { n: "收起校勘記",        k: "dismiss", a: "noPaper", w: 260 },
  { n: "再入齋",            k: "enter",  a: "view:close", w: 400 },
  { n: "收束_本幕已畢",     k: "assert", a: "flag:f_act7_done" }
]},
8: { name: "第八幕 · 塔院", steps: [
  { n: "讀幕間",            k: "hs",     id: "h_ledger_bridge", w: 380 },
  { n: "收起幕間",          k: "hs",     id: "h_bridge_go",     a: "view:room", w: 380 },
  { n: "推門入院",          k: "enter",  a: "view:room", w: 420 },
  { n: "讀塔院體例",        k: "hs",     id: "h_rule",          a: "flag:f_rule_read", w: 340 },
  { n: "收起",              k: "dismiss", a: "noPaper", w: 190 },
  { n: "讀卷五甲本",        k: "hs",     id: "h_vol_a",         a: "flag:f_vol_a_read", w: 340 },
  { n: "收起",              k: "dismiss", a: "noPaper", w: 190 },
  { n: "讀卷五乙本",        k: "hs",     id: "h_vol_b",         a: "flag:f_vol_b_read", w: 340 },
  { n: "收起",              k: "dismiss", a: "noPaper", w: 190 },
  { n: "進兩塔近景",        k: "hs",     id: "h_tower_go",      a: "view:close", w: 660 },
  { n: "在近景",            k: "assert", a: "view:close" },
  { n: "讀勘異板",          k: "hs",     id: "h_panel",         a: "flag:f_panel_read", w: 340 },
  { n: "收起",              k: "dismiss", a: "noPaper", w: 190 },
  { n: "四處已讀",          k: "assert", a: "flag:f_panel_read" },
  { n: "取甲塔讀數牌",      k: "hs",     id: "h_tier_13",       a: "inv:it_tier13", w: 380 },
  { n: "取乙塔讀數牌",      k: "hs",     id: "h_tier_15",       a: "inv:it_tier15", w: 380 },
  { n: "錯法一_嵌到甲塔槽", k: "hs",     id: "h_towerA_slot",   a: "num:f_misplaced_count>=1", w: 480, err: 1 },
  { n: "錯法一已記_槽空",   k: "assert", a: "noflag:f_slot13_set" },
  { n: "選中甲塔牌",        k: "slot",   id: "it_tier13",       a: "slotSel:it_tier13", w: 340 },
  { n: "嵌到甲塔槽",        k: "hs",     id: "h_towerA_slot",   a: "flag:f_slot13_set", w: 560 },
  { n: "選中乙塔牌",        k: "slot",   id: "it_tier15",       a: "slotSel:it_tier15", w: 340 },
  { n: "嵌到乙塔槽",        k: "hs",     id: "h_towerB_slot",   a: "flag:f_slot15_set", w: 520 },
  { n: "兩塔層數已記",      k: "assert", a: "flag:f_tier_pair_moved" },
  { n: "取回甲塔牌",        k: "hs",     id: "h_towerA_slot",   a: "inv:it_tier13", w: 380 },
  { n: "選甲塔牌",          k: "slot",   id: "it_tier13",       a: "slotSel:it_tier13", w: 200 },
  { n: "甲牌擺上尺板",      k: "hs",     id: "h_meas",          a: "noinv:it_tier13", w: 460 },
  { n: "取回乙塔牌",        k: "hs",     id: "h_towerB_slot",   a: "inv:it_tier15", w: 380 },
  { n: "選乙塔牌",          k: "slot",   id: "it_tier15",       a: "slotSel:it_tier15", w: 200 },
  { n: "乙牌擺上尺板",      k: "hs",     id: "h_meas",          a: "noinv:it_tier15", w: 520 },
  { n: "兩套數並置",        k: "assert", a: "domOn:meas-signs" },
  { n: "錯法二_空手按板",   k: "hs",     id: "h_panel",         a: "num:f_misplaced_count>=2", w: 380, err: 1 },
  { n: "收起重看",          k: "dismiss", a: "noPaper", w: 200 },
  { n: "錯法二已記_未落印", k: "assert", a: "noflag:f_panel_seal" },
  { n: "架上取竹筆",        k: "hs",     id: "h_pen",           a: "inv:it_pen", w: 460 },
  { n: "竹筆按板",          k: "hs",     id: "h_panel",         a: "flag:f_panel_seal", w: 520 },
  { n: "勘異板已落印",      k: "assert", a: "flag:f_panel_seal" },
  { n: "取銅鈴",            k: "hs",     id: "h_bell",          a: "inv:it_bell", w: 380 },
  { n: "挂上銅鈴",          k: "hs",     id: "h_bell",          a: "flag:f_bell_ok", w: 560 },
  { n: "收束成立",          k: "assert", a: "flag:f_act8_done" },
  { n: "鈴已離手",          k: "assert", a: "noinv:it_bell" },
  { n: "回院中",            k: "hs",     id: "h_close_back",    a: "view:room", w: 460 },
  { n: "開台账",            k: "bk",     a: "ledger", w: 420 },
  { n: "取閱校勘記",        k: "hs",     id: "h_ledger_notes",  a: "paper", w: 500 },
  { n: "收起校勘記",        k: "dismiss", a: "noPaper", w: 260 },
  { n: "再入院",            k: "enter",  a: "view:room", w: 400 },
  { n: "收束_本幕已畢",     k: "assert", a: "flag:f_act8_done" }
]},
9: { name: "第九幕 · 藏書閣", steps: [
  { n: "讀幕間",            k: "hs",     id: "h_ledger_bridge", w: 260 },
  { n: "收起幕間",          k: "hs",     id: "h_bridge_go",     a: "view:room", w: 260 },
  { n: "推門入閣",          k: "enter",  a: "view:room", w: 300 },
  { n: "讀藏書閣體例",      k: "hs",     id: "h_rule",          a: "flag:f_rule_read", w: 240 },
  { n: "收起",              k: "dismiss", a: "noPaper", w: 150 },
  { n: "讀散葉所據",        k: "hs",     id: "h_src",           w: 240 },
  { n: "收起",              k: "dismiss", a: "noPaper", w: 150 },
  { n: "進裝訂案近景",      k: "hs",     id: "h_go",            a: "view:close", w: 420 },
  { n: "在近景",            k: "assert", a: "view:close" },
  { n: "取第一葉荼茶",      k: "hs",     id: "h_leaf1",         a: "inv:it_leaf1", w: 260 },
  { n: "錯法一_手上有葉再取葉", k: "hs", id: "h_leaf2",         a: "num:f_misplaced_count>=1", w: 300, err: 1 },
  { n: "錯法一已記_手上仍是那一葉", k: "assert", a: "slotSel:it_leaf1" },
  { n: "荼茶歸版本門",      k: "hs",     id: "h_bin_banben",    a: "flag:f_leaf1_filed", w: 300 },
  { n: "空手點名物格",      k: "hs",     id: "h_bin_mingwu",    w: 260 },
  { n: "取第二葉遍徧",      k: "hs",     id: "h_leaf2",         a: "inv:it_leaf2", w: 240 },
  { n: "遍徧歸訓詁門",      k: "hs",     id: "h_bin_xungu",     a: "flag:f_leaf2_filed", w: 260 },
  { n: "取第三葉",          k: "hs",     id: "h_leaf3",         a: "inv:it_leaf3", w: 240 },
  { n: "三紙三張歸制度門",  k: "hs",     id: "h_bin_zhidu",     a: "flag:f_leaf3_filed", w: 260 },
  { n: "取第四葉勞蟧",      k: "hs",     id: "h_leaf4",         a: "inv:it_leaf4", w: 240 },
  { n: "勞蟧歸名物門",      k: "hs",     id: "h_bin_mingwu",    a: "flag:f_leaf4_filed", w: 260 },
  { n: "取第五葉因同",      k: "hs",     id: "h_leaf5",         a: "inv:it_leaf5", w: 240 },
  { n: "因同歸版本門",      k: "hs",     id: "h_bin_banben",    a: "flag:f_leaf5_filed", w: 260 },
  { n: "取第六葉申分",      k: "hs",     id: "h_leaf6",         a: "inv:it_leaf6", w: 240 },
  { n: "申分歸辨偽門",      k: "hs",     id: "h_bin_bianwei",   a: "flag:f_leaf6_filed", w: 260 },
  { n: "取第七葉",          k: "hs",     id: "h_leaf7",         a: "inv:it_leaf7", w: 240 },
  { n: "十三級十五重歸版本門", k: "hs",  id: "h_bin_banben",    a: "flag:f_leaf7_filed", w: 260 },
  { n: "取第八葉槃盤",      k: "hs",     id: "h_leaf8",         a: "inv:it_leaf8", w: 240 },
  { n: "槃盤歸訓詁門",      k: "hs",     id: "h_bin_xungu",     a: "flag:f_leaf8_filed", w: 300 },
  { n: "五帖已齊",          k: "assert", a: "flag:f_slots_full" },
  { n: "空手點第一孔",      k: "hs",     id: "h_hole1",         w: 260 },
  { n: "取線錐",            k: "hs",     id: "h_awl",           a: "inv:it_awl", w: 260 },
  { n: "錐開第一孔",        k: "hs",     id: "h_hole1",         a: "flag:f_hole1_pierced", w: 260 },
  { n: "錐開第二孔",        k: "hs",     id: "h_hole2",         a: "flag:f_hole2_pierced", w: 260 },
  { n: "錐開第三孔",        k: "hs",     id: "h_hole3",         a: "flag:f_hole3_pierced", w: 260 },
  { n: "錯法二_線不在手就打結", k: "hs", id: "h_knot",          a: "num:f_misplaced_count>=2", w: 300, err: 1 },
  { n: "錯法二已記_冊未訂成", k: "assert", a: "noflag:f_bound" },
  { n: "取線",              k: "hs",     id: "h_thread",        a: "inv:it_thread", w: 260 },
  { n: "穿過第一孔",        k: "hs",     id: "h_hole1",         a: "flag:f_hole1_threaded", w: 260 },
  { n: "穿過第二孔",        k: "hs",     id: "h_hole2",         a: "flag:f_hole2_threaded", w: 260 },
  { n: "錯法三_三孔未穿齊就打結", k: "hs", id: "h_knot",        a: "num:f_misplaced_count>=3", w: 320, err: 1 },
  { n: "錯法三已記_冊未訂成", k: "assert", a: "noflag:f_bound" },
  { n: "穿過第三孔",        k: "hs",     id: "h_hole3",         a: "flag:f_hole3_threaded", w: 260 },
  { n: "取題簽",            k: "hs",     id: "h_tag",           a: "inv:it_tag", w: 260 },
  { n: "錯法四_未訂就貼簽", k: "hs",     id: "h_book",          a: "num:f_misplaced_count>=4", w: 320, err: 1 },
  { n: "錯法四已記_冊未題簽", k: "assert", a: "noflag:f_titled" },
  { n: "選中線",            k: "slot",   id: "it_thread",       a: "slotSel:it_thread", w: 220 },
  { n: "打結_冊訂成",       k: "hs",     id: "h_knot",          a: "flag:f_bound", w: 340 },
  { n: "選中題簽",          k: "slot",   id: "it_tag",          a: "slotSel:it_tag", w: 220 },
  { n: "題簽貼冊脊",        k: "hs",     id: "h_book",          a: "flag:f_titled", w: 340 },
  { n: "取印",              k: "hs",     id: "h_seal",          a: "inv:it_seal", w: 260 },
  { n: "印落冊尾",          k: "hs",     id: "h_book",          a: "flag:f_sealed", w: 340 },
  { n: "收束成立",          k: "assert", a: "flag:f_act9_done" },
  { n: "回閣中",            k: "hs",     id: "h_close_back",    a: "view:room", w: 320 },
  { n: "開台账",            k: "bk",     a: "ledger", w: 300 },
  { n: "取閱校勘記",        k: "hs",     id: "h_ledger_notes",  a: "paper", w: 380 },
  { n: "收起校勘記",        k: "dismiss", a: "noPaper", w: 200 },
  { n: "再入閣",            k: "enter",  a: "view:room", w: 300 },
  { n: "收束_本幕已畢",     k: "assert", a: "flag:f_act9_done" }
]},
10: { name: "第十幕 · 樟木箱底", steps: [
  { n: "讀幕間",            k: "hs",     id: "h_ledger_bridge", w: 260 },
  { n: "收起幕間",          k: "hs",     id: "h_bridge_go",     a: "view:room", w: 260 },
  { n: "推門入庫",          k: "enter",  a: "view:room", w: 300 },
  { n: "讀合卷體例",        k: "hs",     id: "h_rule",          a: "flag:f_rule_read", w: 240 },
  { n: "收起",              k: "dismiss", a: "noPaper", w: 150 },
  { n: "讀十幕一覽",        k: "hs",     id: "h_list",          w: 240 },
  { n: "收起",              k: "dismiss", a: "noPaper", w: 150 },
  { n: "錯法一_匙不在手就開搭扣", k: "hs", id: "h_latch",       a: "num:f_misplaced_count>=1", w: 300, err: 1 },
  { n: "錯法一已記_蓋未掀", k: "assert", a: "noflag:f_lid_open" },
  { n: "蓋未掀就想走近",    k: "hs",     id: "h_go",            a: "view:room", w: 260 },
  { n: "取銅匙",            k: "hs",     id: "h_key",           a: "inv:it_key", w: 260 },
  { n: "挑開搭扣_蓋掀起",   k: "hs",     id: "h_latch",         a: "flag:f_lid_open", w: 320 },
  { n: "匙已歸案上",        k: "assert", a: "noinv:it_key" },
  { n: "走近樟木箱",        k: "hs",     id: "h_go",            a: "view:close", w: 420 },
  { n: "取第一牌",          k: "hs",     id: "h_basket",        a: "inv:it_tag5", w: 260 },
  { n: "錯法二_手上有牌再取牌", k: "hs", id: "h_basket",        a: "num:f_misplaced_count>=2", w: 300, err: 1 },
  { n: "錯法二已記_手上仍是那一牌", k: "assert", a: "slotSel:it_tag5" },
  { n: "膳房牌歸第五槽",    k: "hs",     id: "h_slot5",         a: "flag:f_slot5_filled", w: 300 },
  { n: "取第二牌",          k: "hs",     id: "h_basket",        a: "inv:it_tag2", w: 240 },
  { n: "錯法三_牌歸錯槽",   k: "hs",     id: "h_slot7",         a: "num:f_misplaced_count>=3", w: 320, err: 1 },
  { n: "錯法三已記_牌仍在手", k: "assert", a: "slotSel:it_tag2" },
  { n: "熔銅作牌歸第二槽",  k: "hs",     id: "h_slot2",         a: "flag:f_slot2_filled", w: 260 },
  { n: "錯法四_十槽未滿就合蓋", k: "hs", id: "h_shut",          a: "num:f_misplaced_count>=4", w: 300, err: 1 },
  { n: "錯法四已記_蓋未合上", k: "assert", a: "noflag:f_lid_shut" },
  { n: "空手點第十槽",      k: "hs",     id: "h_slot10",        w: 260 },
  { n: "取第三牌",          k: "hs",     id: "h_basket",        a: "inv:it_tag9", w: 240 },
  { n: "藏書閣牌歸第九槽",  k: "hs",     id: "h_slot9",         a: "flag:f_slot9_filled", w: 260 },
  { n: "取第四牌",          k: "hs",     id: "h_basket",        a: "inv:it_tag1", w: 240 },
  { n: "校書閣牌歸第一槽",  k: "hs",     id: "h_slot1",         a: "flag:f_slot1_filled", w: 260 },
  { n: "取第五牌",          k: "hs",     id: "h_basket",        a: "inv:it_tag7", w: 240 },
  { n: "抄書齋牌歸第七槽",  k: "hs",     id: "h_slot7",         a: "flag:f_slot7_filled", w: 260 },
  { n: "取第六牌",          k: "hs",     id: "h_basket",        a: "inv:it_tag3", w: 240 },
  { n: "校書堂牌歸第三槽",  k: "hs",     id: "h_slot3",         a: "flag:f_slot3_filled", w: 260 },
  { n: "取第七牌",          k: "hs",     id: "h_basket",        a: "inv:it_tag8", w: 240 },
  { n: "塔院牌歸第八槽",    k: "hs",     id: "h_slot8",         a: "flag:f_slot8_filled", w: 260 },
  { n: "取第八牌",          k: "hs",     id: "h_basket",        a: "inv:it_tag4", w: 240 },
  { n: "書庫走廊牌歸第四槽", k: "hs",    id: "h_slot4",         a: "flag:f_slot4_filled", w: 260 },
  { n: "取第九牌",          k: "hs",     id: "h_basket",        a: "inv:it_tag6", w: 240 },
  { n: "類書庫牌歸第六槽",  k: "hs",     id: "h_slot6",         a: "flag:f_slot6_filled", w: 260 },
  { n: "簏中牌盡",          k: "assert", a: "noinv:it_tag6" },
  { n: "取無名封皮",        k: "hs",     id: "h_cover",         a: "inv:it_cover", w: 260 },
  { n: "封皮歸第十槽",      k: "hs",     id: "h_slot10",        a: "flag:f_slot10_filled", w: 320 },
  { n: "十槽既滿",          k: "assert", a: "flag:f_slots_full" },
  { n: "合蓋",              k: "hs",     id: "h_shut",          a: "flag:f_lid_shut", w: 320 },
  { n: "取銅鎖",            k: "hs",     id: "h_lock",          a: "inv:it_lock", w: 260 },
  { n: "落鎖_合卷",         k: "hs",     id: "h_shut",          a: "flag:f_locked", w: 320 },
  { n: "取印",              k: "hs",     id: "h_seal",          a: "inv:it_seal", w: 260 },
  { n: "落印_兩存",         k: "hs",     id: "h_shut",          a: "flag:f_sealed", w: 320 },
  { n: "收束成立",          k: "assert", a: "flag:f_act10_done" },
  { n: "回庫中",            k: "hs",     id: "h_close_back",    a: "view:room", w: 320 },
  { n: "開台账",            k: "bk",     a: "ledger", w: 300 },
  { n: "取閱校勘記",        k: "hs",     id: "h_ledger_notes",  a: "paper", w: 380 },
  { n: "校勘記翻到末頁",    k: "pager",  w: 90 },
  { n: "全劇總目已見",      k: "assert", a: "notesHasText:全劇總目" },
  { n: "收起校勘記",        k: "dismiss", a: "noPaper", w: 200 },
  { n: "再入庫",            k: "enter",  a: "view:room", w: 300 },
  { n: "收束_本幕已畢",     k: "assert", a: "flag:f_act10_done" }
]}
  };

  /* 当前幕：由文件名 "第N幕.html" 得出 */
  function actFromUrl() {
    var m = decodeURIComponent(location.pathname).match(/([一二三四五六七八九十]+)幕\.html$/);
    if (!m) return null;
    var map = { "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10 };
    return /^十$/.test(m[1]) ? 10 : (/^十(.)$/.test(m[1]) ? 10 + (map["" + m[1][1]] || 0) : map[m[1]]);
  }
  var ACT = actFromUrl();

  /* 第十幕末页断言：全劇總目 —— 用纸面上的文字核，不猜 */
  PRED["notesHasText"] = function (x) {
    var ts = document.querySelectorAll("#paper-layer text"), all = "";
    for (var q = 0; q < ts.length; q++) all += ts[q].textContent;
    return all.indexOf(x) >= 0;
  };

  window.__live = {
    act: ACT, name: (PLANS[ACT] || {}).name || "(未登记)",
    steps: function () { return (PLANS[ACT] || { steps: [] }).steps; },
    next: next, aim: function (i) { return aim(PLANS[ACT].steps[i]); },
    mark: mark, finish: finish, fail: fail, sig: sig, result: result,
    pred: pred, ready: true
  };
  log("自测入口就绪 · " + (PLANS[ACT] ? PLANS[ACT].name : "未知幕") +
      " · 共 " + (PLANS[ACT] ? PLANS[ACT].steps.length : 0) + " 步 · 存档键 " + SAVE);
})();
