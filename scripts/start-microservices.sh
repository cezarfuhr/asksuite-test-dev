#!/bin/bash

set -e

echo "=========================================="
echo "Starting Microservices Architecture"
echo "=========================================="
echo ""

# Check if docker and docker-compose are available
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed"
    exit 1
fi

# Stop any running containers
echo "🛑 Stopping existing containers..."
docker-compose -f docker-compose.microservices.yml down 2>/dev/null || true
echo ""

# Build images
echo "🔨 Building Docker images..."
docker-compose -f docker-compose.microservices.yml build
echo ""

# Start services
echo "🚀 Starting services..."
docker-compose -f docker-compose.microservices.yml up -d
echo ""

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check health
echo ""
echo "=========================================="
echo "Health Check"
echo "=========================================="

max_retries=30
retry_count=0

while [ $retry_count -lt $max_retries ]; do
    if curl -s http://localhost:8080/health > /dev/null 2>&1; then
        echo "✅ All services are ready!"
        break
    fi

    retry_count=$((retry_count + 1))
    echo "⏳ Waiting for services... ($retry_count/$max_retries)"
    sleep 2
done

if [ $retry_count -eq $max_retries ]; then
    echo "❌ Services failed to start within timeout"
    echo ""
    echo "Checking logs:"
    docker-compose -f docker-compose.microservices.yml logs --tail=50
    exit 1
fi

echo ""
./scripts/monitor-health.sh

echo ""
echo "=========================================="
echo "Microservices Started Successfully!"
echo "=========================================="
echo ""
echo "📊 Orchestrator: http://localhost:8080"
echo "🔍 Health: http://localhost:8080/health"
echo "📈 Metrics: http://localhost:8080/metrics"
echo ""
echo "Test search:"
echo 'curl -X POST http://localhost:8080/search -H "Content-Type: application/json" -d '"'"'{"checkin":"2025-12-01","checkout":"2025-12-03","adults":2}'"'"''
echo ""
echo "View logs:"
echo "docker-compose -f docker-compose.microservices.yml logs -f"
echo ""
