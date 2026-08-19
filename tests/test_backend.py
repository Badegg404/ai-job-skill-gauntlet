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


if __name__ == "__main__":
    unittest.main(verbosity=2)
