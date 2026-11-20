# Gameplay Lab

用于快速搭建玩法原型、试验数值和记录结果的个人工具箱。规则、数值配方与实验分开；不以构建通用游戏引擎为目标。

## 开始

需要 Node.js 20.19+ 或 22.12+。在仓库根目录运行：

```sh
npm install
npm run dev
npm test
npm run build
```

打开终端显示的本地地址，从首页选择实验。Idle 经济实验支持：调整参数并重置，手动推进或自动升级，切换速度；运行 100 个种子的批量模拟并导出 JSON。所有模拟按固定一秒步长执行，画面速度不改变规则。双倍收益是为了演示可重放随机性，不是成熟的经济模型。

## 结构

- `packages/math`：曲线；`simulation`：固定种子、步进、批量运行和统计；`progression`：升级费用。
- `packages/assets`：程序合成的少量反馈音；`inspector`：JSON 导出。
- `recipes/curves`：起步数值配方；`experiments/idle-loop`：首个可交互实验。
- `experiments/fleet-collection`：舰娘收集项目设计；其 `battle` 目录是单场战斗实验。其余目录目前是扩展位置。
- `asset-kits`：素材分层和来源记录。当前没有引入第三方素材。

曲线输入从 0 开始；等级从 1 开始。实验中的每次升级或手动推进都会推进一秒。随机生成器将种子转换为 32 位无符号整数。批量结果是统计观察，不能替代实际游玩；曲线配方本身也不保证平衡。

## 新实验

在 `experiments/` 下建立目录，记录要验证的问题、操作方式、通过条件及结果；规则保持纯 TypeScript，按需组合公共模块。先实现具体玩法，再根据第二个实验提取通用机制。可复制 `experiments/fleet-collection/battle/README.md` 作为评审模板。

导出的 JSON 包含配置、种子、状态、批量结果和代码版本占位字段；提交代码后请填写 Git commit。导出不包含执行中每一步的操作历史，因此不能单凭该文件重放手动操作；批量模拟则记录固定策略与种子。
