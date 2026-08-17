// CharacterLoraPreset - character_loader_widget.js
//
// DROP 5: consolidates preset management into the "Character Prompt
// Loader" node itself via a "Manage Characters" popup, instead of
// requiring a separate Editor node + queue-to-save workflow.
//
// The popup lets you:
//   - Add a new preset (name, lora, strengths, trigger, description)
//   - Click an existing preset in the list to load it into the form for editing
//   - Delete a preset (click x -> inline "confirm?" -> Yes/Cancel)
//   - Toggle a "visible on node" checkbox per preset
//
// Only presets with visible=true render as checkboxes on the node's
// main face - so a library of 100 saved characters doesn't clutter
// the node; you opt specific ones into view via the popup.
//
// The Python side (nodes.py) is unchanged from drop 3/4 - the Loader
// node still just receives a comma-separated "selected_presets" string
// under the hood.

import { app } from "../../scripts/app.js";

const LOADER_NODE_NAME = "CharacterLoraPreset_Loader";
const LIST_ENDPOINT = "/character_lora_preset/list";
const LORAS_ENDPOINT = "/character_lora_preset/loras";
const SAVE_ENDPOINT = "/character_lora_preset/save";
const DELETE_ENDPOINT = "/character_lora_preset/delete";
const SET_VISIBLE_ENDPOINT = "/character_lora_preset/set_visible";

const STYLE_ID = "character-lora-preset-modal-styles";

