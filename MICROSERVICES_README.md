# Microservices Architecture - Web Scraper

Arquitetura de microserviços com Puppeteer e Playwright, A/B testing e Circuit Breaker.

## Estrutura

```
services/
├── orchestrator/          # Gateway com A/B testing e circuit breaker
├── scraper-puppeteer/     # Provider Puppeteer
├── scraper-playwright/    # Provider Playwright
└── tests/                 # Testes de contrato e comparação
```

## Quick Start

### 1. Build e Start

```bash
docker-compose -f docker-compose.microservices.yml build
docker-compose -f docker-compose.microservices.yml up -d
```

### 2. Verificar Health

```bash
./scripts/monitor-health.sh
```

### 3. Testar Search

```bash
curl -X POST http://localhost:8080/search \
  -H "Content-Type: application/json" \
  -d '{"checkin":"2025-12-01","checkout":"2025-12-03","adults":2}'
```

## Configuração A/B Testing

Editar variável no `docker-compose.microservices.yml`:

```yaml
PLAYWRIGHT_TRAFFIC_PERCENTAGE=20  # 20% tráfego Playwright
```

**Rollout gradual:**
- Dia 1-2: 5%
- Dia 3-4: 10%
- Dia 5-7: 20%
- Semana 2: 50%
- Semana 3: 100%

## Endpoints

### Orchestrator (8080)
- `POST /search` - Buscar quartos
- `GET /health` - Health agregado
- `GET /metrics` - Métricas A/B e circuit breakers
- `POST /admin/circuit-breaker/reset/:provider` - Reset manual

### Scrapers (3001, 3002)
- `POST /scrape` - Executar scraping
- `GET /health` - Health individual

## Testes

### Testes de Contrato
```bash
cd services/tests
npm install
npm run test:contract
```

### Testes de Comparação (A/B Shadow Mode)
```bash
npm run test:comparison
```

### Load Test
```bash
node scripts/load-test.js

# Customizar
CONCURRENT_USERS=50 REQUESTS_PER_USER=10 node scripts/load-test.js
```

## Monitoramento

### Logs
```bash
docker logs -f orchestrator
docker logs -f scraper-puppeteer
docker logs -f scraper-playwright
```

### Métricas
```bash
curl http://localhost:8080/metrics | jq
```

## Circuit Breaker

**Estados:**
- `CLOSED`: Normal
- `OPEN`: Provider bloqueado (muitas falhas)
- `HALF_OPEN`: Testando recuperação

**Configuração:**
```yaml
CIRCUIT_BREAKER_THRESHOLD=5        # Falhas para abrir
CIRCUIT_BREAKER_TIMEOUT=30000      # Timeout antes de retry (ms)
```

**Reset manual:**
```bash
curl -X POST http://localhost:8080/admin/circuit-breaker/reset/playwright
```

## Troubleshooting

### Container não inicia
```bash
docker-compose -f docker-compose.microservices.yml logs <service>
docker-compose -f docker-compose.microservices.yml restart <service>
```

### Puppeteer/Playwright crashes
```bash
# Aumentar memória no docker-compose.microservices.yml
limits:
  memory: 2G  # Aumentar de 1G para 2G
```

### Circuit breaker sempre OPEN
```bash
# Verificar logs do provider
docker logs scraper-playwright

# Reset manual
curl -X POST http://localhost:8080/admin/circuit-breaker/reset/playwright
```

## Desempenho Esperado

| Métrica | Puppeteer | Playwright | Target |
|---------|-----------|------------|--------|
| Avg Time | 8-12s | 5-8s | <10s |
| Success Rate | 85% | >90% | >90% |
| Memory | 800MB | 600MB | <1GB |

## Rollback

### Rollback para 0% Playwright
```bash
# Editar docker-compose.microservices.yml
PLAYWRIGHT_TRAFFIC_PERCENTAGE=0

docker-compose -f docker-compose.microservices.yml up -d orchestrator
```

### Rollback para monólito
```bash
docker-compose -f docker-compose.microservices.yml down
docker-compose up -d  # Monólito original
```
