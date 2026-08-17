"""
CharacterLoraPreset - presets_store.py

Handles all reading/writing of the presets.json file that backs both
the Editor node and the Loader node. This is the single source of truth
for saved character presets.

presets.json schema:
{
  "Janice_25": {
    "lora": "Janice_25_v3.safetensors",
    "strength_model": 1.0,
    "strength_clip": 1.0,
    "trigger": "Janice_25",
    "description": "Janice, a 25-year-old Latina woman with long wavy dark brown hair, ..."
  },
  ...
}
"""

import os
import json
import tempfile

try:
    import folder_paths
    _HAS_FOLDER_PATHS = True
except ImportError:
    _HAS_FOLDER_PATHS = False


def _get_storage_dir():
    """
    Resolve a stable directory to store presets.json in.
    Prefers ComfyUI's official per-user directory when available
    (folder_paths.get_user_directory), falling back to a local
    'stored_data' folder next to this file if that API isn't present
    (older ComfyUI versions).
    """
    if _HAS_FOLDER_PATHS and hasattr(folder_paths, "get_user_directory"):
        try:
            base = folder_paths.get_user_directory()
            path = os.path.join(base, "character_lora_preset")
            os.makedirs(path, exist_ok=True)
            return path
        except Exception:
            pass

    # Fallback: keep it inside this custom node's own folder so it
    # still works standalone with zero dependency on user-dir APIs.
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "stored_data")
    os.makedirs(path, exist_ok=True)
    return path


def _get_presets_path():
    return os.path.join(_get_storage_dir(), "presets.json")


def load_presets():
    """Return the full presets dict. Returns {} if file doesn't exist yet or is corrupt."""
    path = _get_presets_path()
    if not os.path.exists(path):
        return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
            if not isinstance(data, dict):
                return {}
            return data
    except (json.JSONDecodeError, OSError):
        return {}


def _save_presets(data):
    """
    Atomic write: write to a temp file in the same directory, then replace
    the real file. Avoids ending up with a half-written/corrupt presets.json
    if something interrupts the write.
    """
    path = _get_presets_path()
    directory = os.path.dirname(path)
    fd, tmp_path = tempfile.mkstemp(dir=directory, suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        os.replace(tmp_path, path)
    except Exception:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        raise


def get_preset(name):
    """Return a single preset dict, or None if it doesn't exist."""
    return load_presets().get(name)


def save_preset(name, lora, strength_model, strength_clip, trigger, description, visible=None):
    """
    Create or overwrite a preset. Returns the updated full presets dict.
    Raises ValueError on invalid input.

    `visible` controls whether this preset shows as a checkbox on the
    Loader node's main face. If not explicitly provided:
      - new preset -> defaults to True (shows immediately after creation)
      - existing preset being edited -> keeps its current visible value
    """
    name = (name or "").strip()
    if not name:
        raise ValueError("Preset name cannot be empty.")

    trigger = trigger or ""
    description = description or ""

    presets = load_presets()
    existing = presets.get(name, {})

    if visible is None:
        visible = existing.get("visible", True)

    presets[name] = {
        "lora": lora or "",
        "strength_model": float(strength_model) if strength_model is not None else 1.0,
        "strength_clip": float(strength_clip) if strength_clip is not None else 1.0,
        "trigger": trigger,
        "description": description,
        "visible": bool(visible),
    }
    _save_presets(presets)
    return presets


def set_visible(name, visible):
    """
    Update just the visible flag for an existing preset (used by the
    Loader node's manage-characters popup for quick show/hide toggling
    without resending the full preset). No-op if the preset doesn't exist.
    Returns the updated full presets dict.
    """
    presets = load_presets()
    if name in presets:
        presets[name]["visible"] = bool(visible)
        _save_presets(presets)
    return presets


def delete_preset(name):
    """Delete a preset by name. Returns the updated full presets dict. No-op if not found."""
    presets = load_presets()
    if name in presets:
        del presets[name]
        _save_presets(presets)
    return presets


def list_preset_names():
    """Return a sorted list of all preset names (for building checkboxes/dropdowns)."""
    return sorted(load_presets().keys())
