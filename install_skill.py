#!/usr/bin/env python3
"""
Sony ARW Creative Look Unlocker — Universal Cross-Platform Skill Installer
===========================================================================
跨平台 Agent Skill 一键安装器 (支持 Windows、macOS 与 Linux)
自动将 Skill 安装到 Antigravity / Gemini 全局配置、当前工作区 .agents、Claude 及 Cursor。
"""

import os
import sys
import shutil

# Windows 终端控制台 UTF-8 支持
if sys.platform == "win32":
    try:
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        if hasattr(sys.stderr, "reconfigure"):
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

SKILL_NAME = "sony-arw-fl2-unlocker"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

def main():
    print(f"⚡ [Sony ARW Unlocker] Installing Agent Skill: {SKILL_NAME}...")

    user_home = os.path.expanduser("~")
    gemini_global = os.path.join(user_home, ".gemini", "config", "skills", SKILL_NAME)
    agents_local = os.path.join(os.getcwd(), ".agents", "skills", SKILL_NAME)
    claude_skills = os.path.join(user_home, ".claude", "skills", SKILL_NAME)
    cursor_skills = os.path.join(user_home, ".cursor", "skills", SKILL_NAME)

    skill_md = os.path.join(SCRIPT_DIR, "SKILL.md")
    if not os.path.isfile(skill_md):
        print(f"❌ Error: SKILL.md not found in {SCRIPT_DIR}", file=sys.stderr)
        sys.exit(1)

    target_dirs = [gemini_global, agents_local]

    # 检测 Claude 与 Cursor
    if os.path.isdir(os.path.join(user_home, ".claude")):
        target_dirs.append(claude_skills)
    if os.path.isdir(os.path.join(user_home, ".cursor")):
        target_dirs.append(cursor_skills)

    for target in target_dirs:
        os.makedirs(os.path.join(target, "scripts"), exist_ok=True)
        os.makedirs(os.path.join(target, "presets"), exist_ok=True)

        # 拷贝 SKILL.md
        shutil.copy2(skill_md, os.path.join(target, "SKILL.md"))

        # 拷贝 scripts
        for script_name in ["camouf_arw.py", "export_lut_cube.py"]:
            src_script = os.path.join(SCRIPT_DIR, "scripts", script_name)
            if not os.path.isfile(src_script):
                src_script = os.path.join(SCRIPT_DIR, script_name)
            if os.path.isfile(src_script):
                dst_script = os.path.join(target, "scripts", script_name)
                shutil.copy2(src_script, dst_script)
                if sys.platform != "win32":
                    try:
                        os.chmod(dst_script, 0o755)
                    except Exception:
                        pass

        # 拷贝 presets
        presets_dir = os.path.join(SCRIPT_DIR, "presets")
        if os.path.isdir(presets_dir):
            for item in os.listdir(presets_dir):
                s = os.path.join(presets_dir, item)
                d = os.path.join(target, "presets", item)
                if os.path.isfile(s):
                    shutil.copy2(s, d)
                elif os.path.isdir(s):
                    shutil.copytree(s, d, dirs_exist_ok=True)

    print(f"✅ [Success] Skill '{SKILL_NAME}' has been successfully installed!")
    print("📍 Installed Locations:")
    print(f"   - Global Agent Config: {gemini_global}")
    print(f"   - Workspace Config:    {agents_local}")
    if claude_skills in target_dirs:
        print(f"   - Claude Config:       {claude_skills}")
    if cursor_skills in target_dirs:
        print(f"   - Cursor Config:       {cursor_skills}")
    print()
    print("💡 Usage in Agent chat:")
    print('   "帮我把当前目录下的 ARW 照片全部解锁 FL2 / FL3 胶片创意外观"')

if __name__ == "__main__":
    main()
