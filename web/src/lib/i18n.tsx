'use client'

import * as React from 'react'

type Locale = 'zh' | 'en'

interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, values?: Record<string, string | number>) => string
}

const I18nContext = React.createContext<I18nContextValue>({
  locale: 'zh',
  setLocale: () => {},
  t: (key: string) => key,
})

// ── Translation dictionary ──────────────────────────────────────────
const translations: Record<string, Record<Locale, string>> = {
  // ── Layout / Shell ──
  'app.name': { zh: 'LLM Wiki', en: 'LLM Wiki' },

  // ── Wikis list page ──
  'wikis.header': { zh: 'LLM Wiki', en: 'LLM Wiki' },
  'wikis.newButton': { zh: '新建', en: 'New' },
  'wikis.createFirst': { zh: '创建你的第一个 Wiki', en: 'Create your first wiki' },
  'wikis.createDesc': { zh: '上传资料，连接 AI，让它自动构建结构化的 Wiki。', en: 'Upload sources, connect Claude, and let it compile a structured wiki automatically.' },
  'wikis.getStarted': { zh: '开始使用', en: 'Get started' },
  'wikis.settingUp': { zh: '创建中...', en: 'Setting up...' },
  'wikis.customName': { zh: '或使用自定义名称创建', en: 'or create with a custom name' },
  'wikis.newWiki': { zh: '新建 Wiki', en: 'New Wiki' },
  'wikis.noSources': { zh: '暂无来源', en: 'No sources yet' },
  'wikis.sourceCount': { zh: '{{count}} 个来源', en: '{{count}} source{{s}}' },
  'wikis.pageCount': { zh: '{{count}} 个页面', en: '{{count}} page{{s}}' },
  'wikis.loadError': { zh: '无法加载 Wiki', en: 'Could not load wikis' },
  'wikis.retry': { zh: '重试', en: 'Retry' },
  'wikis.step1Title': { zh: '创建 Wiki', en: 'Create a wiki' },
  'wikis.step1Desc': { zh: '为你的知识空间命名。可以创建多个。', en: 'Name your knowledge space. You can have as many as you need.' },
  'wikis.step2Title': { zh: '添加来源', en: 'Add sources' },
  'wikis.step2Desc': { zh: '上传 PDF、笔记、记录——任何你想让 AI 学习的资料。', en: 'Upload PDFs, notes, transcripts — anything you want Claude to learn from.' },
  'wikis.step3Title': { zh: '与 AI 对话', en: 'Ask Claude' },
  'wikis.step3Desc': { zh: 'AI 会阅读你的资料，编译出带有交叉引用和摘要的 Wiki。', en: 'Claude reads your sources and compiles a wiki with cross-references and summaries.' },
  'wikis.createDialogTitle': { zh: '创建 {{kind}}', en: 'Create {{kind}}' },
  'wikis.createDialogName': { zh: '名称', en: 'Name' },
  'wikis.createDialogCancel': { zh: '取消', en: 'Cancel' },
  'wikis.createDialogSubmit': { zh: '创建', en: 'Create' },
  'wikis.timeJustNow': { zh: '刚刚', en: 'Just now' },
  'wikis.timeMinutes': { zh: '{{m}}分钟前', en: '{{m}}m ago' },
  'wikis.timeHours': { zh: '{{h}}小时前', en: '{{h}}h ago' },
  'wikis.timeDays': { zh: '{{d}}天前', en: '{{d}}d ago' },
  'wikis.timeMonths': { zh: '{{mo}}个月前', en: '{{mo}}mo ago' },
  'wikis.timeYears': { zh: '{{y}}年前', en: '{{y}}y ago' },

  // ── Detail / Wiki view ──
  'detail.noWiki': { zh: '暂无 Wiki', en: 'No wiki yet' },
  'detail.noWikiDesc': { zh: '添加一些来源，然后让 AI 从中编译出 Wiki。', en: 'Add some sources, then ask Claude to compile a wiki from them.' },
  'detail.uploadSources': { zh: '上传来源', en: 'Upload Sources' },
  'detail.configureMcp': { zh: '配置 MCP', en: 'Configure MCP' },
  'detail.openClaude': { zh: '打开 Claude', en: 'Open Claude' },
  'detail.noWikiSidebar': { zh: '暂无 Wiki', en: 'No wiki yet' },
  'detail.addSources': { zh: '添加来源', en: 'Add Sources' },

  // ── Sidebar / Navigation ──
  'sidebar.search': { zh: '搜索页面和来源', en: 'Search pages and sources' },
  'sidebar.jumpTo': { zh: '跳转到页面、来源或操作...', en: 'Jump to page, source, or action...' },
  'sidebar.knowledgeGraph': { zh: '知识图谱', en: 'Knowledge graph' },
  'sidebar.sources': { zh: '来源', en: 'Sources' },
  'sidebar.wiki': { zh: 'Wiki', en: 'Wiki' },
  'sidebar.switchWiki': { zh: '切换 Wiki', en: 'Switch wiki' },
  'sidebar.allFiles': { zh: '全部文件', en: 'All Files' },
  'sidebar.noResults': { zh: '无结果', en: 'No results' },
  'sidebar.upload': { zh: '上传', en: 'Upload' },

  // ── Files Grid ──
  'files.emptyTitle': { zh: '暂无文件', en: 'No files yet' },
  'files.emptyDesc': { zh: '上传文档或创建笔记以开始', en: 'Upload documents or create notes to get started' },
  'files.uploadFiles': { zh: '上传文件', en: 'Upload Files' },
  'files.createNote': { zh: '创建笔记', en: 'Create Note' },
  'files.all': { zh: '全部', en: 'All' },
  'files.uploading': { zh: '上传中', en: 'Uploading' },
  'files.uploaded': { zh: '已上传', en: 'Uploaded' },
  'files.folders': { zh: '文件夹', en: 'Folders' },
  'files.root': { zh: '根目录', en: 'Root' },
  'files.download': { zh: '下载', en: 'Download' },
  'files.rename': { zh: '重命名', en: 'Rename' },
  'files.delete': { zh: '删除', en: 'Delete' },
  'files.deleteConfirm': { zh: '确定删除此文件？', en: 'Delete this file?' },
  'files.deleteCancel': { zh: '取消', en: 'Cancel' },
  'files.newFolder': { zh: '新建文件夹', en: 'New Folder' },
  'files.folderName': { zh: '文件夹名称', en: 'Folder name' },

  // ── Editor Toolbar ──
  'editor.undo': { zh: '撤销', en: 'Undo' },
  'editor.redo': { zh: '重做', en: 'Redo' },
  'editor.bold': { zh: '加粗', en: 'Bold' },
  'editor.italic': { zh: '斜体', en: 'Italic' },
  'editor.heading': { zh: '标题', en: 'Heading' },
  'editor.bulletList': { zh: '无序列表', en: 'Bullet list' },
  'editor.orderedList': { zh: '有序列表', en: 'Ordered list' },
  'editor.link': { zh: '链接', en: 'Link' },
  'editor.table': { zh: '表格', en: 'Table' },
  'editor.untitled': { zh: '未命名', en: 'Untitled' },
  'editor.linkUrl': { zh: '链接地址', en: 'Link URL' },
  'editor.insertTable': { zh: '插入表格', en: 'Insert table' },
  'editor.insertColumnBefore': { zh: '左侧插入列', en: 'Insert column before' },
  'editor.insertColumnAfter': { zh: '右侧插入列', en: 'Insert column after' },
  'editor.insertRowBefore': { zh: '上方插入行', en: 'Insert row before' },
  'editor.insertRowAfter': { zh: '下方插入行', en: 'Insert row after' },
  'editor.deleteTable': { zh: '删除表格', en: 'Delete table' },

  // ── Property Editors ──
  'props.searchOrAdd': { zh: '搜索或添加...', en: 'Search or add...' },
  'props.empty': { zh: '空白', en: 'Empty' },
  'props.urlPlaceholder': { zh: 'https://...', en: 'https://...' },
  'props.addProperty': { zh: '添加属性', en: 'Add property' },
  'props.description': { zh: '描述', en: 'Description' },
  'props.date': { zh: '日期', en: 'Date' },
  'props.tags': { zh: '标签', en: 'Tags' },
  'props.url': { zh: '链接', en: 'URL' },

  // ── Wiki Content Viewer ──
  'wiki.copyMarkdown': { zh: '复制 Markdown', en: 'Copy markdown' },
  'wiki.showInGraph': { zh: '在知识图谱中查看', en: 'Show in graph' },
  'wiki.onThisPage': { zh: '本页目录', en: 'On this page' },
  'wiki.viewFullscreen': { zh: '全屏查看', en: 'View fullscreen' },
  'wiki.zoomOut': { zh: '缩小', en: 'Zoom out' },
  'wiki.zoomIn': { zh: '放大', en: 'Zoom in' },
  'wiki.resetZoom': { zh: '重置缩放', en: 'Reset zoom' },
  'wiki.close': { zh: '关闭', en: 'Close' },

  // ── PDF Viewer ──
  'pdf.find': { zh: '在文档中查找', en: 'Find in document' },
  'pdf.previousMatch': { zh: '上一个匹配', en: 'Previous match' },
  'pdf.nextMatch': { zh: '下一个匹配', en: 'Next match' },
  'pdf.closeSearch': { zh: '关闭搜索', en: 'Close search' },
  'pdf.highlights': { zh: '高亮', en: 'Highlights' },
  'pdf.download': { zh: '下载 PDF', en: 'Download PDF' },
  'pdf.goToPage': { zh: '跳转到页', en: 'Go to page' },
  'pdf.closeHighlights': { zh: '关闭高亮面板', en: 'Close highlights drawer' },
  'pdf.zoomOut': { zh: '缩小', en: 'Zoom out' },
  'pdf.zoomIn': { zh: '放大', en: 'Zoom in' },
  'pdf.resetZoom': { zh: '重置缩放', en: 'Reset zoom' },
  'pdf.documentViewer': { zh: '文档查看器', en: 'Document viewer' },

  // ── Upload Progress ──
  'upload.clearCompleted': { zh: '清除已完成', en: 'Clear completed' },
  'upload.dismiss': { zh: '关闭', en: 'Dismiss' },
  'upload.view': { zh: '查看', en: 'View' },

  // ── User Menu ──
  'user.lightMode': { zh: '浅色模式', en: 'Light Mode' },
  'user.darkMode': { zh: '深色模式', en: 'Dark Mode' },
  'user.signOut': { zh: '退出登录', en: 'Sign Out' },
  'user.settings': { zh: '设置', en: 'Settings' },

  // ── Settings Page ──
  'settings.title': { zh: '设置', en: 'Settings' },
  'settings.usage': { zh: '用量', en: 'Usage' },
  'settings.storage': { zh: '存储', en: 'Storage' },
  'settings.ocrPages': { zh: 'OCR 页数', en: 'OCR Pages' },
  'settings.documents': { zh: '文档', en: 'Documents' },
  'settings.documentsUploaded': { zh: '{{count}} 个文档已上传', en: '{{count}} document{{s}} uploaded' },
  'settings.connectClaude': { zh: '连接 AI', en: 'Connect Claude' },
  'settings.mcpDesc': { zh: '运行以下命令获取此工作区的 MCP 配置：', en: 'Run this command to get the Claude Desktop / Claude Code MCP config for this workspace:' },
  'settings.mcp': { zh: 'MCP 配置', en: 'MCP Configuration' },
  'settings.wikiPaths': { zh: 'Wiki 目录', en: 'Wiki Paths' },
  'settings.editPath': { zh: '修改', en: 'Edit' },
  'settings.editPathTitle': { zh: '修改 {{name}} 的目录', en: 'Edit path for {{name}}' },
  'settings.editPathDesc': { zh: '输入新的本地文件夹路径。新的路径将使用独立的 SQLite 数据库 (.llmwiki/index.db)。', en: 'Enter new local folder path. A new independent SQLite database (.llmwiki/index.db) will be used.' },
  'settings.confirmChange': { zh: '确认修改', en: 'Confirm change' },
  'settings.confirmDesc': { zh: '新的工作区路径将在 .env 中更新 WORKSPACE_PATH，并在新路径创建独立的 SQLite 数据库。确认后请手动重启服务生效。', en: 'The new workspace path will update WORKSPACE_PATH in .env and create an independent SQLite database at the new path. Restart the service manually after confirming.' },
  'settings.currentPath': { zh: '当前路径：', en: 'Current path:' },
  'settings.newPath': { zh: '新路径：', en: 'New path:' },
  'settings.dbLocation': { zh: '数据库位置：', en: 'DB location:' },
  'settings.nextStep': { zh: '下一步', en: 'Next' },
  'settings.save': { zh: '确认修改', en: 'Save' },
  'settings.saving': { zh: '保存中...', en: 'Saving...' },
  'settings.clickToExpand': { zh: '点击展开查看 MCP 配置详情', en: 'Click to expand MCP config details' },
  'settings.copyCommand': { zh: '复制命令', en: 'Copy command' },
  'settings.copied': { zh: '已复制', en: 'Copied' },
  'settings.mcpGuideDesc': { zh: '通过 MCP 将 LLM Wiki 连接到 AI 助手，让 AI 能够读取、搜索和编辑你的 Wiki 内容。', en: 'Connect LLM Wiki to AI assistants via MCP, enabling AI to read, search, and edit your wiki content.' },

  // ── Wiki Folders ──
  'ws.title': { zh: 'Wiki 文件夹', en: 'Wiki Folders' },
  'ws.description': { zh: '每个文件夹各自带独立的 SQLite 数据库（.llmwiki/index.db）。切换时无需重启，直接读取对应文件夹的内容。', en: 'Each folder has its own SQLite database (.llmwiki/index.db). Switching is live — no restart needed; the selected folder is read directly.' },
  'ws.loading': { zh: '加载中...', en: 'Loading...' },
  'ws.empty': { zh: '尚未注册任何文件夹。', en: 'No folders registered yet.' },
  'ws.current': { zh: '当前', en: 'Current' },
  'ws.switch': { zh: '切换', en: 'Switch' },
  'ws.remove': { zh: '移除', en: 'Remove' },
  'ws.add': { zh: '添加文件夹', en: 'Add folder' },
  'ws.addTitle': { zh: '添加 Wiki 文件夹', en: 'Add Wiki folder' },
  'ws.addDesc': { zh: '输入本地文件夹路径。将自动创建 .llmwiki/index.db 并切换到此文件夹。', en: 'Enter a local folder path. A .llmwiki/index.db will be created and the server will switch to it.' },
  'ws.cancel': { zh: '取消', en: 'Cancel' },
  'ws.confirmRemove': { zh: '从注册表中移除「{{name}}」？文件夹和文件不会被删除。', en: 'Remove "{{name}}" from the registry? The folder and its files are not deleted.' },

  // ── MCP Config Page ──
  'mcp.title': { zh: 'MCP 配置', en: 'MCP Configuration' },
  'mcp.description': { zh: '通过 MCP（Model Context Protocol）将 LLM Wiki 连接到 AI 助手，让 AI 能够直接读取、搜索和编辑你的 Wiki 内容。', en: 'Connect LLM Wiki to AI assistants via MCP (Model Context Protocol), enabling AI to read, search, and edit your wiki content directly.' },
  'mcp.step1Title': { zh: '1. 复制并粘贴配置', en: '1. Copy & paste config' },
  'mcp.step1Desc': { zh: '复制下面的 JSON 配置，合并到配置文件的 mcpServers 字段中。如果已存在其他 MCP 服务器，追加这个条目即可。', en: 'Copy the JSON below and merge it into the mcpServers field of your config file. If other MCP servers already exist, just append this entry.' },
  'mcp.step2Title': { zh: '2. 重启 AI 助手', en: '2. Restart AI assistant' },
  'mcp.claudeDesktop': { zh: 'Claude Desktop', en: 'Claude Desktop' },
  'mcp.claudeCode': { zh: 'Claude Code', en: 'Claude Code' },
  'mcp.configPathDesktop': { zh: '配置文件: %APPDATA%\\Claude\\claude_desktop_config.json', en: 'Config file: %APPDATA%\\Claude\\claude_desktop_config.json' },
  'mcp.configPathCode': { zh: '配置文件: 项目根目录\\.claude\\settings.json', en: 'Config file: .claude/settings.json (project root)' },
  'mcp.step2Desc': { zh: '将下面的 JSON 配置合并到配置文件的 mcpServers 字段中。如果已存在其他 MCP 服务器，追加这个条目即可。', en: 'Merge the JSON config below into the mcpServers field of your config file. If other MCP servers already exist, just append this entry.' },
  'mcp.step2Info': { zh: '重启后，AI 助手即可通过 MCP 工具访问你的 Wiki 内容。可以试试对 AI 说："阅读指南，然后帮我整理 Wiki"。', en: 'After restarting, your AI assistant can access your wiki content via MCP tools. Try saying: "Read the guide, then help me organize the wiki".' },
  'mcp.copyConfig': { zh: '复制配置', en: 'Copy Config' },
  'mcp.copied': { zh: '已复制！', en: 'Copied!' },
  'mcp.workspacePath': { zh: '工作区路径', en: 'Workspace Path' },
  'mcp.generateFor': { zh: '为当前工作区生成配置', en: 'Generate config for current workspace' },
  'mcp.backToSettings': { zh: '返回设置', en: 'Back to Settings' },
  'mcp.onePerWorkspace': { zh: '每个工作区对应一个 MCP 条目。如需多个工作区，在 mcpServers 中为每个工作区添加一条配置。', en: 'One workspace = one MCP server entry. Add one entry per workspace folder in mcpServers.' },
  'mcp.configSaved': { zh: '配置已复制到剪贴板。请粘贴到上述配置文件中。', en: 'Config copied to clipboard. Paste it into the config file listed above.' },

  // ── Onboarding ──
  'onboarding.title': { zh: '欢迎使用 LLM Wiki', en: 'Welcome to LLM Wiki' },
  'onboarding.desc': { zh: 'LLM Wiki 帮你整理知识。上传资料，连接 AI，自动构建结构化 Wiki。', en: 'LLM Wiki helps you organize knowledge. Upload sources, connect an AI, and build a structured wiki automatically.' },
  'onboarding.getStarted': { zh: '开始使用', en: 'Get started' },
  'onboarding.configureMcp': { zh: '配置 MCP', en: 'Configure MCP' },

  // ── Landing Page ──
  'landing.navGitHub': { zh: 'GitHub', en: 'GitHub' },
  'landing.navDocs': { zh: '文档', en: 'Docs' },
  'landing.heroTitle': { zh: '智能知识库', en: 'LLM Wiki' },
  'landing.heroDesc': { zh: '上传文档，连接 AI，自动编译结构化 Wiki。免费、开源。', en: "Free, open-source implementation of Karpathy's LLM Wiki. Upload documents and build a compounding wiki directly via Claude." },
  'landing.getStartedFree': { zh: '免费开始使用', en: 'Get started free' },
  'landing.feature1Title': { zh: '上传资料', en: 'Upload Sources' },
  'landing.feature1Desc': { zh: '支持 PDF、笔记、网页剪藏等多种格式。', en: 'Upload PDFs, notes, transcripts — anything you want the AI to learn from.' },
  'landing.feature2Title': { zh: 'AI 编译', en: 'AI Compiles' },
  'landing.feature2Desc': { zh: 'AI 自动阅读并提取关键信息，生成结构化页面。', en: 'AI reads your sources and compiles structured, cross-referenced wiki pages.' },
  'landing.feature3Title': { zh: '知识图谱', en: 'Knowledge Graph' },
  'landing.feature3Desc': { zh: '可视化查看知识点之间的关联。', en: 'Visualize connections between concepts in your knowledge base.' },

  // ── Policy Pages ──
  'policy.getStarted': { zh: '开始使用', en: 'Get started' },

  // ── Common / Shared ──
  'common.cancel': { zh: '取消', en: 'Cancel' },
  'common.save': { zh: '保存', en: 'Save' },
  'common.delete': { zh: '删除', en: 'Delete' },
  'common.loading': { zh: '加载中...', en: 'Loading...' },
  'common.error': { zh: '出错了', en: 'An error occurred' },
  'common.back': { zh: '返回', en: 'Back' },
  'common.more': { zh: '更多', en: 'More' },
  'common.course': { zh: '课程', en: 'course' },
  'common.wiki': { zh: 'Wiki', en: 'wiki' },
  'common.notifications': { zh: '通知', en: 'Notifications' },
  'common.lightMode': { zh: '浅色模式', en: 'Light Mode' },
  'common.darkMode': { zh: '深色模式', en: 'Dark Mode' },
}

// ── Provider ────────────────────────────────────────────────────────

export function I18nProvider({ children, defaultLocale = 'zh' as Locale }: { children: React.ReactNode; defaultLocale?: Locale }) {
  const [locale, setLocale] = React.useState<Locale>(defaultLocale)

  const t = React.useCallback(
    (key: string, values?: Record<string, string | number>): string => {
      const entry = translations[key]
      if (!entry) {
        console.warn(`[i18n] Missing translation key: ${key}`)
        return key
      }
      let text = entry[locale] ?? entry['zh']
      if (values) {
        // Replace {{var}} placeholders
        text = text.replace(/\{\{(\w+)\}\}/g, (_, varName) => {
          const val = values[varName]
          if (val === undefined) return `{{${varName}}}`
          return String(val)
        })
      }
      return text
    },
    [locale],
  )

  const value = React.useMemo(() => ({ locale, setLocale, t }), [locale, t])

  return React.createElement(I18nContext.Provider, { value }, children)
}

// ── Hook ─────────────────────────────────────────────────────────────

export function useI18n() {
  return React.useContext(I18nContext)
}

export { translations }
export type { Locale }
