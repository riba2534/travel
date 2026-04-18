# 我的足迹 · Travel Map

把「一生足迹」App 导出的 GPX 数据，渲染成一张深色沉浸式的世界地图。可以自由缩放，每一个点都能看到。

> 在线访问：<https://travel.riba2534.cn>
> 备用域名：<https://travel-map-j6x.pages.dev>

---

## 数据画像（当前实例）

| 维度 | 值 |
|---|---|
| 总点数 | 67,706 |
| 时间跨度 | 2018-05 → 2026-04（8 年） |
| 经度范围 | -116.97°W ~ 129.50°E |
| 纬度范围 | 1.25°N ~ 43.37°N |
| 国家 | 4（中国 / 墨西哥 / 新加坡 / 土耳其） |
| 累计里程 | 28,878 km |
| 高频地点 | 北京 33,911 · 墨西哥城 6,349 · 西安 4,511 · 新加坡 1,679 · 上海 1,434 |

---

## 功能

- **全屏深色矢量地图**：OpenFreeMap dark 风格 + 强制 `name:zh-Hans` 中文标签
- **多缩放层级展示**：
  - 远视图：暖橙色发光的聚类气泡（含点数标签）
  - 近视图：单点 4px 发光圆点 + 点击 popup（UTC 时间 / 坐标 / 海拔）
- **轨迹线**：青色半透明 MultiLineString（按 30 分钟时间间隔切段，避免画跨洋飞行直线）
- **年份双滑块**：拉动毫秒级响应，setData 重新聚类
- **模式切换**：点位 / 热力图
- **高频城市卡**：点击 flyTo 城市中心
- **统计 KPI**：足迹点数 / 国家数 / 公里数 / 年份数
- **响应式**：PC + 移动端（≥44px 触控目标 + safe-area + 浮窗 backdrop-blur）

---

## 技术栈

| 层 | 选型 |
|---|---|
| 构建 | Vite 5 + React 18 + TypeScript |
| 地图引擎 | MapLibre GL JS 4（WebGL，原生 supercluster） |
| 矢量瓦片 | [OpenFreeMap](https://openfreemap.org) dark（免费、无 key、无限速） |
| 兜底瓦片 | CartoDB DarkMatter raster |
| GPX 解析 | 正则流式解析（构建时） |
| 轨迹简化 | simplify-js（tolerance 0.0001，~11m） |
| 国家识别 | world-atlas 50m + @turf/boolean-point-in-polygon |
| 距离计算 | @turf/length |
| 样式 | Tailwind CSS 3 + 5 个 CSS variable |
| 字体 | Inter（UI）+ JetBrains Mono（数字） |
| 部署 | Cloudflare Pages（自动 HTTPS + 全球 CDN） |

---

## 项目结构

```
travel/
├── raw/track.gpx              # 原始 GPX（gitignored，本地 15MB）
├── public/data/               # 构建产物（gitignored，每次 build 重生）
│   ├── points.geojson         # 全部 67,706 个点
│   ├── track.geojson          # MultiLineString 轨迹（简化后）
│   └── summary.json           # 统计 + 国家 + 高频城市
├── scripts/
│   ├── build-data.ts          # GPX → 三件套构建脚本
│   └── known-cities.ts        # 已知城市目录（用于命名网格中心）
├── src/
│   ├── main.tsx
│   ├── App.tsx                # 全局状态 + 布局
│   ├── Map.tsx                # MapLibre 实例、所有图层、交互
│   ├── components/
│   │   ├── Header.tsx         # 左上：标题 + 统计（合并）
│   │   ├── CityList.tsx       # 右上：高频城市
│   │   ├── YearSlider.tsx     # 底部：年份双滑块 + 直方图
│   │   └── ModeToggle.tsx     # 底左：点位 / 热力切换
│   ├── lib/
│   │   ├── types.ts
│   │   └── mapStyle.ts        # 拉 OpenFreeMap 风格 + 强制中文化
│   └── styles/globals.css
├── index.html                 # preconnect + preload summary.json
├── tailwind.config.js
└── vite.config.ts             # brotli + gzip 压缩 + maplibre 单独 chunk
```

---

## 本地开发

```bash
# 1. 安装依赖
npm install

# 2. 把你的 GPX 放到 raw/track.gpx
mkdir -p raw && cp /path/to/your.gpx raw/track.gpx

# 3. 构建数据三件套（输出到 public/data/）
npm run build:data

# 4. 启动 dev server
npm run dev          # http://localhost:5173

# 5. 生产构建 + 本地预览
npm run build
npm run preview      # http://localhost:4173
```

### 用你自己的 GPX

把任意 GPX 文件放到 `raw/track.gpx`（任何 GPS 类 App 导出的标准 GPX 都可以，例如「一生足迹」、行者、Garmin Connect、Strava 等），然后跑 `npm run build:data`。脚本会：

1. 流式解析所有 `<trkpt>`（用正则，比 xmldom 快 10x）
2. 经纬度保留 5 位小数（约 1m 精度，节省 40% 体积）
3. 按相邻点时间间隔 > 30 分钟切段（避免跨洋直线）
4. 每段 simplify-js 简化（tolerance 0.0001）
5. 采样比对 50m 国家边界生成国家列表
6. 0.5°×0.5° 网格聚合，匹配 `scripts/known-cities.ts` 中的已知城市生成 topCities

如果你常去的地点不在 `known-cities.ts` 里，可以自己加几行进去（按经纬度匹配，半径 0.8°）。

---

## 部署到 Cloudflare Pages

需要 Cloudflare 账号 + 一个域名（可选）。

```bash
# 方案一：CLI 交互登录
npx wrangler login
npx wrangler pages project create travel-map --production-branch main
npm run build
npx wrangler pages deploy dist --project-name travel-map --branch main

# 方案二：API token（CI 友好）
export CLOUDFLARE_API_TOKEN=cfat_xxx
export CLOUDFLARE_ACCOUNT_ID=xxx
npm run build
npx wrangler pages deploy dist --project-name travel-map --branch main
```

绑定自定义域名（以 `travel.example.com` 为例）：

1. Cloudflare Dashboard → Pages → travel-map → Custom domains → 添加 `travel.example.com`
2. DNS：在 `example.com` 下加 CNAME `travel` → `travel-map-xxx.pages.dev`，**Proxy 开启**（橙色云）
3. 等 1-2 分钟 Cloudflare 自动签 TLS 证书

---

## 性能预算

| 资源 | 大小（gzip） | 加载策略 |
|---|---|---|
| `index.html` | 0.5 KB | 立即 |
| `index.js` | 50 KB | 立即 |
| `maplibre.js` | 211 KB | 立即（manualChunks 分离） |
| `index.css` | 12 KB | 立即 |
| `summary.json` | 0.6 KB | `<link rel="preload">` |
| OpenFreeMap style | ~100 KB | 异步，map 初始化时 |
| `track.geojson` | ~150 KB | map.on('load') 后异步 |
| `points.geojson` | ~2 MB | map.on('load') 后异步 |

首次进入 LCP < 2s。冷 CDN 时 8MB points.geojson 首次下载 20-30s（边缘缓存后秒开）。

---

## 已知限制

- **国家识别用 50m 边界**，海岸城市/小岛可能误判（接受 MVP 误差，需要更精确可换 10m 数据集）
- **少量乡镇 OSM 缺 `name:zh`**，会回退显示英文/拼音
- **Track 不参与年份过滤**（轨迹线没有逐顶点时间戳，只切了段）
- **首次访问 points.geojson 慢**（8MB 未压缩；Cloudflare 边缘缓存后会自动 brotli 压缩）

---

## License

MIT
