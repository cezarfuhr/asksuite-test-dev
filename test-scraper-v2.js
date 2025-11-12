const puppeteer = require('puppeteer');

async function testScraper() {
    console.log('🚀 Teste Scraper V2 - Análise Detalhada\n');

    const url = 'https://reservations3.fasthotel.com.br/188/214?entrada=2025-12-01&saida=2025-12-03&adultos=1';
    let browser = null;

    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

        console.log('📄 Navegando...');
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        await page.waitForTimeout(5000);

        console.log('🔍 Analisando estrutura HTML...\n');

        // Análise focada em elementos com preço (R$)
        const analysis = await page.evaluate(() => {
            // 1. Buscar TODOS os elementos que contenham "R$"
            const allElements = document.querySelectorAll('*');
            const elementsWithPrice = [];

            allElements.forEach(el => {
                const text = el.textContent?.trim() || '';
                if (text.includes('R$') && text.length < 500) {
                    elementsWithPrice.push({
                        tag: el.tagName,
                        class: el.className,
                        id: el.id,
                        text: text.substring(0, 150),
                        html: el.outerHTML?.substring(0, 300)
                    });
                }
            });

            // 2. Buscar containers pai de elementos com preço
            const priceContainers = Array.from(document.querySelectorAll('[class*="acomodacao"], [class*="tipo"]'));

            return {
                elementsWithPrice: elementsWithPrice.slice(0, 10),
                priceContainersCount: priceContainers.length,
                sampleContainer: priceContainers[0]?.outerHTML?.substring(0, 1000)
            };
        });

        console.log('💰 Elementos com "R$":');
        console.log(JSON.stringify(analysis.elementsWithPrice, null, 2));

        console.log(`\n📦 Containers com "acomodacao/tipo": ${analysis.priceContainersCount}`);
        console.log(`\n📝 Sample container:\n${analysis.sampleContainer}\n`);

        await page.screenshot({ path: '/app/debug-screenshot.png', fullPage: true });
        console.log('📸 Screenshot salvo em /app/debug-screenshot.png');

        await browser.close();
        return analysis;

    } catch (error) {
        console.error('❌ Erro:', error.message);
        if (browser) await browser.close();
        throw error;
    }
}

testScraper()
    .then(() => {
        console.log('\n✅ Análise concluída!');
        process.exit(0);
    })
    .catch(err => {
        console.error('\n❌ Análise falhou:', err);
        process.exit(1);
    });
