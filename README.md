# ⚡ Skill Gauntlet · AI 能力试炼

<div align="center">

**Local-first · LLM-powered · Simulated Interviewer · Skill Profiling · Gamified Growth**

▎ Run the gauntlet of a ruthless AI interviewer — 10 dimensions, probe by probe, until you crack or you prove you know it.

[![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Linux-8A2BE2)](#)
[![LLM](https://img.shields.io/badge/LLM-DeepSeek%20%7C%20Qwen-FF6B6B)](#)
[![Local-first](https://img.shields.io/badge/Privacy-100%25%20Local-2FD6B5)](#)
[![License](https://img.shields.io/badge/License-MIT-blue)](#license)

**English** · [中文文档](./README.zh-CN.md)

</div>

> **In one line**: Import your study materials, then run the gauntlet of a simulated interviewer that probes, roasts, and even kicks you out — walk away with a 10-dimension skill radar + job-match report + gamified growth.

---

## ✨ Why this exists

You've studied tons of AI / Agent / RAG knowledge — but do you actually **know it**?

- ❌ Rote-memorized questions you forget the next day
- ❌ Answers that work until the phrasing changes
- ❌ Zero interview pressure until it's a real interview

This system fixes exactly that: **turn your study materials into questions that separate "real understanding" from "memorization", then let a ruthless interviewer expose what you don't actually know.**

---

## 🚀 Core Capabilities

| Capability | Description |
|---|---|
| 📥 **Materials → Questions** | Drop in a whole folder; LLM parses notes/code/data and generates **12 exam questions** (8 theory + 4 practical) + 3 job-interview reference questions |
| 📘 **Theory Exam** | Multiple-choice / true-false / fill-in-the-blank, judged by code with zero error |
| 🛠️ **Practical Exam** | Questions built on **your course's actual code** — not a generic "implement a function", but "fix the filter logic in this demo" |
| 💼 **Interview** | Pick from 8 AI roles; a simulated interviewer that **probes, downgrades, roasts, and ends the interview early** |
| 🧬 **10-Dimension Profile** | Radar chart + baseline level + job-match suggestions |
| 🎮 **Gamified Growth** | XP / levels / badges / streaks |
| 🔒 **100% Local** | Data lives in `~/.exam-center/`; API key stays in your browser and calls the LLM directly — **never leaves your machine** |

---

## 💼 The Interviewer — more than "asking questions"

The most human part of the whole system — this is the gauntlet. It will:

- 🎬 **Have mannerisms**: `(closes your resume, sighs)`、`(furrows brows, leans forward)`
- 🔍 **Probe ≥3 times per question**: even a decent answer gets dug deeper — why, drawbacks, edge cases, counterexamples
- 😤 **Downgrade when you can't answer**: "I don't know / can't" → point it out sharply, then break the question into the most basic sub-question
- 😏 **Roast you after repeated misses**: "That's the Nth time you couldn't answer — is your resume a little inflated?"
- 🚪 **End it early**: 4 cumulative misses on basics, and the interviewer closes your resume — "go back and build the fundamentals first"

Each of the 8 roles has its own **dedicated persona + knowledge graph + real interview-question arsenal**:

```
Agent Engineer · LLM App Dev · AI Platform/Inference · ML/Algorithm
RAG/Retrieval · Multimodal/Vision · AI Eval/Quality · Prompt Engineer
```

---

## 🧬 Skill Profile

After each exam, the system accumulates a **10-dimension skill radar**:

```
Prompt Engineering · RAG & Knowledge · Tool Calling · Vector & Embedding · Agent Core
Model Fine-tuning · Dev Frameworks · Deployment & Inference · Algorithms & Neural Nets · Interview Communication
```

From it you get: a **baseline level** + **your best-matched AI roles** (top suggestions).

---

## 🚀 Quick Start

> **You'll need**: Python 3.10+ · an LLM API key (DeepSeek / Alibaba Bailian / any OpenAI-compatible endpoint)

### Option 1: Run from source (recommended)

```bash
# 1. Install Python 3.10+
git clone https://github.com/Badegg404/skill-gauntlet.git
cd skill-gauntlet

# 2. Start (auto-opens browser)
./start.sh          # macOS / Linux
# On Windows, run `python3 server.py` (start.sh is a bash script for macOS/Linux)

# 3. Open http://127.0.0.1:8765 in your browser
```

### Option 2: Package as a desktop app

```bash
python3 -m venv .venv-build && source .venv-build/bin/activate
pip install pyinstaller
pyinstaller --clean --noconfirm build.spec
open dist/AI面试能力评估.app    # macOS
```

### Configure the LLM (required)

On first launch, fill in an API key under "⚙️ Settings" (supports **DeepSeek official**, **Alibaba Bailian**, and any OpenAI-compatible endpoint). The key is used by your browser to call the LLM directly, and can also be auto-filled from local environment variables — **it never leaves your machine**.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│           Frontend (zero framework, zero bundler) │
│  exam.js(logic) · prompts.js(prompts) · profile.js│
│  scoring.js(judging) · job_knowledge.json(8 roles)│
└──────────────────┬──────────────────────────────┘
                   │ HTTP (127.0.0.1:8765)
┌──────────────────▼──────────────────────────────┐
│      Python backend (pure stdlib, no deps)        │
│  server.py(HTTP) · pipeline.py(parse & generate)  │
│  storage.py(storage) · parser/(note parsing)      │
└──────────────────┬──────────────────────────────┘
                   │ browser-direct (key never leaves)
┌──────────────────▼──────────────────────────────┐
│   LLM (DeepSeek / Qwen / any OpenAI-compatible)    │
│   question gen · judging · interviewer · tagging   │
└─────────────────────────────────────────────────┘
```

**Core philosophy**: `LLM handles semantics, code handles data + prompts + fallback validation` — anything that "must always hold" (probe count, randomness, whitelist, dedup) is enforced by code, never left to the LLM's "initiative".

---

## 📁 Layout

```
.
├── server.py            # HTTP server (ThreadingHTTPServer, pure stdlib)
├── pipeline.py          # material parsing → course JSON → question pipeline
├── storage.py           # persistence (~/.exam-center/)
├── utils.py             # note detection / dedup / helpers
├── parser/              # Markdown note parser
├── web/                 # frontend (zero-framework vanilla JS)
│   ├── exam.js          # core interaction logic
│   ├── prompts.js       # all LLM prompts (centralized)
│   ├── scoring.js       # judging / question validation
│   ├── profile.js       # skill profile / levels / badges
│   ├── job_knowledge.js # job-knowledge loader (fetches the JSON)
│   ├── job_knowledge.json  # 8-role knowledge base (real interview questions)
│   └── fonts/           # web fonts (Orbitron / Share Tech Mono / Smiley)
├── tests/               # 38 tests (16 backend + 22 frontend)
├── docs/                # maintenance docs
└── build.spec           # PyInstaller config
```

---

## 🧪 Tests

```bash
./run_tests.sh    # run all 38 tests
```

---

## 🔒 Privacy

- **Data is 100% local**: notes, question banks, and exam history live in `~/.exam-center/` — nothing is uploaded
- **API key never leaves your machine**: the browser calls the LLM directly; the backend may read the key from local environment variables to auto-fill it, but never uploads or stores it anywhere
- **Single-user by design**: built for personal learning, not multi-tenant

---

## 📄 License

[MIT](./LICENSE)

---

<div align="center">

**⭐ If this project helps you, give it a Star!**

*Polished line by line — from a vague idea to a working interview system.*

</div>
