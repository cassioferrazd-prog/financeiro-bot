const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

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

    return `📊 RELATÓRIO DO MÊS

💰 Entradas: R$ ${entrada.toFixed(2)}
💸 Saídas: R$ ${saida.toFixed(2)}
📈 Saldo: R$ ${saldo.toFixed(2)}`;
}

function resumoHoje() {
    const dados = carregarDados();
    const dataHoje = hoje();

    let entrada = 0;
    let saida = 0;

    for (const item of dados) {
        if (item.data === dataHoje) {
            if (item.tipo === 'entrada') entrada += item.valor;
            if (item.tipo === 'saida') saida += item.valor;
        }
    }

    const saldo = entrada - saida;

    return `📅 HOJE

💰 Entradas: R$ ${entrada.toFixed(2)}
💸 Saídas: R$ ${saida.toFixed(2)}
📈 Resultado: R$ ${saldo.toFixed(2)}`;
}

function resumoCategoriasMes() {
    const dados = carregarDados();
    const mesAtual = new Date().toISOString().slice(0, 7);
    const categorias = {};

    for (const item of dados) {
        if (item.data.startsWith(mesAtual) && item.tipo === 'saida') {
            if (!categorias[item.categoria]) {
                categorias[item.categoria] = 0;
            }
            categorias[item.categoria] += item.valor;
        }
    }

    const nomes = Object.keys(categorias);

    if (nomes.length === 0) {
        return '📂 CATEGORIAS DO MÊS\n\nNenhuma despesa registrada.';
    }

    let texto = '📂 CATEGORIAS DO MÊS\n';

    for (const nome of nomes) {
        texto += \n• ${nome}: R$ ${categorias[nome].toFixed(2)};
    }

    return texto;
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

client.on('message_create', async msg => {
    try {
        if (!msg.fromMe) return;
        if (msg.from.includes('@g.us')) return;

        const texto = msg.body.toLowerCase().trim();
        const partes = texto.split(' ');
        const comando = partes[0];

        if (texto === 'saldo') {
            await msg.reply(💰 Saldo atual: R$ ${saldoTotal().toFixed(2)});
            return;
        }

        if (texto === 'relatorio') {
            await msg.reply(resumoMes());
            return;
        }

        if (texto === 'hoje') {
            await msg.reply(resumoHoje());
            return;
        }

        if (texto === 'categorias') {
            await msg.reply(resumoCategoriasMes());
            return;
        }

        if (comando === 'venda') {
            const valor = parseFloat((partes[1] || '').replace(',', '.'));
            if (isNaN(valor)) return;

            const dados = carregarDados();
            dados.push({
                tipo: 'entrada',
                categoria: 'venda',
                valor: valor,
                data: hoje()
            });
            salvarDados(dados);
            return;
        }

        if (comando === 'compra') {
            const valor = parseFloat((partes[1] || '').replace(',', '.'));
            const categoria = partes.slice(2).join(' ') || 'mercadoria';
            if (isNaN(valor)) return;

            const dados = carregarDados();
            dados.push({
                tipo: 'saida',
                categoria: categoria,
                valor: valor,
                data: hoje()
            });
            salvarDados(dados);
            return;
        }

        if (comando === 'despesa') {
            const valor = parseFloat((partes[1] || '').replace(',', '.'));
            const categoria = partes.slice(2).join(' ') || 'despesa';
            if (isNaN(valor)) return;

            const dados = carregarDados();
            dados.push({
                tipo: 'saida',
                categoria: categoria,
                valor: valor,
                data: hoje()
            });
            salvarDados(dados);
            return;
        }

        if (comando === 'gasto') {
            const valor = parseFloat((partes[1] || '').replace(',', '.'));
            const categoria = partes.slice(2).join(' ') || 'variado';
            if (isNaN(valor)) return;

            const dados = carregarDados();
            dados.push({
                tipo: 'saida',
                categoria: categoria,
                valor: valor,
                data: hoje()
            });
            salvarDados(dados);
            return;
        }
    } catch (erro) {
        console.error('ERRO AO PROCESSAR MENSAGEM:', erro);
    }
});

client.initialize();