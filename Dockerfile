# === 1. 基础镜像 ===
FROM node:20-alpine AS base

# === 2. 依赖安装阶段 ===
FROM base AS deps
WORKDIR /app

# 复制 package.json 等文件
COPY package.json package-lock.json* ./

# 安装依赖 (设置国内源，加快速度)
RUN npm config set registry https://registry.npmmirror.com/
RUN npm ci

# === 3. 构建阶段 ===
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 禁用 Next.js 的遥测数据收集
ENV NEXT_TELEMETRY_DISABLED=1

# 运行构建
RUN npm run build

# === 4. 生产运行阶段 ===
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 创建 nextjs 用户，避免使用 root 运行（安全最佳实践）
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 自动创建 .next 目录并授权
RUN mkdir .next
RUN chown nextjs:nodejs .next

# 复制构建产物
# Next.js 的 standalone 模式能极大减小镜像体积
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# 切换用户
USER nextjs

# 暴露端口
EXPOSE 3000

# 启动命令
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]