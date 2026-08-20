#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
storage.py — 用户数据存储与查重（依赖 utils）
"""
import json
import re
import uuid
from collections import Counter
from datetime import datetime
from pathlib import Path

from utils import USERS_DIR, DATA_DIR, slug_from_name, content_hash, slugify

def find_duplicate(uid, filename, md):
    """检查该用户是否已导入过同名（slug）或同内容（hash）的课程。

    返回 (True, info) 或 (False, None)。
    """
    d = user_dir(uid)
    courses_dir = d / "courses"
    if not courses_dir.exists():
        return False, None
    slug = slug_from_name(filename)
    h = content_hash(md)
    # 1. 同名课程文件已存在
    target = courses_dir / f"{slug}.json"
    if target.exists():
        try:
            c = json.loads(target.read_text(encoding="utf-8"))
            return True, {"reason": "同名资料", "title": c.get("title", slug), "file": target.name}
        except Exception:
            pass
    # 2. 内容 hash 相同（改了文件名也能识别）
    for f in courses_dir.glob("*.json"):
        if f.name == "index.json":
            continue
        try:
            c = json.loads(f.read_text(encoding="utf-8"))
        except Exception:
            continue
        if (c.get("source") or {}).get("contentHash") == h:
            return True, {"reason": "相同内容", "title": c.get("title", f.stem), "file": f.name}
    return False, None


def new_dir_id():
    return "d_" + datetime.now().strftime("%Y%m%d%H%M%S") + "_" + uuid.uuid4().hex[:4]


def is_valid_dir_id(dir_id):
    """目录 id 必须是 d_ 前缀（M2：拒绝 "index" 等可能命中索引文件的 id）。"""
    return bool(dir_id) and bool(re.fullmatch(r"d_[A-Za-z0-9_]+", str(dir_id)))


def load_dir(uid, dir_id):
    """读取某个资料目录；不存在返回 None。"""
    if not is_valid_dir_id(dir_id):
        return None
    f = user_dir(uid) / "dirs" / f"{dir_id}.json"
    if f.exists():
        try:
            return json.loads(f.read_text(encoding="utf-8"))
        except Exception:
            return None
    return None


def save_dir(uid, dir_data):
    """保存资料目录文件，并更新目录索引。"""
    d = ensure_user(uid)
    dir_id = dir_data.get("id") or new_dir_id()
    dir_data["id"] = dir_id
    (d / "dirs" / f"{dir_id}.json").write_text(json.dumps(dir_data, ensure_ascii=False, indent=2), encoding="utf-8")
    rebuild_dirs_index(uid)
    return dir_data


def rebuild_dirs_index(uid):
    """重建该用户资料目录索引。"""
    d = user_dir(uid)
    dirs_dir = d / "dirs"
    if not dirs_dir.exists():
        return
    dirs = []
    for f in sorted(dirs_dir.glob("*.json")):
        if f.name == "index.json":
            continue
        try:
            dd = json.loads(f.read_text(encoding="utf-8"))
        except Exception:
            continue
        quiz = dd.get("course", {}).get("quiz", [])
        materials = (dd.get("course", {}) or {}).get("materials", []) or []
        # 纯笔记目录（无代码素材）不显示实战考核按钮：用 materials 的 code 类型判断（与前端 hasCode 一致）
        has_code = any(
            (m.get("type") == "code") or
            (isinstance(m.get("file"), str) and re.search(r"\.(py|ipynb|js|ts|java)$", m.get("file") or "", re.I))
            for m in materials
        )
        dirs.append({
            "id": dd.get("id", f.stem),
            "title": dd.get("title", f.stem),
            "createdAt": dd.get("createdAt", ""),
            "fileCount": len(dd.get("files", [])),
            "quizCount": len(quiz),
            "theoryCount": sum(1 for q in quiz if q.get("dimension") == "theory" or (q.get("dimension") is None and q.get("type") in ("choice", "multi_choice", "true_false", "fill_blank"))),
            "practicalCount": sum(1 for q in quiz if q.get("dimension") == "practical" or q.get("type") == "practical"),
            "interviewCount": sum(1 for q in quiz if q.get("interview")),
            "hasCode": has_code,
        })
    (dirs_dir / "index.json").write_text(
        json.dumps({"dirs": dirs, "total": len(dirs)}, ensure_ascii=False, indent=2), encoding="utf-8")


def find_duplicate_in_dirs(uid, filename, md):
    """跨目录查重：检查该用户所有资料目录是否已含同名或同内容文件。

    返回 (True, info) 或 (False, None)。
    """
    d = user_dir(uid)
    dirs_dir = d / "dirs"
    if not dirs_dir.exists():
        return False, None
    h = content_hash(md)
    base = Path(filename).name
    for f in dirs_dir.glob("*.json"):
        if f.name == "index.json":
            continue
        try:
            dd = json.loads(f.read_text(encoding="utf-8"))
        except Exception:
            continue
        for item in dd.get("files", []):
            if item.get("hash") == h:
                return True, {"reason": "相同内容", "title": dd.get("title", f.stem), "dirId": dd.get("id")}
            if Path(item.get("filename", "")).name == base:
                return True, {"reason": "同名文件", "title": dd.get("title", f.stem), "dirId": dd.get("id")}
    return False, None


def safe_uid(uid):
    """校验并规范化用户 ID（防止路径穿越）。"""
    if not uid:
        return None
    uid = str(uid).strip()
    if not re.fullmatch(r"[A-Za-z0-9_-]{4,64}", uid):
        return None
    return uid


def user_dir(uid):
    return USERS_DIR / safe_uid(uid)


def ensure_user(uid):
    """创建用户目录，返回目录 Path。"""
    d = user_dir(uid)
    (d / "courses").mkdir(parents=True, exist_ok=True)
    (d / "imports").mkdir(parents=True, exist_ok=True)
    (d / "dirs").mkdir(parents=True, exist_ok=True)
    return d


def rebuild_index(uid):
    """重建某用户的课程库索引。"""
    d = user_dir(uid)
    courses_dir = d / "courses"
    if not courses_dir.exists():
        return
    courses = []
    for f in sorted(courses_dir.glob("*.json")):
        if f.name == "index.json":
            continue
        try:
            c = json.loads(f.read_text(encoding="utf-8"))
        except Exception:
            continue
        quiz = c.get("quiz", [])
        courses.append({
            "file": f.name,
            "slug": f.stem,
            "title": c.get("title", f.stem),
            "chapters": len(c.get("chapters", [])),
            "quizCount": len(quiz),
            "types": dict(Counter(q.get("type") for q in quiz)),
            "abilities": dict(Counter(q.get("ability", "未标记") for q in quiz)),
            "interview": sum(1 for q in quiz if q.get("interview")),
            "practical": sum(1 for q in quiz if q.get("type") == "practical"),
        })
    (courses_dir / "index.json").write_text(
        json.dumps({"courses": courses, "total": len(courses)}, ensure_ascii=False, indent=2),
        encoding="utf-8")


def archive_import(uid, filename, md, summary, engine_generated, llm_generated=0):
    """把导入的原始资料存档到用户目录。"""
    d = ensure_user(uid)
    imports_dir = d / "imports"
    slug = slugify(filename)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    md_name = f"{stamp}_{slug}.md"
    (imports_dir / md_name).write_text(md, encoding="utf-8")
    return {
        "filename": filename,
        "archive": f"users/{safe_uid(uid)}/imports/{md_name}",
        "date": datetime.now().isoformat(),
        "title": summary.get("title", filename),
        "quizCount": summary.get("quizCount", 0),
        "engineGenerated": engine_generated,
        "llmGenerated": llm_generated,
    }


def new_uid():
    """生成新用户 ID。"""
    return "u_" + uuid.uuid4().hex[:12]


def get_device_uid():
    """获取本机固定的设备 UID（所有浏览器共享同一用户）。

    存到数据目录下的 .device-uid 文件：首次生成，之后复用。
    这样换浏览器打开仍是同一个用户，数据不丢。
    """
    f = DATA_DIR / ".device-uid"
    if f.exists():
        try:
            uid = f.read_text(encoding="utf-8").strip()
            if safe_uid(uid):
                return uid
        except Exception:
            pass
    uid = "dev_" + uuid.uuid4().hex[:12]
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        f.write_text(uid, encoding="utf-8")
    except Exception:
        pass
    return uid
