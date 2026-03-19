const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

const ARQUIVO_DADOS = 'dados.json';

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

function saldoTotal() {
    const dados = lerDados();
    let total = 0;

    dados.forEach(item => {
        if (item.tipo === 'entrada') total += item.valor;
        else total -= item.valor;
    });

    return total;
}

function adicionar(tipo, valor, descricao) {
    const dados = lerDados();

    dados.push({
        data: new Date().toISOString(),
        tipo,
        valor,
        descricao
    });

    salvarDados(dados);
}

function resumoMes() {
    const dados = lerDados();
    const agora = new Date();

    let entradas = 0;
    let saidas = 0;

    dados.forEach(item => {
        const data = new Date(item.data);

        if (
            data.getMonth() === agora.getMonth() &&
            data.getFullYear() === agora.getFullYear()
        ) {
            if (item.tipo === 'entrada') entradas += item.valor;
            else saidas += item.valor;
        }
    });

    return `📊 RELATÓRIO DO MÊS

Entradas: R$ ${entradas}
Saídas: R$ ${saidas}
Saldo: R$ ${entradas - saidas}`;
}

// IMPORTANTE: usar "message", não "message_create"
client.on('message', async msg => {
    try {
        console.log('MENSAGEM RECEBIDA DE:', msg.from);
        console.log('TEXTO:', msg.body);

        if (msg.from.includes('@g.us')) return;

        let texto = msg.body.toLowerCase().trim();

        if (!texto.startsWith('bot')) return;

        const comando = texto.replace(/^bot/, '').trim();

        if (comando === 'saldo') {
            await msg.reply(`💰 Saldo: R$ ${saldoTotal()}`);
            return;
        }

        if (comando === 'relatorio' || comando === 'relatório' || comando === 'mes' || comando === 'mês') {
            await msg.reply(resumoMes());
            return;
        }

        if (comando.startsWith('vendi') || comando.startsWith('recebi')) {
            const valor = parseFloat(comando.split(' ')[1]?.replace(',', '.'));

            if (isNaN(valor)) {
                await msg.reply('❌ Valor inválido');
                return;
            }

            adicionar('entrada', valor, comando);

            await msg.reply(`✅ Entrada registrada

💰 Saldo atual: R$ ${saldoTotal()}`);
            return;
        }

        if (comando.startsWith('gastei') || comando.startsWith('paguei')) {
            const valor = parseFloat(comando.split(' ')[1]?.replace(',', '.'));

            if (isNaN(valor)) {
                await msg.reply('❌ Valor inválido');
                return;
            }

            adicionar('saida', valor, comando);

            await msg.reply(`✅ Saída registrada

💰 Saldo atual: R$ ${saldoTotal()}`);
            return;
        }

        await msg.reply('❌ Comando não reconhecido. Use:\nbot saldo\nbot relatorio\nbot vendi 200\nbot gastei 20 almoço');
    } catch (erro) {
        console.error('ERRO AO PROCESSAR MENSAGEM:', erro);
    }
});

client.initialize();