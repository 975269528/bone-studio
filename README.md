# BoneStudio · 2D 骨骼动画工具

本地桌面编辑器，将拆分的透明图片绑定到骨骼，制作关键帧动画和两段 IK，并导出透明 PNG 序列或 spritesheet。外部 AI 通过 MCP 操作**当前窗口的完整会话，包括未保存修改**，与界面共用撤销历史，无需 AI API key。

## 启动

Windows x64 用户可在 [GitHub Releases](https://github.com/975269528/bone-studio/releases) 下载，或使用 [最新 BoneStudio.exe 下载链接](https://github.com/975269528/bone-studio/releases/latest/download/BoneStudio.exe)，下载后直接双击启动。本地构建文件位于 `release/BoneStudio.exe`。便携版文件名固定，不含版本号，外部快捷方式无需随版本更新；应用内部保留版本信息。便携版包含 Electron 与运行依赖，无需安装 Node.js、运行 CMD 或保持控制台窗口；首次启动会解压到临时目录。项目文件仍保存到你选择的位置，编辑器设置和 AI 连接信息默认位于 `%APPDATA%\BoneStudio`。当前产物未签名。

从源码开发：Node.js 22.12+，npm，Windows / macOS / Linux 的 Electron 桌面环境。项目锁文件固定依赖；首次安装或打包需要联网下载依赖、Electron 和打包工具。

```powershell
npm ci
npm run dev
```

开发脚本管理本地 Vite 和 Electron 子进程，关闭桌面或按 Ctrl+C 会结束相关进程。辅助进程在 Windows 隐藏启动。Vite 绑定 `127.0.0.1:5173`。调试端口默认关闭；仅在开发时显式设置 `BONE_STUDIO_DEBUG_PORT=9222` 才打开本地调试。

使用构建版本：

```powershell
npm run build
npm start
```

Windows 便携 EXE 构建与验收：

```powershell
npm ci
npm run package:win
npm run test:package
```

产物输出到 `release/`；`package:win` 先构建界面与 MCP 校验模块，再生成 x64 便携版，不发布到网络。包内仅含 `dist/`、`dist-mcp/`、`electron/`、必要元数据和生产依赖，开发依赖、源码、个人参考图与导出文件不会进入应用包。`test:package` 检查 EXE 图标，并启动真实 EXE，使用全新临时数据目录和隐藏窗口，检查快捷键、时间轴曲线、时长拖动、启动恢复、批量导入、保存/打开、MCP、预览与两种 ZIP 导出；截图保留在 `output/playwright/` 和 `output/package-check/`。测试不会使用正在编辑的窗口或其连接信息；其中旧版 MCP 配置复制验收会临时操作系统剪贴板，因此建议在独立测试环境或 GitHub Actions 中运行完整命令。

`start-bone-studio.cmd` 仍用于有开发依赖的源码构建版本；普通使用优先双击便携 EXE。

检查：`npm run lint`、`npm test`、`npm run test:bridge`。`build` 同时生成界面和共用 MCP 命令校验模块；修改核心 schema 后重新运行 `build` 或重启 `dev`。`test:bridge` 验证 stdio 握手、工具列表、非法命令拒绝、本地认证边界与文件覆盖保护，不代替实际画面验收。

## GitHub 源码准备

提交源码、`package-lock.json` 与构建配置即可；`release/`、开发依赖、输出目录和个人参考图由 `.gitignore` 排除。不要提交真实 `.env` 或包含本地令牌的 `ai-connection.json`。本地打包不代表已经创建或上传 GitHub 仓库。

`.github/workflows/windows-build.yml` 只在手动运行和拉取请求时检查、构建 Windows x64 便携 EXE；普通推送不会触发构建。对 `main` / `master` 手动运行时，全部检查和真实 EXE 验收通过后会自动发布 [GitHub Release](https://github.com/975269528/bone-studio/releases)，附件固定为 `BoneStudio.exe`。日常发布也可直接上传已验收的本地 `release/BoneStudio.exe`，无需重新构建。拉取请求和其它分支的手动运行只构建、校验，不发布，也没有仓库写权限。

手动上传已有 EXE 时可使用 `v<应用版本>`；手动运行构建流程时，标签使用 `v<应用版本>-build.<运行序号>.<重试次数>`，准确关联本次构建提交。相同版本或重跑也不会覆盖旧 Release。上传和附件大小校验在草稿中完成，成功后才公开并标为 Latest；失败时运行明确报错，可能留下供排查的草稿。Release 说明包含源码提交、构建记录和 EXE 的 SHA-256。[最新 EXE 下载地址](https://github.com/975269528/bone-studio/releases/latest/download/BoneStudio.exe) 保持固定。许可证尚待项目所有者选定。

## 使用流程

首次启动显示空白骨架，顶部“新建”可创建空白项目或加载示例人物。桌面版会记住最近成功打开、保存的项目，下次启动恢复该文件的已保存内容；文件丢失、损坏或读取超时时提示原因并回到空白，不会恢复未保存修改。“打开”优先定位到上次成功保存的文件；没有保存记录时使用最近打开的文件，路径失效则使用系统默认位置。

时间轴关键帧可单击选择、Ctrl / Cmd 增减选择、Shift 选择范围，通过工具栏或 Ctrl / Cmd+C、V 复制粘贴。粘贴以当前播放头为起点，保留多帧的相对时间与缓动；“倒序粘贴关键帧”同时反转时间顺序和各段缓动。整批操作支持一次撤销，Del 删除选中的关键帧。拖动时间轴末端可整体调整动作时长，骨骼和 IK 目标关键帧同步按比例伸缩。多个动作共用有目标帧的 IK 时，请先在属性“适用动作”中将其关联到当前动作，再调整时长，避免改变其他动作。

点击关键帧后，在时间轴“曲线”视图中直接调整它到下一帧的缓动，无需弹窗。可选择线性、平滑、阶梯或贝塞尔，使用预设、可拖动控制点、数值输入及曲线复制／粘贴／反转；骨骼的位置与旋转、IK 目标的位置均使用同一段缓动，实时预览和导出共用采样逻辑。最后一帧没有下一段，请选择前一帧调整前面的缓动。PNG 序列按时长与 FPS 导出，例如 2 秒、24 FPS 为 48 张 PNG；“图集”可将所有帧合并到一张图片中。

时间轴提供“自动 K 帧”开关，默认关闭。在动画模式中，关闭时调整骨骼或 IK 目标只预览当前姿态，选择对象后按 K 或点击“记录关键帧”才写入当前时间；开启后每次调整自动创建或更新该时刻的关键帧。未录姿态不保存、不导出，切换时间、动作或开始播放时会清除并提示；骨架模式仍修改基础骨架。开关为当前会话设置，不写入项目文件；输入文字时 K 保留输入用途。

MCP `render_preview` 在当前动作、当前时间包含待录姿态，与画布一致；采样其他时间、`get_project`、保存和导出使用已录入的项目内容。AI 显式发送的关键帧命令直接写入项目，不受“自动 K”开关影响。

1. 默认示例是一名紫头巾小厨师，使用 15 个透明 SVG 分件。紫头巾、白衣、紫围裙与棕鞋沿用参考人物的风格，约 2.35 头身，轻微朝左的 3/4 侧身，近远侧手脚非镜像；后续默认人物继续沿用这一侧身视角。躯干与左右髋从腰部同一骨盆中心分叉，两条腿链首尾相连；挥手只驱动近侧手臂，身体与双脚固定。新角色可导入 PNG / WebP / JPEG 部件；透明拆图推荐 PNG。左侧“素材”保存可复用原图，点击 + 才创建画布图片部件。选择左侧图片部件，再点“添加骨骼”，默认“创建并绑定”：新骨起点放在图片锚点，已有图片保留位置、旋转、缩放、透明度与层级，创建和绑定一次撤销；选择素材后添加骨骼则新建图片部件并绑定。取消绑定勾选可只建骨。属性中可换绑骨骼，换绑或解绑保持当前显示姿态；部件局部变换统一用于基础姿态与所有动作，其他时间的运动会随新骨改变。
2. 按 Q 在骨架和动画模式之间循环，恢复上次动作与时间并暂停播放。无动作时保持骨架模式，先在时间轴添加动作。也可点击顶部模式按钮或选择时间轴动作。切换“骨架”模式，选择“绘制骨骼”工具，在基础姿态中拖出骨骼。已选骨骼作为父骨，空白选择创建根骨；勾选“保持父骨骼”可连续绘制同级分支，取消后新骨成为下一段的父骨。Esc 取消本次绘制。“双端 / 整骨编辑”工具可分别拖圆形起点、菱形终点或整个骨身：连接在同一关节上的骨骼一起调整，未拖动的远端固定，因此骨长与角度可以同时改变。默认“保持图片原位”补偿部件的基础世界位置与旋转；关闭后图片随骨骼变化。该模式显示并编辑基础骨架，不写动画关键帧；已有动画会受到基础骨架变化影响。
3. “选择 / 姿态移动”工具可拖动图片或骨骼关节，骨骼尖端控制旋转。“旋转图片”和“缩放图片”工具从图片边缘拖动，围绕锚点旋转或等比缩放。点击空白清除选择，在项目属性的“整体角色缩放”输入 0.1–10 倍率并应用，同时缩放整套骨架、图片和动作。右侧数值标签可左右拖动实时调整，按住 Shift 微调；也可点击数值输入。有变化的数值拖动合并为一条撤销记录；拖动过程中按 Esc 撤销本次已成功写入的修改，外部文档修改会中断当前拖动。
4. 左侧支持拖拽：图片部件拖到骨骼上换绑；骨骼拖到另一骨骼上更换父级，保持基础骨架姿态，动作继续使用原局部关键帧。禁止拖到自身、后代或改变 IK 下骨父级。拖到“根级 / 解除父级或图片绑定”区可解除关系；素材拖到“骨骼树”标签后放到目标骨骼，会添加新部件并绑定。点击节点箭头展开或收起（不改变选择），也可全部展开或收起；选中隐藏对象自动展开其祖先。项目、骨骼、图片部件、IK 和素材均可在右侧属性命名，回车或离开输入框提交；素材卡片的铅笔和骨骼树双击可快速进入命名。动作名称在时间轴右侧修改。删除骨骼会保留图片并解除对应绑定，保持当前显示姿态；撤销可恢复骨骼与绑定。
5. 选择动画，在时间轴切换时间，编辑骨骼姿态并写入关键帧；K 录帧，空格播放或暂停。IK 使用直接相连的根骨与末端骨，目标可写入动画关键帧。IK 第二段的位置受连接保护，请拖动 IK 目标调整姿态；禁用 IK 后可编辑旋转，如需独立移动第二段须先移除关联约束。
6. 保存项目为 JSON，或导出 PNG 序列 ZIP / spritesheet ZIP。图片像素嵌入项目，重新打开项目无需原图路径。桌面首次保存选择位置，之后“保存”或 Ctrl+S 直接覆盖当前项目文件；“另存为”或 Ctrl+Shift+S 选择新文件。打开项目沿用打开路径，重命名仍保存到原文件；新建、加载示例与浏览器导入重置路径，浏览器预览每次下载 JSON。Ctrl+Z 撤销，Ctrl+Y 或 Ctrl+Shift+Z 重做；macOS 使用 Command。

Del 直接删除，无需确认：在画布或骨骼树选中骨骼、图片部件、IK 后删除该对象；点击时间轴关键帧菱形后按 Del 删除该帧。删除动作时，先用 Tab 聚焦“删除动作”按钮再按 Del；鼠标点击删除按钮仍显示确认框。时间刻度、轨道空白、素材和无选择时不会触发删除。输入、菜单、弹窗和鼠标拖动期间禁用 Del；删除后可 Ctrl+Z 撤销。

“素材 → 导入图片”支持一次选择多张 PNG / WebP / JPEG（Ctrl / Shift 多选），导入后进入素材库，点击 + 添加到画布；同批导入可一次撤销。

中键拖动或“平移视图”工具只移动观察视图，滚轮以指针位置为中心缩放；“适应窗口”重置平移并调整视图倍率。工具栏可切换“骨骼”叠加和“纯画面”，查看实际角色构图。操作提示在顶部中间显示并自动消失。

右上角可切换“柔和浅色 / 柔和深色”：浅色使用暖灰、奶油色面板，深色使用柔和灰蓝。主题偏好保存在当前浏览器的本地存储中，刷新后恢复；存储不可用时仍能在当前会话切换。主题只改变编辑器界面，不改变角色图片、项目内容和动画导出。

资源面板的“骨骼 / 未绑定图片 / IK 约束”三组可独立展开、收起和滚动；空组及少量条目会紧凑显示，把空间留给长列表。拖动骨骼、图片部件或素材时保持按住鼠标，可用滚轮查找远处的骨骼目标；素材可先拖到“骨骼树”标签，再继续放到骨骼上。时间轴上边缘可上下拖动调整高度；点击或拖动顶部刻度定位，轨道列表滚动时刻度和底部定位条始终可见。父骨骼与图片绑定菜单会按视窗空间向上或向下展开，支持搜索、滚动及方向键选择；在弹窗内按 Esc 先关闭菜单，再按一次关闭弹窗。

两种 ZIP 都包含 `animation.json`。采样时间为 `frame / fps`，覆盖 `[0, duration)`；帧数为 `ceil(duration * fps)`，不重复尾帧。导出先检查资源预算：最多 2400 帧，单帧最多 16,777,216 像素，总帧像素最多 268,435,456；精灵图每边最多 8192，最多 33,554,432 像素，帧间保留 2 像素透明间距。超限会明确失败，可降低画布尺寸、帧率或动画长度。

工作区无网格。图片导入上限为单张 18 MB（18,000,000 字节）、单批 36 MB、单边 8192 像素；项目 JSON 最多 64 MiB；导出文件最多 256 MiB。动画与画布的更细范围由项目 schema 校验。序列和图集导出均保留透明背景。

## 连接外部 AI

启动 BoneStudio，点击右上角「AI / MCP」，再点「复制 MCP 配置」，将 JSON 合并到支持 MCP stdio 的 Agent 客户端配置中，刷新或重启客户端即可接入。

**仅 AI / MCP 接入需要安装 Node.js 22.12 或更高版本，并确保 `node` 命令可用；普通 EXE 编辑器使用不需要 Node.js。** 软件会把自包含适配器保存到当前用户的数据目录，收到 EXE 的用户无需源码、`npm install` 或 `node_modules`。复制内容只有启动命令、适配器路径和连接文件路径，不包含本地令牌。请保持编辑器打开；关掉再启动会恢复连接，无需重新复制。配置适用于当前电脑和用户，更改软件数据目录后重新复制。

开发者也可继续使用源码中的适配器：先在源码目录执行 `npm ci`，再使用以下手工配置。`args` 使用本机绝对路径，不需要启动第二个编辑器。

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

桌面自动生成 `%APPDATA%\BoneStudio\ai-connection.json`（macOS 为 `~/Library/Application Support/BoneStudio/`，Linux 为 `~/.config/BoneStudio/`）。适配器每次调用读取此文件，因此桌面重启后可继续使用。可通过 `BONE_STUDIO_USER_DATA` 指定绝对数据目录；目录自动创建，浏览器缓存和单实例状态一起隔离。自定义目录或特殊运行环境时，在客户端 `env` 中设置 `BONE_STUDIO_CONNECTION` 为实际连接文件的绝对路径。`BONE_STUDIO_HIDDEN=1` 仅用于隐藏验收窗口，普通使用无需设置。`.env.example` 记录可选变量；程序不自动加载 `.env`。

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
| `project.scale` | `factor`：0.1–10 的等比倍率 | `pivotX,pivotY`，未传坐标轴默认使用对应画布中心 |
| `asset.add` | `asset`：id,name,dataUrl,width,height | — |
| `asset.update` | `assetId,changes`：name 的部分对象 | — |
| `bone.add` | `bone`：id,name,parentId,x,y,rotation,length | — |
| `bone.update` | `boneId,changes`：除 id 外的骨骼字段 | — |
| `bone.edit` | `boneId,endpoint,x,y`：endpoint 为 `head` / `tail` / `body`，基础世界坐标；body 的 x/y 是新骨头位置 | `keepImages`，默认 true |
| `bone.reparent` | `boneId,parentId`：parentId 为骨骼 ID 或 null | `connection`：`head` / `tail` / `none`，默认 none；`keepImages`，默认 true |
| `bone.remove` | `boneId` | `animationId`：现有动作 ID 或 null；`time`：0–600 秒，默认 0 |
| `attachment.add` | `attachment`：id,name,assetId,boneId,x,y,rotation,scaleX,scaleY,anchorX,anchorY,opacity,zIndex | — |
| `attachment.update` / `attachment.remove` | `attachmentId`；update 还需 `changes` | changes 为除 id 外的附件字段 |
| `animation.add` | `animation`：id,name,duration,fps,loop,tracks | — |
| `animation.update` / `animation.remove` | `animationId`；update 还需 `changes` | changes 为除 id 外的动画字段 |
| `keyframe.set` | `animationId,boneId,keyframe:{time,x,y,rotation}` | 轨道默认 `interpolation`: linear / smooth / step / step-start / bezier |
| `keyframe.remove` | `animationId,boneId,time` | — |
| `ik.add` | `constraint`：id,name,rootBoneId,tipBoneId,targetX,targetY,bendDirection,enabled,targetKeys | `animationId` |
| `ik.update` / `ik.remove` | `constraintId`；update 还需 `changes` | changes 为除 id 外的 IK 字段 |
| `ik.keyframe.set` | `constraintId,keyframe:{time,x,y}` | — |
| `ik.keyframe.remove` | `constraintId,time` | — |

rotation 使用角度。bone.parentId 与 attachment.boneId 可为 null；scaleX/scaleY 为倍率；anchorX/anchorY 为 0–1；opacity 为 0–1；bendDirection 为 1 或 -1。动画 tracks 为 `{boneId,keyframes,interpolation}` 数组，IK targetKeys 为 `{time,x,y}` 数组。批量指令最终状态统一校验，失败时不会部分更新。

骨骼与 IK 关键帧可增加 `interpolation`（linear / smooth / step / step-start / bezier）与 `curve: {x1,y1,x2,y2}`，控制点均为 0–1，描述该关键帧到下一关键帧的缓动。`step` 保持到段末后跳变，`step-start` 在段开始后立即跳变，用于正确反转阶梯动作。旧骨骼关键帧沿用轨道插值，旧 IK 关键帧默认为线性；贝塞尔没有控制点时使用标准 ease。`keyframe.set` / `ik.keyframe.set` 更新同一时刻的姿态时保留未提供的缓动字段；需要完全替换时，可在同一批次先删除该帧再设置。项目仍为 version 1，旧项目可继续打开。

`bone.remove` 删除指定骨骼及其子骨、相关轨道和 IK，保留所有图片素材与部件。受影响部件解除骨骼绑定，将指定动作时间的 FK / IK 世界位置和旋转写入部件，保留缩放、锚点、透明度和图层顺序；未传 `animationId` 或传 null 时使用基础姿态。只删除当前生效 IK 的下骨时，存活根骨的解算姿态也会烘焙到当前动作关键帧或基础旋转，保全仍绑定其上的图片；其他动作保持不变。界面删除传入当前动作与时间，因此图片保留删除前的显示姿态。整个删除事务支持撤销和重做。

`bone.update` 修改 `length` 时，原来末端相连的子骨及相连关键帧跟随新的末端；原有自定义偏移、父头连接与明确脱开的骨骼保持局部偏移。涉及该骨骼作为根骨的 IK 会同步下骨位置与适用动作关键帧为 `x=length,y=0`，旋转和目标保持不变。

`bone.edit` 参考常见骨架编辑器的共享关节操作方式：拖头或尾移动对应共享节点，拖骨身平移它的两个共享节点，其他端点保持基础世界位置。整个骨架一次重建局部变换，避免子级重复位移；编辑结果的每根骨长至少 1 像素，非法输入或零长结果整批拒绝。只有 IK 根骨长度改变时同步该约束适用动画的下骨位置关键帧，其他 FK 关键帧保持不变。`keepImages=true` 保存全部图片锚点和旋转的基础世界姿态，反算新局部位置；图片缩放、锚点与层级不变。

`bone.reparent` 默认保全全部骨骼基础世界端点，解除父级或改变父级不会自动吸附。显式指定 `head` / `tail` 时，将被换父骨的头吸附到父骨对应关节，平移自身骨身及与其头尾共享的子骨关节，子骨其他端点固定。禁止连接自身、后代、不存在的父级或将 IK 下骨从尾连接脱开。父骨选择及连接关系可在骨架属性中修改。所有骨架编辑和换父操作支持撤销、重做与 MCP 原子批次。

项目保持 version 1。骨骼可增加 `connection` 字段描述与父骨共享的关节：`head`、`tail` 或 `none`；根骨仅允许 none。旧项目缺少该字段时，根据基础局部 `x=0,y=0` 或 `x=父骨长,y=0` 推断头、尾连接，读取时不会补写字段。首次骨架编辑将当前推断关系明确记录；显式 none 即使坐标重叠也不会联动。该格式是 BoneStudio 自有项目格式。

`project.scale` 同时缩放基础骨架、骨骼动画位置、部件位置和尺寸、IK 目标及目标关键帧。根骨与自由部件围绕指定世界轴心缩放，子骨与绑定部件的局部偏移乘以倍率；骨长和图片缩放倍率同步改变。旋转、时间、原始图片像素及画布尺寸保持不变。项目仍使用 version 1，无需迁移；任何结果超出项目允许范围时整批拒绝。

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

Agent 可直接调用 `render_preview` 获取当前未保存项目的真实 PNG 效果图，按动作与时间反复取样，无需操作鼠标或截取窗口。编辑器进程须保持运行，窗口可在后台、最小化或隐藏；完全退出编辑器后，预览和编辑接口会断开。导出示例：`{"animationId":"existing-animation-id","format":"sheet","fps":24,"outputPath":"D:\\Exports\\walk.zip"}`。
