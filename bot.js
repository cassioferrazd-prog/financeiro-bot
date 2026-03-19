// =============================================
// BOT FINANCEIRO WHATSAPP - VERSÃO COMPLETA E ATUALIZADA
// Lançamentos com data auto/manual, editar, grafico ASCII, relatorio periodo
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

function resumoPeriodo(inicioStr, fimStr) {
    const inicio = parseData(inicioStr);
    const fim = parseData(fimStr);
    if (!inicio || !fim || inicio > fim) return 'Datas inválidas ou início maior que fim.';

    const dados = carregarDados();
    let entrada = 0, saida = 0;
    for (const item of dados) {
        if (item.data >= inicio && item.data <= fim) {
            if (item.tipo === 'entrada') entrada += item.valor;
            if (item.tipo === 'saida') saida += item.valor;
        }
    }
    const saldo = entrada - saida;
    return `📊 RELATÓRIO PERÍODO (${formatData(inicio)} a ${formatData(fim)})\n\n💰 Entradas: R$ ${entrada.toFixed(2)}\n💸 Saídas: R$ ${saida.toFixed(2)}\n📈 Saldo: R$ ${saldo.toFixed(2)}`;
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
    if (!msg.fromMe || msg.from.includes('@g.us')) return;

    try {
        const texto = msg.body.trim();
        const lower = texto.toLowerCase();
        const partes = lower.split(/\s+/);
        const comando = partes[0];

        // ===================== COMANDOS DE CONSULTA =====================
        if (lower === 'saldo') return msg.reply(`💰 Saldo atual: R$ ${saldoTotal().toFixed(2)}`);
        if (lower === 'hoje') return msg.reply(resumoHoje());
        if (['relatorio', 'relatório'].includes(comando)) {
            if (partes.length === 1) return msg.reply(resumoMes());
            if (partes.length === 3) return msg.reply(resumoPeriodo(partes[1], partes[2]));
            return msg.reply('Uso: relatorio [inicio] [fim]  ou apenas relatorio (mês atual)');
        }
        if (lower === 'categorias') return msg.reply(resumoCategoriasMes());
        if (lower === 'grafico') return msg.reply(graficoCategoriasMes());
        if (lower === 'ultimos') return msg.reply(ultimosLancamentos());

        if (['ajuda', 'help'].includes(lower)) {
            return msg.reply(`📋 COMANDOS DO BOT

💰 saldo
📅 hoje
📊 relatorio  (mês) ou relatorio DD/MM/AAAA DD/MM/AAAA
📂 categorias
📊 grafico
📋 ultimos

✅ Registrar
venda 350
venda 350 18/03/2026
gasto 45 uber
despesa 1200 aluguel 15/03

🛠️ editar ID novo_valor [nova_categoria] [nova_data]
Ex: editar 5 450 transporte 20/03

Digite ajuda a qualquer momento.`);
        }

        // ===================== EDITAR LANÇAMENTO =====================
        if (comando === 'editar') {
            const [, idStr, novoValorStr, ...resto] = partes;
            const id = parseInt(idStr);
            const novoValor = parseFloat(novoValorStr?.replace(',', '.'));
            if (isNaN(id) || isNaN(novoValor) || novoValor <= 0) {
                return msg.reply('Uso: editar ID novo_valor [nova_categoria] [nova_data]\nEx: editar 3 1200 aluguel 20/03');
            }

            const dados = carregarDados();
            if (id < 1 || id > dados.length) return msg.reply('ID inválido. Veja com ultimos');

            const item = dados[id - 1];
            item.valor = novoValor;

            if (resto.length > 0) {
                const possData = resto[resto.length - 1];
                const parsedData = parseData(possData);
                if (parsedData) {
                    item.data = parsedData;
                    resto.pop();
                }
                if (resto.length > 0) item.categoria = resto.join(' ');
            }

            salvarDados(dados);
            return msg.reply(`✅ Lançamento #${id} atualizado!\nValor: R$ ${novoValor.toFixed(2)}\nCategoria: ${item.categoria}\nData: ${formatData(item.data)}`);
        }

        // ===================== REGISTRAR VENDA =====================
        if (comando === 'venda') {
            if (partes.length < 2) return msg.reply('❌ Uso: venda 350 [data opcional]');
            const valor = parseFloat(partes[1].replace(',', '.'));
            if (isNaN(valor) || valor <= 0) return msg.reply('❌ Valor inválido!');

            let dataLancamento = new Date().toISOString();
            if (partes.length > 2) {
                const possData = partes[2];
                const parsed = parseData(possData);
                if (parsed) dataLancamento = parsed;
            }

            const dados = carregarDados();
            dados.push({ tipo: 'entrada', categoria: 'venda', valor, data: dataLancamento });
            salvarDados(dados);

            msg.reply(`✅ Venda registrada!\n💰 R$ ${valor.toFixed(2)} • ${formatData(dataLancamento)}`);
            return;
        }

        // ===================== REGISTRAR SAÍDA =====================
        if (['compra', 'despesa', 'gasto'].includes(comando)) {
            if (partes.length < 2) return msg.reply(`❌ Uso: ${comando} 150 [categoria] [data opcional]`);
            const valor = parseFloat(partes[1].replace(',', '.'));
            if (isNaN(valor) || valor <= 0) return msg.reply('❌ Valor inválido!');

            let categoria = 'outros';
            let dataLancamento = new Date().toISOString();

            if (partes.length > 2) {
                const possData = partes[partes.length - 1];
                const parsed = parseData(possData);
                if (parsed) {
                    dataLancamento = parsed;
                    categoria = partes.slice(2, -1).join(' ') || categoria;
                } else {
                    categoria = partes.slice(2).join(' ') || categoria;
                }
            }

            const dados = carregarDados();
            dados.push({ tipo: 'saida', categoria, valor, data: dataLancamento });
            salvarDados(dados);

            const nome = comando.charAt(0).toUpperCase() + comando.slice(1);
            msg.reply(`✅ ${nome} registrado!\n💸 R$ ${valor.toFixed(2)} • ${categoria} • ${formatData(dataLancamento)}`);
            return;
        }

        msg.reply('Comando não reconhecido. Digite "ajuda"');

    } catch (err) {
        console.error('Erro:', err);
        msg.reply('❌ Ocorreu um erro. Tente novamente.');
    }
});

cron.schedule('*/14 * * * *', () => http.get('http://localhost:3000/ping', () => {}).on('error', () => {}));
client.initialize();
console.log('🚀 Bot financeiro iniciado!');