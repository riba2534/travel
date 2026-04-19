# Travel Map - 本地开发命令
# 用法：make <target>，或直接 make 看 help

.PHONY: help install dev data build full preview clean clean-all reinstall ports

# 默认目标：显示帮助
.DEFAULT_GOAL := help

help:  ## 显示所有可用命令
	@echo "Travel Map - 可用命令："
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "常用流程："
	@echo "  首次：     make install && make data && make dev"
	@echo "  日常：     make dev"
	@echo "  加新行程： cp /path/to/new.gpx raw/track.gpx && make data && make dev"
	@echo "  发版前：   make full && make preview"

install:  ## 安装 npm 依赖
	npm install

reinstall:  ## 清理并重装依赖
	rm -rf node_modules package-lock.json
	npm install

dev:  ## 启动开发服务器（http://localhost:5173）
	npm run dev

data:  ## 从 raw/track.gpx 重新生成数据三件套到 public/data/
	@if [ ! -f raw/track.gpx ]; then \
		echo "错误：raw/track.gpx 不存在。请先把 GPX 复制进来："; \
		echo "  mkdir -p raw && cp /path/to/your.gpx raw/track.gpx"; \
		exit 1; \
	fi
	npm run build:data

build:  ## 生产构建（需 public/data/ 已存在）
	npm run build

full:  ## 数据 + 构建（一把梭，从 GPX 到 dist/）
	npm run build:full

preview:  ## 本地预览生产构建（http://localhost:4173）
	npm run preview

clean:  ## 清理构建产物（dist/ + tsbuildinfo），保留 public/data/
	rm -rf dist
	find . -name "*.tsbuildinfo" -not -path "./node_modules/*" -delete
	@echo "清理完成。public/data/ 保留（删了要重跑 make data 才能 build）"

clean-all:  ## 深度清理（含 public/data/，下次需重跑 make data）
	rm -rf dist public/data
	find . -name "*.tsbuildinfo" -not -path "./node_modules/*" -delete
	@echo "深度清理完成"

ports:  ## 看哪些端口被 vite 占着
	@lsof -i :5173 -i :4173 2>/dev/null || echo "5173 / 4173 都空着"
