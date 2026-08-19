#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
note_parser.py — 学习笔记 → 课程 JSON 解析器

从模板化学习笔记（Markdown）解析出结构化课程数据。
适配笔记固定骨架：
  学习目标 / 知识依赖关系图 / 核心概念表 / 实战任务清单 / 难点预判 /
  逐章讲解（一句话概括→类比切入→核心机制→预判答疑→重点小结）/
  实战引导 / 角色互换测验 / 掌握情况评估 / 下节课预告

用法:
  python note_parser.py <note.md> [-o output.json]
"""
import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

# ---------------------------------------------------------------- 基础工具

def extract_code_blocks(lines):
    """提取围栏代码块，替换为占位符。返回 (占位行列表, 代码块列表)。"""
    blocks = []
    out = []
    i = 0
    n = len(lines)
    while i < n:
        line = lines[i]
        m = re.match(r'^\s*(```|~~~)\s*(\w*)\s*$', line)
        if m:
            fence = m.group(1)
            lang = m.group(2) or ''
            body = []
            i += 1
            while i < n and not re.match(r'^\s*' + fence + r'\s*$', lines[i]):
                body.append(lines[i])
                i += 1
            i += 1  # skip closing fence
            idx = len(blocks)
            blocks.append({"language": lang, "code": "\n".join(body)})
            out.append(f"__CODEBLOCK_{idx}__")
        else:
            out.append(line)
            i += 1
    return out, blocks


def restore_codeblocks(text, blocks):
    """把内容字符串里的占位符还原为 markdown 代码块。"""
    def _rep(m):
        idx = int(m.group(1))
        b = blocks[idx]
        return f"```{b['language']}\n{b['code']}\n```"
    return re.sub(r'__CODEBLOCK_(\d+)__', _rep, text)


def strip_md(text):
    """去除行内 markdown 标记，返回纯文本。"""
    text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)
    text = re.sub(r'`([^`]+)`', r'\1', text)
    text = text.strip()
    return text


def parse_table(lines):
    """解析 markdown 表格。返回 (表头列表, 数据行列表[每行是 dict])。"""
    rows = []
    for ln in lines:
        s = ln.strip()
        if not s.startswith('|'):
            continue
        cells = [c.strip() for c in s.strip('|').split('|')]
        rows.append(cells)
    if not rows:
        return [], []
    header = [strip_md(c) for c in rows[0]]
    data = []
    for r in rows[2:]:  # skip separator row
        if len(r) < len(header):
            r = r + [''] * (len(header) - len(r))
        data.append({header[i]: strip_md(r[i]) for i in range(len(header))})
    return header, data


def parse_numbered_list(lines):
    """解析编号/无序列表，返回 (items, rest_lines)。"""
    items = []
    rest = []
    for ln in lines:
        s = ln.strip()
        if re.match(r'^(\d+)[.、)]\s+', s) or re.match(r'^[-*]\s+', s):
            item = re.sub(r'^(\d+)[.、)]\s+', '', s)
            item = re.sub(r'^[-*]\s+', '', item)
            items.append(item)
        elif s:
            rest.append(ln)
    return items, rest


def split_blocks(lines):
    """
    把行列表按标题分割成展平的块列表。
    返回 [{"level": int, "heading": str, "lines": [...]}]
    """
    blocks = []
    current = None
    for ln in lines:
        m = re.match(r'^(#{1,6})\s+(.*)$', ln)
        if m:
            if current:
                blocks.append(current)
            level = len(m.group(1))
            current = {"level": level, "heading": m.group(2).strip(), "lines": []}
        else:
            if current is None:
                current = {"level": 0, "heading": "", "lines": []}
            current["lines"].append(ln)
    if current:
        blocks.append(current)
    return blocks


def difficulty_stars(text):
    """从 ★☆☆ 之类文本提取星级数值。"""
    return text.count('★')


def split_qa(lines, blocks):
    """
    解析预判答疑/测验区：识别 **Q1：xxx** 开始的新问题。
    返回 [{"question": ..., "answer": ...}]
    """
    qa = []
    cur_q = None
    cur_a = []
    for ln in lines:
        m = re.match(r'^\s*\*\*Q(\d+)[\s:：]*(.*?)\*\*\s*[:：]?\s*(.*)$', ln)
        if m:
            if cur_q is not None:
                qa.append({"question": cur_q, "answer": _clean_answer("\n".join(cur_a))})
            qno = m.group(1)
            qtext = strip_md(m.group(2))
            # 去掉「（新人提问）」这类角色前缀
            qtext = re.sub(r'^（[^）]*）\s*', '', qtext)
            tail = m.group(3).strip()
            if tail:
                qtext = f"{qtext}：{strip_md(tail)}" if qtext else strip_md(tail)
            cur_q = f"Q{qno}：{qtext}" if qtext else f"Q{qno}"
            cur_a = []
        else:
            if cur_q is not None:
                cur_a.append(ln)
    if cur_q is not None:
        qa.append({"question": cur_q, "answer": _clean_answer("\n".join(cur_a))})
    return qa


def _clean_answer(text):
    """清理答案文本：去掉引用标记与「参考答案要点」前缀。"""
    out = []
    for ln in text.split('\n'):
        s = re.sub(r'^>\s*', '', ln)
        s = re.sub(r'^\*{0,2}参考答案要点\*{0,2}[:：]?\s*', '', s)
        out.append(s)
    return "\n".join(out).strip()


# ---------------------------------------------------------------- 各部分解析

def parse_head_meta(block):
    """解析头部（# 标题 + 引用块元信息）。"""
    meta = {"notes": [], "prerequisites": [], "conventions": []}
    in_notes = False
    in_prereq = False
    for ln in block["lines"]:
        s = ln.strip()
        if s.startswith('>'):
            body = re.sub(r'^>\s*', '', s)
            if body.startswith('**前置回顾**'):
                in_prereq = True
                in_notes = False
                continue
            if body.startswith('**注释约定'):
                in_prereq = False
                in_notes = False
                meta["conventions"].append(body)
                continue
            if in_prereq:
                # 格式：- **概念**（章节）→ 说明
                m = re.match(r'^[-*]\s*\*\*(.+?)\*\*\s*(?:（([^）]+)）)?\s*[—–→]\s*(.*)$', body)
                if m:
                    concept = strip_md(m.group(1))
                    ref = m.group(2) or ''
                    detail = m.group(3)
                    meta["prerequisites"].append({
                        "concept": f"{concept}（{ref}）" if ref else concept,
                        "detail": strip_md(detail),
                    })
                else:
                    m2 = re.match(r'^\*\*(.+?)\*\*\s*(?:（([^）]+)）)?\s*[—–→]?\s*(.*)$', body)
                    if m2:
                        meta["prerequisites"].append({
                            "concept": strip_md(m2.group(1)),
                            "detail": strip_md(m2.group(3)),
                        })
                    else:
                        meta["prerequisites"].append({"concept": "", "detail": strip_md(body)})
            else:
                meta["notes"].append(body)
    return meta


