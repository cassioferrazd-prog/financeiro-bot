// =============================================
// BOT FINANCEIRO WHATSAPP - VERSÃO CORRIGIDA (sem repetições)
// Debug + comandos tolerantes + testes facilitados
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

// ==================== FUNÇÕES DE DATA ====================
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

// ==================== RELATÓRIOS ====================
function saldoTotal() {
    const dados = carregarDados();
    return dados.reduce((acc, item) => acc + (item.tipo === 'entrada' ? item.valor : -item.valor), 0);
}

function resumoMes() {
    const dados = carregarDados();
    const mesAtual = new Date().toISOString().slice(0, 7);
    let entrada = 0, saida = 0;
    dados.forEach(item => {
        if (item.data.startsWith(mesAtual)) {
            if (item.tipo === 'entrada') entrada += item.valor;
            if (item.tipo === 'saida') saida += item.valor;
        }
    });
    const saldo = entrada - saida;
    return `📊 RELATÓRIO DO MÊS (${mesAtual})\n\n💰 Entradas: R$ ${entrada.toFixed(2)}\n💸 Saídas: R$ ${saida.toFixed(2)}\n📈 Saldo: R$ ${saldo.toFixed(2)}`;
}

function resumoHoje() {
    const dados = carregarDados();
    const hoje = new Date().toISOString().slice(0, 10);
    let entrada = 0, saida = 0;
    dados.forEach(item => {
        if (item.data.startsWith(hoje)) {
            if (item.tipo === 'entrada') entrada += item.valor;
            if (item.tipo === 'saida') saida += item.valor;
        }
    });
    const saldo = entrada - saida;
    return `📅 HOJE (${hoje})\n\n💰 Entradas: R$ ${entrada.toFixed(2)}\n💸 Saídas: R$ ${saida.toFixed(2)}\n📈 Resultado: R$ ${saldo.toFixed(2)}`;
}

function resumoCategoriasMes() {
    const dados = carregarDados();
    const mesAtual = new Date().toISOString().slice(0, 7);
    const categorias = {};
    dados.forEach(item => {
        if (item.data.startsWith(mesAtual) && item.tipo === 'saida') {
            categorias[item.categoria] = (categorias[item.categoria] || 0) + item.valor;
        }
    });
    const nomes = Object.keys(categorias);
    if (nomes.length === 0) return 'Nenhuma despesa este mês.';
    let texto = '📂 CATEGORIAS DO MÊS\n';
    nomes.sort().forEach(nome => {
        texto += `\n• ${nome}: R$ ${categorias[nome].toFixed(2)}`;
    });
    return texto;
}

function graficoCategoriasMes() {
    const dados = carregarDados();
    const mesAtual = new Date().toISOString().slice(0, 7);
    const cat = {};
    let total = 0;
    dados.forEach(item => {
        if (item.data.startsWith(mesAtual) && item.tipo === 'saida') {
            cat[item.categoria] = (cat[item.categoria] || 0) + item.valor;
            total += item.valor;
        }
    });
    if (total === 0) return 'Sem gastos para gráfico.';
    const max = 20;
    let texto = '📊 GRAFICO GASTOS MÊS\n\n';
    Object.entries(cat).sort((a,b) => b[1]-a[1]).forEach(([nome, val]) => {
        const pct = val / total;
        const tam = Math.round(pct * max);
        const bar = '█'.repeat(tam) + ' '.repeat(max - tam);
        texto += `${nome.padEnd(12)} | ${bar} R$ ${val.toFixed(2)}\n`;
    });
    texto += `\nTotal: R$ ${total.toFixed(2)}`;
    return texto;
}

function ultimosLancamentos() {
    const dados = carregarDados();
    if (dados.length === 0) return 'Nenhum lançamento.';
    const ult = dados.slice(-10).reverse();
    let texto = '📋 ÚLTIMOS 10\n(ID | data | tipo | valor | cat)\n\n';
    ult.forEach((item, i) => {
        const id = dados.length - 10 + i + 1;
        const tipo = item.tipo === 'entrada' ? 'VENDA' : 'GASTO';
        texto += `${id} | ${formatData(item.data)} | ${tipo} | ${item.valor.toFixed(2)} | ${item.categoria}\n`;
    });
    texto += '\nEditar: editar ID novo_valor [cat] [data]';
    return texto;
}

// ==================== CLIENT ====================
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] }
});

client.on('qr', qr => {
    console.log('QR CODE:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => console.log('✅ Conectado!'));

client.on('message_create', async msg => {
    console.log('Mensagem recebida →', {
        body: msg.body,
        from: msg.from,
        fromMe: msg.fromMe,
        isGroup: msg.from.includes('@g.us')
    });

    // Temporariamente removida restrição para testes
    // if (!msg.fromMe || msg.from.includes('@g.us')) return;

    try {
        const texto = (msg.body || '').trim();
        if (!texto) return;

        const cmd = texto.toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        console.log('Comando normalizado:', cmd);

        // Comandos tolerantes
        if (cmd.includes('saldo')) {
            return msg.reply(`💰 Saldo: R$ ${saldoTotal().toFixed(2)}`);
        }

        if (cmd.includes('hoje')) {
            return msg.reply(resumoHoje());
        }

        if (cmd.includes('relatorio') || cmd.includes('relatório')) {
            return msg.reply(resumoMes());
        }

        if (cmd.includes('categorias')) {
            return msg.reply(resumoCategoriasMes());
        }

        if (cmd.includes('grafico') || cmd.includes('gráfico')) {
            return msg.reply(graficoCategoriasMes());
        }

        if (cmd.includes('ultimos') || cmd.includes('últimos')) {
            return msg.reply(ultimosLancamentos());
        }

        if (cmd.includes('ajuda') || cmd.includes('help')) {
            return msg.reply(`📋 COMANDOS

• saldo
• hoje
• relatorio
• categorias
• grafico
• ultimos
• ajuda

Registrar:
venda 350
gasto 80 uber 15/03

Editar:
editar 3 500 luz 20/03`);
        }

        // Resposta padrão se nenhum comando bater
        msg.reply('Não entendi o comando.\nDigite "ajuda" para ver as opções.');

    } catch (err) {
        console.error('Erro:', err.message);
        msg.reply('❌ Erro interno. Tente novamente.');
    }
});

cron.schedule('*/14 * * * *', () => http.get('http://localhost:3000/ping', () => {}).on('error', () => {}));
client.initialize();
console.log('🚀 Iniciado!');