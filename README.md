# CharacterLoraPreset

A ComfyUI custom node for managing character LoRAs. Save a character once — its LoRA file, trigger word, and description — and load it into any prompt with a single click. Mix multiple characters in one generation, tweak strengths per-run without touching your saved presets, and keep a large character library organized without cluttering your workflow.

Built for anyone doing repeated character-consistent generation (illustration, portraiture, storytelling) who's tired of re-typing the same trigger + description block and manually wiring up LoRA loaders every time.

---

## What it does

**One node — `Character Prompt Loader`** — replaces the usual LoRA loader + prompt text combo for character work:

- A checkbox per saved character. Check the ones you want in this generation.
- Checking a character reveals an inline **Model / CLIP strength** control, pre-filled from the saved preset — tweak it for this run only, without altering what's saved.
- Outputs a ready-to-use `model`, `clip` (LoRAs applied and stacked), and `prompt` (the combined trigger + description text for every checked character, plus your scene/action prompt).

**A "⚙ Manage Characters" popup**, opened from the node itself — no separate editor node needed:

- Add a new character: name, LoRA file (pulled live from your loras folder), Model/CLIP strength, trigger, description.
- Click any saved character in the list to load it back into the form for editing.
- Delete with an inline confirmation — no accidental deletes.
- Search by name or trigger — handy once your library grows past a handful of characters.
- A **"visible on node"** toggle per character, so a library of 50+ presets doesn't have to clutter the checkbox list — only the ones you flag as visible show up on the node face.

Everything is stored locally in a `presets.json` file — no external services, no manual YAML editing.

---

## Screenshots

<!-- Add your screenshots below. Suggested shots:
     1. The Character Prompt Loader node with a couple of characters checked and strength rows visible
     2. The Manage Characters popup, showing the add/edit form
     3. The Manage Characters popup, showing the saved presets list with search
     4. A before/after generation showing a character LoRA applied
-->

![Character Prompt Loader node](screenshots/node-overview.png)

![Manage Characters — add/edit form](screenshots/manage-form.png)

---

## Installation

1. Download or clone this repository into your ComfyUI custom nodes folder:
   ```
   ComfyUI/custom_nodes/CharacterLoraPreset/
   ```
2. Restart ComfyUI.
3. Add the **Character Prompt Loader** node (search "character" in the Add Node menu, or find it under the `CharacterLoraPreset` category).

No extra dependencies beyond what ComfyUI already ships with.

---

## Usage

### Adding your first character

1. Add a `Character Prompt Loader` node and wire `model` / `clip` in from your checkpoint loader.
2. Click **⚙ Manage Characters**.
3. Fill in:
   - **Preset Name** — an internal identifier, e.g. `Janice_25`
   - **LoRA File** — pick from the dropdown
   - **Strength (Model / CLIP)** — the LoRA's default strength
   - **Trigger** — the trigger word(s) your LoRA was trained on
   - **Description** — the character description block that follows the trigger in your training captions
4. Click **Save Preset**.
5. Close the popup — the character now appears as a checkbox on the node.

### Using characters in a generation

1. Check the character(s) you want active for this generation.
2. Each checked character reveals a Model/CLIP strength row — click the arrows to nudge by 0.01, or click the value to type an exact number. These are per-run tweaks only; they don't change the saved preset.
3. Add your scene/action prompt in the `scene_prompt` box.
4. Wire the node's `model` / `clip` outputs into your sampler chain, and `prompt` into your positive `CLIPTextEncode`.

The final prompt is built as one line per checked character (`trigger, description`), followed by your scene prompt — matching the structure most character LoRA training captions use.

### Managing a large library

- Use the **search bar** in the Manage Characters popup to filter by name or trigger.
- Toggle **"Visible on node"** off for characters you're not actively using — they stay saved, just hidden from the node's checkbox list until you need them again.

---

## How data is stored

All presets live in a single `presets.json` file (created automatically), typically at:

```
ComfyUI/user/default/character_lora_preset/presets.json
```

(Falls back to a local folder inside the custom node directory on older ComfyUI versions without a user-data API.)

Each preset:

```json
{
  "Janice_25": {
    "lora": "Janice_25_v3.safetensors",
    "strength_model": 1.0,
    "strength_clip": 1.0,
    "trigger": "Janice_25",
    "description": "Janice, a 25-year-old Latina woman with long wavy dark brown hair, ...",
    "visible": true
  }
}
```

---

## Notes

- Built and tested against the classic (non-Vue) ComfyUI frontend.
- Per-run strength overrides are encoded invisibly in the node's saved workflow state, so they survive switching workflow tabs or reloading the browser.
- Renaming a preset isn't currently supported — delete and recreate under the new name if needed.

---

## License

https://github.com/AtheIIa/CharacterLoraPreset/blob/main/LICENSE
