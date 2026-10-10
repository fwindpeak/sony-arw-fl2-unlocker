#!/usr/bin/env bash
# ==============================================================================
# Sony ARW Creative Look Unlocker — Agent Skill One-Line Installer
# ==============================================================================
set -e

SKILL_NAME="sony-arw-fl2-unlocker"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "⚡ [Sony ARW Unlocker] Installing Agent Skill: ${SKILL_NAME}..."

# Target Directories for popular agent platforms
GEMINI_GLOBAL="${HOME}/.gemini/config/skills/${SKILL_NAME}"
AGENTS_LOCAL="${PWD}/.agents/skills/${SKILL_NAME}"
CLAUDE_SKILLS="${HOME}/.claude/skills/${SKILL_NAME}"
CURSOR_SKILLS="${HOME}/.cursor/skills/${SKILL_NAME}"

mkdir -p "${GEMINI_GLOBAL}/scripts"
mkdir -p "${AGENTS_LOCAL}/scripts"

# Copy Skill definition, helper script, and 3D-LUT presets
if [ -f "${SCRIPT_DIR}/SKILL.md" ]; then
    cp "${SCRIPT_DIR}/SKILL.md" "${GEMINI_GLOBAL}/SKILL.md"
    cp "${SCRIPT_DIR}/SKILL.md" "${AGENTS_LOCAL}/SKILL.md"
    cp "${SCRIPT_DIR}/scripts/camouf_arw.py" "${GEMINI_GLOBAL}/scripts/camouf_arw.py"
    cp "${SCRIPT_DIR}/scripts/camouf_arw.py" "${AGENTS_LOCAL}/scripts/camouf_arw.py"
    chmod +x "${GEMINI_GLOBAL}/scripts/camouf_arw.py" "${AGENTS_LOCAL}/scripts/camouf_arw.py"

    if [ -f "${SCRIPT_DIR}/scripts/export_lut_cube.py" ]; then
        cp "${SCRIPT_DIR}/scripts/export_lut_cube.py" "${GEMINI_GLOBAL}/scripts/export_lut_cube.py"
        cp "${SCRIPT_DIR}/scripts/export_lut_cube.py" "${AGENTS_LOCAL}/scripts/export_lut_cube.py"
        chmod +x "${GEMINI_GLOBAL}/scripts/export_lut_cube.py" "${AGENTS_LOCAL}/scripts/export_lut_cube.py"
    fi

    if [ -d "${SCRIPT_DIR}/presets" ]; then
        mkdir -p "${GEMINI_GLOBAL}/presets" "${AGENTS_LOCAL}/presets"
        cp -r "${SCRIPT_DIR}/presets/"* "${GEMINI_GLOBAL}/presets/" 2>/dev/null || true
        cp -r "${SCRIPT_DIR}/presets/"* "${AGENTS_LOCAL}/presets/" 2>/dev/null || true
    fi
else
    echo "❌ Error: SKILL.md not found in ${SCRIPT_DIR}"
    exit 1
fi

# Also link to Claude/Cursor if directory exists
if [ -d "${HOME}/.claude" ]; then
    mkdir -p "${CLAUDE_SKILLS}/scripts"
    cp -r "${GEMINI_GLOBAL}/"* "${CLAUDE_SKILLS}/"
fi

if [ -d "${HOME}/.cursor" ]; then
    mkdir -p "${CURSOR_SKILLS}/scripts"
    cp -r "${GEMINI_GLOBAL}/"* "${CURSOR_SKILLS}/"
fi

echo "✅ [Success] Skill '${SKILL_NAME}' has been successfully installed!"
echo "📍 Installed Locations:"
echo "   - Global Agent Config: ${GEMINI_GLOBAL}"
echo "   - Workspace Config:    ${AGENTS_LOCAL}"
echo ""
echo "💡 Usage in Agent chat:"
echo '   "帮我把当前目录下的 ARW 照片全部解锁 FL2 / FL3 胶片创意外观"'
