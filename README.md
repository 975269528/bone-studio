# BoneStudio · 2D 骨骼动画工具

本地桌面编辑器，将拆分的透明图片绑定到骨骼，制作关键帧动画和两段 IK，并导出透明 PNG 序列或 spritesheet。外部 AI 通过 MCP 操作**当前窗口的完整会话，包括未保存修改**，与界面共用撤销历史，无需 AI API key。

## 启动

环境：Node.js 22.12+（或 20.19+），npm，Windows / macOS / Linux 的 Electron 桌面环境。本项目锁文件按当前兼容版本固定依赖；首次安装或启动 Electron 时可能需要下载 Electron 二进制。

```powershell
npm install
npm run dev
```

开发脚本管理本地 Vite 和 Electron 子进程，关闭桌面或按 Ctrl+C 会结束相关进程。辅助进程在 Windows 隐藏启动。Vite 绑定 `127.0.0.1:5173`。调试端口默认关闭；仅在开发时显式设置 `BONE_STUDIO_DEBUG_PORT=9222` 才打开本地调试。

使用构建版本：

```powershell
npm run build
npm start
```

Windows 可在构建后双击 `start-bone-studio.cmd`，启动器使用自身所在目录，支持中文路径；缺少依赖或构建时会显示所需命令，不自动安装。这是首版源码与运行版，尚未制作安装器。

检查：`npm run lint`、`npm test`、`npm run test:bridge`。`build` 同时生成界面和共用 MCP 命令校验模块；修改核心 schema 后重新运行 `build` 或重启 `dev`。`test:bridge` 验证 stdio 握手、工具列表、非法命令拒绝、本地认证边界与文件覆盖保护，不代替实际画面验收。

## 使用流程

1. 导入 PNG / WebP / JPEG 部件；透明拆图推荐 PNG。建立骨骼后，选择附件和骨骼完成绑定，再调整位置、锚点、缩放与层级。
2. 选择动画，在时间轴切换时间，编辑骨骼姿态并写入关键帧；播放查看实时预览。IK 使用直接相连的根骨与末端骨，目标可写入动画关键帧。
3. 保存项目为 JSON。图片像素嵌入项目，重新打开项目无需原图路径。
4. 导出 PNG 序列 ZIP，或包含 PNG spritesheet 与帧数据 JSON 的 ZIP。

两种 ZIP 都包含 `animation.json`。采样时间为 `frame / fps`，覆盖 `[0, duration)`；帧数为 `ceil(duration * fps)`，不重复尾帧。导出先检查资源预算：最多 2400 帧，单帧最多 16,777,216 像素，总帧像素最多 268,435,456；精灵图每边最多 8192，最多 33,554,432 像素，帧间保留 2 像素透明间距。超限会明确失败，可降低画布尺寸、帧率或动画长度。

工作区无网格。图片导入上限为单张 18 MB（18,000,000 字节）、单批 36 MB、单边 8192 像素；项目 JSON 最多 64 MiB；导出文件最多 256 MiB。动画与画布的更细范围由项目 schema 校验。序列和图集导出均保留透明背景。

## 连接外部 AI

先启动 BoneStudio 并保持编辑器窗口打开，再在支持 MCP stdio 的本地 AI 客户端中加入以下配置。`args` 使用本机绝对路径，不需要启动第二个编辑器。

```json
{
  "mcpServers": {
    "bone-studio": {
      "command": "node",
      "args": ["D:\\Project\\2D骨骼动画工具\\electron\\mcp.cjs"]
    }
  }
}
```

桌面自动生成 `%APPDATA%\BoneStudio\ai-connection.json`（macOS 为 `~/Library/Application Support/BoneStudio/`，Linux 为 `~/.config/BoneStudio/`）。适配器每次调用读取此文件，因此桌面重启后可继续使用。自定义桌面 userData 或特殊运行环境时，在客户端 `env` 中设置 `BONE_STUDIO_CONNECTION` 为实际连接文件的绝对路径。`.env.example` 只展示路径格式；程序不自动加载 `.env`。

连接文件含随机本地令牌，勿提交或分享。服务只监听 `127.0.0.1` 动态端口，并校验 bearer token、Host 和 Origin；不提供任意代码执行或通用文件读取接口。桌面采用 context isolation、沙箱及禁用 Node 集成，适配器只访问显式指定的图片和输出路径。窗口关闭时，未完成请求失败，连接失效。每次编辑操作限时 90 秒，最多 16 个等待请求。

## MCP 工具参数

