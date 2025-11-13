#!/bin/bash

# Health monitoring script for microservices

echo "==================================="
echo "Microservices Health Check"
echo "==================================="
echo ""

ORCHESTRATOR_URL="${ORCHESTRATOR_URL:-http://localhost:8080}"
PUPPETEER_URL="${PUPPETEER_URL:-http://localhost:3001}"
PLAYWRIGHT_URL="${PLAYWRIGHT_URL:-http://localhost:3002}"

check_service() {
  local name=$1
  local url=$2

  echo -n "Checking $name... "

  response=$(curl -s -w "\n%{http_code}" "$url/health" 2>/dev/null)
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')

  if [ "$http_code" = "200" ]; then
    echo "✅ OK"
    echo "  Response: $body"
  else
    echo "❌ FAILED (HTTP $http_code)"
    echo "  Response: $body"
  fi
  echo ""
}

# Check individual services
check_service "Puppeteer Service" "$PUPPETEER_URL"
check_service "Playwright Service" "$PLAYWRIGHT_URL"
check_service "Orchestrator Service" "$ORCHESTRATOR_URL"

# Check orchestrator metrics
echo "==================================="
echo "Orchestrator Metrics"
echo "==================================="
metrics=$(curl -s "$ORCHESTRATOR_URL/metrics" 2>/dev/null)
echo "$metrics" | jq '.' 2>/dev/null || echo "$metrics"
echo ""

# Test search endpoint
echo "==================================="
echo "Testing Search Endpoint"
echo "==================================="
search_result=$(curl -s -X POST "$ORCHESTRATOR_URL/search" \
  -H "Content-Type: application/json" \
  -d '{"checkin":"2025-12-01","checkout":"2025-12-03","adults":2}' 2>/dev/null)

if echo "$search_result" | jq -e '.success == true' >/dev/null 2>&1; then
  echo "✅ Search successful"
  echo "$search_result" | jq '{success, provider: .meta.provider, executionTime: .meta.executionTime, roomsFound: (.data | length)}' 2>/dev/null
else
  echo "❌ Search failed"
  echo "$search_result" | jq '.' 2>/dev/null || echo "$search_result"
fi

echo ""
echo "==================================="
echo "Health Check Complete"
echo "==================================="
