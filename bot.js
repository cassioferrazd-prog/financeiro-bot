const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

const ARQUIVO_DADOS = 'dados.json';

if (!fs.existsSync(ARQUIVO_DADOS)) {
    fs.writeFileSync(ARQUIVO_DADOS, JSON.stringify([]));
}

function lerDados() {
    return JSON.parse(fs.readFileSync(ARQUIVO_DADOS, 'utf8'));
}

function salvarDados(dados) {
    fs.writeFileSync(ARQUIVO_DADOS, JSON.stringify(dados, null, 2));
}

function normalizarTexto(texto) {
    return texto
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

function detectarCategoria(tipoComando, descricao) {
    const d = normalizarTexto(descricao);

    if (tipoComando === 'venda') return 'venda';

    if (tipoComando === 'compra') {
        if (d.includes('fornecedor')) return 'fornecedor';
        if (d.includes('estoque')) return 'estoque';
        if (d.includes('mercadoria')) return 'mercadoria';
        return 'compra';
    }

    if (tipoComando === 'despesa') {
        if (d.includes('aluguel')) return 'aluguel';
        if (d.includes('internet')) return 'internet';
        if (d.includes('salario')) return 'salario';
        if (d.includes('energia')) return 'energia';
        if (d.includes('agua')) return 'agua';
        return 'despesa fixa';
    }

    if (tipoComando === 'gasto') {
        if (d.includes('feira')) return 'feira';
        if (d.includes('gasolina')) return 'gasolina';
        if (d.includes('transporte')) return 'transporte';
        if (
            d.includes('almoco') ||
            d.includes('lanche') ||
            d.includes('alimentacao') ||
            d.includes('comida')
        ) {
            return 'alimentacao';
        }
        return 'variados';
    }

    return 'outros';
}

function mapearTipoFinanceiro(tipoComando) {
    if (tipoComando === 'venda') return 'entrada';
    return 'saida';
}

function adicionarLancamento(tipoComando, valor, descricao, dataManual = null) {
    const dados = lerDados();

    const data = dataManual
        ? new Date(dataManual.split('/').reverse().join('-'))
        : new Date();

    const categoria = detectarCategoria(tipoComando, descricao);
    const tipo = mapearTipoFinanceiro(tipoComando);

    dados.push({
        data: data.toISOString(),
        tipo,
        origem: tipoComando,
        valor,
        descricao,
        categoria
    });

    salvarDados(dados);
}

function saldoTotal() {
    const dados = lerDados();
    let total = 0;

    for (const item of dados) {
        if (item.tipo === 'entrada') total += item.valor;
        else total -= item.valor;
    }

    return total;
}

function filtrarPeriodo(periodo) {
    const dados = lerDados();
    const agora = new Date();

    return dados.filter(item => {
        const data = new Date(item.data);

        if (periodo === 'dia') {
            return data.toDateString() === agora.toDateString();
        }

        if (periodo === 'semana') {
            const inicio = new Date(agora);
            inicio.setDate(agora.getDate() - 7);
            return data >= inicio;
        }

        if (periodo === 'mes') {
            return (
                data.getMonth() === agora.getMonth() &&
                data.getFullYear() === agora.getFullYear()
            );
        }

        return false;
    });
}

function resumirPeriodo(periodo) {
    const dados = filtrarPeriodo(periodo);

    let vendas = 0;
    let compras = 0;
    let despesasFixas = 0;
    let gastosVariaveis = 0;

    let qtdVendas = 0;
    let qtdCompras = 0;
    let qtdDespesas = 0;
    let qtdGastos = 0;

    for (const item of dados) {
        if (item.origem === 'venda') {
            vendas += item.valor;
            qtdVendas++;
        }

        if (item.origem === 'compra') {
            compras += item.valor;
            qtdCompras++;
        }

        if (item.origem === 'despesa') {
            despesasFixas += item.valor;
            qtdDespesas++;
        }

        if (item.origem === 'gasto') {
            gastosVariaveis += item.valor;
            qtdGastos++;
        }
    }

    const totalSaidas = compras + despesasFixas + gastosVariaveis;
    const saldo = vendas - totalSaidas;

    const titulo =
        periodo === 'dia' ? 'RESUMO DO DIA' :
        periodo === 'semana' ? 'RESUMO DA SEMANA' :
        'RESUMO DO MÊS';

    return `📊 ${titulo}

💵 Vendas: R$ ${vendas.toFixed(2)}
   • lançamentos: ${qtdVendas}

📦 Compras de mercadoria: R$ ${compras.toFixed(2)}
   • lançamentos: ${qtdCompras}

🏠 Despesas fixas: R$ ${despesasFixas.toFixed(2)}
   • lançamentos: ${qtdDespesas}

🧾 Gastos variáveis: R$ ${gastosVariaveis.toFixed(2)}
   • lançamentos: ${qtdGastos}

📉 Total de saídas: R$ ${totalSaidas.toFixed(2)}
💰 Saldo: R$ ${saldo.toFixed(2)}`;
}

function resumoCategoriasMes() {
    const dados = filtrarPeriodo('mes');
    const categorias = {};

    for (const item of dados) {
        if (item.tipo === 'saida') {
            if (!categorias[item.categoria]) {
                categorias[item.categoria] = 0;
            }
            categorias[item.categoria] += item.valor;
        }
    }

    const nomes = Object.keys(categorias);

    if (nomes.length === 0) {
        return '📂 CATEGORIAS DO MÊS\n\nNenhuma saída registrada.';
    }

    nomes.sort((a, b) => categorias[b] - categorias[a]);

    let texto = '📂 CATEGORIAS DO MÊS\n';

    for (const nome of nomes) {
        texto += \n• ${nome}: R$ ${categorias[nome].toFixed(2)};
    }

    return texto;
}

function ultimosLancamentos(periodo) {
    const dados = filtrarPeriodo(periodo);

    if (dados.length === 0) {
        return '📋 Nenhum lançamento encontrado nesse período.';
    }

    const ordenados = [...dados]
        .sort((a, b) => new Date(b.data) - new Date(a.data))
        .slice(0, 10);

    let texto = '📋 ÚLTIMOS LANÇAMENTOS\n';

    for (const item of ordenados) {
        const data = new Date(item.data).toLocaleDateString('pt-BR');
        texto += \n• ${data} | ${item.origem} | R$ ${item.valor.toFixed(2)} | ${item.categoria};
        if (item.descricao) {
            texto += ` | ${item.descricao}`;
        }
    }

    return texto;
}

function textoAjuda() {
    return `🤖 COMANDOS

📊 Consultas
* saldo
* dia
* semana
* mes
* relatorio
* categorias
* lancamentos dia
* lancamentos semana
* lancamentos mes
* ajuda

💵 Vendas
* venda 350

📦 Compras de mercadoria
* compra 700 mercadoria

🏠 Despesas fixas
* despesa 1200 aluguel
* despesa 99 internet
* despesa 1800 salario funcionario

🧾 Gastos variáveis
* gasto 85 feira
* gasto 40 gasolina
* gasto 25 lanche

📅 Com data manual
* 18/03/2026 venda 350
* 18/03/2026 compra 700 mercadoria
* 18/03/2026 despesa 99 internet
* 18/03/2026 gasto 25 lanche`;
}

function interpretarLancamento(textoOriginal) {
    const texto = normalizarTexto(textoOriginal);
    const palavras = texto.split(/\s+/);

    let dataManual = null;

    if (palavras[0] && palavras[0].includes('/')) {
        dataManual = palavras[0];
        palavras.shift();
    }

    const comando = palavras[0];
    const valorTexto = palavras[1];

    if (!['venda', 'compra', 'despesa', 'gasto'].includes(comando)) {
        return { ignorar: true };
    }

    const valor = parseFloat((valorTexto || '').replace(',', '.'));

    if (isNaN(valor)) {
        return { erro: '❌ Valor inválido.\n\nExemplo: venda 350' };
    }

    const descricao = palavras.slice(2).join(' ').trim();

    adicionarLancamento(comando, valor, descricao, dataManual);

    return { sucessoSilencioso: true };
}

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', qr => {
    console.log('================================');
    console.log('ESCANEIE O QR CODE ABAIXO');
    console.log('================================');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ WhatsApp conectado!');
});

