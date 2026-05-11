import { app, shell, BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { setupIpcHandlers } from './ipc-handlers'
import { initStore } from './store'

let mainWindow: BrowserWindow | null = null

const BUBBLE_SIZE = 72
const PANEL_WIDTH = 420
const PANEL_HEIGHT = 640

function getStartPosition() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  return { x: width - BUBBLE_SIZE - 24, y: height - BUBBLE_SIZE - 24 }
}

function createWindow(): void {
  const pos = getStartPosition()

  mainWindow = new BrowserWindow({
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    x: pos.x,
    y: pos.y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    focusable: true,
    visibleOnAllWorkspaces: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => { mainWindow = null })
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.aitrogiang.app')
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))

  initStore()
  setupIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ---- Window state management ----
ipcMain.on('window:expand', () => {
  if (!mainWindow) return
  const [cx, cy] = mainWindow.getPosition()

  mainWindow.setMinimumSize(360, 480)
  mainWindow.setResizable(true)
  mainWindow.setSize(PANEL_WIDTH, PANEL_HEIGHT, true)
  // Expand upward from current bubble position
  mainWindow.setPosition(cx - (PANEL_WIDTH - BUBBLE_SIZE), cy - (PANEL_HEIGHT - BUBBLE_SIZE), true)
})

ipcMain.on('window:collapse', () => {
  if (!mainWindow) return
  const [cx, cy] = mainWindow.getPosition()
  const [pw, ph] = mainWindow.getSize()

  mainWindow.setMinimumSize(BUBBLE_SIZE, BUBBLE_SIZE)
  mainWindow.setResizable(false)
  mainWindow.setSize(BUBBLE_SIZE, BUBBLE_SIZE, true)
  // Collapse back to bottom-right of old panel position
  mainWindow.setPosition(cx + (pw - BUBBLE_SIZE), cy + (ph - BUBBLE_SIZE), true)
})

// ---- Manual window drag (for transparent windows) ----
let dragStartPos: { x: number; y: number } | null = null

ipcMain.on('window:drag-start', (_event, mousePos: { x: number; y: number }) => {
  if (!mainWindow) return
  const [wx, wy] = mainWindow.getPosition()
  dragStartPos = { x: mousePos.x - wx, y: mousePos.y - wy }
})

ipcMain.on('window:drag-move', (_event, mousePos: { x: number; y: number }) => {
  if (!mainWindow || !dragStartPos) return
  mainWindow.setPosition(
    Math.round(mousePos.x - dragStartPos.x),
    Math.round(mousePos.y - dragStartPos.y)
  )
})

ipcMain.on('window:drag-end', () => {
  dragStartPos = null
})

ipcMain.on('window:quit', () => app.quit())
