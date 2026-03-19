// =============================================
// 📊 BOT FINANCEIRO WHATSAPP - VERSÃO MELHORADA
// Lançamentos diários com data automática + manual
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

// ==================== FUNÇÃO PARA TRATAR DATA ====================
function parseData(dataStr) {
    if (!dataStr) return new Date().toISOString(); // data automática = hoje

    const hoje = new Date();
    const anoAtual = hoje.getFullYear();

    // Formato 1: YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) return new Date(dataStr).toISOString();

    // Formato 2: DD/MM/AAAA ou DD/MM
    const partes = dataStr.split('/');
    if (partes.length === 3) {
        const [dia, mes, ano] = partes.map(Number);
        return new Date(ano, mes-1, dia).toISOString();
    }
    if (partes.length === 2) {
        const [dia, mes] = partes.map(Number);
        return new Date(anoAtual, mes-1, dia).toISOString();
    }

    return null; // data inválida
}

// ==================== FUNÇÕES DE RELATÓRIO ====================
function saldoTotal() {
    const dados = carregarDados();
    let saldo = 0;
    for (const item of dados) {
        if (item.tipo === 'entrada') saldo += item.valor;
        if (item.tipo === 'saida') saldo -= item.valor;
    }
    return saldo;
}

function resumoMes() { /* mesma função anterior */ 
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

function resumoHoje() { /* mesma função anterior */ 
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

function resumoCategoriasMes() { /* mesma função anterior */ 
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

function ultimosLancamentos() {
    const dados = carregarDados();
    if (dados.length === 0) return 'Nenhum lançamento ainda.';
    const ultimos = dados.slice(-10).reverse();
    let texto = '📋 ÚLTIMOS 10 LANÇAMENTOS\n\n';
    for (const item of ultimos) {
        const data = item.data.slice(0,10);
        const tipo = item.tipo === 'entrada' ? '✅ VENDA' : '❌ GASTO';
        texto += `${data} | ${tipo} | R$ ${item.valor.toFixed(2)} | ${item.categoria}\n`;
    }
    return texto;
}

// ==================== CLIENT WHATSAPP ====================
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] }
});

client.on('qr', qr => { console.log('📱 Escaneie o QR Code abaixo:'); qrcode.generate(qr, { small: true }); });
client.on('ready', () => console.log('✅ WhatsApp conectado com sucesso!'));

client.on('message_create', async msg => {
    if (!msg.fromMe || msg.from.includes('@g.us')) return;

    try {
        const texto = msg.body.toLowerCase().trim();
        const partes = texto.split(/\s+/);
        const comando = partes[0];

        // ===================== CONSULTAS =====================
        if (texto === 'saldo') return msg.reply(`💰 Saldo atual: R$ ${saldoTotal().toFixed(2)}`);
        if (['relatorio', 'relatório'].includes(texto)) return msg.reply(resumoMes());
        if (texto === 'hoje') return msg.reply(resumoHoje());
        if (texto === 'categorias') return msg.reply(resumoCategoriasMes());
        if (texto === 'ultimos') return msg.reply(ultimosLancamentos());

        if (['ajuda', 'help'].includes(texto)) {
            return msg.reply(`📋 *COMANDOS DO BOT FINANCEIRO*

💰 saldo
📊 relatorio
📅 hoje
📂 categorias
📋 ultimos

✅ Vendas (data automática ou manual)
venda 350
venda 350 18/03/2026
venda 350 2026-03-18

✅ Gastos
gasto 45 cafe
gasto 120 aluguel 15/03
despesa 700 mercadoria 2026-03-18

🛠️ !limpar (zera tudo)

Digite ajuda a qualquer momento.`);
        }

        // ===================== LANÇAMENTOS =====================
        const valorStr = partes[1];
        const valor = parseFloat(valorStr?.replace(',', '.'));
        if (isNaN(valor) || valor <= 0) {
            if (['venda','compra','despesa','gasto'].includes(comando)) {
                return msg.reply('❌ Valor inválido! Exemplo: venda 350');
            }
        }

        let dataLancamento = null;
        let categoria = '';

        // Pega a data se o último argumento for uma data válida
        const possivelData = partes[partes.length - 1];
        if (/^\d{1,2}\/\d{1,2}(\/\d{4})?$|^\d{4}-\d{2}-\d{2}$/.test(possivelData)) {
            dataLancamento = parseData(possivelData);
            if (!dataLancamento) return msg.reply('❌ Data inválida! Use DD/MM, DD/MM/AAAA ou AAAA-MM-DD');
            
            // O resto é categoria (se houver)
            categoria = partes.slice(2, -1).join(' ') || 'outros';
        } else {
            dataLancamento = new Date().toISOString();
            categoria = partes.slice(2).join(' ') || 'outros';
        }

        const dados = carregarDados();

        if (comando === 'venda') {
            dados.push({ tipo: 'entrada', categoria: 'venda', valor, data: dataLancamento });
            salvarDados(dados);
            const dataFormatada = dataLancamento.slice(0,10);
            return msg.reply(`✅ Venda registrada!\n💰 R$ ${valor.toFixed(2)} • ${dataFormatada}`);
        }

        if (['compra', 'despesa', 'gasto'].includes(comando)) {
            dados.push({ tipo: 'saida', categoria, valor, data: dataLancamento });
            salvarDados(dados);
            const dataFormatada = dataLancamento.slice(0,10);
            const nome = comando.charAt(0).toUpperCase() + comando.slice(1);
            return msg.reply(`✅ ${nome} registrado!\n💸 R$ ${valor.toFixed(2)} • ${categoria} • ${dataFormatada}`);
        }

    } catch (err) {
        console.error(err);
        msg.reply('❌ Erro interno. Tente novamente.');
    }
});

cron.schedule('*/14 * * * *', () => http.get('http://localhost:3000/ping', () => {}).on('error', () => {}));
client.initialize();
console.log('🚀 Bot financeiro iniciado!');