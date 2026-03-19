// =============================================
// BOT FINANCEIRO WHATSAPP - VERSÃO CORRIGIDA E DEBUG
// Railway - março 2026
// =============================================

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const express = require('express');
const cron = require('node-cron');
const http = require('http');

const app = express();
app.get('/', (req, res) => res.send('🤖 Bot financeiro rodando!'));
app.get('/ping', (req, res) => res.status(200).send('pong ' + new Date().toISOString()));
app.listen(3000, '0.0.0.0', () => console.log('🌐 Servidor HTTP ativo na porta 3000'));

const arquivo = 'dados.json';
if (!fs.existsSync(arquivo)) fs.writeFileSync(arquivo, JSON.stringify([]));

function carregarDados() { return JSON.parse(fs.readFileSync(arquivo, 'utf8')); }
function salvarDados(dados) { fs.writeFileSync(arquivo, JSON.stringify(dados, null, 2)); }

// ==================== MANIPULAÇÃO DE DATA ====================
function parseData(dataStr) {
    if (!dataStr) return new Date().toISOString();
    const hoje = new Date();
    const anoAtual = hoje.getFullYear();

    if (/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) return new Date(dataStr).toISOString();

    const partes = dataStr.split('/');
    if (partes.length === 3) {
        const [d, m, a] = partes.map(Number);
        return new Date(a, m - 1, d).toISOString();
    }
    if (partes.length === 2) {
        const [d, m] = partes.map(Number);
        return new Date(anoAtual, m - 1, d).toISOString();
    }
    return null;
}

function formatData(iso) {
    if (!iso) return 'sem data';
    const d = new Date(iso);
    return d.toISOString().slice(0, 10).split('-').reverse().join('/');
}

// ==================== FUNÇÕES DE RELATÓRIO ====================
function saldoTotal() {
    const dados = carregarDados();
    return dados.reduce((acc, item) => acc + (item.tipo === 'entrada' ? item.valor : -item.valor), 0);
}

function resumoMes() {
    const dados = carregarDados();
    const mesAtual = new Date().toISOString().slice(0, 7);
    let entrada = 0, saida = 0;
    for (const item of dados) {
        if (item.data.startsWith(mesAtual)) {
            if (item.tipo === 'entrada') entrada += item.valor;
            if (item.tipo === 'saida') saida += item.valor;
        }
    }
    const saldo = entrada - saida;
    return `📊 RELATÓRIO DO MÊS (${mesAtual})\n\n💰 Entradas: R$ ${entrada.toFixed(2)}\n💸 Saídas: R$ ${saida.toFixed(2)}\n📈 Saldo: R$ ${saldo.toFixed(2)}`;
}

function resumoHoje() {
    const dados = carregarDados();
    const hoje = new Date().toISOString().slice(0, 10);
    let entrada = 0, saida = 0;
    for (const item of dados) {
        if (item.data.startsWith(hoje)) {
            if (item.tipo === 'entrada') entrada += item.valor;
            if (item.tipo === 'saida') saida += item.valor;
        }
    }
    const saldo = entrada - saida;
    return `📅 HOJE (${hoje})\n\n💰 Entradas: R$ ${entrada.toFixed(2)}\n💸 Saídas: R$ ${saida.toFixed(2)}\n📈 Resultado: R$ ${saldo.toFixed(2)}`;
}

function resumoCategoriasMes() {
    const dados = carregarDados();
    const mesAtual = new Date().toISOString().slice(0, 7);
    const categorias = {};
    for (const item of dados) {
        if (item.data.startsWith(mesAtual) && item.tipo === 'saida') {
            categorias[item.categoria] = (categorias[item.categoria] || 0) + item.valor;
        }
    }
    const nomes = Object.keys(categorias);
    if (nomes.length === 0) return 'Nenhuma despesa registrada este mês.';
    let texto = '📂 CATEGORIAS DO MÊS\n';
    for (const nome of nomes.sort()) {
        texto += `\n• ${nome}: R$ ${categorias[nome].toFixed(2)}`;
    }
    return texto;
}