所有对象拒绝未知字段，输出错误通过 `isError` 返回，不会伪报保存或导出成功。建议先读取 `get_project`，查看真实 ID 和 `revision`，再批量编辑。

| 工具 | 参数 | 返回 |
| --- | --- | --- |
| `get_project` | `{}` | 当前完整 `project`、`revision`、`dirty` |
| `apply_commands` | `{commands: ProjectCommand[], expectedRevision?: number}`，1–500 条 | 更新后的项目、revision 与摘要；revision 不匹配时拒绝整批 |
| `import_images` | `{paths: string[]}`，1–100 个明确本地路径 | 将解码图片加入当前项目后的结果 |
| `render_preview` | `{animationId?: string, time?: number}`，时间为 0–600 秒 | PNG 的 MCP image 与尺寸等元数据；未指定动画时使用界面当前选择 |
| `export_animation` | `{animationId: string, format: "sequence" \| "sheet", fps?: number, outputPath: string, replace?: boolean}`，fps 1–120，输出 `.zip` | 实际 `outputPath`、`frameCount` 与尺寸 |
| `save_project` | `{outputPath: string, replace?: boolean}`，输出 `.json` | 实际写入的 `outputPath` |
| `undo` / `redo` | `{}` | 当前会话的撤销/重做结果 |

`outputPath` 必须明确指定文件；其父目录需已存在。默认 `replace: false`，已有文件不覆盖；只有明确传 `replace: true` 才允许替换。输出先写同目录临时文件，再原子发布，失败不会留下半成品目标文件。图片导入不接受 URL。

### ProjectCommand

完整精确 schema 来自 [src/core/commands.ts](src/core/commands.ts) 与 [src/core/schema.ts](src/core/schema.ts)，由构建共享给界面、桌面和 MCP；MCP `tools/list` 也返回展开后的 JSON Schema。ID 使用当前项目现有 ID，新增对象使用唯一 ID。

| `type` | 必需字段（除 type） | 可选字段 |
| --- | --- | --- |
| `project.update` | `changes`：name / width / height 的部分对象 | — |
| `asset.add` | `asset`：id,name,dataUrl,width,height | — |
| `bone.add` | `bone`：id,name,parentId,x,y,rotation,length | — |
| `bone.update` / `bone.remove` | `boneId`；update 还需 `changes` | changes 为除 id 外的骨骼字段 |
| `attachment.add` | `attachment`：id,name,assetId,boneId,x,y,rotation,scaleX,scaleY,anchorX,anchorY,opacity,zIndex | — |
| `attachment.update` / `attachment.remove` | `attachmentId`；update 还需 `changes` | changes 为除 id 外的附件字段 |
| `animation.add` | `animation`：id,name,duration,fps,loop,tracks | — |
| `animation.update` / `animation.remove` | `animationId`；update 还需 `changes` | changes 为除 id 外的动画字段 |
| `keyframe.set` | `animationId,boneId,keyframe:{time,x,y,rotation}` | `interpolation`: linear / smooth / step |
| `keyframe.remove` | `animationId,boneId,time` | — |
| `ik.add` | `constraint`：id,name,rootBoneId,tipBoneId,targetX,targetY,bendDirection,enabled,targetKeys | `animationId` |
| `ik.update` / `ik.remove` | `constraintId`；update 还需 `changes` | changes 为除 id 外的 IK 字段 |
| `ik.keyframe.set` | `constraintId,keyframe:{time,x,y}` | — |
| `ik.keyframe.remove` | `constraintId,time` | — |

rotation 使用角度。bone.parentId 与 attachment.boneId 可为 null；scaleX/scaleY 为倍率；anchorX/anchorY 为 0–1；opacity 为 0–1；bendDirection 为 1 或 -1。动画 tracks 为 `{boneId,keyframes,interpolation}` 数组，IK targetKeys 为 `{time,x,y}` 数组。批量指令最终状态统一校验，失败时不会部分更新；删除骨骼前可在同一批次处理依赖。

示例：将一个现有骨骼的旋转写入现有动画 0.5 秒的位置：

```json
{
  "expectedRevision": 3,
  "commands": [{
    "type": "keyframe.set",
    "animationId": "existing-animation-id",
    "boneId": "existing-bone-id",
    "keyframe": {"time": 0.5, "x": 0, "y": 0, "rotation": 25},
    "interpolation": "smooth"
  }]
}
```

预览使用 `render_preview` 反复取样实际画面。导出示例：`{"animationId":"existing-animation-id","format":"sheet","fps":24,"outputPath":"D:\\Exports\\walk.zip"}`。
