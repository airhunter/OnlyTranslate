# syntax=docker/dockerfile:1

FROM node:22-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git
RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts

COPY website ./website
COPY public/icon/128.png ./public/icon/128.png
COPY store-assets/chrome-web-store/zh-CN/01-web-translation.png ./store-assets/chrome-web-store/zh-CN/01-web-translation.png
COPY store-assets/demos/web-bilingual-reading/poster-horizontal.png ./store-assets/demos/web-bilingual-reading/poster-horizontal.png
COPY store-assets/demos/web-bilingual-reading/onlytranslate-web-bilingual-horizontal-voiceover.mp4 ./store-assets/demos/web-bilingual-reading/onlytranslate-web-bilingual-horizontal-voiceover.mp4
COPY store-assets/demos/video-bilingual-subtitles/poster-horizontal.jpg ./store-assets/demos/video-bilingual-subtitles/poster-horizontal.jpg
COPY store-assets/demos/video-bilingual-subtitles/onlytranslate-video-subtitles-horizontal-voiceover.mp4 ./store-assets/demos/video-bilingual-subtitles/onlytranslate-video-subtitles-horizontal-voiceover.mp4
COPY store-assets/demos/epub-bilingual-reading/poster-horizontal.jpg ./store-assets/demos/epub-bilingual-reading/poster-horizontal.jpg
COPY store-assets/demos/epub-bilingual-reading/onlytranslate-epub-bilingual-horizontal-voiceover.mp4 ./store-assets/demos/epub-bilingual-reading/onlytranslate-epub-bilingual-horizontal-voiceover.mp4

RUN pnpm site:build

FROM caddy:2-alpine

COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=builder /app/website/.vitepress/dist /srv
