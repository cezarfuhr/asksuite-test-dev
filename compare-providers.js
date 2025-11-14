const http = require('http');

const testParams = {
  checkin: '2026-01-15',
  checkout: '2026-01-17',
  adults: 2
};

function callProvider(provider, attempt) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(testParams);

    const options = {
      hostname: provider === 'puppeteer' ? 'scraper-puppeteer' : 'scraper-playwright',
      port: provider === 'puppeteer' ? 3001 : 3002,
      path: '/scrape',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      },
      timeout: 30000
    };

    const startTime = Date.now();

    const req = http.request(options, (res) => {
      let body = '';

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        const endTime = Date.now();
        try {
          const result = JSON.parse(body);
          resolve({
            provider,
            attempt,
            executionTime: endTime - startTime,
            statusCode: res.statusCode,
            result
          });
        } catch (e) {
          resolve({
            provider,
            attempt,
            executionTime: endTime - startTime,
            statusCode: res.statusCode,
            error: 'Failed to parse JSON',
            body
          });
        }
      });
    });

    req.on('error', (e) => {
      resolve({
        provider,
        attempt,
        error: e.message,
        executionTime: Date.now() - startTime
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        provider,
        attempt,
        error: 'Request timeout',
        executionTime: 30000
      });
    });

    req.write(data);
    req.end();
  });
}

async function runTests() {
  console.log('🧪 COMPARATIVE TEST: Puppeteer vs Playwright\n');
  console.log('📅 Test Parameters:');
  console.log(`   Check-in: ${testParams.checkin}`);
  console.log(`   Check-out: ${testParams.checkout}`);
  console.log(`   Adults: ${testParams.adults}\n`);
  console.log('='.repeat(80));
  console.log('\n');

  const results = {
    puppeteer: [],
    playwright: []
  };

  // Test Puppeteer - 2 attempts
  console.log('🤖 Testing PUPPETEER (2 attempts)...\n');
  for (let i = 1; i <= 2; i++) {
    console.log(`   Attempt ${i}/2...`);
    const result = await callProvider('puppeteer', i);
    results.puppeteer.push(result);

    if (result.error) {
      console.log(`   ❌ Error: ${result.error}`);
    } else if (result.result?.success) {
      console.log(`   ✅ Success - ${result.result.data?.length || 0} rooms - ${result.executionTime}ms`);
      if (result.result.meta?.warnings?.length > 0) {
        console.log(`   ⚠️  Warnings: ${result.result.meta.warnings.join(', ')}`);
      }
    } else {
      console.log(`   ❌ Failed - ${result.result?.error || 'Unknown error'}`);
    }
  }

  console.log('\n' + '='.repeat(80) + '\n');

  // Test Playwright - 2 attempts
  console.log('🎭 Testing PLAYWRIGHT (2 attempts)...\n');
  for (let i = 1; i <= 2; i++) {
    console.log(`   Attempt ${i}/2...`);
    const result = await callProvider('playwright', i);
    results.playwright.push(result);

    if (result.error) {
      console.log(`   ❌ Error: ${result.error}`);
    } else if (result.result?.success) {
      console.log(`   ✅ Success - ${result.result.data?.length || 0} rooms - ${result.executionTime}ms`);
      if (result.result.meta?.warnings?.length > 0) {
        console.log(`   ⚠️  Warnings: ${result.result.meta.warnings.join(', ')}`);
      }
    } else {
      console.log(`   ❌ Failed - ${result.result?.error || 'Unknown error'}`);
    }
  }

  console.log('\n' + '='.repeat(80) + '\n');

  // Analysis
  console.log('📊 COMPARATIVE ANALYSIS\n');

  // Puppeteer stats
  const puppeteerSuccess = results.puppeteer.filter(r => r.result?.success).length;
  const puppeteerAvgTime = results.puppeteer
    .filter(r => r.result?.success)
    .reduce((sum, r) => sum + r.executionTime, 0) / (puppeteerSuccess || 1);
  const puppeteerRooms = results.puppeteer
    .filter(r => r.result?.success)
    .map(r => r.result.data?.length || 0);

  console.log('🤖 PUPPETEER:');
  console.log(`   Success Rate: ${puppeteerSuccess}/2 (${puppeteerSuccess * 50}%)`);
  if (puppeteerSuccess > 0) {
    console.log(`   Avg Execution Time: ${puppeteerAvgTime.toFixed(0)}ms`);
    console.log(`   Rooms Found: ${puppeteerRooms.join(', ')}`);
  }

  // Playwright stats
  const playwrightSuccess = results.playwright.filter(r => r.result?.success).length;
  const playwrightAvgTime = results.playwright
    .filter(r => r.result?.success)
    .reduce((sum, r) => sum + r.executionTime, 0) / (playwrightSuccess || 1);
  const playwrightRooms = results.playwright
    .filter(r => r.result?.success)
    .map(r => r.result.data?.length || 0);

  console.log('\n🎭 PLAYWRIGHT:');
  console.log(`   Success Rate: ${playwrightSuccess}/2 (${playwrightSuccess * 50}%)`);
  if (playwrightSuccess > 0) {
    console.log(`   Avg Execution Time: ${playwrightAvgTime.toFixed(0)}ms`);
    console.log(`   Rooms Found: ${playwrightRooms.join(', ')}`);
  } else {
    const errors = results.playwright.map(r => r.error || r.result?.error).filter(Boolean);
    console.log(`   Errors: ${[...new Set(errors)].join(', ')}`);
  }

  console.log('\n' + '='.repeat(80) + '\n');

  // Save detailed results
  const fs = require('fs');
  fs.writeFileSync('/tmp/comparison-results.json', JSON.stringify(results, null, 2));
  console.log('💾 Detailed results saved to: /tmp/comparison-results.json\n');

  // Conclusion
  console.log('🎯 CONCLUSION:\n');
  if (puppeteerSuccess > playwrightSuccess) {
    console.log('   ✅ Puppeteer is more reliable');
  } else if (playwrightSuccess > puppeteerSuccess) {
    console.log('   ✅ Playwright is more reliable');
  } else if (puppeteerSuccess === 0 && playwrightSuccess === 0) {
    console.log('   ❌ Both providers failed');
  } else {
    console.log('   🤝 Both providers equally reliable');
  }

  if (puppeteerSuccess > 0 && playwrightSuccess > 0) {
    const timeDiff = ((puppeteerAvgTime - playwrightAvgTime) / playwrightAvgTime * 100).toFixed(1);
    if (puppeteerAvgTime < playwrightAvgTime) {
      console.log(`   ⚡ Puppeteer is ${Math.abs(timeDiff)}% faster`);
    } else {
      console.log(`   ⚡ Playwright is ${Math.abs(timeDiff)}% faster`);
    }
  }
}

runTests().catch(console.error);