def parse_learning_objectives(block):
    items, _ = parse_numbered_list(block["lines"])
    return [strip_md(it) for it in items]


def parse_dependency_graph(block, blocks):
    """解析知识依赖关系图（mermaid）。"""
    mermaid_src = ""
    for ln in block["lines"]:
        m = re.match(r'__CODEBLOCK_(\d+)__', ln.strip())
        if m:
            b = blocks[int(m.group(1))]
            if b["language"].lower() in ("mermaid", ""):
                mermaid_src = b["code"]
                break
    clusters, nodes, edges = [], {}, []
    if mermaid_src:
        cur_cluster = None
        node_map = {}
        for ln in mermaid_src.split('\n'):
            s = ln.strip()
            if s.startswith('subgraph '):
                name_m = re.search(r'subgraph\s+(\S+?)\s*\["(.*?)"\]', s)
                if name_m:
                    cur_cluster = {"name": name_m.group(2), "nodes": []}
                    clusters.append(cur_cluster)
                else:
                    name_m2 = re.search(r'subgraph\s+(.+)$', s)
                    cur_cluster = {"name": name_m2.group(1).strip().strip('"'), "nodes": []}
                    clusters.append(cur_cluster)
            elif s == 'end':
                cur_cluster = None
            elif '-->' in s:
                parts = re.split(r'\s*-->\s*', s)
                if len(parts) >= 2:
                    a = re.match(r'(\w+)', parts[0])
                    b = re.match(r'(\w+)', parts[-1])
                    if a and b:
                        edges.append({"from": a.group(1), "to": b.group(1)})
            else:
                node_m = re.match(r'(\w+)\s*\["(.*)"\]', s)
                if node_m:
                    nid, label = node_m.group(1), node_m.group(2)
                    label_clean = label.replace('<br/>', ' | ')
                    chap = ''
                    ch_m = re.search(r'第\s*(\d+)\s*章', label)
                    if ch_m:
                        chap = f"第{ch_m.group(1)}章"
                    node_map[nid] = {"id": nid, "label": label_clean, "chapter": chap}
                    if cur_cluster is not None:
                        cur_cluster["nodes"].append(node_map[nid])
    return {
        "mermaid": mermaid_src,
        "clusters": clusters,
        "edges": edges,
    }