function ensureStylesInjected() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
        .clp-overlay {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0, 0, 0, 0.6);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: sans-serif;
        }
        .clp-dialog {
            background: #232323;
            border: 1px solid #444;
            border-radius: 8px;
            width: 640px;
            max-width: 92vw;
            max-height: 85vh;
            display: flex;
            flex-direction: column;
            color: #ddd;
            box-shadow: 0 8px 30px rgba(0,0,0,0.5);
        }
        .clp-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            border-bottom: 1px solid #3a3a3a;
        }
        .clp-header h2 {
            margin: 0;
            font-size: 15px;
            font-weight: 600;
            color: #eee;
        }
        .clp-close-btn {
            background: none;
            border: none;
            color: #999;
            font-size: 18px;
            cursor: pointer;
            line-height: 1;
            padding: 4px 8px;
        }
        .clp-close-btn:hover { color: #fff; }
        .clp-body {
            overflow-y: auto;
            padding: 14px 16px;
        }
        .clp-form-title {
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            color: #999;
            margin: 0 0 8px 0;
        }
        .clp-field {
            margin-bottom: 8px;
        }
        .clp-field label {
            display: block;
            font-size: 11px;
            color: #999;
            margin-bottom: 3px;
        }
        .clp-field input[type="text"],
        .clp-field input[type="number"],
        .clp-field select,
        .clp-field textarea {
            width: 100%;
            box-sizing: border-box;
            background: #1a1a1a;
            border: 1px solid #444;
            border-radius: 4px;
            color: #eee;
            padding: 6px 8px;
            font-size: 12px;
            font-family: inherit;
        }
        .clp-field textarea {
            min-height: 60px;
            resize: vertical;
        }
        .clp-strength-row {
            display: flex;
            gap: 8px;
        }
        .clp-strength-row .clp-field { flex: 1; }
        .clp-form-buttons {
            display: flex;
            gap: 8px;
            margin-top: 10px;
        }
        .clp-btn {
            border: none;
            border-radius: 4px;
            padding: 7px 14px;
            font-size: 12px;
            cursor: pointer;
            font-weight: 600;
        }
        .clp-btn-save { background: #3a7d3a; color: #fff; }
        .clp-btn-save:hover { background: #479347; }
        .clp-btn-clear { background: #3a3a3a; color: #ccc; }
        .clp-btn-clear:hover { background: #484848; }
        .clp-divider {
            border-top: 1px solid #3a3a3a;
            margin: 14px 0;
        }
        .clp-list-row {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 6px 4px;
            border-radius: 4px;
        }
        .clp-list-row:hover { background: #2c2c2c; }
        .clp-list-row-main {
            flex: 1;
            cursor: pointer;
            overflow: hidden;
        }
        .clp-list-row-name {
            font-size: 12px;
            color: #eee;
            font-weight: 600;
        }
        .clp-list-row-trigger {
            font-size: 11px;
            color: #888;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .clp-delete-btn {
            background: none;
            border: none;
            color: #a55;
            font-size: 14px;
            cursor: pointer;
            padding: 2px 8px;
        }
        .clp-delete-btn:hover { color: #e55; }
        .clp-confirm-row {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 11px;
            color: #ccc;
        }
        .clp-confirm-yes {
            background: #a33;
            color: #fff;
            border: none;
            border-radius: 3px;
            padding: 3px 8px;
            font-size: 11px;
            cursor: pointer;
        }
        .clp-confirm-cancel {
            background: #3a3a3a;
            color: #ccc;
            border: none;
            border-radius: 3px;
            padding: 3px 8px;
            font-size: 11px;
            cursor: pointer;
        }
        .clp-empty-msg {
            color: #777;
            font-size: 12px;
            padding: 8px 4px;
        }
        .clp-status-msg {
            font-size: 11px;
            color: #8c8;
            margin-top: 6px;
            min-height: 14px;
        }
        .clp-status-msg.clp-error { color: #e77; }
        .clp-search-input {
            width: 100%;
            box-sizing: border-box;
            background: #1a1a1a;
            border: 1px solid #444;
            border-radius: 4px;
            color: #eee;
            padding: 6px 8px;
            font-size: 12px;
            font-family: inherit;
            margin-bottom: 8px;
        }
        .clp-search-input::placeholder { color: #777; }
    `;
    document.head.appendChild(style);
}

function hideWidget(node, widget) {
    // ComfyUI's own frontend special-cases widgets with type "converted-widget"
    // and skips drawing them (same mechanism used internally for its
    // "convert widget to input" feature).
    widget.origType = widget.type;
    widget.type = "converted-widget";
    widget.computeSize = () => [0, -4];
    widget.hidden = true;
    if (widget.origSerializeValue === undefined) {
        widget.origSerializeValue = widget.serializeValue;
    }
}

async function fetchJSON(url, options) {
    const res = await fetch(url, options);
    let data = null;
    try {
        data = await res.json();
    } catch (e) {
        // ignore - handled below
    }
    if (!res.ok) {
        const msg = (data && data.error) ? data.error : `HTTP ${res.status}`;
        throw new Error(msg);
    }
    return data;
}

function blankFormState() {
    return {
        originalName: null, // null = creating new, non-null = editing existing
        name: "",
        lora: "",
        strength_model: 1.0,
        strength_clip: 1.0,
        trigger: "",
        description: "",
        visible: true,
    };
}

function openManageModal(node, onCloseCallback) {
    ensureStylesInjected();

    const overlay = document.createElement("div");
    overlay.className = "clp-overlay";

    const dialog = document.createElement("div");
    dialog.className = "clp-dialog";
    overlay.appendChild(dialog);

    const header = document.createElement("div");
    header.className = "clp-header";
    header.innerHTML = `<h2>Manage Character Presets</h2>`;
    const closeBtn = document.createElement("button");
    closeBtn.className = "clp-close-btn";
    closeBtn.textContent = "✕";
    header.appendChild(closeBtn);
    dialog.appendChild(header);

    const body = document.createElement("div");
    body.className = "clp-body";
    dialog.appendChild(body);

    // --- form section ---
    const formTitle = document.createElement("p");
    formTitle.className = "clp-form-title";
    formTitle.textContent = "Add New Preset";
    body.appendChild(formTitle);

    const nameField = document.createElement("div");
    nameField.className = "clp-field";
    nameField.innerHTML = `<label>Preset Name</label>`;
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.placeholder = "e.g. Janice_25";
    nameField.appendChild(nameInput);
    body.appendChild(nameField);

    const loraField = document.createElement("div");
    loraField.className = "clp-field";
    loraField.innerHTML = `<label>LoRA File</label>`;
    const loraSelect = document.createElement("select");
    loraField.appendChild(loraSelect);
    body.appendChild(loraField);

    const strengthRow = document.createElement("div");
    strengthRow.className = "clp-strength-row";
    const smField = document.createElement("div");
    smField.className = "clp-field";
    smField.innerHTML = `<label>Strength (Model)</label>`;
    const smInput = document.createElement("input");
    smInput.type = "number";
    smInput.step = "0.01";
    smInput.value = "1.0";
    smField.appendChild(smInput);
    const scField = document.createElement("div");
    scField.className = "clp-field";
    scField.innerHTML = `<label>Strength (CLIP)</label>`;
    const scInput = document.createElement("input");
    scInput.type = "number";
    scInput.step = "0.01";
    scInput.value = "1.0";
    scField.appendChild(scInput);
    strengthRow.appendChild(smField);
    strengthRow.appendChild(scField);
    body.appendChild(strengthRow);

    const triggerField = document.createElement("div");
    triggerField.className = "clp-field";
    triggerField.innerHTML = `<label>Trigger</label>`;
    const triggerInput = document.createElement("input");
    triggerInput.type = "text";
    triggerInput.placeholder = "e.g. Janice_25";
    triggerField.appendChild(triggerInput);
    body.appendChild(triggerField);

    const descField = document.createElement("div");
    descField.className = "clp-field";
    descField.innerHTML = `<label>Description</label>`;
    const descInput = document.createElement("textarea");
    descInput.placeholder = "e.g. Janice, a 25-year-old Latina woman with long wavy dark brown hair, ...";
    descField.appendChild(descInput);
    body.appendChild(descField);

    const visibleField = document.createElement("div");
    visibleField.className = "clp-field";
    const visibleLabel = document.createElement("label");
    visibleLabel.style.display = "flex";
    visibleLabel.style.alignItems = "center";
    visibleLabel.style.gap = "6px";
    visibleLabel.style.cursor = "pointer";
    const visibleCheckbox = document.createElement("input");
    visibleCheckbox.type = "checkbox";
    visibleCheckbox.checked = true;
    visibleLabel.appendChild(visibleCheckbox);
    visibleLabel.appendChild(document.createTextNode("Visible on node"));
    visibleField.appendChild(visibleLabel);
    body.appendChild(visibleField);

    const formButtons = document.createElement("div");
    formButtons.className = "clp-form-buttons";
    const saveBtn = document.createElement("button");
    saveBtn.className = "clp-btn clp-btn-save";
    saveBtn.textContent = "Save Preset";
    const clearBtn = document.createElement("button");
    clearBtn.className = "clp-btn clp-btn-clear";
    clearBtn.textContent = "New / Clear Form";
    formButtons.appendChild(saveBtn);
    formButtons.appendChild(clearBtn);
    body.appendChild(formButtons);

    const duplicateConfirmContainer = document.createElement("div");
    body.appendChild(duplicateConfirmContainer);

    const statusMsg = document.createElement("div");
    statusMsg.className = "clp-status-msg";
    body.appendChild(statusMsg);

    body.appendChild(Object.assign(document.createElement("div"), { className: "clp-divider" }));

    const listTitle = document.createElement("p");
    listTitle.className = "clp-form-title";
    listTitle.textContent = "Saved Presets";
    body.appendChild(listTitle);

    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.className = "clp-search-input";
    searchInput.placeholder = "Search by name or trigger... (e.g. \"emily\")";
    body.appendChild(searchInput);

    const listContainer = document.createElement("div");
    body.appendChild(listContainer);

    document.body.appendChild(overlay);

    // --- state ---
    let formState = blankFormState();
    let allPresets = {};
    let presetsChangedSinceOpen = false;

    function setStatus(msg, isError) {
        statusMsg.textContent = msg || "";
        statusMsg.classList.toggle("clp-error", !!isError);
    }

    function applyFormStateToInputs() {
        formTitle.textContent = formState.originalName ? `Editing: ${formState.originalName}` : "Add New Preset";
        nameInput.value = formState.name;
        nameInput.disabled = !!formState.originalName; // don't allow renaming via edit - avoids orphaning/duplicating
        loraSelect.value = formState.lora;
        smInput.value = formState.strength_model;
        scInput.value = formState.strength_clip;
        triggerInput.value = formState.trigger;
        descInput.value = formState.description;
        visibleCheckbox.checked = !!formState.visible;
    }

    function loadPresetIntoForm(name) {
        const p = allPresets[name];
        if (!p) return;
        formState = {
            originalName: name,
            name: name,
            lora: p.lora || "",
            strength_model: p.strength_model !== undefined ? p.strength_model : 1.0,
            strength_clip: p.strength_clip !== undefined ? p.strength_clip : 1.0,
            trigger: p.trigger || "",
            description: p.description || "",
            visible: p.visible !== false,
        };
        applyFormStateToInputs();
        setStatus("");
        duplicateConfirmContainer.innerHTML = "";
    }

    function resetForm() {
        formState = blankFormState();
        applyFormStateToInputs();
        setStatus("");
    }

    function renderList() {
        listContainer.innerHTML = "";
        const query = searchInput.value.trim().toLowerCase();
        let names = Object.keys(allPresets).sort();
        if (query) {
            names = names.filter((name) => {
                const p = allPresets[name];
                const trigger = (p.trigger || "").toLowerCase();
                return name.toLowerCase().includes(query) || trigger.includes(query);
            });
        }

        if (names.length === 0) {
            const empty = document.createElement("div");
            empty.className = "clp-empty-msg";
            empty.textContent = query
                ? `No presets match "${query}".`
                : "No presets saved yet - fill in the form above to add your first one.";
            listContainer.appendChild(empty);
            return;
        }

        for (const name of names) {
            const p = allPresets[name];
            const row = document.createElement("div");
            row.className = "clp-list-row";

            const visToggle = document.createElement("input");
            visToggle.type = "checkbox";
            visToggle.checked = p.visible !== false;
            visToggle.title = "Show on node face";
            visToggle.addEventListener("change", async () => {
                try {
                    const data = await fetchJSON(SET_VISIBLE_ENDPOINT, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ name, visible: visToggle.checked }),
                    });
                    allPresets = data.presets;
                    presetsChangedSinceOpen = true;
                } catch (err) {
                    setStatus(`Failed to update visibility: ${err.message}`, true);
                    visToggle.checked = !visToggle.checked; // revert on failure
                }
            });
            row.appendChild(visToggle);

            const main = document.createElement("div");
            main.className = "clp-list-row-main";
            main.innerHTML = `
                <div class="clp-list-row-name">${escapeHtml(name)}</div>
                <div class="clp-list-row-trigger">${escapeHtml(p.trigger || "")}</div>
            `;
            main.addEventListener("click", () => loadPresetIntoForm(name));
            row.appendChild(main);

            const deleteSlot = document.createElement("div");
            renderDeleteControl(deleteSlot, name);
            row.appendChild(deleteSlot);

            listContainer.appendChild(row);
        }
    }

    function renderDeleteControl(container, name) {
        container.innerHTML = "";
        const btn = document.createElement("button");
        btn.className = "clp-delete-btn";
        btn.textContent = "✕";
        btn.title = "Delete preset";
        btn.addEventListener("click", () => {
            container.innerHTML = "";
            const confirmRow = document.createElement("div");
            confirmRow.className = "clp-confirm-row";
            confirmRow.innerHTML = `<span>Delete?</span>`;
            const yesBtn = document.createElement("button");
            yesBtn.className = "clp-confirm-yes";
            yesBtn.textContent = "Yes";
            const cancelBtn = document.createElement("button");
            cancelBtn.className = "clp-confirm-cancel";
            cancelBtn.textContent = "Cancel";

            yesBtn.addEventListener("click", async () => {
                try {
                    const data = await fetchJSON(DELETE_ENDPOINT, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ name }),
                    });
                    allPresets = data.presets;
                    presetsChangedSinceOpen = true;
                    if (formState.originalName === name) {
                        resetForm();
                    }
                    renderList();
                    setStatus(`Deleted '${name}'.`, false);
                } catch (err) {
                    setStatus(`Failed to delete: ${err.message}`, true);
                }
            });
            cancelBtn.addEventListener("click", () => {
                renderDeleteControl(container, name);
            });

            confirmRow.appendChild(yesBtn);
            confirmRow.appendChild(cancelBtn);
            container.appendChild(confirmRow);
        });
        container.appendChild(btn);
    }

    function escapeHtml(str) {
        const div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML;
    }

    async function loadData() {
        try {
            const [listData, lorasData] = await Promise.all([
                fetchJSON(LIST_ENDPOINT),
                fetchJSON(LORAS_ENDPOINT),
            ]);
            allPresets = listData.presets || {};

            loraSelect.innerHTML = "";
            const loras = lorasData.loras || [];
            for (const l of loras) {
                const opt = document.createElement("option");
                opt.value = l;
                opt.textContent = l;
                loraSelect.appendChild(opt);
            }
            if (loras.length > 0) {
                loraSelect.value = loras[0];
                formState.lora = loras[0];
            }

            renderList();
        } catch (err) {
            setStatus(`Failed to load: ${err.message}`, true);
        }
    }

    async function performSave(name) {
        try {
            const data = await fetchJSON(SAVE_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name,
                    lora: loraSelect.value,
                    strength_model: parseFloat(smInput.value) || 1.0,
                    strength_clip: parseFloat(scInput.value) || 1.0,
                    trigger: triggerInput.value,
                    description: descInput.value,
                    visible: visibleCheckbox.checked,
                }),
            });
            allPresets = data.presets;
            presetsChangedSinceOpen = true;
            renderList();
            setStatus(`Saved '${name}'.`, false);
            duplicateConfirmContainer.innerHTML = "";
        } catch (err) {
            setStatus(`Failed to save: ${err.message}`, true);
        }
    }

    saveBtn.addEventListener("click", () => {
        const name = nameInput.value.trim();
        if (!name) {
            setStatus("Preset name cannot be empty.", true);
            return;
        }

        const isCreatingNew = !formState.originalName;
        if (isCreatingNew && Object.prototype.hasOwnProperty.call(allPresets, name)) {
            // Editing an existing preset (loaded via the list) is expected to
            // overwrite that same record - not a collision. This only fires
            // when typing a name into the "Add New" form that happens to
            // already exist.
            duplicateConfirmContainer.innerHTML = "";
            const confirmRow = document.createElement("div");
            confirmRow.className = "clp-confirm-row";
            confirmRow.innerHTML = `<span>"${escapeHtml(name)}" already exists - overwrite it?</span>`;
            const yesBtn = document.createElement("button");
            yesBtn.className = "clp-confirm-yes";
            yesBtn.textContent = "Yes, Overwrite";
            const cancelBtn = document.createElement("button");
            cancelBtn.className = "clp-confirm-cancel";
            cancelBtn.textContent = "Cancel";
            yesBtn.addEventListener("click", () => {
                duplicateConfirmContainer.innerHTML = "";
                performSave(name);
            });
            cancelBtn.addEventListener("click", () => {
                duplicateConfirmContainer.innerHTML = "";
            });
            confirmRow.appendChild(yesBtn);
            confirmRow.appendChild(cancelBtn);
            duplicateConfirmContainer.appendChild(confirmRow);
            return;
        }

        performSave(name);
    });

    clearBtn.addEventListener("click", () => {
        resetForm();
        duplicateConfirmContainer.innerHTML = "";
    });

    searchInput.addEventListener("input", () => {
        renderList();
    });

    function closeModal() {
        document.body.removeChild(overlay);
        document.removeEventListener("keydown", onKeyDown);
        if (presetsChangedSinceOpen && onCloseCallback) {
            onCloseCallback();
        }
    }

    function onKeyDown(e) {
        if (e.key === "Escape") {
            closeModal();
        }
    }

    closeBtn.addEventListener("click", closeModal);
    document.addEventListener("keydown", onKeyDown);
    // Deliberately NOT closing on a click outside the dialog (overlay click) -
    // that was triggering accidentally during text selection / copy-paste
    // inside the form fields. Only the X button and Escape close the popup.

    resetForm();
    loadData();
}

// A single-row custom widget showing Model strength (left ~45%) and
// CLIP strength (right ~45%) with a small gap between, each with its
// own decrement/increment arrows (fixed 0.01 step per click - this is
// our own click handler, so it isn't subject to litegraph's built-in
// number-widget arrow/step quirk) and click-to-type-exact-value via
// the canvas prompt. Click-and-drag-to-scrub is intentionally NOT
// implemented on this combined widget (unlike litegraph's native
// number widgets) - typing an exact value covers precise entry, and
// hand-rolling drag hit-testing blind (no live browser to verify
// pixel math against) is the highest-risk part of this widget.
function createStrengthRowWidget(initialModel, initialClip, onChange) {
    const ARROW_ZONE_PX = 16;

    const ORIGINAL_GAP_FRACTION = 0.10; // the gap as first shown, before any adjustment
    const BOX_WIDTH_FRACTION = (1 - ORIGINAL_GAP_FRACTION) / 2; // fixed - never changes, so width stays constant
    const SHIFT_FRACTION = ORIGINAL_GAP_FRACTION / 4; // quarter of the original gap - both edges of each box move by this amount

    const widget = {
        type: "clp_strength_row",
        name: "clp_strength_row",
        value: { model: initialModel, clip: initialClip },
        serialize: false,
        _lastWidth: 200,
        _dragZone: null,

        computeSize(width) {
            return [width, 20];
        },

        _zoneBounds(width) {
            const boxW = width * BOX_WIDTH_FRACTION; // fixed width, same as the original layout
            const shift = width * SHIFT_FRACTION;
            // Model: both edges (outer-left and inner-right) move right by `shift`.
            // Clip: both edges (inner-left and outer-right) move left by `shift`.
            // Net effect: pure translation toward center, width unchanged, leaves
            // a small equal margin on each outer edge.
            return {
                model: { x0: shift, x1: shift + boxW },
                clip: { x0: width - shift - boxW, x1: width - shift },
            };
        },

        draw(ctx, node, widgetWidth, y, height) {
            this._lastWidth = widgetWidth;
            const bounds = this._zoneBounds(widgetWidth);
            const h = height || 20;

            const drawZone = (x0, x1, label, val) => {
                const w = x1 - x0;
                if (w <= 2) return;
                ctx.save();
                ctx.fillStyle = "#1a1a1a";
                ctx.strokeStyle = "#444";
                ctx.lineWidth = 1;
                if (ctx.roundRect) {
                    ctx.beginPath();
                    ctx.roundRect(x0, y, w, h, 4);
                    ctx.fill();
                    ctx.stroke();
                } else {
                    ctx.fillRect(x0, y, w, h);
                    ctx.strokeRect(x0, y, w, h);
                }

                ctx.fillStyle = "#888";
                ctx.font = "10px Arial";
                ctx.textBaseline = "middle";
                ctx.textAlign = "center";
                ctx.fillText("\u25C0", x0 + ARROW_ZONE_PX / 2, y + h / 2);
                ctx.fillText("\u25B6", x1 - ARROW_ZONE_PX / 2, y + h / 2);

                ctx.fillStyle = "#ccc";
                ctx.font = "10px Arial";
                const text = `${label} ${val.toFixed(2)}`;
                ctx.fillText(text, (x0 + x1) / 2, y + h / 2);
                ctx.restore();
            };

            drawZone(bounds.model.x0, bounds.model.x1, "M", this.value.model);
            drawZone(bounds.clip.x0, bounds.clip.x1, "C", this.value.clip);
        },

        _classifyClick(x, width) {
            const bounds = this._zoneBounds(width);
            for (const [key, b] of Object.entries(bounds)) {
                if (x >= b.x0 && x <= b.x1) {
                    if (x <= b.x0 + ARROW_ZONE_PX) return { key, region: "dec" };
                    if (x >= b.x1 - ARROW_ZONE_PX) return { key, region: "inc" };
                    return { key, region: "middle" };
                }
            }
            return null;
        },

        _applyDelta(key, delta) {
            const next = Math.round((this.value[key] + delta) * 100) / 100;
            this.value[key] = next;
            if (onChange) onChange();
        },

        _promptFor(key, event, node) {
            const label = key === "model" ? "Model Strength" : "CLIP Strength";
            if (app.canvas && typeof app.canvas.prompt === "function") {
                app.canvas.prompt(label, this.value[key], (v) => {
                    const parsed = parseFloat(v);
                    if (!isNaN(parsed)) {
                        this.value[key] = Math.round(parsed * 100) / 100;
                        if (onChange) onChange();
                        node.setDirtyCanvas(true, true);
                    }
                }, event);
            }
        },

        mouse(event, pos, node) {
            const x = pos[0];
            const type = event.type;

            if (type === "pointerdown" || type === "mousedown") {
                this._dragZone = this._classifyClick(x, this._lastWidth);
                return true;
            }
            if (type === "pointerup" || type === "mouseup") {
                if (this._dragZone) {
                    const { key, region } = this._dragZone;
                    if (region === "dec") this._applyDelta(key, -0.01);
                    else if (region === "inc") this._applyDelta(key, 0.01);
                    else if (region === "middle") this._promptFor(key, event, node);
                    node.setDirtyCanvas(true, true);
                }
                this._dragZone = null;
                return true;
            }
            return false;
        },
    };

    return widget;
}

function setupCharacterPresetLoader(node) {
    const hiddenWidget = node.widgets.find((w) => w.name === "selected_presets");
    const sceneWidget = node.widgets.find((w) => w.name === "scene_prompt");
    if (!hiddenWidget) {
        console.warn("[CharacterLoraPreset] selected_presets widget not found on node - skipping dynamic checkboxes.");
        return;
    }
    const insertIndex = node.widgets.indexOf(hiddenWidget);
    hideWidget(node, hiddenWidget);

    // IMPORTANT: ComfyUI/litegraph saves widget values as a plain array
    // matched by POSITION, not by name. Our checkboxes/strength fields
    // are added asynchronously and their count varies with how many
    // presets are visible/checked, so a saved array position can land
    // on a totally different widget at restore time before they exist
    // again - corrupting it (this bit us with scene_prompt earlier).
    //
    // Fix: persist our real state (selected names + per-run strength
    // overrides, encoded as "name:model_strength:clip_strength" CSV,
    // plus scene prompt text) through name-keyed onSerialize/onConfigure
    // hooks instead of relying on that positional array at all.
    const origOnSerialize = node.onSerialize;
    node.onSerialize = function (o) {
        if (origOnSerialize) origOnSerialize.apply(this, arguments);
        o.clp_selected_csv = hiddenWidget.value;
        if (sceneWidget) o.clp_scene_prompt = sceneWidget.value;
    };
    const origOnConfigure = node.onConfigure;
    node.onConfigure = function (o) {
        if (origOnConfigure) origOnConfigure.apply(this, arguments);
        if (o && typeof o.clp_selected_csv === "string") {
            hiddenWidget.value = o.clp_selected_csv;
        }
        if (o && typeof o.clp_scene_prompt === "string" && sceneWidget) {
            sceneWidget.value = o.clp_scene_prompt;
        }
    };

    node._characterPresetCheckboxes = {};
    node._characterPresetStrengthWidgets = {}; // name -> { model: widget, clip: widget }
    node._characterPresetsData = {}; // cached full presets dict (for default strengths)

    function moveWidgetToIndex(widget, index) {
        const cur = node.widgets.indexOf(widget);
        if (cur !== -1) node.widgets.splice(cur, 1);
        node.widgets.splice(index, 0, widget);
    }

    function growNodeIfNeeded() {
        const computed = node.computeSize();
        node.setSize([node.size[0], Math.max(node.size[1], computed[1])]);
        node.setDirtyCanvas(true, true);
    }

    function syncHiddenWidget() {
        const parts = [];
        for (const [name, cbWidget] of Object.entries(node._characterPresetCheckboxes)) {
            if (!cbWidget.value) continue;
            const sw = node._characterPresetStrengthWidgets[name];
            if (sw) {
                parts.push(`${name}:${sw.value.model}:${sw.value.clip}`);
            } else {
                parts.push(name); // shouldn't normally happen - checked implies strength widget exists
            }
        }
        hiddenWidget.value = parts.join(", ");
    }

    // Parses the hidden widget's current CSV, supporting both the plain
    // "name" format and "name:model_strength:clip_strength" overrides.
    // Returns a Map from name -> {sm, sc} | null (null = no override,
    // use the preset's saved default strengths).
    function parseCurrentSelection() {
        const map = new Map();
        const raw = typeof hiddenWidget.value === "string" ? hiddenWidget.value : "";
        for (const entry of raw.split(",")) {
            const trimmed = entry.trim();
            if (!trimmed) continue;
            const parts = trimmed.split(":");
            const name = parts[0].trim();
            if (parts.length >= 3) {
                const sm = parseFloat(parts[1]);
                const sc = parseFloat(parts[2]);
                map.set(name, { sm: isNaN(sm) ? null : sm, sc: isNaN(sc) ? null : sc });
            } else {
                map.set(name, null);
            }
        }
        return map;
    }

    function addStrengthWidgets(name, overrideSm, overrideSc) {
        if (node._characterPresetStrengthWidgets[name]) return; // already present

        const presetData = node._characterPresetsData[name] || {};
        const defaultSm = presetData.strength_model !== undefined ? presetData.strength_model : 1.0;
        const defaultSc = presetData.strength_clip !== undefined ? presetData.strength_clip : 1.0;

        const initialSm = (overrideSm !== null && overrideSm !== undefined) ? overrideSm : defaultSm;
        const initialSc = (overrideSc !== null && overrideSc !== undefined) ? overrideSc : defaultSc;

        const cbWidget = node._characterPresetCheckboxes[name];
        const insertPos = node.widgets.indexOf(cbWidget) + 1;

        const rowWidget = createStrengthRowWidget(initialSm, initialSc, () => syncHiddenWidget());
        node.widgets.splice(insertPos, 0, rowWidget);

        node._characterPresetStrengthWidgets[name] = rowWidget;
    }

    function removeStrengthWidgets(name) {
        const sw = node._characterPresetStrengthWidgets[name];
        if (!sw) return;
        const idx = node.widgets.indexOf(sw);
        if (idx !== -1) node.widgets.splice(idx, 1);
        delete node._characterPresetStrengthWidgets[name];
    }

    function onCheckboxToggled(name) {
        const cbWidget = node._characterPresetCheckboxes[name];
        if (cbWidget.value) {
            addStrengthWidgets(name, null, null); // no override yet - use preset defaults
        } else {
            removeStrengthWidgets(name);
        }
        syncHiddenWidget();
        growNodeIfNeeded();
    }

    function removeAllRows() {
        for (const name of Object.keys(node._characterPresetStrengthWidgets)) {
            removeStrengthWidgets(name);
        }
        for (const w of Object.values(node._characterPresetCheckboxes)) {
            const idx = node.widgets.indexOf(w);
            if (idx !== -1) node.widgets.splice(idx, 1);
        }
        node._characterPresetCheckboxes = {};
    }

    function rebuildCheckboxes(visibleNames, presetsData) {
        removeAllRows();
        node._characterPresetsData = presetsData;

        // Read the CURRENT hidden value at rebuild time (not a stale
        // snapshot from setup time) - by the time this async rebuild
        // runs, onConfigure above has already restored the correct
        // value if this node came from a loaded workflow.
        const currentSelection = parseCurrentSelection();

        let pos = insertIndex + 1; // right after the manage button
        for (const name of visibleNames) {
            const selection = currentSelection.get(name); // undefined | null | {sm, sc}
            const checked = currentSelection.has(name);

            const cbWidget = node.addWidget(
                "toggle",
                name,
                checked,
                () => onCheckboxToggled(name),
                {}
            );
            cbWidget.serialize = false;
            moveWidgetToIndex(cbWidget, pos);
            pos += 1;
            node._characterPresetCheckboxes[name] = cbWidget;

            if (checked) {
                const override = selection || {};
                addStrengthWidgets(name, override.sm, override.sc);
                pos += 1;
            }
        }

        syncHiddenWidget();
        growNodeIfNeeded();
    }

    async function fetchAndRebuild() {
        try {
            const res = await fetch(LIST_ENDPOINT);
            if (!res.ok) {
                console.error(`[CharacterLoraPreset] Failed to fetch preset list: HTTP ${res.status}`);
                return;
            }
            const data = await res.json();
            const presets = data.presets || {};
            const visibleNames = Object.keys(presets)
                .filter((name) => presets[name].visible !== false) // missing flag (old schema) treated as visible
                .sort();
            rebuildCheckboxes(visibleNames, presets);
        } catch (err) {
            console.error("[CharacterLoraPreset] Error fetching preset list:", err);
        }
    }

    const manageBtn = node.addWidget(
        "button",
        "⚙ Manage Characters",
        null,
        () => {
            openManageModal(node, () => fetchAndRebuild());
        },
        {}
    );
    manageBtn.serialize = false;
    moveWidgetToIndex(manageBtn, insertIndex);

    fetchAndRebuild();
}

app.registerExtension({
    name: "CharacterLoraPreset.LoaderCheckboxes",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== LOADER_NODE_NAME) {
            return;
        }
        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const result = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;
            setupCharacterPresetLoader(this);
            return result;
        };
    },
});
