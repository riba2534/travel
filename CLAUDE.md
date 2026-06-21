# CLAUDE.md

## 项目概览

这是一个 Cloudflare Pages 托管的个人旅行足迹地图。网站代码和旅行数据已经分离：

- 网站：`travel.riba2534.cn`，Cloudflare Pages 项目 `travel-map`
- 数据：`data.travel.riba2534.cn`，Cloudflare R2 bucket `travel-data`
- GitHub Actions 只负责构建/部署网站，不再提交或部署 `public/data`

## 数据加载

生产前端默认读取同源 Worker 路由：

```text
https://travel.riba2534.cn/data/manifest.json
```

本地开发默认读取：

```text
https://data.travel.riba2534.cn/manifest.json
```

manifest 指向版本化 snapshot：

```text
snapshots/<version>/summary.json
snapshots/<version>/places.json
snapshots/<version>/points.geojson
snapshots/<version>/track.geojson
```

如需本地指定数据源，用环境变量：

```bash
VITE_TRAVEL_DATA_MANIFEST_URL=http://localhost:8080/manifest.json npm run dev
```

## 常用命令

```bash
npm install
npm run dev
npm run build
npm run preview
```

更新数据：

```bash
npm run build:data -- \
  --gpx /path/to/backUpData-all.gpx \
  --csv /path/to/backUpPhotoData.csv \
  --out dist-data/current

npm run publish:data -- --dir dist-data/current --bucket travel-data --version YYYY-MM-DD
```

`publish:data` 需要环境变量：

```bash
CF_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
```

不要把这些密钥写进仓库。

## 工程约束

- `raw/`、`public/data/`、`dist-data/` 都是本地/生成数据，不提交；默认使用 `dist-data/current`。
- 代码变更走 GitHub Actions 自动部署 Pages。
- 数据变更走 `build:data` + `publish:data`，不需要重新部署网站。
- 更新数据时先上传 snapshot，最后更新 `manifest.json`，保持发布原子性。
- `manifest.json` 短缓存，snapshot 文件长缓存 immutable。

## Cloudflare 当前配置

- Pages 项目：`travel-map`
- Pages 自定义域名：`travel.riba2534.cn`
- R2 bucket：`travel-data`
- R2 自定义域名：`data.travel.riba2534.cn`
- Worker Route：`travel.riba2534.cn/data/*` 反代到 R2 bucket `travel-data`
- Worker 源码：`workers/travel-data-worker.js`
- CORS 需要允许：
  - `https://travel.riba2534.cn`
  - `https://travel-map-j6x.pages.dev`
  - `http://localhost:5173`
  - `http://localhost:4173`
  - `http://127.0.0.1:5173`
  - `http://127.0.0.1:4173`