def parse_concepts(block):
    header, rows = parse_table(block["lines"])
    concepts = []
    for i, r in enumerate(rows, 1):
        concepts.append({
            "id": i,
            "name": r.get("概念名", ""),
            "summary": r.get("一句话解释", ""),
            "difficulty": r.get("难度", ""),
            "difficultyStars": difficulty_stars(r.get("难度", "")),
            "prerequisites": r.get("前置依赖", ""),
            "type": r.get("类型", ""),
        })
    return concepts


def parse_tasks(block):
    header, rows = parse_table(block["lines"])
    tasks = []
    for i, r in enumerate(rows, 1):
        tasks.append({
            "id": i,
            "name": r.get("任务名", ""),
            "description": r.get("做什么", ""),
            "time": r.get("预计耗时", ""),
            "files": r.get("对应文件/命令", r.get("对应文件", "")),
        })
    return tasks


def parse_difficulties(block):
    items, _ = parse_numbered_list(block["lines"])
    diffs = []
    for i, it in enumerate(items, 1):
        m = re.match(r'^\*\*(.+?)\*\*\s*[—–-]\s*(.*)$', it)
        if m:
            diffs.append({"id": i, "title": strip_md(m.group(1)), "detail": strip_md(m.group(2))})
        else:
            diffs.append({"id": i, "title": "", "detail": strip_md(it)})
    return diffs


def detect_chapter_kind(heading, subblocks):
    """判断章节形态。"""
    if '代码走读' in heading:
        return 'code-walkthrough'
    if '实战' in heading:
        return 'practice'
    if '回顾' in heading:
        return 'review'
    return 'concept'