function graficoCategoriasMes() {
    const dados = carregarDados();
    const mesAtual = new Date().toISOString().slice(0, 7);
    const cat = {};
    let totalSaida = 0;

    for (const item of dados) {
        if (item.data.startsWith(mesAtual) && item.tipo === 'saida') {
            cat[item.categoria] = (cat[item.categoria] || 0) + item.valor;
            totalSaida += item.valor;
        }
    }

    if (totalSaida === 0) return 'Sem despesas no mês para gráfico.';

    const maxBar = 20;
    let texto = '📊 GRAFICO GASTOS DO MÊS (ASCII)\n\n';
    Object.entries(cat)
        .sort((a, b) => b[1] - a[1])
        .forEach(([catNome, val]) => {
            const percent = val / totalSaida;
            const barLength = Math.round(percent * maxBar);
            const bar = '█'.repeat(barLength) + ' '.repeat(maxBar - barLength);
            texto += `${catNome.padEnd(15)} | ${bar} R$ ${val.toFixed(2)} (${(percent * 100).toFixed(0)}%)\n`;
        });
    texto += `\nTotal saídas: R$ ${totalSaida.toFixed(2)}`;
    return texto;
}

function ultimosLancamentos() {
    const dados = carregarDados();
    if (dados.length === 0) return 'Nenhum lançamento ainda.';
    const ult = dados.slice(-10).reverse();
    let texto = '📋 ÚLTIMOS 10 LANÇAMENTOS\n(ID | data | tipo | valor | categoria)\n\n';
    ult.forEach((item, idx) => {
        const id = dados.length - 10 + idx + 1;
        const tipo = item.tipo === 'entrada' ? 'VENDA' : 'GASTO';
        texto += `${id.toString().padStart(3)} | ${formatData(item.data)} | ${tipo} | ${item.valor.toFixed(2)} | ${item.categoria}\n`;
    });
    texto += '\nUse o ID para editar: editar ID novo_valor [nova_categoria] [nova_data]';
    return texto;
}

// ==================== WHATSAPP CLIENT ====================
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] }
});

client.on('qr', qr => {
    console.log('📱 Escaneie o QR Code abaixo:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ WhatsApp conectado com sucesso!');
});

client.on('message_create', async msg => {
    // Log de debug para ver exatamente o que chega
    console.log('Mensagem recebida:', {
        body: msg.body,
        from: msg.from,
        fromMe: msg.fromMe,
        isGroup: msg.from.includes('@g.us')
    });

    // Removido temporariamente a restrição !fromMe para testes
    // if (!msg.fromMe || msg.from.includes('@g.us')) return;

    try {
        const texto = (msg.body || '').trim();
        const lower = texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // remove acentos

        if (!texto) return;

        console.log('Comando processado (lower):', lower);

        // Comandos tolerantes
        if (lower.includes('saldo')) {
            return msg.reply(`💰 Saldo atual: R$ ${saldoTotal().toFixed(2)}`);
        }

        if (lower.includes('hoje')) {
            return msg.reply(resumoHoje());
        }

        if (lower.includes('relatorio') || lower.includes('relatório')) {
            return msg.reply(resumoMes());
        }

        if (lower.includes('categorias')) {
            return msg.reply(resumoCategoriasMes());
        }

        if (lower.includes('grafico') || lower.includes('gráfico')) {
            return msg.reply(graficoCategoriasMes());
        }

        if (lower.includes('ultimos') || lower.includes('últimos')) {
            return msg.reply(ultimosLancamentos());
        }

        if (lower.includes('ajuda') || lower.includes('help')) {
            return msg.reply(`📋 COMANDOS DO BOT

💰 saldo
📅 hoje
📊 relatorio  (mês atual)
📂 categorias
📊 grafico
📋 ultimos

✅ Registrar
venda 350
venda 350 18/03
gasto 45 uber
despesa 1200 aluguel 15/03

🛠️ editar ID novo_valor [categoria] [data]

Digite qualquer comando acima.`);
        }

        // Aqui você pode adicionar novamente os comandos de lançamento (venda, gasto, editar)
        // por enquanto deixei comentado para isolar o problema

        // Se nenhum comando bater → resposta padrão
        msg.reply('Comando não reconhecido.\nDigite "ajuda" para ver os comandos disponíveis.');

    } catch (err) {
        console.error('Erro no processamento:', err);
        msg.reply('❌ Ocorreu um erro interno. Tente novamente.');
    }
});

cron.schedule('*/14 * * * *', () => http.get('http://localhost:3000/ping', () => {}).on('error', () => {}));
client.initialize();
console.log('🚀 Bot financeiro iniciado!');