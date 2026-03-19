const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

const ARQUIVO_DADOS = 'dados.json';
const MEU_NUMERO = '5562996132409@c.us';

// cliente WhatsApp
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// cria arquivo de dados se não existir
if (!fs.existsSync(ARQUIVO_DADOS)) {
    fs.writeFileSync(ARQUIVO_DADOS, JSON.stringify([]));
}

function lerDados() {
    return JSON.parse(fs.readFileSync(ARQUIVO_DADOS, 'utf8'));
}

function salvarDados(dados) {
    fs.writeFileSync(ARQUIVO_DADOS, JSON.stringify(dados, null, 2));
}

function detectarCategoria(texto) {
    if (texto.includes('gasolina') || texto.includes('uber')) return 'Transporte';
    if (texto.includes('almoço') || texto.includes('almoco') || texto.includes('comida')) return 'Alimentação';
    if (texto.includes('frete') || texto.includes('entregador')) return 'Logística';
    if (texto.includes('fornecedor')) return 'Estoque';
    if (texto.includes('vendi') || texto.includes('recebi') || texto.includes('venda')) return 'Receita';
    return 'Outros';
}

function adicionar(tipo, valor, descricao, dataManual = null) {
    const dados = lerDados();

    const data = dataManual
        ? new Date(dataManual.split('/').reverse().join('-'))
        : new Date();

    dados.push({
        data: data.toISOString(),
        tipo,
        valor,
        descricao,
        categoria: detectarCategoria(descricao)
    });

    salvarDados(dados);
}

function saldoTotal() {
    const dados = lerDados();
    let total = 0;

    dados.forEach(item => {
        if (item.tipo === 'entrada') total += item.valor;
        else total -= item.valor;
    });

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
            const inicioSemana = new Date(agora);
            inicioSemana.setDate(agora.getDate() - 7);
            return data >= inicioSemana;
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

function resumoPeriodo(periodo) {
    const dados = filtrarPeriodo(periodo);

    let entradas = 0;
    let saidas = 0;

    dados.forEach(item => {
        if (item.tipo === 'entrada') entradas += item.valor;
        else saidas += item.valor;
    });

    return `📊 ${periodo.toUpperCase()}
Entradas: R$ ${entradas}
Saídas: R$ ${saidas}
Saldo: R$ ${entradas - saidas}`;
}

function relatorioCategorias() {
    const dados = lerDados();
    const categorias = {};

    dados.forEach(item => {
        if (item.tipo === 'saida') {
            if (!categorias[item.categoria]) {
                categorias[item.categoria] = 0;
            }
            categorias[item.categoria] += item.valor;
        }
    });

    let texto = '📂 GASTOS POR CATEGORIA\n';

    const nomes = Object.keys(categorias);

    if (nomes.length === 0) {
        return '📂 Nenhum gasto por categoria encontrado.';
    }

    nomes.forEach(cat => {
        texto += `\n${cat}: R$ ${categorias[cat]}`;
    });

    return texto;
}

function exportarRelatorio() {
    const dados = lerDados();

    let texto = 'RELATORIO FINANCEIRO\n\n';
    let entradas = 0;
    let saidas = 0;

    dados.forEach(item => {
        texto += `${item.data} | ${item.tipo} | R$${item.valor} | ${item.categoria} | ${item.descricao}\n`;

        if (item.tipo === 'entrada') entradas += item.valor;
        else saidas += item.valor;
    });

    texto += '\n--- RESUMO ---\n';
    texto += `Entradas: R$ ${entradas}\n`;
    texto += `Saídas: R$ ${saidas}\n`;
    texto += `Saldo: R$ ${entradas - saidas}\n`;

    fs.writeFileSync('relatorio.txt', texto);
}

function interpretarLancamento(textoOriginal) {
    let texto = textoOriginal.trim().toLowerCase();

    if (texto.startsWith('bot')) {
        texto = texto.replace(/^bot/, '').trim();
    }

    const palavras = texto.split(' ');

    let tipo = '';
    let valor = 0;
    let dataManual = null;

    if (palavras[0] && palavras[0].includes('/')) {
        dataManual = palavras[0];
        palavras.shift();
    }

    const textoSemData = palavras.join(' ');

    if (
        textoSemData.includes('vendi') ||
        textoSemData.includes('recebi') ||
        textoSemData.includes('entrada')
    ) {
        tipo = 'entrada';
    } else if (
        textoSemData.includes('gastei') ||
        textoSemData.includes('paguei') ||
        textoSemData.includes('saida') ||
        textoSemData.includes('saída')
    ) {
        tipo = 'saida';
    } else {
        return { erro: '❌ Não entendi a mensagem.' };
    }

    for (const p of palavras) {
        const numero = parseFloat(p.replace(',', '.'));
        if (!isNaN(numero)) {
            valor = numero;
            break;
        }
    }

    if (!valor) {
        return { erro: '❌ Valor não encontrado.' };
    }

    adicionar(tipo, valor, textoSemData, dataManual);

    return {
        sucesso: `✅ Registrado!
💰 Saldo atual: R$ ${saldoTotal()}`
    };
}

// eventos WhatsApp
client.on('qr', qr => {
    console.log('QR RECEIVED');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ WhatsApp conectado!');
});

client.on('authenticated', () => {
    console.log('🔐 Autenticado com sucesso!');
});

client.on('auth_failure', msg => {
    console.error('❌ Falha na autenticação:', msg);
});

client.on('disconnected', reason => {
    console.log('⚠️ WhatsApp desconectado:', reason);
});

client.on('message_create', async msg => {
    try {
        if (msg.from.includes('@g.us')) return;
        if (msg.from !== MEU_NUMERO) return;

        let texto = msg.body.trim().toLowerCase();

        if (!texto.startsWith('bot')) return;

        const comando = texto.replace(/^bot/, '').trim();

        if (comando === 'saldo') {
            await msg.reply(`💰 Saldo: R$ ${saldoTotal()}`);
            return;
        }

        if (
            comando === 'dia' ||
            comando === 'semana' ||
            comando === 'mes' ||
            comando === 'mês'
        ) {
            const periodo = comando === 'mês' ? 'mes' : comando;
            await msg.reply(resumoPeriodo(periodo));
            return;
        }

        if (
            comando.includes('relatorio do mes') ||
            comando.includes('relatório do mes') ||
            comando.includes('relatório do mês') ||
            comando.includes('relatorio do mês') ||
            comando === 'relatorio' ||
            comando === 'relatório'
        ) {
            await msg.reply(resumoPeriodo('mes'));
            return;
        }

        if (comando === 'categorias') {
            await msg.reply(relatorioCategorias());
            return;
        }

        if (comando === 'exportar') {
            exportarRelatorio();
            await msg.reply('📁 Relatório exportado com sucesso em relatorio.txt');
            return;
        }

        const resultado = interpretarLancamento(texto);

        if (resultado.erro) {
            await msg.reply(resultado.erro);
            return;
        }

        if (resultado.sucesso) {
            await msg.reply(resultado.sucesso);
        }
    } catch (erro) {
        console.error('Erro ao processar mensagem:', erro);
        await msg.reply('❌ Ocorreu um erro ao processar a mensagem.');
    }
});

client.initialize();