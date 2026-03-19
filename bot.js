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

// evita processar a mesma mensagem duas vezes
const mensagensProcessadas = new Set();

async function processarMensagem(msg, origemEvento) {
    try {
        const id = msg.id?._serialized || `${origemEvento}-${Date.now()}`;

        if (mensagensProcessadas.has(id)) {
            return;
        }
        mensagensProcessadas.add(id);

        console.log('-----------------------------');
        console.log('EVENTO:', origemEvento);
        console.log('FROM:', msg.from);
        console.log('TO:', msg.to);
        console.log('FROM_ME:', msg.fromMe);
        console.log('BODY:', msg.body);
        console.log('-----------------------------');

        // ignora grupos
        if (msg.from && msg.from.includes('@g.us')) return;

        const texto = (msg.body || '').toLowerCase().trim();

        // só reage a mensagens que começam com "bot"
        if (!texto.startsWith('bot')) return;

        const comando = texto.replace(/^bot/, '').trim();

        if (comando === 'saldo') {
            await msg.reply(`💰 Saldo: R$ ${saldoTotal()}`);
            return;
        }

        if (
            comando === 'relatorio' ||
            comando === 'relatório' ||
            comando === 'mes' ||
            comando === 'mês' ||
            comando === 'relatorio do mes' ||
            comando === 'relatório do mês'
        ) {
            await msg.reply(resumoMes());
            return;
        }

        if (comando.startsWith('vendi') || comando.startsWith('recebi')) {
            const partes = comando.split(' ');
            const valor = parseFloat((partes[1] || '').replace(',', '.'));

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
            const partes = comando.split(' ');
            const valor = parseFloat((partes[1] || '').replace(',', '.'));

            if (isNaN(valor)) {
                await msg.reply('❌ Valor inválido');
                return;
            }

            adicionar('saida', valor, comando);

            await msg.reply(`✅ Saída registrada

💰 Saldo atual: R$ ${saldoTotal()}`);
            return;
        }

        await msg.reply(
            '❌ Comando não reconhecido.\n\nUse:\n' +
            'bot saldo\n' +
            'bot relatorio\n' +
            'bot vendi 200\n' +
            'bot gastei 20 almoço'
        );
    } catch (erro) {
        console.error('ERRO AO PROCESSAR MENSAGEM:', erro);
    }
}

// pega mensagens recebidas
client.on('message', async msg => {
    await processarMensagem(msg, 'message');
});

// pega mensagens criadas/enviadas, inclusive quando você fala com você mesmo
client.on('message_create', async msg => {
    await processarMensagem(msg, 'message_create');
});

client.initialize();