def parse_chapter(block, subblocks, blocks, index):
    """解析单个章节（## 第 N 章）。subblocks 是章节下的 ### 子块列表。"""
    title = block["heading"]

    chapter = {
        "index": index,
        "title": title,
        "shortTitle": re.sub(r'^.*?第\s*\d+\s*[章课节][:：·]\s*', '', title),
        "kind": detect_chapter_kind(title, subblocks),
        "summary": "",
        "analogy": None,
        "sections": [],
        "qa": [],
        "takeaways": [],
    }

    def _section_content(sb):
        return restore_codeblocks("\n".join(sb["lines"]), blocks).strip()

    for sb in subblocks:
        h = sb["heading"]
        if re.search(r'一句话概括', h):
            chapter["summary"] = _section_content(sb)
        elif re.search(r'类比切入', h):
            name = re.sub(r'^.*类比切入[:：]\s*', '', h)
            chapter["analogy"] = {"name": name, "content": _section_content(sb),
                                   "steps": _split_analogy_steps(_section_content(sb))}
        elif re.search(r'预判答疑', h):
            chapter["qa"] = split_qa(sb["lines"], blocks)
        elif re.search(r'重点小结', h):
            items, _ = parse_numbered_list(sb["lines"])
            chapter["takeaways"] = items
        else:
            content = _section_content(sb)
            code_blocks_in_section = []
            for ln in sb["lines"]:
                m = re.match(r'__CODEBLOCK_(\d+)__', ln.strip())
                if m:
                    b = blocks[int(m.group(1))]
                    code_blocks_in_section.append({
                        "language": b["language"], "code": b["code"],
                        "caption": _find_caption(sb["lines"], ln),
                    })
            chapter["sections"].append({
                "heading": h,
                "content": content,
                "codeBlocks": code_blocks_in_section,
            })
    # 若没有"一句话概括"，从章节直接正文（列表项/段落）提取摘要作为兜底
    if not chapter["summary"]:
        # 章节块自身的 lines（新闻格式：标题下的 - 列表项）
        own_lines = block.get("lines", [])
        candidate_lines = []
        for ln in own_lines:
            t = strip_md(ln).strip()
            if not t or t.startswith('#'):
                continue
            candidate_lines.append(ln)
        # 子块中的无标题内容也作为候选
        for sb in subblocks:
            if not sb["heading"]:
                candidate_lines.extend(sb["lines"])
        for ln in candidate_lines:
            t = strip_md(ln).strip()
            # 先去列表符号
            t = re.sub(r'^[-*•]\s*', '', t)
            if not t or t.startswith(('#', '---')):
                continue
            # 跳过链接
            if re.match(r'^https?://', t):
                continue
            # 跳过时间戳行（新闻格式）
            if re.match(r'^(Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s*\d{1,2}\s', t) or re.match(r'^\d{4}-\d{2}-\d{2}', t):
                continue
            if len(t) >= 8:
                chapter["summary"] = t
                break
    return chapter


def _find_caption(lines, codeblock_line):
    """找代码块占位符上一行的非空文本作为说明。"""
    idx = None
    for i, ln in enumerate(lines):
        if ln == codeblock_line:
            idx = i
            break
    if idx and idx > 0:
        prev = lines[idx - 1].strip()
        if prev and not prev.startswith('#'):
            return strip_md(prev)
    return ""


def _split_analogy_steps(text):
    """
    把类比切入文本拆成可播放的步骤序列（3~6 步最佳）。
    策略：先按句号/换行切，过长的句子再按「；」「——」「，」次级切分，
    合并成 12~45 字的语义单元。
    """
    if not text:
        return []
    # 一级切分：句号/感叹号/问号/换行
    parts = re.split(r'([。！？\n]+)', text)
    units = []
    buf = ""
    for p in parts:
        if not p or p.strip() in ('。', '！', '？', '\n'):
            continue
        buf = (buf + p).strip()
        if buf and (p.endswith(('。', '！', '？')) or '\n' in p) and len(buf) >= 10:
            units.append(buf)
            buf = ""
    if buf.strip():
        units.append(buf.strip())
    # 二级切分：过长单元按 ；——， 细分
    steps = []
    for u in units:
        if len(u) > 45:
            sub_parts = re.split(r'(；|——|，)', u)
            cur = ""
            for sp in sub_parts:
                if not sp:
                    continue
                cur = (cur + sp).strip()
                # 次级单元达到 14~45 字就提交，或遇到 ；——
                if (sp in ('；', '——') or len(cur) >= 45) and len(cur) >= 12:
                    steps.append(cur)
                    cur = ""
            if cur.strip() and len(cur.strip()) >= 12:
                steps.append(cur.strip())
        else:
            steps.append(u)
    # 兜底：仍过短/过长的合并或截断
    merged = []
    for s in steps:
        s = s.strip().strip('，。；：、,')
        if not s:
            continue
        if len(s) < 10 and merged:
            merged[-1] = merged[-1] + s
        else:
            merged.append(s)
    # 限制每步长度，避免动画溢出
    final = []
    for s in merged:
        while len(s) > 48:
            cut = s[:46]
            # 尽量在标点处断
            brk = max(cut.rfind('，'), cut.rfind('；'), cut.rfind('——'), cut.rfind(' '))
            if brk > 20:
                final.append(cut[:brk + 1])
                s = s[brk + 1:]
            else:
                final.append(cut)
                s = s[46:]
        if s:
            final.append(s)
    return final


