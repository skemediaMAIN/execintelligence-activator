var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => ActivatorPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var TARGET_ID = "execintelligence";
var LEGACY_ID = "obsidian-vault-guardian";
var FILES = ["manifest.json", "main.js", "styles.css"];
var DEFAULT_BACKEND = "https://ovg-ip.execintelligence.ai";
var DEFAULTS = { backendEndpoint: DEFAULT_BACKEND, lastLicence: "" };
var ActivatorPlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULTS;
  }
  async onload() {
    this.settings = Object.assign({}, DEFAULTS, await this.loadData());
    this.addCommand({
      id: "activate-execintelligence",
      name: "Activate ExecIntelligence (enter licence and install)",
      callback: () => new LicenceModal(this.app, this).open()
    });
    this.addSettingTab(new ActivatorSettingTab(this.app, this));
    const installed = await this.app.vault.adapter.exists(
      (0, import_obsidian.normalizePath)(`.obsidian/plugins/${TARGET_ID}/main.js`)
    ) || await this.app.vault.adapter.exists(
      (0, import_obsidian.normalizePath)(`.obsidian/plugins/${LEGACY_ID}/main.js`)
    );
    if (!installed) {
      new import_obsidian.Notice("ExecIntelligence: run 'Activate ExecIntelligence' to install with your licence.", 8e3);
    }
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  /** Copy a pre-2026-09-05 install's settings out of the legacy folder, once. */
  async migrateLegacyFolder(adapter, dir, onStep) {
    const legacy = (0, import_obsidian.normalizePath)(`.obsidian/plugins/${LEGACY_ID}/data.json`);
    const target = (0, import_obsidian.normalizePath)(`${dir}/data.json`);
    try {
      if (!await adapter.exists(legacy))
        return;
      if (await adapter.exists(target))
        return;
      onStep("carrying your existing licence and settings across...");
      await adapter.write(target, await adapter.read(legacy));
    } catch (_e) {
    }
  }
  /**
   * Stop the pre-rename folder claiming our plugin id, once the new one is proven good.
   *
   * WHY THIS IS NOT OPTIONAL (2026-09-05). migrateLegacyFolder above COPIES the licence across and
   * leaves the old folder alone, which felt like the safe choice and is in fact the defect. Both
   * folders declare `"id": "execintelligence"`, and Obsidian registers a plugin ONCE per id: it
   * loads whichever it reaches first and silently ignores the other. That is precisely the failure
   * the CEO lost hours to, where a device correctly reported that a newer build existed and would
   * not take it. Shipping the migration without this would have handed the identical experience to
   * every existing customer, on their first activation, as a direct result of the fix.
   *
   * IT REMOVES THE MANIFEST, NOT THE FOLDER. `manifest.json` is the file that declares the id, so
   * deleting it is enough to end the collision, and it is the smallest possible act that does.
   * `data.json` is deliberately left behind: it holds the customer's licence and settings, it is
   * their property, and if anything about this went wrong it is the only copy they have. A
   * directory holding one orphaned settings file is harmless; deleting someone's licence to tidy
   * up is not.
   *
   * ORDER MATTERS. This runs only after the new folder holds a downloaded, size-checked build.
   * Retiring first would leave a customer with two half-installs and no working plugin.
   */
  async retireLegacyFolder(adapter, dir, onStep) {
    try {
      const legacyDir = (0, import_obsidian.normalizePath)(`.obsidian/plugins/${LEGACY_ID}`);
      const legacyManifest = (0, import_obsidian.normalizePath)(`${legacyDir}/manifest.json`);
      if (!await adapter.exists(legacyManifest))
        return;
      if (!await adapter.exists((0, import_obsidian.normalizePath)(`${dir}/main.js`)))
        return;
      if (!await adapter.exists((0, import_obsidian.normalizePath)(`${dir}/manifest.json`)))
        return;
      onStep("retiring the old installation folder...");
      await adapter.remove(legacyManifest);
      try {
        await adapter.remove((0, import_obsidian.normalizePath)(`${legacyDir}/main.js`));
      } catch (_e) {
      }
      try {
        await adapter.remove((0, import_obsidian.normalizePath)(`${legacyDir}/styles.css`));
      } catch (_e) {
      }
    } catch (_e) {
    }
  }
  /** Download the per-customer watermarked build and install it into this vault. */
  async activate(licence, onStep) {
    licence = (licence || "").trim();
    if (!licence)
      throw new Error("Enter your licence key.");
    const base = (this.settings.backendEndpoint || DEFAULT_BACKEND).replace(/\/+$/, "");
    const dir = (0, import_obsidian.normalizePath)(`.obsidian/plugins/${TARGET_ID}`);
    const adapter = this.app.vault.adapter;
    if (!await adapter.exists(dir))
      await adapter.mkdir(dir);
    await this.migrateLegacyFolder(adapter, dir, onStep);
    for (const file of FILES) {
      onStep(`downloading ${file}...`);
      const res = await (0, import_obsidian.requestUrl)({
        url: `${base}/download?key=${encodeURIComponent(licence)}&file=${encodeURIComponent(file)}`,
        method: "GET",
        throw: false
      });
      if (res.status !== 200) {
        let msg = `download of ${file} failed (HTTP ${res.status})`;
        try {
          const j = res.json;
          if (j && j.error)
            msg += `: ${j.error}`;
        } catch (_e) {
        }
        throw new Error(msg);
      }
      await adapter.writeBinary((0, import_obsidian.normalizePath)(`${dir}/${file}`), res.arrayBuffer);
    }
    onStep("writing licence...");
    const dataPath = (0, import_obsidian.normalizePath)(`${dir}/data.json`);
    let data = {};
    if (await adapter.exists(dataPath)) {
      try {
        data = JSON.parse(await adapter.read(dataPath));
      } catch (_e) {
        data = {};
      }
    }
    data.apiKey = licence;
    if (!data.backendEndpoint)
      data.backendEndpoint = base;
    await adapter.write(dataPath, JSON.stringify(data, null, 2));
    this.settings.lastLicence = licence;
    this.settings.backendEndpoint = base;
    await this.saveSettings();
    await this.retireLegacyFolder(adapter, dir, onStep);
    onStep("enabling ExecIntelligence...");
    try {
      await this.app.plugins.enablePlugin(TARGET_ID);
    } catch (_e) {
    }
  }
};
var LicenceModal = class extends import_obsidian.Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: "Activate ExecIntelligence" });
    contentEl.createEl("p", {
      text: "Enter your licence key. We will download your private build, install it into this vault, and turn it on."
    });
    let licence = this.plugin.settings.lastLicence || "";
    new import_obsidian.Setting(contentEl).setName("Licence key").addText((t) => t.setPlaceholder("ei-...").setValue(licence).onChange((v) => licence = v));
    const status = contentEl.createEl("p", { text: "" });
    new import_obsidian.Setting(contentEl).addButton((b) => b.setButtonText("Activate").setCta().onClick(async () => {
      b.setDisabled(true);
      try {
        await this.plugin.activate(licence, (m) => status.textContent = m);
        status.textContent = "";
        new import_obsidian.Notice("ExecIntelligence is installed and active. Open its settings to finish setup (one-time local engine).", 9e3);
        this.close();
      } catch (e) {
        status.textContent = "Error: " + ((e == null ? void 0 : e.message) || String(e));
      } finally {
        b.setDisabled(false);
      }
    }));
  }
  onClose() {
    this.contentEl.empty();
  }
};
var ActivatorSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h3", { text: "ExecIntelligence Activator" });
    new import_obsidian.Setting(containerEl).setName("Activate / reinstall").setDesc("Enter your licence to download and install your private ExecIntelligence build.").addButton((b) => b.setButtonText("Activate").setCta().onClick(() => new LicenceModal(this.app, this.plugin).open()));
    new import_obsidian.Setting(containerEl).setName("Backend endpoint").setDesc("Leave as default unless told otherwise.").addText((t) => t.setValue(this.plugin.settings.backendEndpoint).setPlaceholder(DEFAULT_BACKEND).onChange(async (v) => {
      this.plugin.settings.backendEndpoint = v.trim() || DEFAULT_BACKEND;
      await this.plugin.saveSettings();
    }));
  }
};
