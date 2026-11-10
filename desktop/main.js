// AFMI Projets — desktop shell for the team platform.
// The platform stays on the shared server (so everyone works on the same data);
// this app shows it in its own window, keeps the session, and opens anything
// outside the platform in the system browser.
const { app, BrowserWindow, Menu, ipcMain, shell, dialog, session } = require("electron");
const path = require("node:path");
const fs = require("node:fs");

// separate profile for automated tests
if (process.env.AFMI_USER_DATA) app.setPath("userData", process.env.AFMI_USER_DATA);

const bundled = JSON.parse(fs.readFileSync(path.join(__dirname, "app-config.json"), "utf8"));
const configFile = () => path.join(app.getPath("userData"), "config.json");

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(configFile(), "utf8"));
  } catch {
    return {};
  }
}
function writeConfig(patch) {
  const next = { ...readConfig(), ...patch };
  fs.mkdirSync(path.dirname(configFile()), { recursive: true });
  fs.writeFileSync(configFile(), JSON.stringify(next, null, 2));
  return next;
}
const serverUrl = () => process.env.AFMI_URL || readConfig().url || bundled.url || "";
const lang = () => (readConfig().lang || (app.getLocale().startsWith("fr") ? "fr" : "ar"));

/** https anywhere; plain http only for this computer (local testing). */
function normalizeUrl(input) {
  let u;
  try {
    u = new URL(String(input).trim());
  } catch {
    return null;
  }
  const local = ["127.0.0.1", "localhost"].includes(u.hostname);
  if (u.protocol !== "https:" && !(u.protocol === "http:" && local)) return null;
  return u.origin;
}

let win = null;

function loadPlatform() {
  const url = serverUrl();
  if (!url) return win.loadFile(path.join(__dirname, "pages", "setup.html"));
  return win.loadURL(`${url}/${lang()}/home`);
}

function createWindow() {
  const bounds = readConfig().bounds || { width: 1280, height: 840 };
  win = new BrowserWindow({
    ...bounds,
    minWidth: 380,
    minHeight: 500,
    title: "AFMI Projets",
    icon: path.join(__dirname, "build", "icon.png"),
    backgroundColor: "#fafaf7",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });
  win.once("ready-to-show", () => win.show());
  win.on("close", () => writeConfig({ bounds: win.getBounds() }));

  const isPlatform = (target) => {
    const base = serverUrl();
    try {
      return !!base && new URL(target).origin === base;
    } catch {
      return false;
    }
  };
  // links inside the platform stay in the window; everything else (attachments, e-mail links…) opens outside
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isPlatform(url)) win.loadURL(url);
    else if (/^(https?|mailto):/.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (url.startsWith("file:") || isPlatform(url)) return;
    event.preventDefault();
    if (/^(https?|mailto):/.test(url)) shell.openExternal(url);
  });
  win.webContents.on("did-fail-load", (_e, code, _desc, url, isMainFrame) => {
    if (isMainFrame && code !== -3 && !url.startsWith("file:")) {
      win.loadFile(path.join(__dirname, "pages", "offline.html"));
    }
  });

  loadPlatform();
}

const T = {
  ar: { app: "البرنامج", server: "تغيير عنوان المنصة…", reload: "إعادة التحميل", quit: "خروج", edit: "تحرير", view: "عرض", zoomIn: "تكبير", zoomOut: "تصغير", zoomReset: "الحجم الأصلي", full: "ملء الشاشة", help: "مساعدة", about: "حول البرنامج", aboutText: (v, u) => `منصة مشاريع AFMI\nالإصدار ${v}\nالخادم: ${u || "غير محدد"}`, language: "اللغة" },
  fr: { app: "Application", server: "Changer l'adresse de la plateforme…", reload: "Recharger", quit: "Quitter", edit: "Édition", view: "Affichage", zoomIn: "Agrandir", zoomOut: "Réduire", zoomReset: "Taille réelle", full: "Plein écran", help: "Aide", about: "À propos", aboutText: (v, u) => `Projets AFMI\nVersion ${v}\nServeur : ${u || "non défini"}`, language: "Langue" },
};

function buildMenu() {
  const t = T[lang()];
  const template = [
    {
      label: t.app,
      submenu: [
        { label: t.server, click: () => { writeConfig({ url: "" }); win.loadFile(path.join(__dirname, "pages", "setup.html")); } },
        {
          label: t.language,
          submenu: [
            { label: "العربية", type: "radio", checked: lang() === "ar", click: () => { writeConfig({ lang: "ar" }); buildMenu(); loadPlatform(); } },
            { label: "Français", type: "radio", checked: lang() === "fr", click: () => { writeConfig({ lang: "fr" }); buildMenu(); loadPlatform(); } },
          ],
        },
        { label: t.reload, accelerator: "CmdOrCtrl+R", click: () => win.webContents.reload() },
        { type: "separator" },
        { label: t.quit, role: "quit" },
      ],
    },
    { label: t.edit, submenu: [{ role: "undo" }, { role: "redo" }, { type: "separator" }, { role: "cut" }, { role: "copy" }, { role: "paste" }, { role: "selectAll" }] },
    {
      label: t.view,
      submenu: [
        { label: t.zoomIn, role: "zoomIn" },
        { label: t.zoomOut, role: "zoomOut" },
        { label: t.zoomReset, role: "resetZoom" },
        { type: "separator" },
        { label: t.full, role: "togglefullscreen" },
      ],
    },
    {
      label: t.help,
      submenu: [
        { label: t.about, click: () => dialog.showMessageBox(win, { type: "info", title: t.about, message: t.aboutText(app.getVersion(), serverUrl()) }) },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// the bridge answers only the app's own local pages, never the remote platform
const local = (e) => (e.senderFrame?.url ?? "").startsWith("file:");
ipcMain.handle("afmi:current-url", (e) => (local(e) ? serverUrl() : null));
ipcMain.handle("afmi:language", () => lang());
ipcMain.handle("afmi:retry", (e) => (local(e) ? loadPlatform() : null));
ipcMain.handle("afmi:save-url", async (e, input) => {
  if (!local(e)) return { ok: false, error: "invalid" };
  const url = normalizeUrl(input);
  if (!url) return { ok: false, error: "invalid" };
  try {
    const res = await fetch(`${url}/ar/login`, { redirect: "manual" });
    if (res.status >= 400) return { ok: false, error: "unreachable" };
  } catch {
    return { ok: false, error: "unreachable" };
  }
  writeConfig({ url });
  loadPlatform();
  return { ok: true };
});

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  app.whenReady().then(() => {
    // the platform needs no camera, microphone, location or notifications
    session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => cb(permission === "clipboard-sanitized-write"));
    buildMenu();
    createWindow();
    app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });
  app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
}