def parse_practice(block, blocks):
    """解析实战引导节（## 实战 N）。"""
    title = block["heading"]
    idm = re.search(r'实战\s*(\d+)', title)
    pid = int(idm.group(1)) if idm else None
    # 先用占位符行做字段提取，最后再还原代码块
    placeholder_text = "\n".join(block["lines"])
    p = {"id": pid, "title": re.sub(r'^实战\s*\d+[:：]?\s*', '', title),
         "content": restore_codeblocks(placeholder_text, blocks)}
    verify = re.search(r'\*\*验证知识点\*\*[:：]\s*(.+?)(?=\*\*预期结果|\*\*动手|\Z)', placeholder_text, re.S)
    if verify:
        p["verifyPoint"] = restore_codeblocks(verify.group(1).strip(), blocks)
    expected = re.search(r'\*\*预期结果\*\*[:：]\s*(.+?)(?=\*\*延伸挑战|\*\*踩坑提醒|__CODEBLOCK_|\Z)', placeholder_text, re.S)
    if expected:
        p["expected"] = restore_codeblocks(expected.group(1).strip(), blocks)
    challenge = re.search(r'\*\*延伸挑战\*\*[:：]\s*(.+?)(?=\n## |__CODEBLOCK_|\Z)', placeholder_text, re.S)
    if challenge:
        p["challenge"] = restore_codeblocks(challenge.group(1).strip(), blocks)
    return p


def parse_quiz(block, blocks):
    """
    解析测验（## 测验题）。支持三种题型，识别规则：

    - 选择题：题干后跟 `A. xxx / B. xxx / C. xxx / D. xxx` 选项行，
      答案标记 `> 答案：B` 或 `> 正确答案：B`
    - 判断题：题干后跟 `> 答案：对/错`（或 true/false、√/×）
    - 问答题：题干后跟 `> 参考答案要点：...`（原有格式）
    - 题型也可在题目标记中显式声明，如 `**Q1（选择题）**`

    每题可带 `> 讲解：...`（错误讲解）与 `> 章节：第N章`（关联章节）。
    """
    raw_lines = block["lines"]
    # 按 **Q{n}** 切题
    q_blocks = []
    cur = None
    for ln in raw_lines:
        m = re.match(r'^\s*\*\*Q(\d+)\s*[（(]?([^）)]*)[）)]?\s*\*\*\s*[:：]?\s*(.*)$', ln)
        if m:
            if cur is not None:
                q_blocks.append(cur)
            cur = {"qno": int(m.group(1)), "tag": m.group(2).strip(),
                   "stem": (m.group(3).strip() or ""), "lines": []}
        else:
            if cur is not None:
                cur["lines"].append(ln)
    if cur is not None:
        q_blocks.append(cur)

    quiz = []
    for q in q_blocks:
        quiz.append(_parse_quiz_item(q, blocks))
    return quiz


