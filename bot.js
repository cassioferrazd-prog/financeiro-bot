// =============================================
// BOT FINANCEIRO WHATSAPP - VERSÃO AVANÇADA
// Edição, relatório por período, gráfico ASCII
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
        return new Date(a, m-1, d).toISOString();
    }
    if (partes.length === 2) {
        const [d, m] = partes.map(Number);
        return new Date(anoAtual, m-1, d).toISOString();
    }
    return null;
}

function formatData(iso) {
    const d = new Date(iso);
    return d.toISOString().slice(0,10).split('-').reverse().join('/');
}

// ==================== FUNÇÕES CORE ====================
function saldoTotal() {
    const dados = carregarDados();
    return dados.reduce((acc, item) => acc + (item.tipo === 'entrada' ? item.valor : -item.valor), 0);
}

function resumoPeriodo(inicioIso, fimIso) {
    const dados = carregarDados();
    let entrada = 0, saida = 0;
    for (const item of dados) {
        if (item.data >= inicioIso && item.data <= fimIso) {
            if (item.tipo === 'entrada') entrada += item.valor;
            if (item.tipo === 'saida') saida += item.valor;
        }
    }
    return `📊 RELATÓRIO PERÍODO (${formatData(inicioIso)} a ${formatData(fimIso)})

💰 Entradas: R$ ${entrada.toFixed(2)}
💸 Saídas:   R$ ${saida.toFixed(2)}
📈 Saldo:     R$ ${(entrada - saida).toFixed(2)}`;
}

function graficoCategoriasMes() {
    const dados = carregarDados();
    const mesAtual = new Date().toISOString().slice(0,7);
    const cat = {};
    let totalSaida = 0;

    for (const item of dados) {
        if (item.data.startsWith(mesAtual) && item.tipo === 'saida') {
            cat[item.categoria] = (cat[item.categoria] || 0) + item.valor;
            totalSaida += item.valor;
        }
    }

    if (totalSaida === 0) return 'Sem despesas no mês para gráfico.';

    const maxBar = 20; // comprimento máximo da barra
    let texto = '📊 GRAFICO DE GASTOS DO MÊS (barras ASCII)\n\n';

    Object.entries(cat)
        .sort((a,b) => b[1] - a[1])
        .forEach(([cat, val]) => {
            const percent = val / totalSaida;
            const barLength = Math.round(percent * maxBar);
            const bar = '█'.repeat(barLength) + ' '.repeat(maxBar - barLength);
            texto += `${cat.padEnd(15)} | ${bar} R$ ${val.toFixed(2)} (${(percent*100).toFixed(0)}%)\n`;
        });

    texto += `\nTotal saídas: R$ ${totalSaida.toFixed(2)}`;
    return texto;
}

function ultimosLancamentos() {
    const dados = carregarDados();
    if (dados.length === 0) return 'Nenhum lançamento.';
    const ult = dados.slice(-10).reverse();
    let texto = '📋 ÚLTIMOS LANÇAMENTOS (ID | data | tipo | valor | categoria)\n\n';
    ult.forEach((item, idx) => {
        const realId = dados.length - 10 + idx + 1; // ID aproximado (ajuste se deletar)
        const tipo = item.tipo === 'entrada' ? 'VENDA' : 'GASTO';
        texto += `${realId.toString().padStart(3)} | ${formatData(item.data)} | ${tipo} | ${item.valor.toFixed(2)} | ${item.categoria}\n`;
    });
    texto += '\nUse o ID do "ultimos" para editar: editar ID novo_valor [nova_categoria] [nova_data]';
    return texto;
}

// ==================== CLIENT ====================
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { headless: true, args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu'] }
});

client.on('qr', qr => { console.log('QR:'); qrcode.generate(qr, {small:true}); });
client.on('ready', () => console.log('✅ Conectado!'));

client.on('message_create', async msg => {
    if (!msg.fromMe || msg.from.includes('@g.us')) return;

    const texto = msg.body.trim();
    const lower = texto.toLowerCase();
    const partes = lower.split(/\s+/);
    const cmd = partes[0];

    try {
        // Comandos simples
        if (lower === 'saldo') return msg.reply(`💰 Saldo: R$ ${saldoTotal().toFixed(2)}`);
        if (['hoje','relatorio','relatório','categorias','ultimos'].includes(cmd)) {
            if (cmd === 'hoje') return msg.reply(resumoHoje());
            if (['relatorio','relatório'].includes(cmd)) return msg.reply(resumoMes());
            if (cmd === 'categorias') return msg.reply(resumoCategoriasMes());
            if (cmd === 'ultimos') return msg.reply(ultimosLancamentos());
        }

        if (lower.startsWith('relatorio ') || lower.startsWith('relatório ')) {
            const args = texto.split(/\s+/).slice(1);
            if (args.length < 2) return msg.reply('Uso: relatorio DD/MM/AAAA DD/MM/AAAA');
            const ini = parseData(args[0]);
            const fim = parseData(args[1]);
            if (!ini || !fim) return msg.reply('Datas inválidas. Use DD/MM ou DD/MM/AAAA');
            if (ini > fim) return msg.reply('Data inicial maior que final.');
            return msg.reply(resumoPeriodo(ini, fim));
        }

        if (lower === 'grafico') {
            return msg.reply(graficoCategoriasMes());
        }

        if (cmd === 'editar') {
            const [, idStr, novoValorStr, ...resto] = partes;
            const id = parseInt(idStr);
            const novoValor = parseFloat(novoValorStr?.replace(',','.'));
            if (isNaN(id) || isNaN(novoValor) || novoValor <= 0) {
                return msg.reply('Uso: editar ID novo_valor [nova_categoria] [nova_data]\nEx: editar 3 1200 aluguel 20/03');
            }

            const dados = carregarDados();
            if (id < 1 || id > dados.length) return msg.reply('ID inválido. Veja com "ultimos"');

            const item = dados[id-1]; // 1-based para usuário
            item.valor = novoValor;

            if (resto.length > 0) {
                const possData = resto[resto.length-1];
                const parsed = parseData(possData);
                if (parsed) {
                    item.data = parsed;
                    resto.pop(); // remove data
                }
                if (resto.length > 0) item.categoria = resto.join(' ');
            }

            salvarDados(dados);
            return msg.reply(`✅ Lançamento #${id} atualizado!\nNovo valor: R$ ${novoValor.toFixed(2)}\nCategoria: ${item.categoria}\nData: ${formatData(item.data)}`);
        }

        // Lançamentos (mantém a lógica anterior com data opcional)
        // ... (copie aqui a parte de venda / gasto / despesa do código anterior)

        // Se chegou aqui → comando desconhecido
        msg.reply('Comando não reconhecido. Digite "ajuda" para ver opções.');

    } catch (err) {
        console.error(err);
        msg.reply('❌ Erro. Tente novamente.');
    }
});

cron.schedule('*/14 * * * *', () => http.get('http://localhost:3000/ping', () => {}).on('error', () => {}));
client.initialize();
console.log('🚀 Iniciado!');