client.on('authenticated', () => {
    console.log('🔐 Autenticado com sucesso!');
});

client.on('auth_failure', msg => {
    console.log('❌ Falha na autenticação:', msg);
});

client.on('disconnected', reason => {
    console.log('⚠️ WhatsApp desconectado:', reason);
});

const mensagensProcessadas = new Set();

async function processarMensagem(msg, origemEvento) {
    try {
        const id = msg.id?._serialized || ${origemEvento}-${Date.now()};

        if (mensagensProcessadas.has(id)) return;
        mensagensProcessadas.add(id);

        console.log('-----------------------------');
        console.log('EVENTO:', origemEvento);
        console.log('FROM:', msg.from);
        console.log('TO:', msg.to);
        console.log('FROM_ME:', msg.fromMe);
        console.log('BODY:', msg.body);
        console.log('-----------------------------');

        if (msg.from && msg.from.includes('@g.us')) return;

        const textoBruto = (msg.body || '').trim();
        const texto = normalizarTexto(textoBruto);

        if (!texto) return;

        if (texto === 'saldo') {
            await msg.reply(💰 *SALDO ATUAL*\n\nR$ ${saldoTotal().toFixed(2)});
            return;
        }

        if (texto === 'dia' || texto === 'hoje') {
            await msg.reply(resumirPeriodo('dia'));
            return;
        }

        if (texto === 'semana') {
            await msg.reply(resumirPeriodo('semana'));
            return;
        }

        if (
            texto === 'mes' ||
            texto === 'relatorio' ||
            texto === 'relatorio do mes' ||
            texto === 'relatorio do mes atual'
        ) {
            await msg.reply(resumirPeriodo('mes'));
            return;
        }

        if (texto === 'categorias') {
            await msg.reply(resumoCategoriasMes());
            return;
        }

        if (texto === 'lancamentos dia') {
            await msg.reply(ultimosLancamentos('dia'));
            return;
        }

        if (texto === 'lancamentos semana') {
            await msg.reply(ultimosLancamentos('semana'));
            return;
        }

        if (texto === 'lancamentos mes') {
            await msg.reply(ultimosLancamentos('mes'));
            return;
        }

        if (texto === 'ajuda' || texto === 'comandos') {
            await msg.reply(textoAjuda());
            return;
        }

        const resultado = interpretarLancamento(textoBruto);

        if (resultado.erro) {
            await msg.reply(resultado.erro);
            return;
        }

        if (resultado.sucessoSilencioso) {
            return;
        }

    } catch (erro) {
        console.error('ERRO AO PROCESSAR MENSAGEM:', erro);
    }
}

client.on('message', async msg => {
    await processarMensagem(msg, 'message');
});

client.on('message_create', async msg => {
    await processarMensagem(msg, 'message_create');
});

client.initialize();