def _parse_quiz_item(q, blocks):
    """解析单道测验题 → 结构化题目（支持六种题型 + 面试/实战扩展）。"""
    item = {
        "id": q["qno"],
        "type": "essay",
        "question": q["stem"],
        "answer": "",
        "explanation": "",
        "difficulty": 2,
        "interview": False,
        "source": "current",
    }
    raw = q["lines"]
    content = restore_codeblocks("\n".join(raw), blocks)

    # 收集标记行（> 答案/讲解/章节/难度/面试/追问/文件/判定/来源…）与普通行
    ref_answers, ref_explains, ref_chapters = [], [], []
    ref_difficulty, ref_interview, ref_followups = [], [], []
    ref_files, ref_mode, ref_expected, ref_source = [], [], [], []
    ref_ability = []
    body_lines = []
    for ln in raw:
        s = ln.strip()
        m_a = re.match(r'^>\s*(?:正确)?答案[:：]\s*(.+)$', s)
        m_e = re.match(r'^>\s*(?:错误讲解|讲解|解析)[:：]\s*(.+)$', s)
        m_c = re.match(r'^>\s*章节[:：]\s*(?:第\s*)?(\d+)\s*章?$', s)
        m_d = re.match(r'^>\s*难度[:：]\s*(\d+)\s*星?$', s)
        m_i = re.match(r'^>\s*面试[:：]\s*(是|否|true|false|1|0)$', s)
        m_f = re.match(r'^>\s*追问[:：]\s*(.+)$', s)
        m_fl = re.match(r'^>\s*文件[:：]\s*(.+)$', s)
        m_m = re.match(r'^>\s*判定[:：]\s*(choice|paste|self)$', s)
        m_ep = re.match(r'^>\s*(?:预期|匹配)[:：]\s*(.+)$', s)
        m_s = re.match(r'^>\s*来源[:：]\s*(.+)$', s)
        m_ab = re.match(r'^>\s*能力[:：]\s*(.+)$', s)
        if m_a:
            ref_answers.append(strip_md(m_a.group(1)))
        elif m_e:
            ref_explains.append(strip_md(m_e.group(1)))
        elif m_c:
            ref_chapters.append(int(m_c.group(1)))
        elif m_d:
            ref_difficulty.append(int(m_d.group(1)))
        elif m_i:
            ref_interview.append(m_i.group(1).lower() in ("是", "true", "1"))
        elif m_f:
            ref_followups.append(strip_md(m_f.group(1)))
        elif m_fl:
            ref_files.append(strip_md(m_fl.group(1)))
        elif m_m:
            ref_mode.append(m_m.group(1))
        elif m_ep:
            ref_expected.append(strip_md(m_ep.group(1)))
        elif m_s:
            ref_source.append(strip_md(m_s.group(1)))
        elif m_ab:
            ref_ability.append(strip_md(m_ab.group(1)))
        else:
            body_lines.append(ln)

    # 识别题型：先看题目标记，再看内容特征
    qtype = "essay"
    tag = q["tag"]
    if '多选' in tag:
        qtype = "multi_choice"
    elif '选择' in tag or '单选' in tag:
        qtype = "choice"
    elif '判断' in tag:
        qtype = "true_false"
    elif '填空' in tag:
        qtype = "fill_blank"
    elif '实战' in tag or '运行' in tag:
        qtype = "practical"

    # 提取选项 A./B./C./D. 或 A-E
    options = []
    opt_re = re.compile(r'^\s*([A-E])[.、)]\s+(.+)$')
    for ln in body_lines:
        m = opt_re.match(ln)
        if m:
            options.append({"key": m.group(1), "text": strip_md(m.group(2))})

    if options and qtype in ("choice", "multi_choice", "practical"):
        if qtype == "essay":
            qtype = "choice"

    item["type"] = qtype

    # 提取题干（若题目标记里没带题干，则取第一段非选项文本）
    stem_lines = [ln for ln in body_lines if not opt_re.match(ln.strip())]
    if not item["question"] and stem_lines:
        first = next((ln.strip() for ln in stem_lines if ln.strip()), "")
        item["question"] = strip_md(first)
        body_lines = [ln for ln in stem_lines[1:]] if first else body_lines

    # 按题型填充
    if qtype in ("choice", "multi_choice") and options:
        item["options"] = [f"{o['key']}. {o['text']}" for o in options]
        key_to_idx = {o["key"]: i for i, o in enumerate(options)}
        answer_text = " ".join(ref_answers).upper()
        if qtype == "multi_choice":
            idxs = []
            for key in ["A", "B", "C", "D", "E"]:
                if key in answer_text:
                    idxs.append(key_to_idx[key])
            item["correctIndex"] = idxs or [0]
        else:
            idxs = []
            for key in ["A", "B", "C", "D", "E"]:
                if key in answer_text:
                    idxs.append(key_to_idx[key])
            item["correctIndex"] = [idxs[0]] if idxs else [0]
    elif qtype == "true_false":
        ans_raw = " ".join(ref_answers).strip()
        tf_map = {"对": "对", "正确": "对", "true": "对", "√": "对", "✓": "对",
                  "错": "错", "错误": "错", "false": "错", "×": "错", "✗": "错", "✘": "错"}
        for k, v in tf_map.items():
            if k in ans_raw:
                item["correctAnswer"] = v
                break
        if "correctAnswer" not in item:
            item["correctAnswer"] = "对"
    elif qtype == "fill_blank":
        if ref_answers:
            # 支持 `> 答案：术语 / 同义词1 / 同义词2`
            raw_ans = " ".join(ref_answers)
            parts = [p.strip() for p in re.split(r'[/／、|]', raw_ans) if p.strip()]
            item["correctAnswer"] = parts[0]
            item["fillAnswers"] = parts
    elif qtype == "practical":
        practical = {"files": [], "compareMode": "self"}
        if ref_files:
            practical["files"] = [f.strip() for f in " ".join(ref_files).split(",") if f.strip()]
        if ref_mode:
            practical["compareMode"] = ref_mode[0]
        if options and ref_mode and ref_mode[0] == "choice":
            practical["options"] = [f"{o['key']}. {o['text']}" for o in options]
            ans_text = " ".join(ref_answers).upper()
            for key, oi in [("A", 0), ("B", 1), ("C", 2), ("D", 3)]:
                if key in ans_text:
                    practical["correctIndex"] = oi
                    break
        if ref_expected:
            practical["expectedPattern"] = " ".join(ref_expected)
        item["practical"] = practical

    # 答案/讲解/章节/难度/面试/追问/来源
    if qtype == "essay":
        m_ref = re.search(r'^\s*>?\s*参考答案要点[:：]?\s*(.*)$', content, re.M | re.S)
        if m_ref:
            item["answer"] = m_ref.group(1).strip()
        elif ref_answers:
            item["answer"] = " ".join(ref_answers)
    else:
        if ref_answers:
            item["answer"] = " ".join(ref_answers)
    if ref_explains:
        item["explanation"] = " ".join(ref_explains)
    if ref_chapters:
        item["chapterRef"] = ref_chapters[0]
    if ref_difficulty:
        item["difficulty"] = ref_difficulty[0]
    if ref_interview:
        item["interview"] = ref_interview[0]
    if ref_followups:
        item["followUps"] = ref_followups
    if ref_source:
        item["source"] = " ".join(ref_source)
    # 能力维度由前端 LLM 打标签兜底（笔记手写题默认提示词工程）
    item.setdefault("ability", "提示词工程")
    return item


