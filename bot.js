const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

const ARQUIVO_DADOS = 'dados.json';

// cria arquivo se não existir
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
    const t = texto.toLowerCase();

    if (t.includes('gasolina') || t.includes('uber') || t.includes('combustivel') || t.includes('combustível')) {
        return 'Transporte';
    }

    if (t.includes('almoço') || t.includes('almoco') || t.includes('comida') || t.includes('lanche')) {
        return 'Alimentação';
    }

    if (t.includes('frete') || t.includes('entregador') || t.includes('envio')) {
        return 'Logística';
    }

    if (t.includes('fornecedor') || t.includes('mercadoria') || t.includes('estoque')) {
        return 'Estoque';
    }

    if (t.includes('aluguel') || t.includes('energia') || t.includes('internet') || t.includes('agua') || t.includes('água')) {
        return 'Despesas Fixas';
    }

    if (t.includes('vendi') || t.includes('recebi') || t.includes('venda')) {
        return 'Receita';
    }

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

function resumoPeriodo(periodo) {
    const dados = filtrarPeriodo(periodo);

    let entradas = 0;
    let saidas = 0;
    let qtdEntradas = 0;
    let qtdSaidas = 0;

    dados.forEach(item => {
        if (item.tipo === 'entrada') {
            entradas += item.valor;
            qtdEntradas++;
        } else {
            saidas += item.valor;
            qtdSaidas++;
        }
    });

    const saldo = entradas - saidas;
    const titulo =
        periodo === 'dia' ? 'RESUMO DO DIA' :
        periodo === 'semana' ? 'RESUMO DA SEMANA' :
        'RESUMO DO MÊS';

    return `📊 *${titulo}*

💵 Entradas: R$ ${entradas.toFixed(2)}
🧾 Saídas: R$ ${saidas.toFixed(2)}
💰 Saldo: R$ ${saldo.toFixed(2)}

📥 Lançamentos de entrada: ${qtdEntradas}
📤 Lançamentos de saída: ${qtdSaidas}`;
}

function relatorioCategorias() {
    const dados = filtrarPeriodo('mes');
    const categorias = {};

    dados.forEach(item => {
        if (item.tipo === 'saida') {
            if (!categorias[item.categoria]) {
                categorias[item.categoria] = 0;
            }
            categorias[item.categoria] += item.valor;
        }
    });

    const nomes = Object.keys(categorias);

    if (nomes.length === 0) {
        return '📂 *GASTOS POR CATEGORIA*\n\nNenhuma saída registrada neste mês.';
    }

    let texto = '📂 *GASTOS POR CATEGORIA (MÊS)*\n';

    nomes.sort((a, b) => categorias[b] - categorias[a]);

    nomes.forEach(cat => {
        texto += `\n• ${cat}: R$ ${categorias[cat].toFixed(2)}`;
    });

    return texto;
}

function ajuda() {
    return `🤖 *COMANDOS DISPONÍVEIS*

📊 Consultas
• saldo
• dia
• semana
• mes
• relatório
• relatorio
• categorias

💵 Entradas
• vendi 200
• recebi 350 pix
• 18/03/2026 vendi 2000

🧾 Saídas
• gastei 20 almoço
• paguei 100 fornecedor
• 18/03/2026 gastei 10 entregador

ℹ️ Outros
• ajuda`;
}

function interpretarLancamento(textoOriginal) {
    const texto = textoOriginal.trim().toLowerCase();
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
        textoSemData.startsWith('entrada')
    ) {
        tipo = 'entrada';
    } else if (
        textoSemData.includes('gastei') ||
        textoSemData.includes('paguei') ||
        textoSemData.startsWith('saida') ||
        textoSemData.startsWith('saída')
    ) {
        tipo = 'saida';
    } else {
        return { erro: null };
    }

    for (const p of palavras) {
        const numero = parseFloat(p.replace(',', '.'));
        if (!isNaN(numero)) {
            valor = numero;
            break;
        }
    }

    if (!valor) {
        return { erro: '❌ Não encontrei o valor.\n\nExemplo: vendi 200 ou gastei 20 almoço' };
    }

    adicionar(tipo, valor, textoSemData, dataManual);

    const categoria = detectarCategoria(textoSemData);
    const emoji = tipo === 'entrada' ? '✅' : '🧾';
    const rotulo = tipo === 'entrada' ? 'Entrada registrada' : 'Saída registrada';

    return {
        sucesso: `${emoji} *${rotulo}*

📌 Descrição: ${textoSemData}
🏷️ Categoria: ${categoria}
💵 Valor: R$ ${valor.toFixed(2)}
💰 Saldo atual: R$ ${saldoTotal().toFixed(2)}`
    };
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
        const id = msg.id?._serialized || `${origemEvento}-${Date.now()}`;

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

        const texto = (msg.body || '').trim().toLowerCase();

        if (!texto) return;

        if (texto === 'saldo') {
            await msg.reply(`💰 *SALDO ATUAL*\n\nR$ ${saldoTotal().toFixed(2)}`);
            return;
        }

        if (texto === 'dia' || texto === 'hoje') {
            await msg.reply(resumoPeriodo('dia'));
            return;
        }

        if (texto === 'semana') {
            await msg.reply(resumoPeriodo('semana'));
            return;
        }

        if (
            texto === 'mes' ||
            texto === 'mês' ||
            texto === 'relatorio' ||
            texto === 'relatório' ||
            texto === 'relatorio do mes' ||
            texto === 'relatório do mes' ||
            texto === 'relatório do mês' ||
            texto === 'relatorio do mês'
        ) {
            await msg.reply(resumoPeriodo('mes'));
            return;
        }

        if (texto === 'categorias') {
            await msg.reply(relatorioCategorias());
            return;
        }

        if (texto === 'ajuda' || texto === 'comandos') {
            await msg.reply(ajuda());
            return;
        }

        const resultado = interpretarLancamento(texto);

        if (resultado.erro) {
            await msg.reply(resultado.erro);
            return;
        }

        if (resultado.sucesso) {
            await msg.reply(resultado.sucesso);
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