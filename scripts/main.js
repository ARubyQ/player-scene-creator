// ================================================================
// ЧАСТЬ 1: ИНТЕРФЕЙС (Менеджер Карт)
// ================================================================

class MapManagerApp extends Application {
    constructor() {
        super();
        this.data = null;
        this.collapsedState = new Set();
    }

    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            id: "player-map-manager-module",
            title: "Менеджер Карт",
            template: "templates/hud/hud.html",
            width: 700,
            height: 800,
            resizable: true,
            classes: ["playermap-window"]
        });
    }

    async render(force, options) {
        const API = window.PlayerMapManager;
        if (!API) {
            ui.notifications.error("Система загружается...");
            return;
        }
        this.data = await API.getData();
        const content = this.buildHTML();

        if (this.dialog) {
            this.dialog.data.content = content;
            this.dialog.render(true);
        } else {
            this.dialog = new Dialog({
                title: "Менеджер Карт",
                content: content,
                buttons: {},
                render: (html) => this.activateListeners(html),
                close: () => { this.dialog = null; }
            }, {
                width: 700,
                height: 800,
                classes: ["playermap-window", "dialog"]
            }).render(true);
        }
    }

    buildHTML() {
        const css = `
        <style>
            .app.playermap-window .window-content { background: #1b1b1b !important; color: #e0e0e0; padding: 0 !important; }
            .pm-container { font-family: sans-serif; user-select: none; padding: 10px; height: 100%; overflow-y: auto; }
            .pm-header-global { display: flex; gap: 10px; margin-bottom: 15px; padding: 10px; background: rgba(0,0,0,0.3); border: 1px solid #333; border-radius: 5px; }
            .pm-btn-global { background: #333; color: #fff; border: 1px solid #000; padding: 8px; cursor: pointer; border-radius: 4px; flex: 1; text-align: center; font-weight: bold; }
            .pm-btn-global:hover { background: #ffae00; color: #000; }
            
            .pm-tree-node { margin-top: 5px; }
            .pm-folder-header { display: flex; align-items: center; padding: 8px 10px; background: #2a2a2a; border: 1px solid #333; border-radius: 4px; cursor: pointer; }
            .pm-folder-header:hover { background: #353535; }
            .pm-folder-header.drag-hover { background: #3a3a2a !important; border: 1px dashed #ffae00 !important; }
            .pm-folder-name { flex-grow: 1; font-weight: bold; font-size: 1.1em; margin-left: 10px; }
            
            .pm-root-header { margin-bottom: 10px; background: #222; border: 1px dashed #444; padding: 8px; border-radius: 4px; font-style: italic; color: #888; }
            .pm-root-header.drag-hover { border: 1px dashed #ffae00; color: #ffae00; }
            
            .pm-folder-actions { display: flex; gap: 4px; }
            .pm-f-btn { width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border-radius: 3px; cursor: pointer; border: 1px solid #000; font-size: 0.8em; color: #fff; }
            .btn-add-map { background: #2f6a3a; } .btn-add-folder { background: #2f566a; } .btn-del-folder { background: #6a2f2f; }
            
            .pm-children { margin-left: 22px; border-left: 1px dashed #444; padding-left: 5px; }
            .pm-tree-node.collapsed > .pm-children { display: none; }
            .pm-tree-node.collapsed .fa-chevron-down { transform: rotate(-90deg); }
            
            .pm-scene-item { display: flex; align-items: center; padding: 6px 10px; background: rgba(255,255,255,0.03); border-bottom: 1px solid #333; margin-top: 2px; border-radius: 3px; cursor: grab; }
            .pm-scene-item:hover { background: rgba(255,255,255,0.1); }
            .pm-thumb { width: 40px; height: 40px; object-fit: cover; border-radius: 4px; margin-right: 12px; border: 1px solid #000; }
            .pm-s-name { flex-grow: 1; font-size: 1em; color: #ddd; pointer-events: none; }
            
            .pm-actions { display: flex; gap: 5px; }
            .pm-s-btn { width: 28px; height: 28px; border: 1px solid #000; border-radius: 3px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: white; }
            .b-go { background: #3b6e8a; } .b-move { background: #8a6e3b; } .b-edit { background: #444; } .b-del { background: #782e22; }
        </style>`;

        let html = `${css}<div class="pm-container">
            <div class="pm-header-global">
                <div class="pm-btn-global" id="btn-root-folder"><i class="fas fa-folder-plus"></i> Создать папку</div>
                <div class="pm-btn-global" id="btn-root-map"><i class="fas fa-plus-circle"></i> Создать карту</div>
            </div>
            <div id="pm-content">`;

        html += `<div class="pm-root-header droppable-folder" data-folder-id="${this.data.rootId}"><i class="fas fa-inbox"></i> 📂 Основная папка</div>`;
        
        const rootScenes = this.data.scenes.filter(s => s.folder === this.data.rootId);
        rootScenes.forEach(s => html += this.renderSceneItem(s));

        html += this.renderTree(this.data.rootId);
        html += `</div></div>`;
        return html;
    }

    renderTree(parentId) {
        let html = "";
        const folders = this.data.folders.filter(f => f.parent === parentId);
        folders.forEach(f => {
            const isCollapsed = this.collapsedState.has(f.id) ? "collapsed" : "";
            html += `
            <div class="pm-tree-node ${isCollapsed}" data-id="${f.id}">
                <div class="pm-folder-header droppable-folder" data-folder-id="${f.id}">
                    <i class="fas fa-chevron-down"></i>
                    <span class="pm-folder-name">📁 ${f.name}</span>
                    <div class="pm-folder-actions">
                        <div class="pm-f-btn btn-add-map action-add-map" data-folder="${f.id}" title="Карта"><i class="fas fa-plus"></i></div>
                        <div class="pm-f-btn btn-add-folder action-add-subfolder" data-folder="${f.id}" title="Папка"><i class="fas fa-folder-plus"></i></div>
                        <div class="pm-f-btn btn-del-folder action-del-folder" data-id="${f.id}" title="Удалить"><i class="fas fa-trash"></i></div>
                    </div>
                </div>
                <div class="pm-children">${this.renderScenesInFolder(f.id)}${this.renderTree(f.id)}</div>
            </div>`;
        });
        return html;
    }

    renderScenesInFolder(folderId) {
        let html = "";
        const scenes = this.data.scenes.filter(s => s.folder === folderId);
        scenes.forEach(s => html += this.renderSceneItem(s));
        return html;
    }

    renderSceneItem(s) {
        return `
        <div class="pm-scene-item draggable-scene" draggable="true" data-scene-id="${s.id}">
            <img src="${s.thumb || 'icons/svg/mystery-man.svg'}" class="pm-thumb">
            <div class="pm-s-name">${s.name}</div>
            <div class="pm-actions">
                <button class="pm-s-btn b-go action-go" data-id="${s.id}" title="Перейти"><i class="fas fa-eye"></i></button>
                <button class="pm-s-btn b-move action-move" data-id="${s.id}" title="Переместить"><i class="fas fa-exchange-alt"></i></button>
                <button class="pm-s-btn b-edit action-edit" data-id="${s.id}" title="Фон"><i class="fas fa-image"></i></button>
                <button class="pm-s-btn b-del action-del" data-id="${s.id}" title="Удалить"><i class="fas fa-trash"></i></button>
            </div>
        </div>`;
    }

    activateListeners(html) {
        const API = window.PlayerMapManager;

        html.find('.draggable-scene').on('dragstart', (ev) => {
            ev.originalEvent.dataTransfer.setData("text/plain", ev.currentTarget.dataset.sceneId);
        });
        html.find('.droppable-folder').on('dragover', (ev) => {
            ev.preventDefault();
            ev.currentTarget.classList.add('drag-hover');
        });
        html.find('.droppable-folder').on('dragleave', (ev) => {
            ev.currentTarget.classList.remove('drag-hover');
        });
        html.find('.droppable-folder').on('drop', async (ev) => {
            ev.preventDefault();
            ev.currentTarget.classList.remove('drag-hover');
            const sceneId = ev.originalEvent.dataTransfer.getData("text/plain");
            const targetFolderId = ev.currentTarget.dataset.folderId;
            if (sceneId && targetFolderId) {
                await API.moveScene(sceneId, targetFolderId);
                setTimeout(() => this.render(), 150);
            }
        });

        html.find(".pm-folder-header").click((e) => {
            if ($(e.target).closest('.pm-folder-actions').length) return;
            const node = $(e.currentTarget).closest('.pm-tree-node');
            node.toggleClass("collapsed");
            if(node.hasClass("collapsed")) this.collapsedState.add(node.data("id"));
            else this.collapsedState.delete(node.data("id"));
        });

        const openMoveDialog = (sceneId) => {
            let options = `<option value="${this.data.rootId}">📂 (Корень)</option>`;
            this.data.folders.forEach(f => options += `<option value="${f.id}">📁 ${f.name}</option>`);
            new Dialog({
                title: "Переместить",
                content: `<div class="form-group" style="padding:10px"><select id="nf" style="width:100%">${options}</select></div>`,
                buttons: { move: { label: "ОК", callback: async (h) => { await API.moveScene(sceneId, h.find("#nf").val()); this.render(); }}}
            }).render(true);
        };

        const openMapDialog = (folderId) => {
            new Dialog({
                title: "Новая карта",
                content: `<form style="margin-bottom:10px"><div class="form-group"><label>Название</label><input type="text" id="mn" autofocus></div><div class="form-group"><label>Фон</label><div style="display:flex;gap:5px"><input type="text" id="mi"><button type="button" id="fb" style="flex:0 0 30px"><i class="fas fa-folder"></i></button></div></div></form>`,
                render: (h) => h.find("#fb").click(() => new FilePicker({type: "image", current: "assets/playermaps", callback: p => h.find("#mi").val(p)}).render(true)),
                buttons: { yes: { label: "Создать", callback: async (h) => { if (h.find("#mn").val()) { await API.createScene(h.find("#mn").val(), h.find("#mi").val(), folderId, game.user.name); this.render(); }}}}
            }).render(true);
        };

        const openFolderDialog = (parentId) => {
            new Dialog({ title: "Новая папка", content: `<input type="text" id="fn" placeholder="Название">`, buttons: { yes: { label: "Создать", callback: async (h) => { if (h.find("#fn").val()) { await API.createFolder(h.find("#fn").val(), parentId); this.render(); }}}}}).render(true);
        };

        html.find("#btn-root-folder").click(() => openFolderDialog(this.data.rootId));
        html.find("#btn-root-map").click(() => openMapDialog(this.data.rootId));
        html.find(".action-add-map").click((ev) => openMapDialog(ev.currentTarget.dataset.folder));
        html.find(".action-add-subfolder").click((ev) => openFolderDialog(ev.currentTarget.dataset.folder));
        html.find(".action-del-folder").click((ev) => {
            const id = ev.currentTarget.dataset.id;
            new Dialog({ title: "Удалить?", content: "Удалить папку?", buttons: { yes: { label: "Да", callback: async () => { await API.deleteFolder(id); setTimeout(() => this.render(), 200); }}}}).render(true);
        });
        html.find(".action-go").click(ev => API.activate(ev.currentTarget.dataset.id));
        html.find(".action-edit").click(ev => { const id = ev.currentTarget.dataset.id; new FilePicker({type: "image", current: "assets/playermaps", callback: async (p) => { await API.updateImage(id, p); this.render(); }}).render(true); });
        html.find(".action-move").click(ev => openMoveDialog(ev.currentTarget.dataset.id));
        html.find(".action-del").click(ev => { const id = ev.currentTarget.dataset.id; new Dialog({ title: "Удалить?", content: "Удалить карту?", buttons: { yes: { label: "Да", callback: async () => { await API.deleteScene(id); setTimeout(() => this.render(), 200); }}}}).render(true); });
    }
}

