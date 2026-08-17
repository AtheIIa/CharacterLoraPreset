"""
CharacterLoraPreset - nodes.py

CharacterPromptLoader: loads saved character presets, applies their
LoRAs, and builds the combined prompt. Preset management (add/edit/
delete/visibility) happens entirely through the "Manage Characters"
popup built into this node's JS layer - there is no separate Editor
node; it was removed once the popup covered everything it did.

Node key is namespaced with a "CharacterLoraPreset_" prefix to avoid
any collision with other installed custom node packs.
"""

import folder_paths
import comfy.sd
import comfy.utils

from . import presets_store


class CharacterPromptLoader:
    """
    Load one or more saved character presets, apply their LoRAs to
    model/clip, and build a combined prompt string:

        <trigger>, <description>
        <trigger>, <description>
        ...
        <scene_prompt>

    """

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "model": ("MODEL",),
                "clip": ("CLIP",),
                "selected_presets": ("STRING", {
                    "default": "",
                    "multiline": False,
                    "tooltip": "Comma-separated preset names, e.g. Janice_25, Robin_34",
                }),
                "scene_prompt": ("STRING", {"default": "", "multiline": True}),
            }
        }

    RETURN_TYPES = ("MODEL", "CLIP", "STRING")
    RETURN_NAMES = ("model", "clip", "prompt")
    FUNCTION = "load"
    CATEGORY = "CharacterLoraPreset"

    def load(self, model, clip, selected_presets, scene_prompt):
        presets = presets_store.load_presets()

        entries = [e.strip() for e in (selected_presets or "").split(",")]
        entries = [e for e in entries if e]

        prompt_lines = []
        missing = []

        for entry in entries:
            # Supports both "name" (use preset's saved strengths) and
            # "name:model_strength:clip_strength" (per-run override from
            # the node face, without touching the saved preset).
            parts = entry.split(":")
            name = parts[0].strip()

            override_sm = None
            override_sc = None
            if len(parts) >= 3:
                try:
                    override_sm = float(parts[1])
                    override_sc = float(parts[2])
                except ValueError:
                    override_sm = None
                    override_sc = None

            preset = presets.get(name)
            if preset is None:
                missing.append(name)
                continue

            lora_name = preset.get("lora", "")
            strength_model = override_sm if override_sm is not None else float(preset.get("strength_model", 1.0))
            strength_clip = override_sc if override_sc is not None else float(preset.get("strength_clip", 1.0))

            if lora_name:
                lora_path = folder_paths.get_full_path("loras", lora_name)
                if lora_path is None:
                    print(f"[CharacterLoraPreset] WARNING: lora file not found for preset "
                          f"'{name}': {lora_name} - skipping LoRA application for this preset.")
                else:
                    lora_sd = comfy.utils.load_torch_file(lora_path, safe_load=True)
                    model, clip = comfy.sd.load_lora_for_models(
                        model, clip, lora_sd, strength_model, strength_clip
                    )

            trigger = preset.get("trigger", "")
            description = preset.get("description", "")
            prompt_lines.append(f"{trigger}, {description}")

        if missing:
            print(f"[CharacterLoraPreset] WARNING: these preset names were not found and "
                  f"were skipped: {missing}")

        full_prompt = "\n".join(prompt_lines)
        scene_prompt = (scene_prompt or "").strip()
        if scene_prompt:
            full_prompt = f"{full_prompt}\n{scene_prompt}" if full_prompt else scene_prompt

        return (model, clip, full_prompt)

    @classmethod
    def IS_CHANGED(cls, model, clip, selected_presets, scene_prompt):
        return float("nan")


NODE_CLASS_MAPPINGS = {
    "CharacterLoraPreset_Loader": CharacterPromptLoader,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "CharacterLoraPreset_Loader": "Character Prompt Loader",
}
