#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
server.py — 知识考核系统本地服务器（多用户版）

每个用户完全隔离：
  web/users/<uid>/course.json        该用户当前课程
  web/users/<uid>/courses/           该用户课程库
  web/users/<uid>/profile.json       该用户学习档案
  web/users/<uid>/imports/           该用户导入的资料存档

提供 API：
  POST /api/import        {uid, md, filename}              单份导入+出题
  POST /api/import-batch  {uid, files:[{filename,md}]}     批量导入+出题
  GET  /api/profile?uid=x                                   读取档案
  POST /api/profile-save  {uid, profile}                    保存档案
  GET  /api/courses-index?uid=x                             该用户课程库索引
  GET  /api/users         所有用户列表（管理员查看）

出题：前端 LLM 直连（出题/打标签/判分均由 LLM 驱动，程序负责数据结构与兜底校验）

用法:
  python3 server.py [port]
"""
import json
import logging
import os
import re
import sys
import threading
import time
import uuid
import webbrowser
import shutil
import subprocess
from collections import Counter
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from logging.handlers import RotatingFileHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs

# 业务模块导入
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE / "parser"))
sys.path.insert(0, str(HERE))
from note_parser import parse_note  # noqa: E402
from utils import (  # noqa: E402
    WEB_DIR, DATA_DIR, USERS_DIR,
    slug_from_name, content_hash, looks_like_study_note,
    dedupe_questions, shuffle_choice_options,
)
from storage import (  # noqa: E402
    find_duplicate_in_dirs, load_dir, save_dir, rebuild_dirs_index,
    safe_uid, user_dir, ensure_user, rebuild_index, archive_import,
    new_uid, get_device_uid, is_valid_dir_id,
)
from pipeline import (  # noqa: E402
    build_dir_from_files, build_course_from_md, course_summary,
    enrich_quiz, assign_chapter_refs, process_aux_file,
)

# ===== 数据目录自动 git 化（本地版本管理，纯本地无 remote，静默失败） =====
_DATA_GIT_ROOT = None
_data_commit_timer = None

def _git_ok():
    return shutil.which("git") is not None

def _data_gitignore(root):
    gi = os.path.join(root, ".gitignore")
    if not os.path.exists(gi):
        try:
            with open(gi, "w", encoding="utf-8") as fh:
                fh.write("# 运行日志不入库\nlogs/\nstartup.log\nusers/*/logs/\nusers/*/import-debug.log\nusers/*/reset-ts\n.DS_Store\n__pycache__/\n")
        except Exception:
            pass

def ensure_data_git():
    """启动时调用：数据目录自动 git 化（首次 init + 提交）。无 git / 失败静默。"""
    global _DATA_GIT_ROOT
    if not _git_ok():
        return False
    root = str(Path(DATA_DIR))
    _DATA_GIT_ROOT = root
    try:
        if not os.path.isdir(os.path.join(root, ".git")):
            subprocess.run(["git", "-C", root, "init", "-b", "main"], capture_output=True, timeout=30)
            _data_gitignore(root)
            subprocess.run(["git", "-C", root, "add", "-A"], capture_output=True, timeout=60)
            subprocess.run(["git", "-C", root, "commit", "-m", "chore: 考核数据仓库初始化", "--allow-empty"], capture_output=True, timeout=60)
            log_json(APP_LOGGER, "info", "data.git-init", "数据目录已自动 git 化", {"root": root})
        return True
    except Exception:
        return False

def schedule_data_commit(reason="数据变更"):
    """数据变更后调用：30s 防抖合并提交（静默失败，不干扰主流程）。"""
    global _data_commit_timer, _DATA_GIT_ROOT
    if not _git_ok() or not _DATA_GIT_ROOT:
        return
    def _do():
        try:
            subprocess.run(["git", "-C", _DATA_GIT_ROOT, "add", "-A"], capture_output=True, timeout=60)
            st = subprocess.run(["git", "-C", _DATA_GIT_ROOT, "status", "--porcelain"], capture_output=True, text=True, timeout=30)
            if st.stdout.strip():
                subprocess.run(["git", "-C", _DATA_GIT_ROOT, "commit", "-m", "data: 自动保存（" + reason + "）"], capture_output=True, timeout=60)
        except Exception:
            pass
    if _data_commit_timer:
        _data_commit_timer.cancel()
    _data_commit_timer = threading.Timer(30, _do)
    _data_commit_timer.daemon = True
    _data_commit_timer.start()

# ===== 日志系统（stdlib logging，零依赖） =====
# app.log:   全局系统日志（启动/端口/请求/未捕获异常），DATA_DIR/logs/app.log
# activity.log: 每用户活动日志（前端上报 + 后端业务事件），users/{uid}/logs/activity.log
# 均为 JSONL（每行一个 JSON），RotatingFileHandler 单文件 2MB × 5 份自动轮转
_LOG_MAX_BYTES = 2 * 1024 * 1024
_LOG_BACKUPS = 5

def _make_json_logger(name, path):
    """构造写 JSONL 行的文件 logger（RotatingFileHandler 轮转），失败时降级为 NullHandler。"""
    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG)
    logger.propagate = False
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        fh = RotatingFileHandler(str(path), maxBytes=_LOG_MAX_BYTES, backupCount=_LOG_BACKUPS, encoding="utf-8")
        fh.setFormatter(logging.Formatter("%(message)s"))
        logger.addHandler(fh)
    except Exception:
        logger.addHandler(logging.NullHandler())
    return logger


APP_LOGGER = _make_json_logger("app", DATA_DIR / "logs" / "app.log")

_activity_loggers = {}
_activity_lock = threading.Lock()


def activity_logger(uid):
    """按用户取活动日志 logger（进程内缓存，避免每行重建 handler）。"""
    with _activity_lock:
        lg = _activity_loggers.get(uid)
        if lg is None:
            lg = _make_json_logger("activity." + uid, user_dir(uid) / "logs" / "activity.log")
            _activity_loggers[uid] = lg
        return lg


def log_json(logger, level, tag, msg="", payload=None, **extra):
    """统一 JSONL 行组装：{at, level, tag, msg, payload, **extra}。level: info|warn|error。"""
    row = {
        "at": datetime.now().isoformat(),
        "level": level,
        "tag": tag,
        "msg": msg or "",
        "payload": payload or {},
    }
    row.update(extra)
    text = json.dumps(row, ensure_ascii=False)
    if level == "error":
        logger.error(text)
    elif level == "warn":
        logger.warning(text)
    else:
        logger.info(text)


def _clear_log_file(logger):
    """清空日志文件：对 handler 主动轮转 + 删除全部备份，让句柄指向新文件。

    不能裸 unlink 主文件——RotatingFileHandler 持有旧 inode 的句柄，
    继续写会写到已删除文件，新日志在文件系统不可见（用户实测：清空后诊断中心永远为空）。
    doRollover 会关旧句柄、把旧文件轮转为 .1、重建空主文件，再删掉 .1..N 即彻底清空。
    """
    from logging.handlers import RotatingFileHandler as _RFH
    for h in logger.handlers:
        if isinstance(h, _RFH):
            try:
                h.doRollover()
                for i in range(1, _LOG_BACKUPS + 1):
                    Path(h.baseFilename + "." + str(i)).unlink(missing_ok=True)
            except Exception:
                pass


# ===== 重置竞态防护（reset-ts 墓碑） =====
# 背景：saveState 是 fire-and-forget 的 /api/profile-save，用户点「重置」时，
# 重置前已发出的旧保存请求可能晚于 reset-all 到达并被无条件写盘 → 旧数据（含能力画像）复活。
# 方案：reset-all 写 reset-ts 时间戳墓碑；profile-save 携带 clientTs（保存发起时刻），
#        clientTs 早于 reset-ts 的请求视为「重置前挂起的旧请求」，丢弃不写盘。
RESET_TS_FILE = "reset-ts"


def is_stale_profile_save(udir, client_ts):
    """client_ts 早于最近一次重置时间戳 → 该保存是重置前挂起的旧请求，应丢弃。

    udir: 用户目录 Path；client_ts: 前端 saveState 发起时刻（毫秒时间戳，可为空/字符串）。
    缺 clientTs（老前端）或文件缺失时不拦截，保持兼容。
    """
    if not client_ts:
        return False
    try:
        client_ts = float(client_ts)
    except (TypeError, ValueError):
        return False
    ts_file = Path(udir) / RESET_TS_FILE
    if not ts_file.exists():
        return False
    try:
        reset_ts = float(ts_file.read_text(encoding="utf-8").strip())
    except Exception:
        return False
    return client_ts < reset_ts


# 静态资源目录：PyInstaller 打包后从 _MEIPASS 读取；源码运行时用本地 web/
class CourseHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB_DIR), **kwargs)

    def log_message(self, fmt, *args):
        sys.stderr.write("[course] %s\n" % (fmt % args))

    def _is_local_host(self):
        """校验 Host 头是否为本地地址（防 DNS rebinding：恶意域名解析到 127.0.0.1）。"""
        host = (self.headers.get("Host") or "").strip()
        # BUG-4 修复：先剥 IPv6 方括号再取主机部分（[::1] / [::1]:8765 / ::1 均应识别为本地）
        if host.startswith("["):
            host = host[1:].split("]")[0]
        else:
            host = host.split(":")[0]
        host = host.lower()
        return host in ("127.0.0.1", "localhost", "::1")

    def _reject_nonlocal(self):
        if not self._is_local_host():
            self.send_response(403)
            self.send_header("Content-Length", "0")
            self.end_headers()
            return True
        return False

    def _serve_exam_html(self):
        """返回 exam.html，并把静态资源版本号替换为文件修改时间戳。

        根治浏览器（尤其 Safari）缓存旧 JS/CSS 的问题：文件一改，
        版本号自动变化，浏览器就会重新请求，无需手动 bump。
        """
        html_path = WEB_DIR / "exam.html"
        if not html_path.exists():
            self.send_error(404, "Not Found")
            return
        html = html_path.read_text(encoding="utf-8")

        def versioned(name):
            f = WEB_DIR / name
            mtime = int(f.stat().st_mtime) if f.exists() else 0
            return f"{name}?v={mtime}"

        # 静态资源版本注入：通配所有本地 .js/.css（?v= 可选），按文件 mtime 生成版本号，避免浏览器缓存旧版
        html = re.sub(r'(src|href)="([^"]+\.(?:js|css))(?:\?v=[^"]*)?"', lambda m: f'{m.group(1)}="{versioned(m.group(2))}"', html)

        body = html.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    # ---- 业务接口 ----
    # 统一包装：任何 handler 抛出的异常都带 traceback 落盘（不静默），并记录请求耗时
    def _log_request(self, method, path, dur_ms):
        """请求级日志：慢请求(>2s)记 warn；API 请求记 info；静态资源只记 slow（避免淹没业务日志）。
        异常路径不调用本函数（异常已单独记 http.uncaught error），避免同一异常记两行。"""
        if dur_ms > 2000:
            log_json(APP_LOGGER, "warn", "http.slow", "慢请求", {"method": method, "path": path, "durMs": dur_ms})
        elif path.startswith("/api/"):
            log_json(APP_LOGGER, "info", "http." + method.lower(), "", {"path": path, "durMs": dur_ms})

    def do_GET(self):
        t0 = time.time()
        exc = None
        try:
            self._dispatch_get()
        except Exception as e:
            exc = e
            import traceback
            log_json(APP_LOGGER, "error", "http.uncaught", "GET 未捕获异常: " + self.path,
                     {"method": "GET", "path": self.path, "err": str(e),
                      "traceback": traceback.format_exc()[-1500:]})
            try:
                self._send_json({"error": "服务器内部错误"}, 500)
            except Exception:
                pass
        finally:
            if exc is None:
                self._log_request("GET", self.path, round((time.time() - t0) * 1000))

    def _dispatch_get(self):
        if self._reject_nonlocal():
            return
        parsed = urlparse(self.path)
        q = parse_qs(parsed.query)
        if parsed.path == "/api/logs":
            self._handle_logs(q)
            return
        if parsed.path == "/api/profile":
            self._handle_profile(q)
            return
        if parsed.path == "/api/courses-index":
            self._handle_courses_index(q)
            return
        if parsed.path == "/api/user-course":
            self._handle_user_course(q)
            return
        if parsed.path == "/api/user-course-file":
            self._handle_user_course_file(q)
            return
        if parsed.path == "/api/users":
            self._handle_users()
            return
        if parsed.path == "/api/new-user":
            self._send_json({"ok": True, "uid": new_uid()})
            return
        if parsed.path == "/api/whoami":
            self._send_json({"ok": True, "uid": get_device_uid()})
            return
        if parsed.path == "/api/llm-env":
            self._handle_llm_env(q)
            return
        if parsed.path == "/api/dirs":
            self._handle_dirs(q)
            return
        if parsed.path == "/api/dir":
            self._handle_dir(q)
            return
        # 主页：动态注入静态资源版本号（文件修改时间），根治浏览器缓存旧资源
        if parsed.path in ("/", "/exam.html", "/index.html"):
            self._serve_exam_html()
            return
        super().do_GET()

    def do_POST(self):
        t0 = time.time()
        exc = None
        try:
            self._dispatch_post()
        except Exception as e:
            exc = e
            import traceback
            log_json(APP_LOGGER, "error", "http.uncaught", "POST 未捕获异常: " + self.path,
                     {"method": "POST", "path": self.path, "err": str(e),
                      "traceback": traceback.format_exc()[-1500:]})
            try:
                self._send_json({"error": "服务器内部错误"}, 500)
            except Exception:
                pass
        finally:
            if exc is None:
                self._log_request("POST", self.path, round((time.time() - t0) * 1000))

    def _dispatch_post(self):
        if self._reject_nonlocal():
            return
        parsed = urlparse(self.path)
        if parsed.path == "/api/import":
            self._handle_import()
        elif parsed.path == "/api/import-batch":
            self._handle_import_batch()
        elif parsed.path == "/api/profile-save":
            self._handle_profile_save()
        elif parsed.path == "/api/course-save":
            self._handle_course_save()
        elif parsed.path == "/api/dir-rename":
            self._handle_dir_rename()
        elif parsed.path == "/api/dir-delete":
            self._handle_dir_delete()
        elif parsed.path == "/api/dir-file-add":
            self._handle_dir_file_add()
        elif parsed.path == "/api/import-debug":
            self._handle_import_debug()
        elif parsed.path == "/api/log":
            self._handle_log()
        elif parsed.path == "/api/logs-clear":
            self._handle_logs_clear()
        elif parsed.path == "/api/dir-file-delete":
            self._handle_dir_file_delete()
        elif parsed.path == "/api/run-code":
            self._handle_run_code()
        elif parsed.path == "/api/reset-all":
            self._handle_reset_all()
        else:
            self.send_error(404, "Not Found")

    def _read_body(self, max_bytes=50 * 1024 * 1024):
        """请求体长度上限（默认 50MB，导入资料可能较大）；超限返回空体并记录日志。"""
        length = int(self.headers.get("Content-Length", 0))
        if length <= 0:
            return b""
        if length > max_bytes:
            log_json(APP_LOGGER, "warn", "http.body-too-large", "请求体超过上限", {"length": length, "max": max_bytes})
            return b""
        return self.rfile.read(length)

    def _send_json(self, obj, status=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_shell_exports(self):
        """解析常见 shell 配置文件里的 export KEY=value（双击启动的 .app 读不到 shell 环境变量，
        但用户常把 API Key 写在 ~/.zshrc / ~/.bashrc 里，这里主动扫一遍）。返回 {KEY: value}。"""
        home = os.path.expanduser("~")
        files = [
            os.path.join(home, ".zshrc"),
            os.path.join(home, ".zprofile"),
            os.path.join(home, ".bashrc"),
            os.path.join(home, ".bash_profile"),
            os.path.join(home, ".profile"),
        ]
        exports = {}
        for fp in files:
            try:
                with open(fp, "r", encoding="utf-8", errors="ignore") as fh:
                    for line in fh:
                        m = re.match(r'^\s*export\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+?)\s*$', line.strip())
                        if not m:
                            continue
                        val = m.group(2).strip()
                        # 去掉首尾成对引号
                        if len(val) >= 2 and val[0] in ('"', "'") and val[-1] == val[0]:
                            val = val[1:-1]
                        exports[m.group(1)] = val
            except OSError:
                continue
        return exports

    @staticmethod
    def _mask_key(val):
        """S-2 加固：Key 掩码显示（sk-***last4），避免 shell 配置里的完整 Key 经页面泄露。"""
        val = (val or "").strip()
        if len(val) <= 8:
            return val[:3] + "***"
        return val[:3] + "***" + val[-4:]

    def _handle_llm_env(self, q=None):
        """读取本机环境变量 / shell 配置文件里的 LLM API Key（可选功能），供前端「从本机环境读取」填入。
        仅在本机服务内访问（_reject_nonlocal 已拦），Key 不离开本机。
        S-2 加固：默认只返回掩码 Key；前端确认后带 full=1 才返回完整 Key。"""
        # 常见 LLM API Key 环境变量 → 推断的 base / 默认模型 / 展示名
        CANDIDATES = [
            ("DASHSCOPE_API_KEY", "https://dashscope.aliyuncs.com/compatible-mode/v1", "qwen-turbo", "阿里云百炼（通义千问）"),
            ("DEEPSEEK_API_KEY", "https://api.deepseek.com", "deepseek-chat", "DeepSeek 官方"),
            ("OPENAI_API_KEY", "https://api.openai.com/v1", "gpt-4o-mini", "OpenAI 官方"),
            ("MOONSHOT_API_KEY", "https://api.moonshot.cn/v1", "moonshot-v1-8k", "Moonshot（Kimi）"),
            ("ZHIPU_API_KEY", "https://open.bigmodel.cn/api/paas/v4", "glm-4-flash", "智谱（GLM）"),
            ("ZHIPUAI_API_KEY", "https://open.bigmodel.cn/api/paas/v4", "glm-4-flash", "智谱（GLM）"),
        ]
        # 合并：os.environ（继承）优先，其次 shell 配置文件里的 export
        env_map = dict(os.environ)
        env_map.update(self._read_shell_exports())
        full = bool(q and ((q.get("full") or [""])[0] == "1"))   # 仅前端确认后才返回完整 Key
        found = []
        for env, base, model, label in CANDIDATES:
            val = (env_map.get(env) or "").strip()
            if val:
                found.append({"env": env, "key": val if full else self._mask_key(val), "base": base, "model": model, "label": label})
        self._send_json({"ok": True, "found": found})

    def _require_uid(self, data):
        uid = safe_uid(data.get("uid") or data.get("userId"))
        if not uid:
            self._send_json({"error": "缺少有效的用户 ID"}, 400)
            return None
        return uid

    # ---- 档案 ----
    def _handle_profile(self, query):
        uid = safe_uid((query.get("uid") or [""])[0])
        if not uid:
            self._send_json({"ok": True, "profile": None})
            return
        pf = user_dir(uid) / "profile.json"
        if pf.exists():
            try:
                data = json.loads(pf.read_text(encoding="utf-8"))
                self._send_json({"ok": True, "profile": data})
                return
            except Exception:
                pass
        self._send_json({"ok": True, "profile": None})

    def _handle_profile_save(self):
        try:
            data = json.loads(self._read_body().decode("utf-8"))
        except Exception:
            self._send_json({"error": "请求体必须是 JSON"}, 400)
            return
        uid = self._require_uid(data)
        if not uid:
            return
        profile = data.get("profile")
        if profile is None:
            self._send_json({"error": "缺少 profile 字段"}, 400)
            return
        try:
            d = ensure_user(uid)
            # 重置竞态防护：重置前挂起的旧保存请求（clientTs 早于 reset-ts）丢弃，防止旧数据复活
            if is_stale_profile_save(d, data.get("clientTs")):
                log_json(APP_LOGGER, "warn", "profile.stale-save-dropped", "丢弃重置前挂起的旧 profile 保存",
                         {"uid": uid, "clientTs": data.get("clientTs")})
                self._send_json({"ok": True, "stale": True})
                return
            (d / "profile.json").write_text(json.dumps(profile, ensure_ascii=False, indent=2), encoding="utf-8")
            schedule_data_commit("画像保存")
            self._send_json({"ok": True, "saved": str(d / "profile.json")})
        except Exception as e:
            self._send_json({"error": f"保存失败: {e}"}, 500)

    def _handle_course_save(self):
        """前端 LLM 出题后保存课程（服务器不接触 API key，只存结果）。

        若带 dirId，则同时回写对应目录文件，保证目录视图能看到 LLM 出的题（H2）。
        """
        try:
            data = json.loads(self._read_body().decode("utf-8"))
        except Exception:
            self._send_json({"error": "请求体必须是 JSON"}, 400)
            return
        uid = self._require_uid(data)
        if not uid:
            return
        course = data.get("course")
        if not course:
            self._send_json({"error": "缺少 course 字段"}, 400)
            return
        dir_id = data.get("dirId") or None
        try:
            d = ensure_user(uid)
            (d / "course.json").write_text(json.dumps(course, ensure_ascii=False, indent=2), encoding="utf-8")
            # 同时更新该用户课程库（slug 统一从 course.source.notePath 派生，不用 Path.stem，见 M3）
            summary = course_summary(course)
            slug = summary["slug"]
            if slug:
                lib_file = d / "courses" / f"{slug}.json"
                lib_file.write_text(json.dumps(course, ensure_ascii=False, indent=2), encoding="utf-8")
                rebuild_index(uid)
            # H2：回写目录文件，让目录模型（dirs/）与当前课程一致
            if dir_id:
                dd = load_dir(uid, dir_id)
                if dd is not None:
                    dd["course"] = course
                    # 重新统计各文件贡献题数（fromFile）
                    quiz_by_file = Counter(q.get("fromFile", "") for q in course.get("quiz", []))
                    for f in dd.get("files", []):
                        f["questionCount"] = quiz_by_file.get(f.get("filename", ""), 0)
                    save_dir(uid, dd)
            schedule_data_commit("课程保存")
            self._send_json({"ok": True, "saved": str(d / "course.json")})
        except Exception as e:
            self._send_json({"error": f"保存失败: {e}"}, 500)

    # ---- 课程库索引 ----
    def _handle_courses_index(self, query):
        uid = safe_uid((query.get("uid") or [""])[0])
        if not uid:
            self._send_json({"courses": [], "total": 0})
            return
        idx = user_dir(uid) / "courses" / "index.json"
        if idx.exists():
            try:
                data = json.loads(idx.read_text(encoding="utf-8"))
                self._send_json(data)
                return
            except Exception as e:
                log_json(APP_LOGGER, "warn", "dir.index-corrupt", "课程库索引读取失败，回退空列表",
                         {"uid": uid, "path": str(idx), "err": str(e)})
        self._send_json({"courses": [], "total": 0})

    def _handle_user_course(self, query):
        """该用户的当前课程；无则返回空课程。"""
        uid = safe_uid((query.get("uid") or [""])[0])
        if not uid:
            empty = {"title": "未导入课程", "quiz": [], "chapters": [], "concepts": [], "learningObjectives": [], "difficulties": [], "tasks": []}
            self._send_json({"course": empty})
            return
        cf = user_dir(uid) / "course.json"
        if cf.exists():
            try:
                course = json.loads(cf.read_text(encoding="utf-8"))
                self._send_json({"course": course})
                return
            except Exception as e:
                log_json(APP_LOGGER, "warn", "course.read-corrupt", "course.json 读取失败，回退空课程",
                         {"uid": uid, "path": str(cf), "err": str(e)})
        empty = {"title": "未导入课程", "quiz": [], "chapters": [], "concepts": [], "learningObjectives": [], "difficulties": [], "tasks": []}
        self._send_json({"course": empty})

    def _handle_user_course_file(self, query):
        """读取该用户课程库中的指定课程文件。"""
        uid = safe_uid((query.get("uid") or [""])[0])
        fname = (query.get("file") or [""])[0]
        # S-3 加固：文件名白名单（slug.json），彻底挡路径穿越（../、绝对路径、\、~）
        if not uid or not re.fullmatch(r"[A-Za-z0-9_\-]+\.json", fname):
            self._send_json({})
            return
        cf = user_dir(uid) / "courses" / fname
        if cf.exists():
            try:
                self._send_json(json.loads(cf.read_text(encoding="utf-8")))
                return
            except Exception:
                pass
        self._send_json({})

    # ---- 用户列表 ----
    def _handle_users(self):
        users = []
        if USERS_DIR.exists():
            for d in sorted(USERS_DIR.iterdir()):
                if not d.is_dir():
                    continue
                pf = d / "profile.json"
                nick = ""
                if pf.exists():
                    try:
                        pf_data = json.loads(pf.read_text(encoding="utf-8"))
                        nick = pf_data.get("nickname", "")
                    except Exception:
                        pass
                users.append({"uid": d.name, "nickname": nick})
        self._send_json({"ok": True, "users": users})

    # ---- 资料目录管理 ----
    def _handle_dirs(self, query):
        """目录索引。"""
        uid = safe_uid((query.get("uid") or [""])[0])
        if not uid:
            self._send_json({"dirs": [], "total": 0})
            return
        idx = user_dir(uid) / "dirs" / "index.json"
        if idx.exists():
            try:
                self._send_json(json.loads(idx.read_text(encoding="utf-8")))
                return
            except Exception:
                pass
        self._send_json({"dirs": [], "total": 0})

    def _handle_dir(self, query):
        """读取单个目录详情。"""
        uid = safe_uid((query.get("uid") or [""])[0])
        dir_id = (query.get("id") or [""])[0]
        dd = load_dir(uid, dir_id)
        if dd is None:
            self._send_json({})
            return
        self._send_json(dd)

    def _handle_dir_rename(self):
        try:
            data = json.loads(self._read_body().decode("utf-8"))
        except Exception:
            self._send_json({"error": "请求体必须是 JSON"}, 400)
            return
        uid = self._require_uid(data)
        if not uid:
            return
        dir_id = data.get("id", "")
        title = (data.get("title") or "").strip()
        if not dir_id or not title:
            self._send_json({"error": "缺少 id 或 title"}, 400)
            return
        dd = load_dir(uid, dir_id)
        if dd is None:
            self._send_json({"error": "目录不存在"}, 404)
            return
        old_slug = slug_from_name(dd.get("title", ""))
        dd["title"] = title[:40]
        # 同步更新 course.title
        if dd.get("course"):
            dd["course"]["title"] = title[:40]
        save_dir(uid, dd)
        # M1：改名后同步 courses/ 镜像（旧 slug → 新 slug）
        new_slug = slug_from_name(title[:40])
        if old_slug != new_slug:
            d = user_dir(uid)
            old_mirror = d / "courses" / f"{old_slug}.json"
            new_mirror = d / "courses" / f"{new_slug}.json"
            if old_mirror.exists() and not new_mirror.exists():
                try:
                    old_mirror.rename(new_mirror)
                    rebuild_index(uid)
                except Exception as e:
                    log_json(APP_LOGGER, "warn", "dir.rename-mirror-fail", "目录改名后课程镜像同步失败",
                             {"dirId": dir_id, "old": str(old_mirror), "new": str(new_mirror), "err": str(e)})
        schedule_data_commit("目录改名")
        self._send_json({"ok": True, "title": dd["title"]})

    def _handle_import_debug(self):
        """导入诊断日志：前端上报 LLM 生成失败详情，落盘到用户目录，供排查导入问题。"""
        try:
            data = json.loads(self._read_body().decode("utf-8"))
        except Exception:
            self._send_json({"error": "请求体必须是 JSON"}, 400)
            return
        uid = str(data.get("uid") or "").strip()
        if not safe_uid(uid):
            self._send_json({"error": "非法 uid"}, 400)
            return
        try:
            d = user_dir(uid)
            d.mkdir(parents=True, exist_ok=True)
            with open(d / "import-debug.log", "a", encoding="utf-8") as f:
                f.write(json.dumps({
                    "at": datetime.now().isoformat(),
                    "tag": data.get("tag"),
                    "payload": data.get("payload"),
                }, ensure_ascii=False) + chr(10))
        except Exception as e:
            log_json(APP_LOGGER, "error", "log.write-fail", "import-debug.log 写盘失败", {"err": str(e)})
        self._send_json({"ok": True})

    def _handle_log(self):
        """前端日志批量上报：写用户 activity.log（JSONL），逐行校验类型。"""
        try:
            data = json.loads(self._read_body().decode("utf-8"))
        except Exception:
            self._send_json({"error": "请求体必须是 JSON"}, 400)
            return
        uid = str(data.get("uid") or "").strip()
        if not safe_uid(uid):
            self._send_json({"error": "非法 uid"}, 400)
            return
        rows = data.get("rows")
        if not isinstance(rows, list):
            self._send_json({"error": "rows 必须是数组"}, 400)
            return
        lg = activity_logger(uid)
        n = 0
        for row in rows:
            if not isinstance(row, dict):
                continue
            try:
                lg.info(json.dumps(row, ensure_ascii=False))
                n += 1
            except Exception:
                continue
        schedule_data_commit("追加文件")
        self._send_json({"ok": True, "n": n})

    def _handle_logs(self, q):
        """诊断中心只读接口：file=activity|app，limit=N 行（默认 300，上限 2000）。"""
        uid = str((q.get("uid") or [""])[0]).strip()
        if not safe_uid(uid):
            self._send_json({"error": "非法 uid"}, 400)
            return
        file = (q.get("file") or ["activity"])[0]
        if file not in ("activity", "app"):
            self._send_json({"error": "file 只能是 activity 或 app"}, 400)
            return
        try:
            limit = int((q.get("limit") or ["300"])[0])
        except (TypeError, ValueError):
            limit = 300
        limit = max(1, min(limit, 2000))
        p = (DATA_DIR / "logs" / "app.log") if file == "app" else (user_dir(uid) / "logs" / "activity.log")
        lines = []
        total = 0
        if p.exists():
            try:
                raw = p.read_text(encoding="utf-8", errors="replace").splitlines()
                total = len(raw)
                lines = raw[-limit:]
            except Exception as e:
                log_json(APP_LOGGER, "error", "log.read-fail", "日志读取失败", {"path": str(p), "err": str(e)})
        self._send_json({"ok": True, "file": file, "lines": lines, "total": total, "path": str(p)})

    def _handle_logs_clear(self):
        """清空日志（仅用户手动触发，诊断中心按钮）。"""
        try:
            data = json.loads(self._read_body().decode("utf-8"))
        except Exception:
            self._send_json({"error": "请求体必须是 JSON"}, 400)
            return
        uid = str(data.get("uid") or "").strip()
        if not safe_uid(uid):
            self._send_json({"error": "非法 uid"}, 400)
            return
        file = data.get("file") or "activity"
        if file not in ("activity", "app"):
            self._send_json({"error": "file 只能是 activity 或 app"}, 400)
            return
        # 用 _clear_log_file 轮转重建句柄（裸 unlink 会让 handler 写已删 inode → 新日志不可见，评审发现的高严重 bug）
        lg = APP_LOGGER if file == "app" else activity_logger(uid)
        try:
            _clear_log_file(lg)
            cleared = True
        except Exception as e:
            cleared = False
            log_json(APP_LOGGER, "error", "log.clear-fail", "日志清空失败", {"path": str(lg.handlers[0].baseFilename) if lg.handlers else str(p), "err": str(e)})
        log_json(activity_logger(uid), "info", "log.cleared", "日志已清空", {"file": file})
        self._send_json({"ok": True, "cleared": cleared})


    def _handle_dir_delete(self):
        try:
            data = json.loads(self._read_body().decode("utf-8"))
        except Exception:
            self._send_json({"error": "请求体必须是 JSON"}, 400)
            return
        uid = self._require_uid(data)
        if not uid:
            return
        dir_id = data.get("id", "")
        if not is_valid_dir_id(dir_id):
            self._send_json({"error": "非法目录 id"}, 400)
            return
        # M1：删除目录时同步删除旧课程库镜像（按标题派生的 slug）
        dd = load_dir(uid, dir_id)
        if dd is not None:
            slug = slug_from_name(dd.get("title", ""))
            mirror = user_dir(uid) / "courses" / f"{slug}.json"
            if mirror.exists():
                try:
                    mirror.unlink()
                except Exception as e:
                    log_json(APP_LOGGER, "warn", "dir.delete-mirror-fail", "删除目录时课程镜像删除失败",
                             {"dirId": dir_id, "mirror": str(mirror), "err": str(e)})
            rebuild_index(uid)
        f = user_dir(uid) / "dirs" / f"{dir_id}.json"
        if f.exists():
            f.unlink()
        rebuild_dirs_index(uid)
        self._send_json({"ok": True})

    def _handle_run_code(self):
        """执行用户补全的 Python 代码（实战题「代码补全 + 运行验证」）。
        本地 subprocess 运行，8 秒超时；只返回运行输出（不含代码），代码内容不入日志。
        """
        try:
            body = self._read_body(1 * 1024 * 1024)
            data = json.loads(body or b"{}")
            code = str(data.get("code") or "")
            if not code.strip():
                self._send_json({"ok": False, "error": "代码为空"})
                return
            timeout_ms = int(data.get("timeoutMs") or 8000)
            timeout_s = max(1, min(timeout_ms, 15000) / 1000.0)
            import subprocess, tempfile, shutil
            # 隔离工作目录（空临时目录，代码无法读取用户文件）
            workdir = tempfile.mkdtemp(prefix="exam-run-")
            try:
                # Unix 下加资源限制：内存 256MB / CPU 5s，防恶意或失控代码吃满机器
                pre = None
                try:
                    import resource
                    def _pre():
                        resource.setrlimit(resource.RLIMIT_AS, (256 * 1024 * 1024, 256 * 1024 * 1024))
                        resource.setrlimit(resource.RLIMIT_CPU, (5, 5))
                    pre = _pre
                except Exception:
                    pass
                proc = subprocess.run(
                    [sys.executable, "-u", "-c", code],
                    capture_output=True, text=True, timeout=timeout_s,
                    cwd=workdir,
                    preexec_fn=pre if pre else None,
                    env={"PATH": os.environ.get("PATH", ""), "HOME": workdir, "PYTHONIOENCODING": "utf-8"},
                )
                out = proc.stdout or ""
                err = proc.stderr or ""
                if len(out) > 20000: out = out[-20000:] + "\n[输出已截断]"
                if len(err) > 8000: err = err[-8000:] + "\n[错误已截断]"
                self._send_json({"ok": True, "exitCode": proc.returncode, "stdout": out, "stderr": err})
            except subprocess.TimeoutExpired:
                self._send_json({"ok": True, "exitCode": -1, "stdout": "", "stderr": "[运行超时（8s）——代码可能死循环，请检查]"})
            finally:
                shutil.rmtree(workdir, ignore_errors=True)
        except Exception as e:
            self._send_json({"ok": False, "error": "运行失败: " + str(e)[:200]})

    def _handle_reset_all(self):
        """彻底清空该用户的所有数据：当前课程、课程库、资料目录、档案、导入存档。"""
        try:
            data = json.loads(self._read_body().decode("utf-8"))
        except Exception:
            self._send_json({"error": "请求体必须是 JSON"}, 400)
            return
        uid = self._require_uid(data)
        if not uid:
            return
        d = user_dir(uid)
        # 重置竞态防护（评审 B）：墓碑必须在删除**之前**写——多线程下若先删后写，
        # 重置前挂起的旧 profile-save 恰在删除后、墓碑前的窗口到达会读不到墓碑而放行（复活窗口）。
        # 先写墓碑则整个删除期间旧请求（clientTs 更早）都会被拦截。
        try:
            (d / RESET_TS_FILE).write_text(str(time.time() * 1000), encoding="utf-8")
        except Exception as e:
            log_json(APP_LOGGER, "warn", "profile.reset-ts-fail", "写 reset-ts 墓碑失败", {"err": str(e)})
        clear_fail = 0
        # 删除当前课程 + 档案
        for name in ("course.json", "profile.json"):
            f = d / name
            if f.exists():
                try:
                    f.unlink()
                except Exception:
                    clear_fail += 1
        # 清空课程库、导入存档、资料目录
        for sub in ("courses", "imports", "dirs"):
            sd = d / sub
            if sd.exists():
                for f in sd.glob("*"):
                    if f.is_file():
                        try:
                            f.unlink()
                        except Exception:
                            clear_fail += 1
        if clear_fail:
            log_json(APP_LOGGER, "warn", "profile.reset-partial", "重置数据时部分文件删除失败",
                     {"uid": uid, "failed": clear_fail})
        log_json(activity_logger(uid), "info", "profile.reset", "用户重置了全部数据", {"resetDir": str(d)})
        schedule_data_commit("重置数据")
        self._send_json({"ok": True, "reset": str(d)})

    def _handle_dir_file_delete(self):
        """删除目录里的某个文件，连带删除它生成的题目。"""
        try:
            data = json.loads(self._read_body().decode("utf-8"))
        except Exception:
            self._send_json({"error": "请求体必须是 JSON"}, 400)
            return
        uid = self._require_uid(data)
        if not uid:
            return
        dir_id = data.get("id", "")
        filename = data.get("filename", "")
        dd = load_dir(uid, dir_id)
        if dd is None:
            self._send_json({"error": "目录不存在"}, 404)
            return
        if not filename:
            self._send_json({"error": "缺少 filename"}, 400)
            return
        # 从文件清单移除
        dd["files"] = [f for f in dd.get("files", []) if f.get("filename") != filename]
        # 连带删除该文件生成的题目（fromFile 匹配）
        course = dd.get("course") or {}
        removed = 0
        keep = []
        for q in course.get("quiz", []):
            if q.get("fromFile") == filename:
                removed += 1
            else:
                keep.append(q)
        course["quiz"] = keep
        # 同时清理 materials 里对应文件
        course["materials"] = [m for m in course.get("materials", []) if m.get("file") != Path(filename).name and m.get("path") != filename]
        dd["course"] = course
        save_dir(uid, dd)
        schedule_data_commit("删除文件")
        self._send_json({"ok": True, "removedQuestions": removed, "fileCount": len(dd["files"]), "quizCount": len(keep)})

    def _handle_dir_file_add(self):
        """往已有目录追加文件（重新解析合并，连带新增题目）。"""
        try:
            data = json.loads(self._read_body().decode("utf-8"))
        except Exception:
            self._send_json({"error": "请求体必须是 JSON"}, 400)
            return
        uid = self._require_uid(data)
        if not uid:
            return
        dir_id = data.get("id", "")
        files = data.get("files", [])
        api_key = data.get("apiKey") or None
        dd = load_dir(uid, dir_id)
        if dd is None:
            self._send_json({"error": "目录不存在"}, 404)
            return
        if not files:
            self._send_json({"error": "没有文件"}, 400)
            return

        # 对每个文件查重（本目录 + 其他目录）
        duplicates = []
        added = []
        errors = []   # D-8 修复：收集解析失败的文件，不再静默吞错
        existing_files = {f.get("filename") for f in dd.get("files", [])}
        existing_hashes = {f.get("hash") for f in dd.get("files", [])}
        course = dd.get("course") or {}
        qid = 3000 + len(course.get("quiz", []))
        new_materials = course.get("materials", [])

        for item in files:
            filename = item.get("filename", "note.md")
            md = item.get("md", "")
            kind = item.get("kind", "note")
            if not md.strip():
                continue
            h = content_hash(md)
            # 本目录内已存在
            if filename in existing_files or h in existing_hashes:
                duplicates.append({"filename": filename, "reason": "本目录已有", "title": dd.get("title", "")})
                continue
            # 其他目录查重
            dup, info = find_duplicate_in_dirs(uid, filename, md)
            if dup:
                duplicates.append({"filename": filename, "reason": info.get("reason", "重复"), "title": info.get("title", "")})
                continue
            # 产物/缓存目录 → 不出题，仅挂进文件清单
            if kind == "artifact":
                existing_files.add(filename)
                existing_hashes.add(h)
                added.append({"filename": filename, "kind": kind, "hash": h})
                continue
            is_note = kind == "note" and filename.lower().endswith((".md", ".markdown"))
            # 内容兜底：.md 但不像学习笔记（如新闻汇总）→ 降级为辅助资料
            if is_note and not looks_like_study_note(md, filename):
                is_note = False
                kind = "text"
            if is_note:
                try:
                    c, _, _ = build_course_from_md(uid, md, filename, api_key)
                    for q in c.get("quiz", []):
                        q["fromFile"] = filename
                        course.setdefault("quiz", []).append(q)
                except Exception as e:
                    # D-8 修复：收集错误并返回给前端，用户能看到「某文件解析失败」
                    errors.append({"filename": filename, "error": str(e)})
                    continue
            else:
                aux_qs, material = process_aux_file(filename, md, qid)
                qid += len(aux_qs)
                for q in aux_qs:
                    q["fromFile"] = filename
                    course.setdefault("quiz", []).append(q)
                new_materials.append(material)
            existing_files.add(filename)
            existing_hashes.add(h)
            added.append({"filename": filename, "kind": kind, "hash": h})

        # 去重 + 补全 + 更新文件清单
        course["quiz"] = dedupe_questions(course.get("quiz", []))
        # M4：统一重排 id，避免 file-add 复用 qid 撞车
        for i, q in enumerate(course["quiz"]):
            q["id"] = 2000 + i + 1
        course = enrich_quiz(course)
        course = assign_chapter_refs(course)
        course["materials"] = new_materials
        quiz_by_file = Counter(q.get("fromFile", "") for q in course.get("quiz", []))
        for f in dd.get("files", []):
            f["questionCount"] = quiz_by_file.get(f.get("filename", ""), 0)
        for a in added:
            dd.setdefault("files", []).append({
                "filename": a["filename"], "kind": a["kind"], "hash": a["hash"],
                "questionCount": quiz_by_file.get(a["filename"], 0),
            })
        dd["course"] = course
        save_dir(uid, dd)
        self._send_json({"ok": True, "duplicates": duplicates, "added": len(added), "quizCount": len(course.get("quiz", [])), "errors": errors})

    # ---- 导入 ----
    def _handle_import(self):
        try:
            data = json.loads(self._read_body().decode("utf-8"))
        except Exception:
            self._send_json({"error": "请求体必须是 JSON"}, 400)
            return
        uid = self._require_uid(data)
        if not uid:
            return
        md = data.get("md", "")
        filename = data.get("filename", "note.md")
        api_key = data.get("apiKey") or None
        if not md.strip():
            self._send_json({"error": "md 内容为空"}, 400)
            return
        try:
            course, engine_questions, llm_questions = build_course_from_md(uid, md, filename, api_key)
            summary = course_summary(course)
            d = ensure_user(uid)

            # 1. 保存当前课程
            (d / "course.json").write_text(json.dumps(course, ensure_ascii=False, indent=2), encoding="utf-8")

            # 2. 加入该用户课程库
            slug = summary["slug"]
            lib_file = d / "courses" / f"{slug}.json"
            lib_file.write_text(json.dumps(course, ensure_ascii=False, indent=2), encoding="utf-8")
            rebuild_index(uid)

            # 3. 存档原始资料
            archive = archive_import(uid, filename, md, summary, len(engine_questions), len(llm_questions))

            schedule_data_commit("导入资料")
            self._send_json({
                "ok": True,
                "summary": summary,
                "engineGenerated": len(engine_questions),
                "llmGenerated": len(llm_questions),
                "course": course,
                "archive": archive,
            })
        except Exception as e:
            import traceback
            traceback.print_exc()
            self._send_json({"error": f"导入失败: {e}"}, 500)

    def _handle_import_batch(self):
        try:
            data = json.loads(self._read_body().decode("utf-8"))
        except Exception:
            self._send_json({"error": "请求体必须是 JSON"}, 400)
            return
        uid = self._require_uid(data)
        if not uid:
            return
        files = data.get("files", [])
        api_key = data.get("apiKey") or None
        if not files:
            self._send_json({"error": "没有可导入的资料"}, 400)
            return

        d = ensure_user(uid)
        try:
            # 一次导入 = 一个章节目录（合并所有文件）
            dir_data, duplicates, errors, aux_summary = build_dir_from_files(uid, files, api_key)

            # 全部文件重复/为空 → 不创建目录，直接返回重复信息
            if dir_data is None:
                self._send_json({
                    "ok": True,
                    "dir": None,
                    "duplicates": duplicates,
                    "errors": errors,
                    "auxItems": [],
                    "fileCount": 0,
                    "totalQuestions": 0,
                    "course": None,
                })
                return

            # 向后兼容：当前课程 = 该目录的主课程；也写入旧 courses/ 库
            main_course = dir_data["course"]
            (d / "course.json").write_text(json.dumps(main_course, ensure_ascii=False, indent=2), encoding="utf-8")
            slug = slug_from_name(dir_data["title"])
            lib_file = d / "courses" / f"{slug}.json"
            lib_file.write_text(json.dumps(main_course, ensure_ascii=False, indent=2), encoding="utf-8")
            rebuild_index(uid)

            # D-3 修复：批量导入也存档原始资料（与单份导入一致），重复/未处理文件跳过
            processed_names = {f["filename"] for f in dir_data["files"]}
            archives = []
            for item in files:
                if item.get("filename") not in processed_names:
                    continue
                try:
                    archives.append(archive_import(uid, item.get("filename", "note.md"), item.get("md", ""), {"title": item.get("filename", "note.md"), "quizCount": 0}, 0, 0))
                except Exception as e:
                    log_json(APP_LOGGER, "warn", "import.archive-fail", "批量导入资料存档失败",
                             {"uid": uid, "filename": item.get("filename", ""), "err": str(e)})

            quiz = main_course.get("quiz", [])
            schedule_data_commit("批量导入")
            self._send_json({
                "ok": True,
                "dir": dir_data,
                "duplicates": duplicates,
                "errors": errors,
                "auxItems": aux_summary,
                "fileCount": len(dir_data["files"]),
                "totalQuestions": len(quiz),
                "course": main_course,
                "archives": archives,
            })
        except Exception as e:
            import traceback
            traceback.print_exc()
            self._send_json({"error": f"导入失败: {e}"}, 500)

    def end_headers(self):
        # 本地单机工具：前端同源访问，不需要 CORS。
        # 禁止缓存，避免浏览器缓存旧版 JS/CSS 导致刷新后界面不更新。
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()


def _startup_log(msg):
    """windowed 模式下无终端，把启动信息写到数据目录下的日志文件便于诊断。"""
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        with open(DATA_DIR / "startup.log", "a", encoding="utf-8") as f:
            f.write(msg + "\n")
    except Exception:
        pass


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    try:
        USERS_DIR.mkdir(parents=True, exist_ok=True)
        _startup_log(f"[start] frozen={getattr(sys, 'frozen', False)} meipass={getattr(sys, '_MEIPASS', None)} web={WEB_DIR} users={USERS_DIR}")
        log_json(APP_LOGGER, "info", "app.start", "服务启动", {
            "frozen": getattr(sys, "frozen", False),
            "web": str(WEB_DIR), "users": str(USERS_DIR),
        })
    except Exception as e:
        _startup_log(f"[startup-error] {e}")
        raise

    # 端口被占用时自动递增重试
    server = None
    for p in range(port, port + 20):
        try:
            server = ThreadingHTTPServer(("127.0.0.1", p), CourseHandler)
            port = p
            break
        except OSError:
            continue
    if server is None:
        _startup_log("[error] 端口均被占用")
        log_json(APP_LOGGER, "error", "app.start-fail", "端口均被占用，无法启动", {"port": port})
        print("❌ 无法启动：端口均被占用")
        sys.exit(1)

    # 数据目录自动 git 化（本地版本管理，静默失败）
    ensure_data_git()

    _startup_log(f"[listening] http://127.0.0.1:{port}/exam.html")
    log_json(APP_LOGGER, "info", "app.listen", "服务已监听", {"url": f"http://127.0.0.1:{port}/exam.html"})

    url = f"http://127.0.0.1:{port}/exam.html"
    print("🌐 AI 岗位能力试炼 · AI Job Skill Gauntlet 已启动")
    print(f"   考核中心: {url}")
    print(f"   数据目录: {USERS_DIR}")
    print(f"   出题引擎: LLM 直连（设置页填 API Key 后启用）")
    print("   关闭本窗口即停止程序")

    # 延迟 0.8s 后自动打开默认浏览器（桌面应用体验）
    threading.Timer(0.8, lambda: webbrowser.open(url)).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止")


if __name__ == "__main__":
    main()
