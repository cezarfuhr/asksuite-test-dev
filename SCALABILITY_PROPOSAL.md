# Web Scraping Architecture: Microservices-Based Solution with Multi-Provider Strategy

**Document Type:** Technical Architecture Proposal
**Author:** System Architecture & Scalability Team
**Date:** 2025-11-12
**Version:** 1.0
**Status:** Proposal for Review

---

## Executive Summary

This document proposes a microservices-based architecture for the hotel search scraping system, transitioning from a monolithic single-provider approach to a distributed, multi-provider solution with high availability, fault tolerance, and horizontal scalability.

### Key Highlights

- **Proposed Architecture:** 4-container microservices design
- **Primary Goal:** Enable A/B testing between Puppeteer and Playwright with zero-downtime failover
- **Expected Improvements:**
  - 99.9% availability through redundancy
  - 40-60% performance improvement via Playwright
  - Independent scaling of components
  - Safe provider migration with automated rollback
- **Implementation Effort:** 2-4 weeks (phased approach)
- **Infrastructure Cost Impact:** +30-40% (justified by reliability gains)

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Proposed Architecture](#2-proposed-architecture)
3. [Technical Design](#3-technical-design)
4. [Scalability Strategy](#4-scalability-strategy)
5. [Quality Assurance](#5-quality-assurance)
6. [Implementation Roadmap](#6-implementation-roadmap)
7. [Risk Assessment](#7-risk-assessment)
8. [Metrics & Success Criteria](#8-metrics--success-criteria)
9. [Cost-Benefit Analysis](#9-cost-benefit-analysis)
10. [Recommendations](#10-recommendations)

---

## 1. Current State Analysis

### 1.1 Existing Architecture

```
┌──────────────────────────────────────┐
│      Monolithic Backend              │
│  ┌────────────────────────────────┐  │
│  │  Express API                   │  │
│  │  BrowserService (Puppeteer)    │  │
│  │  ScraperService                │  │
│  │  Database Connection           │  │
│  │  Redis Connection              │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

### 1.2 Identified Limitations

| Issue | Impact | Severity |
|-------|--------|----------|
| Single provider dependency | No failover if Puppeteer fails | **High** |
| Tight coupling | Difficult to swap providers | **High** |
| No isolation | Provider crash affects entire service | **Critical** |
| Limited scalability | Cannot scale scraping independently | **Medium** |
| No A/B testing capability | Cannot validate new providers safely | **Medium** |
| Large container size | ~800MB with all dependencies | **Low** |

### 1.3 Performance Baseline (Current State)

- **Average scraping time:** 8-12 seconds
- **Success rate:** ~85% (after Chromium path fix)
- **Error recovery:** Manual intervention required
- **Scalability:** Vertical only (increase container resources)
- **Deployment risk:** High (monolithic changes)

---

## 2. Proposed Architecture

### 2.1 High-Level Design

```
                    ┌─────────────────────────────────────┐
                    │         LOAD BALANCER               │
                    │      (nginx or cloud LB)            │
                    └──────────────┬──────────────────────┘
                                   │
                    ┌──────────────▼──────────────────────┐
                    │     ORCHESTRATOR SERVICE            │
                    │  ┌───────────────────────────────┐  │
                    │  │ API Gateway                   │  │
                    │  │ Circuit Breaker               │  │
                    │  │ A/B Logic Engine              │  │
                    │  │ Fallback Manager              │  │
                    │  │ Health Check Aggregator       │  │
                    │  │ Metrics Collector             │  │
                    │  └───────────────────────────────┘  │
                    └──┬─────────────────────┬────────────┘
                       │                     │
         ┌─────────────▼──────┐    ┌────────▼─────────────┐
         │  SCRAPER SERVICE   │    │  SCRAPER SERVICE     │
         │    (Puppeteer)     │    │   (Playwright)       │
         │                    │    │                      │
         │  - /scrape         │    │  - /scrape           │
         │  - /health         │    │  - /health           │
         │  - Chromium        │    │  - Chromium/Firefox  │
         │  - ~300MB image    │    │  - ~300MB image      │
         └─────────┬──────────┘    └──────────┬───────────┘
                   │                           │
                   └────────────┬──────────────┘
                                │
                    ┌───────────▼──────────────────────────┐
                    │    DATA LAYER SERVICES               │
                    │  ┌─────────────┐  ┌──────────────┐   │
                    │  │   Redis     │  │  PostgreSQL  │   │
                    │  │  (Cache)    │  │  (Storage)   │   │
                    │  └─────────────┘  └──────────────┘   │
                    └──────────────────────────────────────┘
```

### 2.2 Component Responsibilities

#### Orchestrator Service (Gateway)
**Technology:** Node.js (Express)
**Port:** 8080 (external)
**Responsibilities:**
- Receive and validate client requests
- Implement A/B testing logic (traffic splitting)
- Execute circuit breaker pattern per provider
- Manage fallback chain: Playwright → Puppeteer → Cache → Mock
- Aggregate health status from all services
- Collect and expose metrics
- Rate limiting and authentication (future)

**Key Features:**
- Stateless design (horizontal scaling)
- Sub-100ms routing overhead
- Configurable provider ratios (env vars)
- Graceful degradation

#### Scraper Service - Puppeteer
**Technology:** Node.js + Puppeteer + Chromium
**Port:** 3001 (internal)
**Responsibilities:**
- Execute scraping requests via Puppeteer
- Return standardized room data structure
- Health check endpoint
- Isolated process management

**Container Specifications:**
- Base: `node:18-alpine`
- Size: ~300MB
- CPU: 0.5-1 core
- Memory: 512MB-1GB
- Restart policy: unless-stopped

#### Scraper Service - Playwright
**Technology:** Node.js + Playwright + Chromium
**Port:** 3002 (internal)
**Responsibilities:**
- Execute scraping requests via Playwright
- Return identical data structure as Puppeteer
- Health check endpoint
- Isolated process management

**Container Specifications:**
- Base: `mcr.microsoft.com/playwright:v1.40.0-focal`
- Size: ~300MB
- CPU: 0.5-1 core
- Memory: 512MB-1GB
- Restart policy: unless-stopped

#### Data Layer
**Redis:**
- Cache scraping results (TTL: 1 hour)
- Store circuit breaker states
- Session management (future)

**PostgreSQL:**
- Persist search history
- Store performance metrics
- Provider comparison data

---

## 3. Technical Design

### 3.1 Service Communication Protocol

#### Request Flow
```
1. Client → Orchestrator: POST /search
2. Orchestrator → Cache: Check if result exists
3. If cache miss:
   a. Orchestrator → Provider Selection (A/B logic)
   b. Orchestrator → Scraper Service: POST /scrape
   c. Scraper → Orchestrator: Response (rooms data)
   d. Orchestrator → Cache: Store result
4. Orchestrator → Client: Response
5. Orchestrator → Database: Log async (fire-and-forget)
```

#### Standardized Scraper Interface (Contract)

```typescript
// Request
POST /scrape
Content-Type: application/json

{
  "checkin": "YYYY-MM-DD",
  "checkout": "YYYY-MM-DD",
  "adults": number
}

// Response - Success
200 OK
{
  "success": true,
  "data": [
    {
      "name": string,
      "description": string,
      "price": string,
      "image": string
    }
  ],
  "meta": {
    "provider": "puppeteer" | "playwright",
    "executionTime": number,
    "timestamp": string
  }
}

// Response - Error
500 Internal Server Error
{
  "success": false,
  "error": {
    "code": "SCRAPING_FAILED" | "TIMEOUT" | "BROWSER_CRASH",
    "message": string,
    "provider": string
  }
}
```

### 3.2 Circuit Breaker Pattern

**Implementation:** Per-provider circuit breaker

```
States:
├── CLOSED (normal operation)
│   ├── Success → remain CLOSED
│   └── Failure count ≥ threshold → OPEN
│
├── OPEN (provider blocked)
│   ├── All requests → fallback immediately
│   └── After timeout → HALF_OPEN
│
└── HALF_OPEN (testing recovery)
    ├── Success → CLOSED
    └── Failure → OPEN
```

**Configuration:**
```javascript
{
  failureThreshold: 5,        // failures to trip
  successThreshold: 2,        // successes to close
  timeout: 30000,             // ms before retry
  monitoringPeriod: 60000,    // window for counting
  fallbackEnabled: true
}
```

### 3.3 A/B Testing Strategy

#### Traffic Distribution Mechanisms

**Option 1: Percentage-based (Recommended)**
```javascript
// Environment variable
PLAYWRIGHT_TRAFFIC_PERCENTAGE=20

// Logic
if (random(0, 100) < PLAYWRIGHT_TRAFFIC_PERCENTAGE) {
  provider = 'playwright';
} else {
  provider = 'puppeteer';
}
```

**Option 2: Header-based (Testing/Debug)**
```javascript
// Client can specify
X-Provider: puppeteer | playwright | auto

// Useful for:
- Manual testing
- Client-specific rollout
- Debugging
```

**Option 3: Canary Deployment**
```javascript
// Gradual rollout
Week 1: 10% Playwright
Week 2: 25% Playwright (if metrics good)
Week 3: 50% Playwright
Week 4: 100% Playwright
```

### 3.4 Fallback Chain

```
Request arrives
    ↓
┌───────────────────┐
│ Check Cache       │ → Hit → Return cached data
└────────┬──────────┘
         │ Miss
         ↓
┌───────────────────┐
│ Primary Provider  │ → Success → Cache + Return
│ (Playwright)      │
└────────┬──────────┘
         │ Failure
         ↓
┌───────────────────┐
│ Circuit Breaker   │ → OPEN → Skip directly to fallback
└────────┬──────────┘
         │ Try
         ↓
┌───────────────────┐
│ Fallback Provider │ → Success → Cache + Return + Log
│ (Puppeteer)       │
└────────┬──────────┘
         │ Failure
         ↓
┌───────────────────┐
│ Stale Cache       │ → Exists → Return with warning
│ (TTL expired)     │
└────────┬──────────┘
         │ Not found
         ↓
┌───────────────────┐
│ Mock Data         │ → Return fallback data + Alert
│ (Last resort)     │
└───────────────────┘
```

### 3.5 Dependency Inversion (Interfaces)

```typescript
// scraper-interface.ts
interface IScraperProvider {
  scrape(params: ScrapeParams): Promise<ScrapeResult>;
  healthCheck(): Promise<HealthStatus>;
  getName(): string;
}

// puppeteer-provider.ts
class PuppeteerProvider implements IScraperProvider {
  async scrape(params) { /* implementation */ }
  async healthCheck() { /* implementation */ }
  getName() { return 'puppeteer'; }
}

// playwright-provider.ts
class PlaywrightProvider implements IScraperProvider {
  async scrape(params) { /* implementation */ }
  async healthCheck() { /* implementation */ }
  getName() { return 'playwright'; }
}

// orchestrator.ts
class ScraperOrchestrator {
  constructor(private providers: IScraperProvider[]) {}

  async selectProvider(): IScraperProvider {
    // A/B logic, circuit breaker, etc.
  }
}
```

---

## 4. Scalability Strategy

### 4.1 Horizontal Scaling

**Orchestrator:**
- Stateless design → unlimited horizontal scaling
- Load balancer distributes requests
- No shared state (Redis for cache only)

**Scraper Services:**
```yaml
# docker-compose.yml
services:
  scraper-puppeteer:
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '1'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M

  scraper-playwright:
    deploy:
      replicas: 2  # Start with fewer, scale based on traffic %
```

**Auto-scaling Rules (Kubernetes/ECS):**
```yaml
- CPU > 70% for 2 minutes → +1 replica
- CPU < 30% for 5 minutes → -1 replica
- Min replicas: 2 (HA)
- Max replicas: 10
```

### 4.2 Vertical Scaling

| Component | Min Resources | Max Resources | Scale Trigger |
|-----------|---------------|---------------|---------------|
| Orchestrator | 256MB / 0.25 CPU | 1GB / 1 CPU | Req/s > 100 |
| Scraper (each) | 512MB / 0.5 CPU | 2GB / 2 CPU | Active scrapes > 5 |
| Redis | 256MB | 2GB | Cache hit ratio < 70% |
| PostgreSQL | 512MB | 4GB | Query time > 100ms |

### 4.3 Database Sharding Strategy (Future)

```
Current: Single PostgreSQL instance
Future (>10M searches):
  ├── Shard by date range
  │   └── searches_2025_01, searches_2025_02, ...
  └── Read replicas for analytics
```

### 4.4 Caching Strategy

**Cache Layers:**
1. **L1: In-memory (Orchestrator)** - LRU cache, 100 most recent
2. **L2: Redis** - All results, TTL 1 hour
3. **L3: Database** - Historical data

**Cache Invalidation:**
- TTL-based (1 hour default)
- Manual invalidation endpoint (admin)
- Price change detection (future enhancement)

---

## 5. Quality Assurance

### 5.1 Testing Strategy

#### Contract Tests
**Purpose:** Ensure both providers implement identical interface

```javascript
describe('Scraper Provider Contract', () => {
  const providers = [
    new PuppeteerProvider(),
    new PlaywrightProvider()
  ];

  providers.forEach(provider => {
    describe(`${provider.getName()} Provider`, () => {
      it('should implement scrape method', () => {
        expect(provider.scrape).toBeDefined();
        expect(typeof provider.scrape).toBe('function');
      });

      it('should return standardized structure', async () => {
        const result = await provider.scrape({
          checkin: '2025-12-01',
          checkout: '2025-12-03'
        });

        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('data');
        expect(result.data).toBeInstanceOf(Array);

        if (result.data.length > 0) {
          expect(result.data[0]).toHaveProperty('name');
          expect(result.data[0]).toHaveProperty('description');
          expect(result.data[0]).toHaveProperty('price');
          expect(result.data[0]).toHaveProperty('image');
        }
      });

      it('should handle errors consistently', async () => {
        const result = await provider.scrape({
          checkin: 'invalid',
          checkout: 'invalid'
        });

        expect(result.success).toBe(false);
        expect(result).toHaveProperty('error');
        expect(result.error).toHaveProperty('code');
        expect(result.error).toHaveProperty('message');
      });
    });
  });
});
```

#### Comparison Tests (Shadow Mode)
**Purpose:** Validate Playwright produces equivalent results

```javascript
describe('Provider Comparison', () => {
  it('should return similar results for same search', async () => {
    const params = {
      checkin: '2025-12-01',
      checkout: '2025-12-03'
    };

    const [puppeteerResult, playwrightResult] = await Promise.all([
      puppeteerProvider.scrape(params),
      playwrightProvider.scrape(params)
    ]);

    // Allow ±10% variance in room count
    const variance = Math.abs(
      puppeteerResult.data.length - playwrightResult.data.length
    ) / puppeteerResult.data.length;

    expect(variance).toBeLessThan(0.1);

    // Structure validation
    expect(puppeteerResult.data[0]).toMatchObject({
      name: expect.any(String),
      price: expect.any(String)
    });
    expect(playwrightResult.data[0]).toMatchObject({
      name: expect.any(String),
      price: expect.any(String)
    });
  });
});
```

#### Load Tests
**Tool:** k6 or Artillery

```javascript
// load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 10 },   // Ramp up
    { duration: '5m', target: 50 },   // Sustained load
    { duration: '2m', target: 100 },  // Peak
    { duration: '5m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<15000'], // 95% under 15s
    http_req_failed: ['rate<0.1'],      // Error rate < 10%
  },
};

export default function () {
  const payload = JSON.stringify({
    checkin: '2025-12-01',
    checkout: '2025-12-03',
  });

  const res = http.post('http://orchestrator:8080/search', payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response has data': (r) => JSON.parse(r.body).data.length > 0,
  });

  sleep(1);
}
```

#### Chaos Engineering Tests
**Tool:** Chaos Mesh or manual scripts

```bash
# Test scenarios:
1. Kill Playwright container → Verify fallback to Puppeteer
2. Network latency 500ms → Verify timeout handling
3. Memory pressure → Verify graceful degradation
4. Redis unavailable → Verify operation without cache
5. Database slow queries → Verify async logging doesn't block
```

### 5.2 Monitoring & Observability

#### Metrics Collection (Prometheus)

```yaml
# Key Metrics:
- scraper_requests_total{provider="puppeteer|playwright", status="success|error"}
- scraper_duration_seconds{provider, percentile="50|95|99"}
- scraper_rooms_found{provider}
- circuit_breaker_state{provider}
- cache_hit_ratio
- orchestrator_requests_total{endpoint}
- container_cpu_usage{service}
- container_memory_usage{service}
```

#### Logging Strategy (Structured JSON)

```json
{
  "timestamp": "2025-11-12T18:36:05.387Z",
  "level": "info|warn|error",
  "service": "orchestrator|scraper-puppeteer|scraper-playwright",
  "traceId": "uuid-v4",
  "event": "scrape_request|scrape_success|scrape_error|fallback_triggered",
  "provider": "puppeteer|playwright",
  "duration": 8039,
  "roomsFound": 78,
  "cached": false,
  "fallbackUsed": false,
  "error": null
}
```

#### Alerting Rules

| Alert | Condition | Severity | Action |
|-------|-----------|----------|--------|
| High Error Rate | Error rate > 15% for 5min | Critical | Page on-call + Auto-rollback |
| Circuit Breaker Open | Any provider OPEN > 2min | High | Slack alert + Investigate |
| Slow Response | P95 latency > 20s | Medium | Slack alert |
| No Rooms Found | Rooms < 10 for 10 consecutive searches | High | Check if site changed |
| Container Restart | Any container restarts > 3 in 10min | Medium | Investigate logs |
| Cache Miss Rate | Cache hit < 50% | Low | Review cache TTL |

---

## 6. Implementation Roadmap

### Phase 1: Foundation (Week 1)
**Goal:** Establish architecture without breaking existing functionality

**Tasks:**
- [ ] Create project structure (orchestrator, scrapers folders)
- [ ] Define service interfaces (TypeScript definitions)
- [ ] Implement PuppeteerProvider with existing code
- [ ] Create Dockerfiles for each service
- [ ] Set up docker-compose with all 4 services
- [ ] Implement basic orchestrator (no A/B yet, just route to Puppeteer)
- [ ] Contract tests for PuppeteerProvider

**Deliverable:** Working 4-container system (Puppeteer only, 100% traffic)

**Success Criteria:**
- All existing tests pass
- Same performance as monolith (±5%)
- No production deployment yet

### Phase 2: Playwright Integration (Week 2)
**Goal:** Add Playwright as alternative provider

**Tasks:**
- [ ] Implement PlaywrightProvider following same interface
- [ ] Create Playwright Dockerfile
- [ ] Contract tests for PlaywrightProvider
- [ ] Comparison tests (shadow mode - both run, compare results)
- [ ] Circuit breaker implementation
- [ ] Health check aggregation

**Deliverable:** Both providers functional, Playwright in shadow mode (0% traffic)

**Success Criteria:**
- Comparison tests show <10% variance in results
- Playwright success rate >90% in shadow mode
- No impact on production traffic

### Phase 3: A/B Testing (Week 3)
**Goal:** Gradual rollout with monitoring

**Tasks:**
- [ ] Implement A/B logic (percentage-based)
- [ ] Metrics collection and dashboard (Grafana)
- [ ] Automated rollback on error threshold
- [ ] Load testing (100 concurrent users)
- [ ] Documentation for ops team

**Rollout Schedule:**
- Day 1-2: 5% Playwright
- Day 3-4: 10% Playwright
- Day 5-7: 20% Playwright (hold for monitoring)

**Success Criteria:**
- Error rate <10% on Playwright traffic
- P95 latency improvement >20%
- Zero manual interventions needed

### Phase 4: Optimization & Scaling (Week 4)
**Goal:** Production-ready with auto-scaling

**Tasks:**
- [ ] Container size optimization
- [ ] Horizontal scaling configuration
- [ ] Advanced caching strategies
- [ ] Chaos engineering tests
- [ ] Runbook for common issues
- [ ] Post-mortem template

**Rollout Schedule:**
- Day 1-3: 50% Playwright (if Week 3 successful)
- Day 4-7: 100% Playwright (Puppeteer as fallback only)

**Success Criteria:**
- 99.9% uptime
- Auto-scaling tested and working
- Ops team trained and comfortable

---

## 7. Risk Assessment

### 7.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Playwright incompatible with site** | Medium | High | Shadow mode testing for 1 week before traffic |
| **Network latency between containers** | Low | Medium | Deploy in same network, monitor latency |
| **Increased complexity causes bugs** | Medium | Medium | Comprehensive testing, gradual rollout |
| **Resource exhaustion** | Low | High | Resource limits, auto-scaling, monitoring |
| **Data inconsistency** | Low | Medium | Contract tests, comparison validation |
| **Circuit breaker false positives** | Medium | Low | Tunable thresholds, manual override |

### 7.2 Operational Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Team unfamiliarity with architecture** | High | Medium | Documentation, training sessions, pair programming |
| **Debugging difficulty** | Medium | Medium | Distributed tracing (trace IDs), centralized logging |
| **Deployment complexity** | Medium | Low | Infrastructure as Code, automated CI/CD |
| **Increased infrastructure costs** | High | Low | Cost monitoring, optimize container sizes |

### 7.3 Rollback Plan

**Triggers for Rollback:**
- Error rate >20% for 10 minutes
- P95 latency >30s for 5 minutes
- Manual decision by engineering lead

**Rollback Procedure:**
1. Set `PLAYWRIGHT_TRAFFIC_PERCENTAGE=0` (instant)
2. Verify metrics return to baseline
3. Investigate root cause
4. Fix issue
5. Re-test in shadow mode
6. Gradual rollout again

**Rollback Time:** <5 minutes (environment variable change)

---

## 8. Metrics & Success Criteria

### 8.1 Performance Metrics

| Metric | Current (Puppeteer) | Target (Playwright) | Measurement |
|--------|---------------------|---------------------|-------------|
| Average Scrape Time | 8-12s | 5-8s (40% improvement) | P50 latency |
| P95 Latency | 15s | <12s | Prometheus |
| Success Rate | 85% | >95% | Error rate tracking |
| Rooms Found (avg) | 65 | >60 (±10% acceptable) | Response validation |
| Memory per Scrape | 800MB | 600MB | Container metrics |
| CPU per Scrape | 1 core | 0.7 core | Container metrics |

### 8.2 Reliability Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Uptime | 99.9% | Uptime monitoring |
| Fallback Success Rate | >90% | When primary fails, fallback succeeds |
| Mean Time to Recovery (MTTR) | <5 minutes | Incident tracking |
| Circuit Breaker Effectiveness | <5% false positives | Manual review |
| Cache Hit Rate | >70% | Redis metrics |

### 8.3 Business Metrics

| Metric | Current | Target | Impact |
|--------|---------|--------|--------|
| API Response Time (perceived) | 8-12s | 5-8s | Better UX |
| Failed Searches | 15% | <5% | Higher conversion |
| Infrastructure Cost | $X/month | $X*1.3/month | Justified by reliability |
| Developer Velocity | Baseline | +20% (easier to add providers) | Long-term benefit |

---

## 9. Cost-Benefit Analysis

### 9.1 Implementation Costs

| Item | Effort | Notes |
|------|--------|-------|
| Development (4 weeks) | 160 hours | 1 senior engineer full-time |
| Testing & QA | 40 hours | Dedicated QA + automated tests |
| Documentation | 16 hours | Architecture docs, runbooks |
| Training | 8 hours | Team onboarding sessions |
| **Total Implementation** | **224 hours** | **~$22,400 @ $100/hr** |

### 9.2 Infrastructure Costs

| Resource | Current | Proposed | Delta |
|----------|---------|----------|-------|
| Compute (containers) | 1 container @ 1GB | 4 containers @ 512MB each = 2GB | +100% |
| Storage (DB) | 10GB | 10GB | 0% |
| Network (egress) | ~5GB/month | ~5GB/month | 0% |
| Monitoring (Grafana Cloud) | $0 (basic) | $49/month | +$49/mo |
| **Monthly Infrastructure** | **~$30/mo** | **~$90/mo** | **+$60/mo** |

### 9.3 Benefits (Quantified)

| Benefit | Annual Value | Calculation |
|---------|--------------|-------------|
| Reduced Failed Searches | $3,600 | 10% error reduction * 1000 searches/mo * $3 avg revenue/search |
| Faster Response (UX) | $1,800 | 5% conversion improvement * 1000 searches/mo * $3 revenue |
| Developer Productivity | $12,000 | 20% faster feature development * $60K eng salary |
| Reduced Downtime | $2,400 | 99.9% vs 98% uptime * $200/hour downtime cost |
| **Total Annual Benefit** | **$19,800** | |

**ROI Calculation:**
- Implementation Cost: $22,400 (one-time)
- Annual Infrastructure: $720 (monthly delta * 12)
- Annual Benefit: $19,800
- **Payback Period:** 14 months
- **3-Year ROI:** 160%

### 9.4 Intangible Benefits

- **Flexibility:** Easy to add new scraping providers (Selenium, Cheerio)
- **Risk Mitigation:** Provider lock-in eliminated
- **Learning:** Team gains microservices expertise
- **Future-Proofing:** Architecture scales to 10x current traffic
- **Competitive Advantage:** Faster, more reliable service than competitors

---

## 10. Recommendations

### 10.1 Primary Recommendation: **APPROVE with Phased Rollout**

**Rationale:**
1. **Technical Merit:** Architecture is sound and follows industry best practices
2. **Risk Mitigation:** Phased approach minimizes production impact
3. **ROI Positive:** 14-month payback, 160% 3-year ROI
4. **Strategic Alignment:** Positions platform for future growth
5. **Competitive:** Improved performance and reliability vs competitors

**Conditions for Approval:**
- [ ] Dedicated engineering resource for 4 weeks (non-negotiable)
- [ ] QA involvement from Week 2 onwards
- [ ] DevOps support for infrastructure setup
- [ ] Product/Business stakeholder signoff on gradual rollout plan
- [ ] Monitoring dashboard ready before Phase 3

### 10.2 Alternative Recommendation: **Delay Until Q2 2025**

**If resources unavailable now, delay but with preparation:**
- Continue using current monolith (stable after recent fixes)
- Use time to:
  - Train team on microservices patterns
  - Set up monitoring infrastructure
  - Conduct more thorough Playwright evaluation
  - Optimize existing Puppeteer performance

**Risk of Delay:**
- Continued provider lock-in
- Missing potential performance gains (40% faster)
- Accumulating technical debt

### 10.3 Not Recommended: **Partial Implementation**

**Do NOT implement only parts of this architecture:**
- ❌ Adding Playwright without orchestrator → No fallback safety
- ❌ Microservices without proper monitoring → Debugging nightmare
- ❌ A/B testing without circuit breakers → Risky rollout

**Principle:** All or nothing. The safety mechanisms are critical.

---

## 11. Appendices

### Appendix A: Technology Stack

| Component | Technology | Version | Rationale |
|-----------|------------|---------|-----------|
| Orchestrator | Node.js + Express | 18 LTS | Existing stack, team expertise |
| Scraper (Puppeteer) | Puppeteer | Latest | Current implementation |
| Scraper (Playwright) | Playwright | v1.40+ | Best-in-class performance |
| Cache | Redis | 7-alpine | Fast, lightweight |
| Database | PostgreSQL | 15-alpine | ACID compliance, existing |
| Monitoring | Prometheus + Grafana | Latest | Industry standard |
| Container Runtime | Docker + Compose | Latest | Development simplicity |
| Orchestration (Prod) | Kubernetes or ECS | - | Future consideration |

### Appendix B: Environment Variables Reference

```bash
# Orchestrator
ORCHESTRATOR_PORT=8080
PUPPETEER_SERVICE_URL=http://scraper-puppeteer:3001
PLAYWRIGHT_SERVICE_URL=http://scraper-playwright:3002
REDIS_URL=redis://redis:6379
DATABASE_URL=postgresql://postgres:5432/asksuite
PLAYWRIGHT_TRAFFIC_PERCENTAGE=20
CIRCUIT_BREAKER_ENABLED=true
CIRCUIT_BREAKER_THRESHOLD=5
CIRCUIT_BREAKER_TIMEOUT=30000
FALLBACK_ENABLED=true
CACHE_TTL=3600
LOG_LEVEL=info

# Scrapers
SCRAPER_PORT=3001
SCRAPER_TIMEOUT=60000
MAX_CONCURRENT_SCRAPES=5

# Feature Flags
FEATURE_COMPARISON_MODE=false  # Shadow mode
FEATURE_MOCK_FALLBACK=false    # Use mock data as last resort
```

### Appendix C: API Endpoints

**Orchestrator (External):**
- `POST /search` - Main search endpoint
- `GET /health` - Aggregated health status
- `GET /search/history` - Search history
- `GET /search/statistics` - Provider comparison stats
- `GET /metrics` - Prometheus metrics
- `POST /admin/circuit-breaker/reset` - Manual CB reset (auth required)

**Scrapers (Internal):**
- `POST /scrape` - Execute scraping
- `GET /health` - Service health

### Appendix D: Glossary

- **Circuit Breaker:** Pattern that prevents cascading failures by stopping requests to failing services
- **Canary Deployment:** Gradual rollout to subset of users to detect issues early
- **Shadow Mode:** Running new code alongside old without serving responses, for comparison
- **Fallback:** Alternative action when primary operation fails
- **A/B Test:** Comparing two variants by splitting traffic
- **Horizontal Scaling:** Adding more instances vs increasing instance size (vertical)
- **MTTR:** Mean Time To Recovery - average time to fix an incident

---

## Document Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-11-12 | Architecture Team | Initial proposal |

---

## Approval Sign-off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Engineering Lead | | | |
| DevOps Lead | | | |
| Product Manager | | | |
| CTO/VP Engineering | | | |

---

**Next Steps:**
1. Review this document with stakeholders
2. Schedule technical deep-dive session
3. Obtain approvals
4. Assign engineering resources
5. Kick off Phase 1 implementation

**Questions or Concerns:** Contact Architecture Team at [architecture@company.com]
