# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller 打包配置 —— AI 岗位能力试炼 · Skill Gauntlet
  macOS   → 生成 .app bundle（双击即用）
  Windows → 生成单个 .exe（onefile，双击即用）
数据目录固定指向用户主目录 ~/.exam-center（见 server.py），不随包分发。
"""
import sys
from pathlib import Path

ROOT = Path(SPECPATH)  # spec 文件所在目录

# 需要打进包里的数据文件：(源路径, 包内目标目录)
datas = [
    (str(ROOT / "web"), "web"),                 # 前端静态资源
    (str(ROOT / "parser"), "parser"),           # 笔记解析器
]

# 纯 Python 模块（被打包器自动发现，这里显式声明更稳妥）
hiddenimports = [
    "note_parser",
    "utils",
    "storage",
    "pipeline",
]

a = Analysis(
    [str(ROOT / "server.py")],
    pathex=[str(ROOT), str(ROOT / "parser")],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)

pyz = PYZ(a.pure)

if sys.platform == "darwin":
    # macOS：onedir 收集所有资源 → 打包进 .app bundle
    exe = EXE(
        pyz,
        a.scripts,
        [],
        exclude_binaries=True,
        name="AI岗位能力试炼",
        debug=False,
        bootloader_ignore_signals=False,
        strip=False,
        upx=False,
        console=False,          # 不弹终端
        disable_windowed_traceback=False,
        argv_emulation=False,
        target_arch=None,
        codesign_identity=None,
        entitlements_file=None,
    )
    coll = COLLECT(
        exe,
        a.binaries,
        a.datas,
        strip=False,
        upx=False,
        upx_exclude=[],
        name="AI岗位能力试炼",
    )
    app = BUNDLE(
        coll,
        name="AI面试能力评估.app",
        icon=None,
        bundle_identifier="com.examcenter.assessment",
    )
else:
    # Windows / Linux：单文件 onefile
    exe = EXE(
        pyz,
        a.scripts,
        a.binaries,
        a.datas,
        [],
        name="AI岗位能力试炼",
        debug=False,
        bootloader_ignore_signals=False,
        strip=False,
        upx=False,
        upx_exclude=[],
        console=False,          # 不弹终端
        disable_windowed_traceback=False,
        argv_emulation=False,
        target_arch=None,
        codesign_identity=None,
        entitlements_file=None,
    )

