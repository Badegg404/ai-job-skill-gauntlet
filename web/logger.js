/* web/logger.js — 前端统一日志（JSONL，批量上报 /api/log → 用户 activity.log）
 *
 * 设计（对齐 skill 方法论 §3.9）：
 *  - 全链路事件化：功能打点 + 全局错误捕获（window.onerror / unhandledrejection）
 *  - 别静默吞错误：任何失败路径至少一条 warn/error
 *  - 会话关联：Logger.begin("imp"|"exam"|"iv"|"test") 生成 sessionId，一次流程一条链
 *  - 批量上报：≤50ms 合并成一次 POST /api/log，尽力而为，绝不影响主流程
 *  - 隐私：payload 由调用方控制，API key 永不入日志
 */
(function () {
  "use strict";
  const Logger = {
    session: null,      // 当前流程 sessionId（begin 设置）
    buffer: [],         // 待上报行
    timer: null,        // 批量定时器

    /** 新流程开始：kind ∈ imp/exam/iv/test/regen，返回 sessionId */
    begin(kind) {
      this.session = (kind || "flow") + "_" + Date.now().toString(36);
      return this.session;
    },

    /** 组装一行并缓冲（内部实现，外部用 info/warn/error） */
    row(level, tag, msg, payload) {
      const row = {
        at: new Date().toISOString(),
        level: level,
        session: this.session,
        tag: tag,
        msg: msg || "",
        payload: payload || {},
      };
      // 浏览器 console 同步镜像（本地调试用，不落盘）
      try {
        if (level === "error") console.error("[" + tag + "]", msg, payload);
        else if (level === "warn") console.warn("[" + tag + "]", msg, payload);
        else console.log("[" + tag + "]", msg);
      } catch (e) { /* ignore */ }
      this.buffer.push(row);
      this._flushLater();
    },

    _flushLater() {
      if (this.timer) return;
      const self = this;
      this.timer = setTimeout(function () { self.timer = null; self._flush(); }, 50);
    },

    /** 批量上报：一次 POST /api/log；失败静默（本地服务，丢几行可接受） */
    async _flush() {
      if (!this.buffer.length) return;
      const rows = this.buffer.splice(0);
      let uid = "";
      try { uid = (typeof UID !== "undefined" && UID) ? UID : ""; } catch (e) { /* ignore */ }
      try {
        await fetch("/api/log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uid: uid, rows: rows }),
        }).catch(function () { /* ignore */ });
      } catch (e) { /* ignore */ }
    },

    info(tag, msg, payload) { this.row("info", tag, msg, payload); },
    warn(tag, msg, payload) { this.row("warn", tag, msg, payload); },
    error(tag, msg, payload) { this.row("error", tag, msg, payload); },
  };

  // 浏览器：window 即全局；测试/其它环境：同步挂到 globalThis，保证全局可访问
  if (typeof window !== "undefined") window.Logger = Logger;
  if (typeof globalThis !== "undefined") globalThis.Logger = Logger;

  // 全局未捕获异常兜底：任何功能的 JS 运行时错误都能被追踪（含堆栈）
  window.addEventListener("error", function (e) {
    Logger.error("sys.uncaught", "未捕获异常: " + (e.message || "unknown"), {
      stack: String((e.error && e.error.stack) || "").slice(0, 2000),
      url: e.filename || "",
      line: e.lineno || 0,
    });
  });

  // 未处理的 Promise 拒绝（async 里漏 catch 的常见表现）
  window.addEventListener("unhandledrejection", function (e) {
    Logger.error("sys.unhandledrejection", "未处理的 Promise 拒绝", {
      reason: String((e.reason && e.reason.message) || e.reason || "").slice(0, 1000),
    });
  });
})();