def parse_assessment(block):
    """解析掌握情况评估。"""
    content = "\n".join(block["lines"])
    a = {"mastered": [], "review": [], "score": "", "comment": ""}
    m = re.search(r'\*\*建议已扎实[^*]*?\*\*\s*[:：]?\s*(.*?)(?=\*\*需要复习|\Z)', content, re.S)
    if m:
        items, _ = parse_numbered_list(m.group(1).split('\n'))
        a["mastered"] = items
    m = re.search(r'\*\*需要复习[^*]*?\*\*\s*[:：]?\s*(.*?)(?=\*\*整体评分|\Z)', content, re.S)
    if m:
        items, _ = parse_numbered_list(m.group(1).split('\n'))
        a["review"] = items
    m = re.search(r'\*\*整体评分\*\*[:：]?\s*(.*?)(?=\*\*一句话评语|\n)', content, re.S)
    if m:
        a["score"] = m.group(1).strip()
    m = re.search(r'\*\*一句话评语\*\*[:：]?\s*(.*)', content, re.S)
    if m:
        a["comment"] = m.group(1).strip()
    return a


def parse_next_course(block):
    content = "\n".join(block["lines"])
    nc = {"title": "", "path": "", "concepts": []}
    t = re.search(r'\*\*(.+?)\*\*', content)
    if t:
        nc["title"] = strip_md(t.group(1))
    p = re.search(r'目录[:：]\s*`([^`]+)`', content)
    if p:
        nc["path"] = p.group(1)
    items, _ = parse_numbered_list(block["lines"])
    nc["concepts"] = items
    return nc


# ---------------------------------------------------------------- 主解析

