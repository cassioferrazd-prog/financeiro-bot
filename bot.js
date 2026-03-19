// =============================================
// 📊 BOT FINANCEIRO WHATSAPP - VERSÃO CORRIGIDA
// Railway compatível - março 2026
// =============================================

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const express = require('express');
const cron = require('node-cron');
const http = require('http');

const app = express();

// ==================== SERVIDOR HTTP (opcional para ping) ====================
app.get('/', (req, res) => res.send('🤖 Bot financeiro rodando!'));
app.get('/ping', (req, res) => res.status(200).send('pong ' + new Date().toISOString()));

app.listen(3000, '0.0.0.0', () => {
    console.log('🌐 Servidor HTTP ativo na porta 3000');
});

// ==================== ARQUIVO DE DADOS ====================
const arquivo = 'dados.json';

if (!fs.existsSync(arquivo)) {
    fs.writeFileSync(arquivo, JSON.stringify([]));
}

function carregarDados() {
    return JSON.parse(fs.readFileSync(arquivo, 'utf8'));
}

function salvarDados(dados) {
    fs.writeFileSync(arquivo, JSON.stringify(dados, null, 2));
}

// ==================== FUNÇÕES ÚTEIS ====================
function hoje() {
    return new Date().toISOString().slice(0, 10);
}

function saldoTotal() {
    const dados = carregarDados();
    let saldo = 0;
    for (const item of dados) {
        if (item.tipo === 'entrada') saldo += item.valor;
        if (item.tipo === 'saida') saldo -= item.valor;
    }
    return saldo;
}

function resumoMes() {
    const dados = carregarDados();
    const mesAtual = new Date().toISOString().slice(0, 7);

    let entrada = 0;
    let saida = 0;

    for (const item of dados) {
        if (item.data.startsWith(mesAtual)) {
            if (item.tipo === 'entrada') entrada += item.valor;
            if (item.tipo === 'saida') saida += item.valor;
        }
    }

    const saldo = entrada - saida;
    return `📊 RELATÓRIO DO MÊS (${mesAtual})

💰 Entradas: R$ ${entrada.toFixed(2)}
💸 Saídas:   R$ ${saida.toFixed(2)}
📈 Saldo:     R$ ${saldo.toFixed(2)}`;
}

function resumoHoje() {
    const dados = carregarDados();
    const dataHoje = hoje();

    let entrada = 0;
    let saida = 0;

    for (const item of dados) {
        if (item.data.startsWith(dataHoje)) {
            if (item.tipo === 'entrada') entrada += item.valor;
            if (item.tipo === 'saida') saida += item.valor;
        }
    }

    const saldo = entrada - saida;
    return `📅 HOJE (${dataHoje})

💰 Entradas: R$ ${entrada.toFixed(2)}
💸 Saídas:   R$ ${saida.toFixed(2)}
📈 Resultado: R$ ${saldo.toFixed(2)}`;
}

function resumoCategoriasMes() {
    const dados = carregarDados();
    const mesAtual = new Date().toISOString().slice(0, 7);
    const categorias = {};

    for (const item of dados) {
        if (item.data.startsWith(mesAtual) && item.tipo === 'saida') {
            if (!categorias[item.categoria]) categorias[item.categoria] = 0;
            categorias[item.categoria] += item.valor;
        }
    }

    const nomes = Object.keys(categorias);
    if (nomes.length === 0) return 'Nenhuma despesa registrada este mês.';

    let texto = '📂 CATEGORIAS DO MÊS\n';

    for (const nome of nomes.sort()) {
        texto += `\n• ${nome}: R$ ${categorias[nome].toFixed(2)}`;  // corrigido: backticks
    }

    return texto;
}

// ==================== WHATSAPP CLIENT ====================
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ]
    }
});

client.on('qr', qr => {
    console.log('📱 Escaneie o QR Code abaixo:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ WhatsApp conectado com sucesso!');
});

