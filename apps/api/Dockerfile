FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3-venv openssl ca-certificates libgomp1 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY apps/api/requirements-tts.txt /tmp/requirements-tts.txt
RUN python3 -m venv /opt/tts && /opt/tts/bin/pip install --no-cache-dir -r /tmp/requirements-tts.txt
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/prisma apps/api/prisma
RUN ONNXRUNTIME_NODE_INSTALL_CUDA=skip npm ci --workspace @nihongo/api --workspace @nihongo/shared --include=dev
COPY packages/shared/src packages/shared/src
COPY apps/api/tsconfig.json apps/api/tsconfig.json
COPY apps/api/src apps/api/src
COPY apps/api/content/handwriting apps/api/content/handwriting
COPY apps/api/scripts/edge_synthesize.py apps/api/scripts/edge_synthesize.py
RUN npm run db:generate && npm run build:server && mkdir -p /data/reading && chown node:node /data/reading
ENV NODE_ENV=production TTS_PYTHON=/opt/tts/bin/python TTS_STORAGE_DIR=/data/reading
USER node
WORKDIR /app/apps/api
CMD ["sh", "-c", "npm run db:migrate && exec node --import tsx dist/index.js"]