def parse_note(md_text, source_path=""):
    raw_lines = md_text.split('\n')
    lines, blocks = extract_code_blocks(raw_lines)
    all_blocks = split_blocks(lines)

    # 标题识别：优先第一个 level-1 块；没有则用第一个 level-2/3 块作为课程名
    title = "未命名课程"
    title_block = None
    for b in all_blocks:
        if b["level"] == 1 and b["heading"]:
            title_block = b
            break
    if title_block is None:
        for b in all_blocks:
            if b["heading"] and b["level"] in (2, 3):
                title_block = b
                break
    if title_block is not None:
        title = strip_md(title_block["heading"])

    course = {
        "schemaVersion": "1.0",
        "id": Path(source_path).stem if source_path else "course",
        "title": title,
        "source": {
            "path": source_path,
            "fileName": Path(source_path).name if source_path else "",
            "parsedAt": datetime.now(timezone.utc).isoformat(),
        },
        "meta": parse_head_meta(title_block) if title_block else {"notes": [], "prerequisites": [], "conventions": []},
        "learningObjectives": [],
        "dependencyGraph": {"mermaid": "", "clusters": [], "edges": []},
        "concepts": [],
        "tasks": [],
        "difficulties": [],
        "chapters": [],
        "practice": [],
        "quiz": [],
        "assessment": {"mastered": [], "review": [], "score": "", "comment": ""},
        "nextCourse": {"title": "", "path": "", "concepts": []},
    }

    chapter_seq = 0
    i = 0
    n = len(all_blocks)
    while i < n:
        b = all_blocks[i]
        if b is title_block:
            i += 1
            continue
        h = b["heading"]
        if b["level"] == 1:
            i += 1
            continue  # 阶段标记（第三步/第四步/测验收尾），由内部 ## 块处理
        if h == '学习目标' or '本课目标' in h or '目标及收益' in h or '课程目标' in h:
            course["learningObjectives"] = parse_learning_objectives(b)
        elif h == '知识依赖关系图':
            course["dependencyGraph"] = parse_dependency_graph(b, blocks)
        elif h == '核心概念表':
            course["concepts"] = parse_concepts(b)
        elif h == '实战任务清单':
            course["tasks"] = parse_tasks(b)
        elif h == '难点预判':
            course["difficulties"] = parse_difficulties(b)
        elif re.search(r'第\s*\d+\s*[章课节]\s*[:：·]', h) or re.match(r'^\d+[.、]\s*', h):
            chapter_seq += 1
            # 收集章节标题块 + 后续所有更深层级的子块（直到下一个同级或更高级别标题）
            subblocks = []
            j = i + 1
            while j < n and all_blocks[j]["level"] > b["level"]:
                subblocks.append(all_blocks[j])
                j += 1
            course["chapters"].append(parse_chapter(b, subblocks, blocks, chapter_seq))
            i = j
            continue
        elif re.match(r'^实战\s*\d+', h):
            course["practice"].append(parse_practice(b, blocks))
        elif h.startswith('测验题'):
            course["quiz"] = parse_quiz(b, blocks)
        elif h == '掌握情况评估':
            course["assessment"] = parse_assessment(b)
        elif h == '下节课预告':
            course["nextCourse"] = parse_next_course(b)
        i += 1

    return course


def main():
    ap = argparse.ArgumentParser(description='学习笔记 → 课程 JSON 解析器')
    ap.add_argument('note', help='Markdown 学习笔记路径')
    ap.add_argument('-o', '--output', help='输出 JSON 路径（默认 <笔记同目录>/<笔记名>.course.json）')
    args = ap.parse_args()

    note_path = Path(args.note)
    md_text = note_path.read_text(encoding='utf-8')
    course = parse_note(md_text, str(note_path))

    out_path = Path(args.output) if args.output else (note_path.parent / f"{note_path.stem}.course.json")
    out_path.write_text(json.dumps(course, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f"✅ 解析完成: {note_path.name}")
    print(f"   课程标题: {course['title']}")
    print(f"   概念 {len(course['concepts'])} 个 | 任务 {len(course['tasks'])} 个 | 章节 {len(course['chapters'])} 章 | 测验 {len(course['quiz'])} 题 | 实战 {len(course['practice'])} 项")
    print(f"   输出: {out_path}")


if __name__ == '__main__':
    sys.exit(main())