// ================================================================
// 2. КНОПКИ (ВСТРАИВАЕМ В МЕНЮ ТОКЕНОВ)
// ================================================================

Hooks.on("getSceneControlButtons", (controls) => {
    
    // --- ВАРИАНТ 1: V13 (Объекты) ---
    if (controls && typeof controls === "object" && !Array.isArray(controls)) {
        const tokenGroup = controls.tokens || controls.token;
        if (tokenGroup && tokenGroup.tools) {
            tokenGroup.tools.playermap = {
                name: "playermap",
                title: "Менеджер Карт",
                icon: "fas fa-map-marked-alt",
                visible: true,
                button: true,
                onClick: () => { new MapManagerApp().render(true); }
            };
            return; 
        }
    }

    // --- ВАРИАНТ 2: Старые версии (Массивы) ---
    if (Array.isArray(controls)) {
        const tokenGroup = controls.find(c => c.name === "token");
        if (tokenGroup) {
            tokenGroup.tools.push({
                name: "playermap",
                title: "Менеджер Карт",
                icon: "fas fa-map-marked-alt",
                visible: true,
                button: true,
                onClick: () => { new MapManagerApp().render(true); }
            });
        }
    }
});

// ================================================================
// 3. СЕРВЕР (SOCKETS)
// ================================================================

