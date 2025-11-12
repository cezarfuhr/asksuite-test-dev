const puppeteer = require('puppeteer');

async function testScraper() {
    console.log('🚀 Teste Scraper V3 - Buscar Tipos de Acomodação\n');

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

        console.log('🔍 Buscando tipos de acomodação...\n');

        const rooms = await page.evaluate(() => {
            // O site usa cards de tipos - vamos buscar por elementos que tenham:
            // 1. data-campo="valor" (preço)
            // 2. Uma estrutura de card/panel

            const roomCards = [];

            // Buscar todos os elementos com preço
            const priceElements = document.querySelectorAll('[data-campo="valor"]');

            priceElements.forEach((priceEl, index) => {
                try {
                    // Subir no DOM para achar o container pai (card/panel)
                    let container = priceEl.closest('.panel, .card, .list-group-item, [class*="tipo"]');

                    if (!container) {
                        // Se não achou, pegar 3 níveis acima
                        container = priceEl.parentElement?.parentElement?.parentElement;
                    }

                    if (!container) return;

                    // Extrair nome do tipo - geralmente em h3, h4, strong ou [data-campo="nome"]
                    const nameEl = container.querySelector('[data-campo="nome"], h3, h4, strong, b');
                    const name = nameEl?.textContent?.trim() || `Tipo ${index + 1}`;

                    // Preço
                    const price = priceEl.textContent?.trim() || '';

                    // Descrição
                    const descEl = container.querySelector('[data-campo="descricao"], .descricao, p');
                    const description = descEl?.textContent?.trim() || '';

                    // Imagem
                    const imgEl = container.querySelector('img');
                    const image = imgEl?.src || imgEl?.getAttribute('data-src') || '';

                    // Características
                    const caracteristicas = container.querySelector('[data-campo="caracteristicas"], .caracteristicas');
                    const details = caracteristicas?.textContent?.trim() || '';

                    // HTML sample para debug
                    const htmlSample = container.outerHTML?.substring(0, 500);

                    roomCards.push({
                        name,
                        price,
                        description: description || details,
                        image,
                        htmlSample
                    });

                } catch (err) {
                    console.error(`Erro no elemento ${index}:`, err.message);
                }
            });

            return roomCards;
        });

        console.log(`✅ Encontrados ${rooms.length} quartos\n`);

        if (rooms.length > 0) {
            console.log('🏨 QUARTOS ENCONTRADOS:\n');
            rooms.forEach((room, i) => {
                console.log(`${i + 1}. ${room.name}`);
                console.log(`   💰 Preço: ${room.price}`);
                console.log(`   📝 Descrição: ${room.description?.substring(0, 100)}${room.description?.length > 100 ? '...' : ''}`);
                console.log(`   🖼️  Imagem: ${room.image ? 'SIM' : 'NÃO'}`);
                console.log(`   📦 HTML: ${room.htmlSample?.substring(0, 150)}...\n`);
            });
        } else {
            console.log('⚠️  Nenhum quarto encontrado!');
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
    .then((rooms) => {
        console.log(`\n✅ Teste concluído! Total: ${rooms.length} quartos`);
        process.exit(0);
    })
    .catch(err => {
        console.error('\n❌ Teste falhou:', err);
        process.exit(1);
    });
