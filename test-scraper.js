const puppeteer = require('puppeteer');

async function testScraper() {
    console.log('🚀 Iniciando teste de scraping...\n');

    const url = 'https://reservations3.fasthotel.com.br/188/214?entrada=2025-12-01&saida=2025-12-03&adultos=1#acomodacoes';
    console.log(`📍 URL: ${url}\n`);

    let browser = null;

    try {
        console.log('🌐 Abrindo navegador...');
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ]
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

        console.log('📄 Navegando para página...');
        await page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: 60000
        });

        console.log('⏳ Aguardando página carregar...');
        await page.waitForTimeout(5000);

        console.log('🔍 Inspecionando estrutura da página...\n');

        // Primeiro, vamos ver quais elementos existem na página
        const pageInfo = await page.evaluate(() => {
            const allIds = Array.from(document.querySelectorAll('[id]'))
                .map(el => el.id)
                .filter(id => id);

            const allClasses = Array.from(document.querySelectorAll('[class*="room"], [class*="quarto"], [class*="acomodacao"], [class*="tipo"]'))
                .map(el => `${el.tagName}.${el.className}`)
                .filter((v, i, a) => a.indexOf(v) === i)
                .slice(0, 20);

            const bodyHTML = document.body.innerHTML.substring(0, 2000);

            return {
                title: document.title,
                url: window.location.href,
                allIds: allIds.slice(0, 30),
                allClasses,
                bodyHTML
            };
        });

        console.log('📊 Informações da página:');
        console.log(`   - Título: ${pageInfo.title}`);
        console.log(`   - URL: ${pageInfo.url}`);
        console.log(`   - IDs encontrados: ${JSON.stringify(pageInfo.allIds, null, 2)}`);
        console.log(`   - Classes relevantes: ${JSON.stringify(pageInfo.allClasses, null, 2)}`);
        console.log(`   - Sample HTML: ${pageInfo.bodyHTML.substring(0, 500)}...\n`);

        // Primeiro: descobrir TODOS os containers de quartos
        const containerInfo = await page.evaluate(() => {
            const containers = document.querySelectorAll('.item_acomodacao, .quarto, [class*="quarto"], [class*="item"]');
            return {
                count: containers.length,
                sample: containers[0]?.outerHTML?.substring(0, 800)
            };
        });

        console.log(`🔍 Containers encontrados: ${containerInfo.count}`);
        console.log(`📝 Sample container HTML:\n${containerInfo.sample}\n`);

        const rooms = await page.evaluate(() => {
            // Tentar diferentes seletores de container
            const possibleContainers = [
                '.item_acomodacao',
                '[class*="item_acomodacao"]',
                '.quarto',
                '[class*="quarto"]'
            ];

            let containers = [];
            for (const selector of possibleContainers) {
                containers = document.querySelectorAll(selector);
                if (containers.length > 0) {
                    console.log(`✅ Usando seletor: "${selector}" (${containers.length} containers)`);
                    break;
                }
            }

            const results = [];
            containers.forEach((container, index) => {
                try {
                    // Tentar diferentes seletores para nome
                    const nameElement = container.querySelector('.titulo, .nome, h3, h4, strong, [class*="titulo"]');
                    const name = nameElement?.textContent?.trim() || `Quarto ${index + 1}`;

                    // Descrição
                    const descElement = container.querySelector('.descricao, .quarto.descricao, p, [class*="descricao"]');
                    const description = descElement?.textContent?.trim() || '';

                    // Preço
                    const priceElement = container.querySelector('.valor, .price, .preco, [class*="valor"], [class*="preco"]');
                    const price = priceElement?.textContent?.trim() || '';

                    // Imagem
                    const imgElement = container.querySelector('img');
                    const image = imgElement?.src || imgElement?.dataset?.src || imgElement?.getAttribute('data-src') || '';

                    results.push({ name, description, price, image });
                } catch (err) {
                    console.error(`Erro no container ${index}:`, err);
                }
            });

            return results;
        });

        console.log(`✅ Scraping concluído!`);
        console.log(`📦 Quartos encontrados: ${rooms.length}\n`);

        if (rooms.length > 0) {
            console.log('🏨 Amostra dos quartos:');
            rooms.slice(0, 3).forEach((room, i) => {
                console.log(`\n   ${i + 1}. ${room.name}`);
                console.log(`      Preço: ${room.price}`);
                console.log(`      Descrição: ${room.description?.substring(0, 80)}...`);
            });
        } else {
            console.log('⚠️  Nenhum quarto encontrado. Vou salvar screenshot para debug...');
            await page.screenshot({ path: '/app/debug-screenshot.png', fullPage: true });
            console.log('📸 Screenshot salvo em: /app/debug-screenshot.png');
        }

        await browser.close();
        return rooms;

    } catch (error) {
        console.error('❌ Erro:', error.message);
        if (browser) await browser.close();
        throw error;
    }
}

testScraper()
    .then(rooms => {
        console.log(`\n✅ Teste finalizado com sucesso!`);
        process.exit(0);
    })
    .catch(err => {
        console.error(`\n❌ Teste falhou:`, err);
        process.exit(1);
    });