Hooks.once("ready", async () => {
    if (!game.modules.get("socketlib")?.active) {
        console.error("Player Scene Creator: Socketlib не активен!");
        return;
    }

    if (game.users.activeGM) {
        try { await FilePicker.createDirectory("data", "assets/playermaps").catch(e => {}); } catch (err) {}
    }

    const socket = socketlib.registerModule("player-scene-creator");
    const ROOT_FOLDER_NAME = "Player Maps";

    async function getRootFolder() {
        let folder = game.folders.find(f => f.name === ROOT_FOLDER_NAME && f.type === "Scene");
        if (!folder) {
            folder = await Folder.create({ name: ROOT_FOLDER_NAME, type: "Scene", color: "#4287f5", sorting: "a" });
        }
        return folder;
    }

    socket.register("getData", async () => {
        const root = await getRootFolder();
        const allSceneFolders = game.folders.filter(f => f.type === "Scene");
        const validFolderIds = new Set([root.id]);
        let changes = true;
        while (changes) {
            changes = false;
            allSceneFolders.forEach(f => {
                if (!validFolderIds.has(f.id) && f.folder?.id && validFolderIds.has(f.folder.id)) {
                    validFolderIds.add(f.id); changes = true;
                }
            });
        }
        const myFolders = allSceneFolders.filter(f => validFolderIds.has(f.id));
        const myScenes = game.scenes.filter(s => s.folder?.id && validFolderIds.has(s.folder.id));
        return {
            rootId: root.id,
            folders: myFolders.map(f => ({ id: f.id, name: f.name, parent: f.folder?.id })),
            scenes: myScenes.map(s => ({ id: s.id, name: s.name, folder: s.folder?.id, thumb: s.background.src }))
        };
    });

    socket.register("createFolder", async (name, parentId) => {
        if (!game.users.activeGM) return;
        const root = await getRootFolder();
        await Folder.create({ name: name, type: "Scene", folder: parentId || root.id, color: "#ff9900", sorting: "a" });
    });

    // === СОЗДАНИЕ СЦЕНЫ (БЕЗ АКТИВАЦИИ + БЕЗ СЕТКИ) ===
    socket.register("createScene", async (name, imgPath, folderId, user) => {
        if (!game.users.activeGM) return;
        const root = await getRootFolder();
        let width = 3000, height = 3000, bg = null;
        if (imgPath) {
            try {
                const tex = await loadTexture(imgPath);
                width = tex.baseTexture.width; height = tex.baseTexture.height; bg = imgPath;
            } catch (e) { console.error("CORS Error:", e); return null; }
        }
        // Создаем сцену
        const s = await Scene.create({
            name: `${name} (${user})`,
            active: false, // НЕ ПЕРЕХОДИМ НА НЕЕ
            navigation: true,
            folder: folderId || root.id, width: width, height: height,
            tokenVision: false, fog: { exploration: false, resetOnVisibility: true },
            globalLight: true, 
            // ВЫКЛЮЧАЕМ ВИДИМОСТЬ СЕТКИ
            grid: { 
                size: 100, 
                type: 1, 
                alpha: 0, // <--- ВОТ ЭТО ДЕЛАЕТ ЕЁ НЕВИДИМОЙ
                units: "ft",
                distance: 5
            },
            background: bg ? { src: bg, offsetX: 0, offsetY: 0 } : undefined
        });
        
        ui.notifications.info(`Игрок ${user} создал карту "${name}".`);
    });

    socket.register("moveScene", async (sceneId, targetFolderId) => {
        if (!game.users.activeGM) return;
        const scene = game.scenes.get(sceneId);
        if (scene) await scene.update({ folder: targetFolderId });
    });

    socket.register("deleteFolder", async (id) => { if (game.users.activeGM) game.folders.get(id)?.delete(); });
    socket.register("deleteScene", async (id) => { if (game.users.activeGM) game.scenes.get(id)?.delete(); });
    socket.register("activate", async (id) => { if (game.users.activeGM) game.scenes.get(id)?.activate(); });
    socket.register("updateSceneImage", async (id, img) => {
        if (!game.users.activeGM) return;
        const s = game.scenes.get(id);
        if (s) { try { const t = await loadTexture(img); await s.update({ background: { src: img }, width: t.baseTexture.width, height: t.baseTexture.height }); } catch (e) {} }
    });

    window.PlayerMapManager = {
        getData: () => socket.executeAsGM("getData"),
        createScene: (n, i, f, u) => socket.executeAsGM("createScene", n, i, f, u),
        deleteScene: (id) => socket.executeAsGM("deleteScene", id),
        updateImage: (id, i) => socket.executeAsGM("updateSceneImage", id, i),
        createFolder: (n, p) => socket.executeAsGM("createFolder", n, p),
        deleteFolder: (id) => socket.executeAsGM("deleteFolder", id),
        activate: (id) => socket.executeAsGM("activate", id),
        moveScene: (sid, fid) => socket.executeAsGM("moveScene", sid, fid)
    };

    console.log("Player Map Manager: MODULE FULLY LOADED");
});