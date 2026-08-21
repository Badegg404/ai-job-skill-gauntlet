#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
test_backend.py — 后端纯函数测试集

覆盖历史 bug 与核心逻辑：
  - 章节识别（第 N 章/课/节 + emoji 前缀 + 数字列表）
  - 选择题选项随机化一致性
  - slug / 学习笔记判据 / 题目去重 / 能力维度兜底

运行：python3 tests/test_backend.py
"""
import json
import re
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "parser"))

from note_parser import parse_note
from utils import (
    slugify,
    slug_from_name,
    looks_like_study_note,
    dedupe_questions,
    shuffle_choice_options,
)
from pipeline import enrich_quiz


def parse_md(md):
    return parse_note(md, "test.md")


class TestChapterRecognition(unittest.TestCase):
    """章节识别（历史 bug：第 N 课/节 + emoji 前缀）"""

    def test_chapter_with_colon(self):
        course = parse_md("# 课程\n\n## 第 1 章：基础概念\n\n内容\n")
        self.assertEqual(len(course["chapters"]), 1)
        self.assertEqual(course["chapters"][0]["title"], "第 1 章：基础概念")

    def test_emoji_prefix_ke(self):
        """🧭 第 06 课：xxx（历史 bug：emoji 前缀 + 课，之前不识别）"""
        course = parse_md("# 课程\n\n## 🧭 第 06 课：模型如何规划并调用工具\n\n内容\n")
        self.assertEqual(len(course["chapters"]), 1)
        self.assertIn("模型如何规划", course["chapters"][0]["title"])

    def test_section(self):
        course = parse_md("# 课程\n\n## 第 3 节：进阶\n\n内容\n")
        self.assertEqual(len(course["chapters"]), 1)

    def test_numbered(self):
        course = parse_md("# 课程\n\n## 1. 数字章节\n\n内容\n")
        self.assertEqual(len(course["chapters"]), 1)

    def test_multiple_chapters(self):
        md = "# 课程\n\n## 第 1 章：一\n\n## 第 2 章：二\n\n## 第 3 章：三\n"
        course = parse_md(md)
        self.assertEqual(len(course["chapters"]), 3)
        # 章节序号递增
        self.assertEqual([c["index"] for c in course["chapters"]], [1, 2, 3])


class TestShuffleChoiceOptions(unittest.TestCase):
    """选择题选项随机化：内容不变、correctIndex 与 answer 一致"""

    def test_preserves_content_and_consistency(self):
        q = {
            "type": "choice",
            "options": ["A. 选项一", "B. 选项二", "C. 选项三", "D. 选项四"],
            "correctIndex": [0],
            "answer": "A",
        }
        shuffle_choice_options(q)
        self.assertEqual(len(q["options"]), 4)
        # 选项内容（去前缀）集合不变
        texts = set(re.sub(r"^[A-Ea-e][.、:：)]\s*", "", o) for o in q["options"])
        self.assertEqual(texts, {"选项一", "选项二", "选项三", "选项四"})
        # correctIndex 是数组且在范围内
        self.assertIsInstance(q["correctIndex"], list)
        for i in q["correctIndex"]:
            self.assertTrue(0 <= i < 4)
        # answer 字母与 correctIndex 一致
        letters = "ABCDE"
        expected = "".join(letters[i] for i in sorted(q["correctIndex"]))
        self.assertEqual(q["answer"], expected)


class TestSlug(unittest.TestCase):
    def test_slug_strips_md(self):
        # M3：不应把「Python 3.10」截断成「Python 3」
        self.assertEqual(slug_from_name("Python 3.10 入门.md"), "Python-3-10-入门")

    def test_slug_no_ext(self):
        self.assertEqual(slug_from_name("Python 3.10 入门"), "Python-3-10-入门")

    def test_slug_empty(self):
        self.assertEqual(slugify(""), "untitled")


class TestLooksLikeStudyNote(unittest.TestCase):
    def test_study_note_by_filename(self):
        self.assertTrue(looks_like_study_note("", "学习笔记.md"))

    def test_study_note_by_structure(self):
        self.assertTrue(looks_like_study_note("# t\n## 核心概念\n", "a.md"))

    def test_study_note_by_chapter(self):
        self.assertTrue(looks_like_study_note("# t\n## 第 1 章：x\n", "a.md"))

    def test_news_not_study_note(self):
        self.assertFalse(looks_like_study_note("# 新闻\n## 1. 第一条\n## 2. 第二条\n", "新闻.md"))


class TestDedupe(unittest.TestCase):
    def test_dedupe_identical(self):
        quiz = [
            {"question": "什么是 RAG？"},
            {"question": "什么是 RAG？"},
            {"question": "什么是 Agent？"},
        ]
        out = dedupe_questions(quiz)
        self.assertEqual(len(out), 2)


class TestEnrichQuiz(unittest.TestCase):
    def test_default_ability(self):
        course = {"quiz": [{"type": "essay", "question": "x", "answer": "y"}]}
        enrich_quiz(course)
        self.assertEqual(course["quiz"][0]["ability"], "提示词工程")

    def test_keeps_existing_ability(self):
        course = {"quiz": [{"type": "essay", "question": "x", "answer": "y", "ability": "RAG 与知识库"}]}
        enrich_quiz(course)
        self.assertEqual(course["quiz"][0]["ability"], "RAG 与知识库")


class TestParseRobustness(unittest.TestCase):
    """D-5/D-6：判断题否定词识别 + 无答案选择题剔除"""

    def _quiz_md(self, body):
        return "# 课程\n\n## 测验题\n\n" + body

    def test_true_false_negative_前缀(self):
        """「不对」→ 错（不被「对」子串误判）"""
        course = parse_note(self._quiz_md("**Q1（判断）** ReAct 循环不需要推理步骤\n\n> 答案：不对\n"), "t.md")
        tf = [q for q in course["quiz"] if q.get("type") == "true_false"]
        self.assertEqual(tf[0]["correctAnswer"], "错")

    def test_true_false_negative_没错(self):
        """「没错」→ 对（双重否定为肯定）"""
        course = parse_note(self._quiz_md("**Q1（判断）** ReAct 一定需要推理\n\n> 答案：没错\n"), "t.md")
        tf = [q for q in course["quiz"] if q.get("type") == "true_false"]
        self.assertEqual(tf[0]["correctAnswer"], "对")

    def test_true_false_normal(self):
        """正常「对」不受影响"""
        course = parse_note(self._quiz_md("**Q1（判断）** RAG 先检索再生成\n\n> 答案：对\n"), "t.md")
        tf = [q for q in course["quiz"] if q.get("type") == "true_false"]
        self.assertEqual(tf[0]["correctAnswer"], "对")

    def test_choice_without_answer_dropped(self):
        """无答案选择题 → correctIndex None，enrich_quiz 剔除（不默认第 0 个）"""
        course = parse_note(self._quiz_md("**Q1（选择）** 以下哪项是 ReAct 的循环步骤？\n\nA. 思考\nB. 行动\nC. 观察\nD. 以上都是\n"), "t.md")
        cho = [q for q in course["quiz"] if q.get("type") == "choice"]
        self.assertIsNone(cho[0].get("correctIndex"))
        enrich_quiz(course)
        self.assertFalse(any(q.get("type") == "choice" for q in course["quiz"]))

    def test_choice_with_answer_kept(self):
        """有答案选择题保留"""
        course = parse_note(self._quiz_md("**Q1（选择）** 以下哪项是 ReAct 的循环步骤？\n\nA. 思考\nB. 行动\nC. 观察\nD. 以上都是\n\n> 答案：D\n"), "t.md")
        cho = [q for q in course["quiz"] if q.get("type") == "choice"]
        self.assertEqual(cho[0]["correctIndex"], [3])


class TestTableParsing(unittest.TestCase):
    """D-7：表格解析不再硬编码跳过第 2 行"""

    def _parse(self, rows):
        from note_parser import parse_table
        return parse_table(rows)

    def test_with_separator(self):
        header, data = self._parse(["| 名称 | 值 |", "| --- | --- |", "| a | 1 |", "| b | 2 |"])
        self.assertEqual(len(data), 2)

    def test_without_separator(self):
        """无分隔行的表格不丢第一行数据（历史 bug：rows[2:] 丢一行）"""
        header, data = self._parse(["| 名称 | 值 |", "| a | 1 |", "| b | 2 |"])
        self.assertEqual(len(data), 2)
        self.assertEqual(data[0]["名称"], "a")



class TestLogSystem(unittest.TestCase):
    """日志系统：JSONL 行格式 / 级别映射 / 轮转 handler"""

    def test_log_json_line_format(self):
        """log_json 组装标准 JSONL 行：at/level/tag/msg/payload"""
        import io
        import logging

        buf = io.StringIO()
        logger = logging.getLogger("test.logjson")
        logger.setLevel(logging.DEBUG)
        logger.propagate = False
        logger.addHandler(logging.StreamHandler(buf))
        import server
        server.log_json(logger, "info", "test.tag", "消息", {"k": 1})
        row = json.loads(buf.getvalue().strip())
        self.assertIn("at", row)
        self.assertEqual(row["level"], "info")
        self.assertEqual(row["tag"], "test.tag")
        self.assertEqual(row["msg"], "消息")
        self.assertEqual(row["payload"], {"k": 1})

    def test_log_json_error_level_maps_to_error(self):
        """error 级别落到 logger.error（诊断中心按级别过滤依赖此映射）"""
        import io
        import logging

        buf = io.StringIO()
        logger = logging.getLogger("test.logerr")
        logger.setLevel(logging.DEBUG)
        logger.propagate = False
        logger.addHandler(logging.StreamHandler(buf))
        import server
        server.log_json(logger, "error", "e.tag", "boom", {"x": 2})
        row = json.loads(buf.getvalue().strip())
        self.assertEqual(row["level"], "error")

    def test_make_json_logger_rotating_handler(self):
        """_make_json_logger 创建 RotatingFileHandler 且写入即落盘"""
        import tempfile

        from logging.handlers import RotatingFileHandler
        import server
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "logs" / "a.log"
            lg = server._make_json_logger("test.rot", p)
            self.assertTrue(any(isinstance(h, RotatingFileHandler) for h in lg.handlers))
            lg.info('{"k": 1}')
            self.assertTrue(p.exists())
            self.assertIn("k", p.read_text(encoding="utf-8"))

if __name__ == "__main__":
    unittest.main(verbosity=2)
