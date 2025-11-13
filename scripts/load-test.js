const http = require('http');

// Load test configuration
const config = {
  orchestratorHost: process.env.ORCHESTRATOR_HOST || 'localhost',
  orchestratorPort: process.env.ORCHESTRATOR_PORT || 8080,
  concurrentUsers: parseInt(process.env.CONCURRENT_USERS || '10', 10),
  requestsPerUser: parseInt(process.env.REQUESTS_PER_USER || '5', 10),
  delayBetweenRequests: parseInt(process.env.DELAY_MS || '1000', 10)
};

// Test data
const testParams = {
  checkin: '2025-12-01',
  checkout: '2025-12-03',
  adults: 2
};

// Metrics
const metrics = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  totalResponseTime: 0,
  responseTimes: [],
  providerStats: {
    puppeteer: { count: 0, totalTime: 0 },
    playwright: { count: 0, totalTime: 0 }
  },
  errors: {}
};

// Make HTTP request
function makeRequest() {
  return new Promise((resolve) => {
    const postData = JSON.stringify(testParams);
    const startTime = Date.now();

    const options = {
      hostname: config.orchestratorHost,
      port: config.orchestratorPort,
      path: '/search',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const responseTime = Date.now() - startTime;
        metrics.totalRequests++;
        metrics.totalResponseTime += responseTime;
        metrics.responseTimes.push(responseTime);

        try {
          const result = JSON.parse(data);

          if (result.success) {
            metrics.successfulRequests++;

            // Track provider usage
            if (result.meta && result.meta.provider) {
              const provider = result.meta.provider;
              if (!metrics.providerStats[provider]) {
                metrics.providerStats[provider] = { count: 0, totalTime: 0 };
              }
              metrics.providerStats[provider].count++;
              metrics.providerStats[provider].totalTime += result.meta.executionTime || 0;
            }
          } else {
            metrics.failedRequests++;
            const errorCode = result.error?.code || 'UNKNOWN';
            metrics.errors[errorCode] = (metrics.errors[errorCode] || 0) + 1;
          }
        } catch (e) {
          metrics.failedRequests++;
          metrics.errors['PARSE_ERROR'] = (metrics.errors['PARSE_ERROR'] || 0) + 1;
        }

        resolve();
      });
    });

    req.on('error', (error) => {
      const responseTime = Date.now() - startTime;
      metrics.totalRequests++;
      metrics.failedRequests++;
      metrics.totalResponseTime += responseTime;
      metrics.responseTimes.push(responseTime);
      metrics.errors['NETWORK_ERROR'] = (metrics.errors['NETWORK_ERROR'] || 0) + 1;
      resolve();
    });

    req.write(postData);
    req.end();
  });
}

// Simulate user
async function simulateUser(userId) {
  console.log(`[User ${userId}] Starting...`);

  for (let i = 0; i < config.requestsPerUser; i++) {
    await makeRequest();
    console.log(`[User ${userId}] Completed request ${i + 1}/${config.requestsPerUser}`);

    if (i < config.requestsPerUser - 1) {
      await new Promise(resolve => setTimeout(resolve, config.delayBetweenRequests));
    }
  }

  console.log(`[User ${userId}] Finished`);
}

// Calculate statistics
function calculateStats() {
  const sortedTimes = metrics.responseTimes.sort((a, b) => a - b);
  const p50 = sortedTimes[Math.floor(sortedTimes.length * 0.5)];
  const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)];
  const p99 = sortedTimes[Math.floor(sortedTimes.length * 0.99)];

  return {
    totalRequests: metrics.totalRequests,
    successfulRequests: metrics.successfulRequests,
    failedRequests: metrics.failedRequests,
    successRate: ((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(2) + '%',
    averageResponseTime: (metrics.totalResponseTime / metrics.totalRequests).toFixed(0) + 'ms',
    p50ResponseTime: p50 + 'ms',
    p95ResponseTime: p95 + 'ms',
    p99ResponseTime: p99 + 'ms',
    providerDistribution: Object.entries(metrics.providerStats).map(([provider, stats]) => ({
      provider,
      requests: stats.count,
      percentage: ((stats.count / metrics.successfulRequests) * 100).toFixed(2) + '%',
      avgExecutionTime: stats.count > 0 ? (stats.totalTime / stats.count).toFixed(0) + 'ms' : '0ms'
    })),
    errors: metrics.errors
  };
}

// Main execution
async function runLoadTest() {
  console.log('========================================');
  console.log('Load Test Configuration');
  console.log('========================================');
  console.log(`Orchestrator: http://${config.orchestratorHost}:${config.orchestratorPort}`);
  console.log(`Concurrent Users: ${config.concurrentUsers}`);
  console.log(`Requests per User: ${config.requestsPerUser}`);
  console.log(`Total Requests: ${config.concurrentUsers * config.requestsPerUser}`);
  console.log(`Delay between requests: ${config.delayBetweenRequests}ms`);
  console.log('========================================\n');

  const startTime = Date.now();

  // Run all users concurrently
  const users = [];
  for (let i = 1; i <= config.concurrentUsers; i++) {
    users.push(simulateUser(i));
  }

  await Promise.all(users);

  const totalTime = Date.now() - startTime;

  console.log('\n========================================');
  console.log('Load Test Results');
  console.log('========================================');
  console.log(`Total Duration: ${(totalTime / 1000).toFixed(2)}s`);
  console.log(`Requests per Second: ${(metrics.totalRequests / (totalTime / 1000)).toFixed(2)}`);
  console.log('');

  const stats = calculateStats();
  console.log('Requests:');
  console.log(`  Total: ${stats.totalRequests}`);
  console.log(`  Successful: ${stats.successfulRequests}`);
  console.log(`  Failed: ${stats.failedRequests}`);
  console.log(`  Success Rate: ${stats.successRate}`);
  console.log('');

  console.log('Response Times:');
  console.log(`  Average: ${stats.averageResponseTime}`);
  console.log(`  P50: ${stats.p50ResponseTime}`);
  console.log(`  P95: ${stats.p95ResponseTime}`);
  console.log(`  P99: ${stats.p99ResponseTime}`);
  console.log('');

  console.log('Provider Distribution (A/B Testing):');
  stats.providerDistribution.forEach(p => {
    console.log(`  ${p.provider}: ${p.requests} requests (${p.percentage}) - Avg: ${p.avgExecutionTime}`);
  });
  console.log('');

  if (Object.keys(stats.errors).length > 0) {
    console.log('Errors:');
    Object.entries(stats.errors).forEach(([code, count]) => {
      console.log(`  ${code}: ${count}`);
    });
    console.log('');
  }

  console.log('========================================');

  // Exit with error if too many failures
  if (metrics.failedRequests / metrics.totalRequests > 0.1) {
    console.log('❌ Load test FAILED: Error rate > 10%');
    process.exit(1);
  } else {
    console.log('✅ Load test PASSED');
    process.exit(0);
  }
}

runLoadTest().catch(error => {
  console.error('Load test error:', error);
  process.exit(1);
});
