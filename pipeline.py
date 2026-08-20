#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
pipeline.py — 导入流水线与课程构建（依赖 note_parser + utils + storage）
"""
import re
from collections import Counter
from datetime import datetime
from pathlib import Path

from note_parser import parse_note
from utils import content_hash, looks_like_study_note, dedupe_questions, slug_from_name, normalize_qtext
from storage import ensure_user, new_dir_id, find_duplicate_in_dirs, save_dir

def auto_dir_title(files):
    """根据上传资料自动生成目录名（优先主笔记标题）。"""
    # 主笔记：文件名含 学习笔记/笔记/README/教程
    for item in files:
        base = Path(item.get("filename", "")).name
        if any(k in base for k in ("学习笔记", "笔记", "README", "教程")):
            return Path(item.get("filename", "")).stem
    # 兜底：第一个笔记文件
    for item in files:
        if item.get("kind", "note") == "note" and item.get("filename", "").lower().endswith((".md", ".markdown")):
            return Path(item.get("filename", "")).stem
    # 再兜底：第一个文件名
    if files:
        return Path(files[0].get("filename", "资料")).stem
    return "未命名目录"


# Q-2 修复：删掉从未使用的 api_base/model 死参数（api_key 仍用于 source.llmEnabled 标记）
def build_dir_from_files(uid, files, api_key=None):
    """一次导入 = 一个章节目录：合并所有文件，返回 (dir_data, duplicates, errors)。

    files: [{filename, md, kind}]
    duplicates: [{filename, reason, title}]
    errors:     [{filename, error}]
    """
    d = ensure_user(uid)
    dir_id = new_dir_id()

    # 1. 遍历文件：查重 + 分类
    note_courses = []     # [(filename, course)] 笔记课程
    aux_items = []        # [(filename, content, kind)] 辅助文件
    processed_files = []  # 实际被处理（非重复）的文件 [{filename, kind, hash}]
    duplicates = []
    errors = []
    content_seen = {}     # 同批内 hash 去重

    for item in files:
        filename = item.get("filename", "note.md")
        md = item.get("md", "")
        kind = item.get("kind", "note")
        if not md.strip():
            errors.append({"filename": filename, "error": "内容为空"})
            continue
        h = content_hash(md)
        # 同批内去重
        if h in content_seen:
            duplicates.append({"filename": filename, "reason": "本批内重复", "title": content_seen[h]})
            continue
        # 跨目录查重
        dup, info = find_duplicate_in_dirs(uid, filename, md)
        if dup:
            duplicates.append({"filename": filename, "reason": info.get("reason", "重复"), "title": info.get("title", "")})
            continue
        content_seen[h] = filename
        processed_files.append({"filename": filename, "kind": kind, "hash": h})
        # 产物/缓存目录 → 不出题，仅挂进文件清单
        if kind == "artifact":
            continue
        is_note = kind == "note" and filename.lower().endswith((".md", ".markdown"))
        # 内容兜底：.md 但不像学习笔记（如新闻汇总）→ 降级为辅助资料，不当主笔记出题
        if is_note and not looks_like_study_note(md, filename):
            is_note = False
            kind = "text"
        if is_note:
            try:
                course, engine_qs, llm_qs = build_course_from_md(uid, md, filename, api_key)
                for q in course.get("quiz", []):
                    q["fromFile"] = filename
                note_courses.append((filename, course))
            except Exception as e:
                errors.append({"filename": filename, "error": str(e)})
        else:
            aux_items.append((filename, md, kind))

    # 2. 选主笔记（作为目录的 title/chapters/concepts 主体）
    main_course = None
    for filename, c in note_courses:
        base = Path(filename).name
        if any(k in base for k in ("学习笔记", "笔记", "README", "教程")):
            main_course = c
            break
    if main_course is None and note_courses:
        main_course = max(note_courses, key=lambda nc: len(nc[1].get("quiz", [])))[1]

    # 3. 无笔记只有辅助文件 → 建空课程容器
    if main_course is None:
        main_course = {
            "schemaVersion": 2, "id": "aux", "title": auto_dir_title(files),
            "source": {"engineGenerated": 0}, "meta": {},
            "learningObjectives": [], "dependencyGraph": {"clusters": [], "edges": []},
            "concepts": [], "tasks": [], "difficulties": [], "chapters": [],
            "practice": [], "quiz": [], "assessment": {}, "nextCourse": "",
        }
    if "source" not in main_course or not isinstance(main_course.get("source"), dict):
        main_course["source"] = {}

    # 4. 合并所有笔记的题目（打 fromFile）
    for filename, c in note_courses:
        if c is main_course:
            continue
        for q in c.get("quiz", []):
            q["fromFile"] = filename
            main_course.setdefault("quiz", []).append(q)

    # 5. 辅助文件生成题目（打 fromFile）
    # 面试题不在此处生成：由 build_comprehensive_interviews 在目录级综合提炼（最多 5 道）
    aux_summary = []
    qid = 3000 + len(main_course.get("quiz", []))
    for filename, content, kind in aux_items:
        aux_qs, material = process_aux_file(filename, content, qid)
        qid += len(aux_qs)
        for q in aux_qs:
            q["fromFile"] = filename
            main_course.setdefault("quiz", []).append(q)
        main_course.setdefault("materials", []).append(material)
        aux_summary.append({
            "filename": filename, "kind": material["type"],
            "lines": material["lines"], "questions": len(aux_qs),
        })

    # 6. 整体去重 + 补全字段
    main_course["quiz"] = dedupe_questions(main_course.get("quiz", []))
    # M4：合并后统一重排 id，避免跨文件引擎题 id 冲突
    for i, q in enumerate(main_course["quiz"]):
        q["id"] = 2000 + i + 1
    main_course = enrich_quiz(main_course)
    # 6.5 目录级综合参考面试题：结合整个目录资料（标题/概念/章节/代码文件）提炼，最多 5 道
    main_course["quiz"] += build_comprehensive_interviews(main_course)
    main_course = assign_chapter_refs(main_course)

    # 7. 文件清单（每个文件贡献几题）
    file_list = []
    quiz_by_file = Counter(q.get("fromFile", "") for q in main_course.get("quiz", []))
    for pf in processed_files:
        file_list.append({
            "filename": pf["filename"],
            "kind": pf["kind"],
            "hash": pf["hash"],
            "questionCount": quiz_by_file.get(pf["filename"], 0),
        })

    # 8. 目录标题
    title = auto_dir_title(files)
    dir_data = {
        "id": dir_id,
        "title": title,
        "createdAt": datetime.now().isoformat(),
        "files": file_list,
        "course": main_course,
    }
    # 无任何实际文件（全部重复/为空）→ 不创建空目录
    if not file_list:
        return None, duplicates, errors, aux_summary
    save_dir(uid, dir_data)

    return dir_data, duplicates, errors, aux_summary


def enrich_quiz(course):
    """为测验题补充默认字段（能力维度由 LLM 在前端打标签，此处仅兜底）。"""
    kept = []
    for q in course.get("quiz", []):
        # D-6 修复：模板未提供答案的选择题不可判分，直接剔除（不默认第 0 个选项，避免误导判分）
        if q.get("type") in ("choice", "multi_choice"):
            ci = q.get("correctIndex")
            if not ci or (isinstance(ci, list) and not ci):
                continue
        q.setdefault("difficulty", 2)
        q.setdefault("interview", False)
        q.setdefault("source", "current")
        q.setdefault("ability", "提示词工程")
        # 三维度归类兜底（theory/practical/interview）
        if "dimension" not in q:
            t = q.get("type")
            if t == "practical":
                q["dimension"] = "practical"
            elif q.get("interview") or t == "essay":
                q["dimension"] = "interview"
            else:
                q["dimension"] = "theory"
        kept.append(q)
    course["quiz"] = kept
    return course


def assign_chapter_refs(course):
    """把没有章节关联的题（概念/面试/场景题）自动关联到章节。

    匹配策略（按优先级）：
      1. 概念名出现在题面 → 该概念关联章节
      2. 概念摘要关键词出现在题面 → 该概念关联章节（概念题题面就是摘要）
      3. 题面关键词与章节标题/摘要匹配
      4. 兜底：按题在课程中的顺序，等分到章节
    返回 course（原地修改）。
    """
    chapters = course.get("chapters", [])
    if not chapters:
        return course

    def norm(s):
        return re.sub(r"[\s·\-—_（）()：:，。、]", "", s or "")

    # 概念 → 章节 映射
    concept_chapter = {}
    concepts = course.get("concepts", [])
    for ci, c in enumerate(concepts):
        name = norm(c.get("name", ""))
        best = None
        for ch in chapters:
            title = norm(ch.get("title", ""))
            summary = norm(ch.get("summary", ""))
            if name and len(name) >= 2 and (name in title or name in summary or name[:4] in title):
                best = ch.get("index")
                break
        if best is None and chapters:
            idx = min(len(chapters) - 1, int(ci * len(chapters) / max(len(concepts), 1)))
            best = chapters[idx].get("index")
        concept_chapter[c.get("name", "")] = best

    # 收集每个概念名的别名（摘要前 8 字），用于匹配概念题题面
    concept_keys = []  # [(key, chapterIdx)]
    for c in concepts:
        cidx = concept_chapter.get(c.get("name", ""))
        if cidx is None:
            continue
        name = c.get("name", "")
        summary = c.get("summary", "")
        # 摘要去标点前 10 字作为匹配键
        key = norm(summary)[:10]
        if len(key) >= 4:
            concept_keys.append((key, cidx))
        if name:
            concept_keys.append((norm(name), cidx))

    # 章节标题/摘要关键词（供题面匹配）
    chapter_keys = [(norm(ch.get("title", "")), ch.get("index")) for ch in chapters]

    for q in course.get("quiz", []):
        if q.get("chapterRef") is not None:
            continue
        qtext = norm(q.get("question", ""))
        matched = None
        # 1) 概念名/摘要键在题面
        for key, cidx in concept_keys:
            if key and len(key) >= 3 and key in qtext:
                matched = cidx
                break
        # 2) 章节标题在题面（判断题等）
        if matched is None:
            for key, cidx in chapter_keys:
                if key and len(key) >= 3 and key in qtext:
                    matched = cidx
                    break
        # 3) 章节摘要中的核心词（取标题去"第N章"后的前6字）
        if matched is None:
            for ch in chapters:
                title = norm(ch.get("title", ""))
                t = re.sub(r"^第\d+章", "", title)[:8]
                if len(t) >= 3 and t in qtext:
                    matched = ch.get("index")
                    break
        if matched is not None:
            q["chapterRef"] = matched
        else:
            # 4) 兜底：按题在完整数组中的位置取模（均匀分布到所有章节）
            order = course.get("quiz", []).index(q)
            idx = order % len(chapters)
            q["chapterRef"] = chapters[idx].get("index")
    return course


CODE_EXTS = ("py", "js", "ts", "jsx", "tsx", "java", "c", "cpp", "h", "go", "rs", "rb", "php", "sh", "bash")
DATA_EXTS = ("json", "yaml", "yml", "toml", "ini", "cfg", "conf", "xml", "csv", "tsv", "sql")


def process_aux_file(filename, content, qid_start=3000):
    """处理非笔记文件：提取数据并生成辅助题（代码实战题/数据理解题）。

    返回 (aux_questions, aux_material)。
    """
    ext = Path(filename).suffix.lstrip(".").lower()
    name = Path(filename).name
    lines = [ln for ln in content.splitlines() if ln.strip()]
    aux_questions = []
    qid = qid_start

    def nid():
        nonlocal qid
        qid += 1
        return qid

    if ext in CODE_EXTS and lines:
        # 代码文件 → 实战题：按文件自身特征分派不同问法，避免每份文件都是同一模板
        code_snippet = "\n".join(lines[:40])
        head = lines[:40]
        # 尽量找一条非空的核心行作为线索（函数签名/类声明）
        sig = next((ln.strip() for ln in head if ln.strip() and not ln.strip().startswith(("#", "//", "/*", "*", "def test", "import", "from", "print()"))), lines[0].strip())
        has_print = any("print(" in ln for ln in head)
        has_return = any("return " in ln for ln in head)
        has_except = any(("except" in ln or "raise " in ln) for ln in head)
        has_class = any(ln.lstrip().startswith("class ") for ln in head)
        has_def = any(ln.lstrip().startswith("def ") for ln in head)
        if has_class:
            q_text = f"【实战】{name} 定义了哪些类/接口？它们之间的协作关系（谁调用谁/谁组合谁）是什么？请概括职责划分。"
            expl = f"考察面向对象设计理解。文件 {name} 共 {len(lines)} 行，关注 class 定义与实例化关系。"
        elif has_except:
            q_text = f"【实战】{name} 如何处理异常与边界情况？指出异常处理逻辑的位置与作用，并说明少了它会怎样。"
            expl = f"考察异常处理与健壮性理解。文件 {name} 共 {len(lines)} 行，关注 except/raise 分支。"
        elif has_print or has_return:
            q_text = f"【实战】阅读 {name}，模拟执行核心逻辑：给定输入时它的输出/返回值是什么？请先给出结果，再说明依据（关键步骤）。"
            expl = f"考察代码执行追踪（trace）能力。文件 {name} 共 {len(lines)} 行，注意 print/return 语句的输出路径。"
        elif has_def:
            q_text = f"【实战】{name} 的核心函数/入口（如 {sig[:60]}）的输入输出是什么？关键实现步骤有哪些？"
            expl = f"考察函数级代码理解。文件 {name} 共 {len(lines)} 行，核心线索：{sig[:80]}"
        else:
            q_text = f"【实战】阅读 {name} 的核心代码，概括它实现的功能与关键逻辑（数据流向 / 关键步骤）。"
            expl = f"考察代码阅读理解能力。文件 {name} 共 {len(lines)} 行，核心逻辑见上方代码。"
        aux_questions.append({
            "id": nid(), "type": "practical",
            "question": q_text,
            "practical": {
                "files": [name],
                "compareMode": "self",
                "expectedPattern": "",
                "options": [],
                "correctIndex": None,
            },
            "code": code_snippet[:1200],
            "answer": f"代码文件 {name}：\n```\n{code_snippet[:800]}\n```\n阅读要点：找到入口函数与关键逻辑。",
            "explanation": expl,
            "chapterRef": None, "difficulty": 3, "interview": False,
            "ability": "AI 应用开发", "source": "file",
        })

    elif ext in DATA_EXTS and lines:
        # 数据/配置 → 数据理解题
        head = lines[0][:80]
        aux_questions.append({
            "id": nid(), "type": "fill_blank",
            "question": f"【数据】文件 {name} 是 __类型的配置/数据__，其主要作用是为系统提供 ______。",
            "correctAnswer": "配置或数据",
            "fillAnswers": ["配置", "数据", "配置或数据"],
            "answer": f"文件 {name} 首行：{head}",
            "explanation": f"数据/配置文件是系统输入的一部分，需与主流程配合理解。",
            "chapterRef": None, "difficulty": 2, "interview": False,
            "ability": "系统与部署", "source": "file",
        })
    elif lines and len(content) > 30:
        # 其他文本 → 资料理解题
        snippet = content.strip()[:200]
        aux_questions.append({
            "id": nid(), "type": "essay",
            "question": f"【资料】文件 {name} 提供了什么信息？它与课程主题有什么关系？",
            "answer": snippet,
            "explanation": f"辅助资料 {name}，提取关键信息并关联课程。",
            "chapterRef": None, "difficulty": 2, "interview": False,
            "ability": "AI 应用开发", "source": "file",
        })

    aux_material = {
        "file": name,
        "path": filename,
        "type": "code" if ext in CODE_EXTS else ("data" if ext in DATA_EXTS else "text"),
        "lines": len(lines),
        "preview": "\n".join(lines[:5])[:200],
    }
    return aux_questions, aux_material


# Q-2 修复：删掉从未使用的 api_base/model 死参数（api_key 仍用于 source.llmEnabled 标记）
def build_comprehensive_interviews(course, max_count=5):
    """目录级综合参考面试题：结合整个目录资料（标题 / 概念 / 章节 / 代码文件）提炼，
    作为面试弹药参考——要准、要综合，不逐代码文件堆量。"""
    title = (course.get("title") or "本课程")[:30]
    concepts = [c.get("name") for c in (course.get("concepts") or []) if c.get("name")][:3]
    chapters = [c.get("title") for c in (course.get("chapters") or []) if c.get("title")][:3]
    code_files = [m.get("file") for m in (course.get("materials") or []) if m.get("type") == "code"][:3]
    c1 = concepts[0] if concepts else "本课核心概念"
    c2 = concepts[1] if len(concepts) > 1 else (concepts[0] if concepts else "本课核心概念")
    ch1 = chapters[0] if chapters else "核心章节"
    code1 = code_files[0] if code_files else "示例代码"
    code2 = code_files[1] if len(code_files) > 1 else code1
    templates = [
        f"【面试】本课程《{title}》围绕「{c1}」展开，面试官问：这个概念在真实项目中解决什么问题、落地要注意什么？你会怎么组织回答？",
        f"【面试】课程在「{ch1}」里用 {code1} 做了实现。面试官让你现场讲这段实现的设计思路与可扩展性，你怎么讲？",
        f"【面试】{c2} 与工程实践结合时常见的问题有哪些（边界、性能、安全）？结合本课程资料举例说明。",
        f"【面试】给一个新人讲清《{title}》的{ch1}，你会用怎样的真实业务场景来讲解？",
        f"【面试】面试官问：把 {code1} 和 {code2} 用到真实项目里，你如何做代码评审与测试？",
    ]
    out = []
    for i, q in enumerate(templates[:max_count]):
        out.append({
            "id": 4000 + i, "type": "essay",   # 综合面试题固定段 4000+（引擎/aux 题经 2000+ 段统一重排，避开冲突）
            "question": q,
            "answer": "参考：结合本目录资料《" + title + "》中相关概念与代码组织回答。",
            "explanation": "综合参考面试题：由整个目录资料（概念/章节/代码）提炼，面试考核时作为该岗位的参考弹药。",
            "chapterRef": None, "difficulty": 3, "interview": True,
            "ability": "AI 应用开发", "source": "file",
            "dimension": "interview",
        })
    return out


def build_course_from_md(uid, md, filename, api_key=None):
    """完整流水线：解析笔记 → 返回课程 JSON。

    出题由前端 LLM 完成（浏览器直连，key 不出服务器）；后端只做解析与数据结构整理。
    """
    course = parse_note(md, filename)
    course = enrich_quiz(course)
    course = assign_chapter_refs(course)

    # 记录来源
    if "source" not in course or not isinstance(course.get("source"), dict):
        course["source"] = {}
    course["source"]["notePath"] = filename
    course["source"]["llmEnabled"] = bool(api_key)
    return course, [], []


def course_summary(course):
    """生成导入结果的统计摘要。"""
    quiz = course.get("quiz", [])
    note_path = course.get("source", {}).get("notePath", course.get("title", "course"))
    return {
        "title": course.get("title", "未命名课程"),
        "slug": slug_from_name(note_path),
        "quizCount": len(quiz),
        "types": dict(Counter(q.get("type") for q in quiz)),
        "abilities": dict(Counter(q.get("ability", "未标记") for q in quiz)),
        "interview": sum(1 for q in quiz if q.get("interview")),
        "practical": sum(1 for q in quiz if q.get("type") == "practical"),
        "chapters": len(course.get("chapters", [])),
        "concepts": len(course.get("concepts", [])),
        "engineGenerated": course.get("source", {}).get("engineGenerated", 0),
        "llmGenerated": course.get("source", {}).get("llmGenerated", 0),
    }
