#!/bin/bash
set -e

echo "🔨 Building vbpagent..."

# Build with cache and parallel stages
DOCKER_BUILDKIT=1 docker build \
  -f Dockerfile \
  --build-arg ENABLE_EMBEDUI=true \
  --build-arg BUILDKIT_INLINE_CACHE=1 \
  -t ghcr.io/kadiesnguyen/vbpagent:latest \
  . 2>&1 | grep -E "^#|ERROR|DONE|exporting"

echo "✅ Build complete!"
echo "🔄 Restarting container..."

./start.sh down vbpclaw && ./start.sh up vbpclaw

echo "✅ Done!"
