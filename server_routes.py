"""
CharacterLoraPreset - server_routes.py

Registers HTTP routes on ComfyUI's PromptServer so the node UI (JS) can
list/save/delete presets without ever touching a yaml/text file by hand.

Routes:
  GET  /character_lora_preset/list           -> {"presets": {...full dict...}}
  GET  /character_lora_preset/get?name=X     -> {...single preset...} or 404
  POST /character_lora_preset/save           -> body: preset fields, returns updated list
  POST /character_lora_preset/delete         -> body: {"name": X}, returns updated list
"""

from aiohttp import web

try:
    from server import PromptServer
    _HAS_SERVER = True
except ImportError:
    _HAS_SERVER = False

try:
    import folder_paths
    _HAS_FOLDER_PATHS = True
except ImportError:
    _HAS_FOLDER_PATHS = False

from . import presets_store


def register_routes():
    if not _HAS_SERVER:
        print("[CharacterLoraPreset] Could not import ComfyUI's PromptServer - routes not registered.")
        return

    routes = PromptServer.instance.routes

    @routes.get("/character_lora_preset/list")
    async def list_presets(request):
        try:
            presets = presets_store.load_presets()
            return web.json_response({"presets": presets})
        except Exception as e:
            return web.json_response({"error": str(e)}, status=500)

    @routes.get("/character_lora_preset/get")
    async def get_preset(request):
        name = request.query.get("name", "")
        preset = presets_store.get_preset(name)
        if preset is None:
            return web.json_response({"error": f"Preset '{name}' not found."}, status=404)
        result = dict(preset)
        result["name"] = name
        return web.json_response(result)

    @routes.post("/character_lora_preset/save")
    async def save_preset(request):
        try:
            body = await request.json()
            name = body.get("name", "")
            lora = body.get("lora", "")
            strength_model = body.get("strength_model", 1.0)
            strength_clip = body.get("strength_clip", 1.0)
            trigger = body.get("trigger", "")
            description = body.get("description", "")
            visible = body.get("visible", None)

            presets = presets_store.save_preset(
                name=name,
                lora=lora,
                strength_model=strength_model,
                strength_clip=strength_clip,
                trigger=trigger,
                description=description,
                visible=visible,
            )
            return web.json_response({"ok": True, "presets": presets})
        except ValueError as e:
            return web.json_response({"error": str(e)}, status=400)
        except Exception as e:
            return web.json_response({"error": str(e)}, status=500)

    @routes.post("/character_lora_preset/delete")
    async def delete_preset(request):
        try:
            body = await request.json()
            name = body.get("name", "")
            if not name:
                return web.json_response({"error": "Preset name is required."}, status=400)
            presets = presets_store.delete_preset(name)
            return web.json_response({"ok": True, "presets": presets})
        except Exception as e:
            return web.json_response({"error": str(e)}, status=500)

    @routes.get("/character_lora_preset/loras")
    async def list_loras(request):
        if not _HAS_FOLDER_PATHS:
            return web.json_response({"error": "folder_paths not available"}, status=500)
        try:
            loras = folder_paths.get_filename_list("loras")
            return web.json_response({"loras": loras})
        except Exception as e:
            return web.json_response({"error": str(e)}, status=500)

    @routes.post("/character_lora_preset/set_visible")
    async def set_visible(request):
        try:
            body = await request.json()
            name = body.get("name", "")
            visible = body.get("visible", True)
            if not name:
                return web.json_response({"error": "Preset name is required."}, status=400)
            presets = presets_store.set_visible(name, visible)
            return web.json_response({"ok": True, "presets": presets})
        except Exception as e:
            return web.json_response({"error": str(e)}, status=500)

    print("[CharacterLoraPreset] Routes registered under /character_lora_preset/*")
