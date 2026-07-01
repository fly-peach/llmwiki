# LLM Wiki 部署文档(Conda)

本文档介绍如何用 Conda 在本地部署 LLM Wiki。本项目已精简为**纯本地模式**:文件系统是事实来源,SQLite 是派生索引

---

## 一、环境要求

| 组件        | 版本要求                   | 说明                       |
| ----------- | -------------------------- | -------------------------- |
| Conda       | Miniconda 或 Anaconda 均可 | 用于管理 Python 环境       |
| Python      | 3.11+                      | 由 conda 创建,无需系统预装 |
| Node.js     | 20+                        | 用于 Web 前端              |
| npm 或 pnpm | 任一                       | 装 Web 依赖                |

**可选依赖:**

- [LibreOffice](https://www.libreoffice.org/):抽取 Word / PowerPoint 文档内容(不装则跳过这两类文件)
- `MISTRAL_API_KEY`:更高质量的 PDF OCR(尤其表格、复杂版式)。不配置则用本地 opendataloader 抽取 PDF。

---

## 二、安装步骤

### 1. 克隆项目

```powershell
git clone https://github.com/fly-peach/llmwiki.git
cd llmwiki
```

### 2. 创建 Conda 环境并安装 Python 依赖

```powershell
# 从 environment.yml 一键创建环境(自动安装所有依赖)
conda env create -f environment.yml
conda activate llmwiki
```

> **说明:** `environment.yml` 统一管理所有 Python 依赖，优先从 conda-forge 通道安装，少数 conda-forge 上不可用的包（如 `opendataloader-pdf`、`mcp`）通过 pip 自动安装。如需更新环境，运行 `conda env update -f environment.yml`。

### 3. 安装 Web 前端依赖

```powershell
cd web
npm install
cd ..
```

> **注意:** 如果你装了 pnpm,也可以用 `pnpm install`。某些网络驱动器(如映射的 NAS 路径)上 pnpm 的 symlink 会失败,此时改用 `npm install`。

---

## 三、启动

### 一键启动(API + Web)

```powershell
conda activate llmwiki

# 方式一:不传参,自动读取 .env 中的 WORKSPACE_PATH
python llmwiki open

# 方式二:显式指定工作区
python llmwiki open WORKSPACE_PATH
```

> `.env` 中的 `WORKSPACE_PATH` 配置了默认工作区路径,不传参时自动读取。

这条命令会依次完成:

1. 在 workspace 下创建 `wiki\`(wiki 页面)和 `.llmwiki\`(SQLite 索引 + 缓存)
2. 索引该文件夹中已有的文件
3. 启动 API 服务(端口由 `.env` 中的 `API_PORT` 决定,默认 `8000`)
4. 启动 Web 服务(端口由 `.env` 中的 `WEB_PORT` 决定,默认 `3000`)并自动打开浏览器

启动后访问 **`http://localhost:{WEB_PORT}/wikis`** 即可看到你的 wiki(初始包含 `overview.md`)。局域网其他电脑访问 `http://{本机IP}:{WEB_PORT}/wikis`。

### 自定义端口

端口配置统一通过项目根目录的 `.env` 文件管理:

```env
# LLM Wiki Configuration
API_PORT=8001          # 后端 API 端口(默认 8000)
WEB_PORT=3000          # 前端 Web 端口(默认 3000)
```

修改后重启服务即可生效。也支持通过环境变量临时覆盖:

```powershell
# Windows PowerShell
$env:API_PORT = "8001"
$env:WEB_PORT = "3001"
python llmwiki open    # 自动读 WORKSPACE_PATH
```

```cmd
:: Windows CMD
set API_PORT=8001
set WEB_PORT=3001
python llmwiki open    # 自动读 WORKSPACE_PATH
```

---

## 四、添加内容

有两种方式把材料喂进 wiki:

### 1. 直接放文件

把文件丢进 workspace 文件夹即可,后台 watcher 会自动索引。支持的格式:

| 类型      | 格式                                                 | 处理方式                                                             |
| --------- | ---------------------------------------------------- | -------------------------------------------------------------------- |
| PDF       | `.pdf`                                               | 本地抽取文本和图片;配 `MISTRAL_API_KEY` 可提升表格/复杂版式 OCR 质量 |
| Office    | `.docx` `.doc` `.pptx` `.ppt`                        | 需本地安装 LibreOffice 转换后抽取                                    |
| 表格      | `.xlsx` `.xls`                                       | 按表抽取                                                             |
| 网页      | `.html` `.htm`                                       | 清理为可读 Markdown,去掉导航和广告                                   |
| 文本/数据 | `.md` `.txt` `.csv` `.json` `.xml` `.yaml` `.svg` 等 | 直接索引切块                                                         |
| 图片      | `.png` `.jpg` `.webp` `.gif`                         | 存储、内联查看,Claude 可读                                           |

### 2. Chrome 扩展剪藏

安装 LLM Wiki Chrome 扩展,在浏览器里剪藏网页/PDF、画高亮、写批注,内容会直接进入本地 workspace(扩展默认指向 `http://localhost:{API_PORT}`,端口由 `.env` 中的 `API_PORT` 决定)。

---

## 五、连接 Claude(MCP)

让 Claude 通过 MCP 读写你的 wiki。

### 1. 生成 MCP 配置

```powershell
python llmwiki mcp-config Z:\DataApp\llmwiki_workspace
```

会打印一段 JSON,形如:

```json
{
  "mcpServers": {
    "llmwiki-llmwiki_workspace": {
      "command": "E:\\ana\\envs\\llmwiki\\python.exe",
      "args": ["E:\\llmwiki\\llmwiki", "mcp", "Z:\\DataApp\\llmwiki_workspace"]
    }
  }
}
```

> Windows 上建议把 `command` 改成 conda 环境里 `python.exe` 的完整路径,避免 Claude Desktop 找不到正确的解释器。工作区路径使用 `Z:\DataApp\llmwiki_workspace` 或 UNC 路径 `\\192.168.18.3\YunYing\DataApp\llmwiki_workspace`。

### 2. 粘贴到对应配置文件

| 客户端         | 配置文件位置                                                                                              |
| -------------- | --------------------------------------------------------------------------------------------------------- |
| Claude Desktop | `claude_desktop_config.json`(macOS: `~/Library/Application Support/Claude/`;Windows: `%APPDATA%\Claude\`) |
| Claude Code    | 项目或全局的 `.claude/settings.json`                                                                      |

每个 workspace 对应一个 MCP server 条目,多个文件夹就加多条。

### 3. 让 Claude 开工

对 Claude 说:

> _Read the guide, then ingest my sources and start building the wiki._

Claude 会先调用 `guide` 工具了解工作流,然后 `read` 你的源文件、`create`/`edit` wiki 页面、用脚注引用回源文件,并自动维护引用图。

---

## 六、目录结构

LLM Wiki 只在你的 workspace 下生成两个东西,**你的源文件不会被移动或修改**:

```
Z:\DataApp\llmwiki_workspace\     # 你的 workspace
  papers\paper.pdf                # 你的源文件,原样保留
  notes.md
  wiki\                           # wiki 页面(AI 生成维护,纯 Markdown)
    overview.md
    log.md
    concepts\
      attention.md
  .llmwiki\                       # 派生层:索引 + 缓存(隐藏,可删可重建)
    index.db                      # SQLite 全文检索索引
    cache\
```

- `wiki\`:普通 Markdown 文件,可用任何编辑器打开、手动编辑、提交 git。Claude 通过 MCP 写它们,但它们就是文件。
- `.llmwiki\`:派生层,删了能从源文件重建。

---

## 七、常用命令

| 命令                                    | 作用                                       |
| --------------------------------------- | ------------------------------------------ |
| `python llmwiki open [路径]`            | 初始化(若需要)+ 启动服务 + 开浏览器        |
| `python llmwiki init [路径]`            | 仅初始化:建 `wiki\` + `.llmwiki\`,索引文件 |
| `python llmwiki serve [路径]`           | 仅启动 API + Web(不重新初始化)             |
| `python llmwiki mcp [路径]`             | 启动 stdio MCP server(供 Claude 连接)      |
| `python llmwiki mcp-config [路径]`      | 打印 Claude MCP 配置 JSON                  |
| `python llmwiki reindex [路径]`         | 强制全量重建 `index.db`                    |

> `[路径]` 可选,不传时自动读取 `.env` 中的 `WORKSPACE_PATH`。

---

## 八、故障排查

### 1. `pnpm install` 报 symlink 错误

项目放在网络映射驱动器(如 NAS、`\\server\share`)上时常见。改用 `npm install` 即可。

### 2. 改了文件但 wiki 没更新

网络驱动器上文件 watcher 可能不灵敏。手动跑一次重建:

```powershell
python llmwiki reindex C:\llmwiki-ws
```

### 3. SQLite 索引损坏 / 想重置

直接删掉 `.llmwiki\index.db`,然后:

```powershell
python llmwiki reindex C:\llmwiki-ws
```

源文件和 wiki 页面都不会丢。

### 4. Claude Desktop 连不上 MCP

- 确认配置里 `command` 指向 conda 环境的 `python.exe`,而不是系统 python
- 确认 `args` 里 workspace 路径正确(Windows 用双反斜杠 `\\`)
- 重启 Claude Desktop

### 5. Word / PPT 无法抽取

需要本地安装 LibreOffice。装好后重跑 `reindex`。

### 6. 端口被占用

API 和 Web 端口由 `.env` 中的 `API_PORT` / `WEB_PORT` 控制。被占用时停掉占用进程,或修改 `.env` 文件后重启。

---

## 九、架构说明(本地模式)

```
  Claude  ──MCP──►  MCP server ─┐
                                │
  Web app ──HTTP─►  API ────────┼──►  VaultFS  ──►  SQLite + 文件系统
                                │
  Chrome  ──HTTP─►  API ────────┘
```

- **VaultFS** 是存储抽象层,本地模式下接 SQLite + 文件系统
- **文件系统**是事实来源,**SQLite 索引**是派生的(可删可重建)
- **MCP server** 服务 Claude,**API** 服务 Web 和 Chrome 扩展
- PDF / Office 抽取在进程内完成(LibreOffice 处理 Office;可选 Mistral OCR 处理 PDF)

---

## 十、一键启动脚本(可选)

新建 `start.ps1`,内容:

```powershell
conda activate llmwiki
python E:\llmwiki\llmwiki open
```

以后双击或在 PowerShell 里 `.\start.ps1` 即可启动(自动读取 `.env` 中的 `WORKSPACE_PATH`)。