// ==================== PROCESSAMENTO DE COMANDOS ====================
client.on('message_create', async msg => {
    if (!msg.fromMe) return;
    if (msg.from.includes('@g.us')) return;

    try {
        const texto = msg.body.toLowerCase().trim();
        if (!texto) return;

        const partes = texto.split(/\s+/);
        const comando = partes[0];

        // Comandos de consulta
        if (texto === 'saldo') {
            msg.reply(`💰 Saldo atual: R$ ${saldoTotal().toFixed(2)}`);
            return;
        }

        if (texto === 'relatorio' || texto === 'relatório') {
            msg.reply(resumoMes());
            return;
        }

        if (texto === 'hoje') {
            msg.reply(resumoHoje());
            return;
        }

        if (texto === 'categorias') {
            msg.reply(resumoCategoriasMes());
            return;
        }

        if (texto === 'ajuda' || texto === 'help') {
            msg.reply(`📋 *COMANDOS DO BOT FINANCEIRO*

💰 *saldo*
📊 *relatorio*
📅 *hoje*
📂 *categorias*

✅ *Registrar entrada*
venda 350

✅ *Registrar saída*
compra 700 mercadoria
despesa 1200 aluguel
gasto 40 gasolina

🛠️ *Extra*
!limpar → zera todos os dados (cuidado!)

Digite *ajuda* a qualquer momento.`);
            return;
        }

        // Limpar dados
        if (texto === '!limpar') {
            fs.writeFileSync(arquivo, '[]');
            msg.reply('🗑️ *Todos os registros foram apagados!*');
            return;
        }

        // Registrar venda
        if (comando === 'venda') {
            if (partes.length < 2) {
                msg.reply('❌ Uso: *venda 350* ou *venda 350,50*');
                return;
            }
            const valor = parseFloat(partes[1].replace(',', '.'));
            if (isNaN(valor) || valor <= 0) {
                msg.reply('❌ Valor inválido! Exemplo: venda 350,50');
                return;
            }

            const dados = carregarDados();
            dados.push({
                tipo: 'entrada',
                categoria: 'venda',
                valor: valor,
                data: new Date().toISOString()
            });
            salvarDados(dados);

            msg.reply(`✅ *Venda registrada!*\n💰 R$ ${valor.toFixed(2)}`);
            return;
        }

        // Registrar saída
        if (['compra', 'despesa', 'gasto'].includes(comando)) {
            if (partes.length < 2) {
                msg.reply(`❌ Uso: *${comando} 150,00 [categoria opcional]*`);
                return;
            }
            const valor = parseFloat(partes[1].replace(',', '.'));
            if (isNaN(valor) || valor <= 0) {
                msg.reply('❌ Valor inválido!');
                return;
            }

            const categoria = partes.slice(2).join(' ') ||
                              (comando === 'gasto' ? 'outros' : comando);

            const dados = carregarDados();
            dados.push({
                tipo: 'saida',
                categoria: categoria,
                valor: valor,
                data: new Date().toISOString()
            });
            salvarDados(dados);

            const nomeComando = comando.charAt(0).toUpperCase() + comando.slice(1);
            msg.reply(`✅ *${nomeComando} registrada!*\n💸 R$ ${valor.toFixed(2)} • ${categoria}`);
            return;
        }

    } catch (err) {
        console.error('Erro ao processar comando:', err);
        msg.reply('❌ Ocorreu um erro interno. Tente novamente.');
    }
});

// ==================== SELF-PING (opcional) ====================
cron.schedule('*/14 * * * *', () => {
    http.get('http://localhost:3000/ping', () => {
        // console.log('Self-ping OK');
    }).on('error', (err) => {
        console.error('Self-ping falhou:', err.message);
    });
});

// ==================== INICIALIZAÇÃO ====================
client.initialize();

console.log('🚀 Bot financeiro iniciado! Aguarde o QR Code...');