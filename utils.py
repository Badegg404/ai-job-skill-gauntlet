#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
utils.py — 通用纯函数与路径常量（无业务依赖）

出题与能力打标签由 LLM 完成（浏览器直连）；此处仅保留非语义的工具函数。
"""
import os
import random
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent

def _resource_dir():
    if getattr(sys, "frozen", False):
        base = Path(getattr(sys, "_MEIPASS", HERE))
        return base / "web"
    return HERE / "web"


# 数据目录：始终指向用户主目录（可写、跨版本持久），可用环境变量覆盖
def _data_dir():
    env = os.environ.get("EXAM_CENTER_HOME")
    if env:
        return Path(env).expanduser()
    return Path.home() / ".exam-center"


WEB_DIR = _resource_dir()
DATA_DIR = _data_dir()
USERS_DIR = DATA_DIR / "users"


def slugify(name):
    """从文件名生成稳定的课程 slug。空结果回退 "untitled"（M6）。"""
    s = re.sub(r"[^\w\u4e00-\u9fff-]", "-", name or "")
    s = re.sub(r"-+", "-", s).strip("-")
    return (s[:60] or "untitled")


def slug_from_name(name):
    """从文件名/标题生成 slug。仅在明确是文档扩展名时剥掉扩展名，
    避免 Path.stem 把「Python 3.10 入门」截断成「Python 3」（M3）。"""
    name = (name or "").strip()
    m = re.match(r"^(.*)\.(md|markdown|txt)$", name, re.I)
    if m:
        name = m.group(1)
    return slugify(name)


def content_hash(md):
    """计算资料内容的 md5（用于查重）。"""
    import hashlib
    return hashlib.md5(md.encode("utf-8")).hexdigest()


def looks_like_study_note(md, filename):
    """判断 .md 文件是否是「结构化学习笔记」，而非新闻汇总/输出产物等。

    学习笔记的典型特征：含「学习目标 / 核心概念 / 第 N 章 / 第 N 课 / 测验题 / 难点预判 /
    知识依赖关系图」等结构标题；文件名含「学习笔记/笔记/教程/README」或「第 N 课」。
    """
    base = Path(filename).name
    # 文件名强信号
    if any(k in base for k in ("学习笔记", "笔记", "教程", "README", "讲义", "课程")):
        return True
    # 文件名含「第 N 课 / 第 N 讲 / 第 N 节」结构（如「第06课_模型如何规划并调用工具」）
    if re.search(r"第\s*\d+\s*[课讲节]", base):
        return True
    # 内容结构信号：取所有 ## 标题判断
    heads = re.findall(r"^#{1,3}\s+(.+)$", md, re.M)
    heads_text = " ".join(heads)
    markers = ("学习目标", "核心概念", "知识依赖", "难点预判", "实战任务", "测验", "掌握情况评估", "下节课预告", "本课目标", "收益说明")
    if any(m in heads_text for m in markers):
        return True
    # 有「第 N 章 / 第 N 课」结构
    if re.search(r"第\s*\d+\s*[章节课]", heads_text):
        return True
    # 标题里至少有一个概念表/章节/测验等结构才像笔记；纯「## 1. 标题」新闻列表不像
    return False


def shuffle_choice_options(q):
    """随机打乱选择题选项顺序，同步更新 correctIndex 与 answer 字母。

    供 LLM 题复用，避免正确答案总落在固定位置（如总在 A）。
    """
    options = q.get("options", [])
    if len(options) < 2:
        return q
    # 去掉前缀（A. / B、/ C) 等），保留纯文本
    def strip_prefix(opt):
        return re.sub(r"^[A-Ea-e][.、:：)]\s*", "", opt).strip()

    texts = [strip_prefix(o) for o in options]
    ci = q.get("correctIndex")
    correct_set = set(ci if isinstance(ci, list) else [ci])
    indices = list(range(len(texts)))
    random.shuffle(indices)
    letters = "ABCDE"
    new_options = [f"{letters[new_i]}. {texts[old_i]}" for new_i, old_i in enumerate(indices)]
    new_correct = [new_i for new_i, old_i in enumerate(indices) if old_i in correct_set]
    q["options"] = new_options
    q["correctIndex"] = new_correct
    q["answer"] = "".join(letters[i] for i in sorted(new_correct))
    return q


def normalize_qtext(text):
    """规范化题干：去空白/标点/题型前缀，用于相似度去重。"""
    t = re.sub(r"【[^】]*】", "", text or "")           # 去【概念】【面试】等前缀
    t = re.sub(r"^[-—–·\s]+", "", t)                    # 去列表符号
    t = re.sub(r"[\s\u3000、。，,;；:：\"'「」『』()（）]+", "", t)
    return t[:60]


def dedupe_questions(quiz):
    """题目文本去重：相同规范化题干只保留第一份。返回去重后的列表。"""
    seen = {}
    out = []
    for q in quiz:
        key = normalize_qtext(q.get("question", ""))
        if not key:
            out.append(q)
            continue
        if key not in seen:
            seen[key] = True
            out.append(q)
    return out
