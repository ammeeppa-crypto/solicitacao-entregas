/* ========================================== */
/* VARIÁVEIS GLOBAIS E CONFIGURAÇÕES */
/* ========================================== */
let dadosTabelas = {};
let chartFinanceiro = null;
let ID_LOJA_ATUAL = localStorage.getItem('idLojaAmmeep');
let historicoClientes = [];
const ADICIONAL_VOLTA = 4.00;

const URL_PLANILHA = "https://script.google.com/macros/s/AKfycby0k4teozsiMEMyWf3IyKh-nCzNPfuRD9BcrTeKF4ew1YBU0sfNxJeOhgMrkYbMc8yv5Q/exec";

/* ========================================== */
/* INICIALIZAÇÃO DO APP */
/* ========================================== */
window.addEventListener('load', () => {
    // Carrega o tabelas.json
    fetch('tabelas.json').then(res => res.json()).then(data => { 
        dadosTabelas = data;
        
        // Define data de hoje nos inputs
        const hoje = new Date().toISOString().split('T')[0];
        ['dataInicio', 'dataFim', 'dataInicioF', 'dataFimF'].forEach(id => {
            const input = document.getElementById(id);
            if (input) input.value = hoje;
        });
        
        // 1. Carrega os dados salvos nos campos (Perfil e Pedido)
        recarregarDadosInterface();
        
        // 2. Verifica se o perfil deve estar travado (cadeado 🔒)
        verificarTravaPerfil();
        
        // 3. Carrega o histórico para a lupa
        carregarHistoricoParaFiltro();
    })
    .catch(err => {
        console.error("Erro ao carregar tabelas.json:", err);
    });
});

async function carregarHistoricoParaFiltro() {
    const id = localStorage.getItem('idLojaAmmeep');
    if(!id) return;
    try {
        const res = await fetch(`${URL_PLANILHA}?action=read&id=${id}`);
        const dados = await res.json();
        const mapeado = dados.map(p => {
            let enderecoLimpo = p.endereco || "";
            let bairroLimpo = "";
            if (enderecoLimpo.includes('(')) {
                const partes = enderecoLimpo.split('(');
                enderecoLimpo = partes[0].trim();
                bairroLimpo = partes[1].replace(')', '').trim();
            }
            return { cliente: p.cliente, endereco: enderecoLimpo, bairro: bairroLimpo };
        });
        historicoClientes = mapeado.filter((v, i, a) => a.findIndex(t => t.cliente === v.cliente) === i);
    } catch (e) { console.log("Erro ao carregar histórico."); }
}

/* ========================================== */
/* FUNÇÕES GERAIS E ATUALIZAÇÃO VISUAL (v3.1) */
/* ========================================== */
function trocarAba(idAba, botaoMenu) {
    document.querySelectorAll('.aba-content').forEach(aba => aba.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    const aba = document.getElementById(idAba);
    if (aba) aba.classList.add('active');
    botaoMenu.classList.add('active');
}

function limparTexto(t) { return t ? t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim() : ""; }

// --- NOVA FUNÇÃO CIRÚRGICA DE ATUALIZAÇÃO VISUAL ---
// Esta função lê o localStorage e força a atualização dos campos na tela
function recarregarDadosInterface() {
    // Busca os dados atuais do localStorage
    const endSalv = localStorage.getItem('endereco') || '';
    const telSalv = localStorage.getItem('telefoneLoja') || '';
    const tabSalv = localStorage.getItem('origem') || ''; // 'Saudade', 'Ianetama', 'Centro'

    // 1. Atualiza campos na aba PERFIL
    const inputEndPerf = document.getElementById('perf-endereco');
    const inputTelPerf = document.getElementById('perf-telefone');
    const selectTabPerf = document.getElementById('perf-bairroOrigem'); // Select no Perfil

    if (inputEndPerf) inputEndPerf.value = endSalv;
    if (inputTelPerf) inputTelPerf.value = telSalv;
    
    // Força o select do Perfil a mostrar a tabela correta
    if (selectTabPerf) selectTabPerf.value = tabSalv;

    // 2. Atualiza campos na aba PEDIDO (imagem image_8.png)
    const inputTabPed = document.getElementById('perf-bairroOrigem-pedido'); // Campo que exibe no Pedido

    // Força o campo visual do pedido a mostrar a tabela correta IMEDIATAMENTE
    if (inputTabPed) inputTabPed.value = tabSalv;

    console.log(`♻️ Interface atualizada visualmente para tabela: ${tabSalv}`);
}

/* ========================================== */
/* LÓGICA DELIVERY */
/* ========================================== */
function calcular() {
    const tabelaOrigem = localStorage.getItem('origem');
    if(!tabelaOrigem || !dadosTabelas[tabelaOrigem]) {
        document.getElementById('res-total').innerText = "---";
        return { taxaBase: 0, valorVolta: 0, total: 0, sucesso: false };
    }

    const destinoDigitado = limparTexto(document.getElementById('bairroDestino').value);
    const enderecoEntrega = limparTexto(document.getElementById('enderecoEntrega').value);
    const querVolta = document.getElementById('volta').value === "Sim";
    let taxaBase = 0, sucesso = false;

    const destinos = dadosTabelas[tabelaOrigem];
    const condoKey = Object.keys(destinos).find(c => c.startsWith("CONDOMINIO:") && enderecoEntrega.includes(limparTexto(c.replace("CONDOMINIO:", ""))));
    
    if (condoKey) { 
        taxaBase = destinos[condoKey]; sucesso = true; 
    } else {
        const bairroKey = Object.keys(destinos).find(b => limparTexto(b) === destinoDigitado);
        if (bairroKey) { taxaBase = destinos[bairroKey]; sucesso = true; }
    }

    const valorVolta = querVolta ? ADICIONAL_VOLTA : 0;
    const total = taxaBase + valorVolta;

    document.getElementById('res-base').innerText = `R$ ${taxaBase.toFixed(2).replace('.', ',')}`;
    document.getElementById('res-volta').innerText = `R$ ${valorVolta.toFixed(2).replace('.', ',')}`;
    document.getElementById('res-total').innerText = sucesso ? `R$ ${total.toFixed(2).replace('.', ',')}` : "---";

    return { taxaBase, valorVolta, total, sucesso, tabela: tabelaOrigem };
}

document.getElementById('bairroDestino').addEventListener('input', calcular);
document.getElementById('enderecoEntrega').addEventListener('input', calcular);
document.getElementById('volta').addEventListener('change', calcular);

document.getElementById('pedidoForm').onsubmit = function(e) {
    e.preventDefault();

    if (!localStorage.getItem('endereco') || !localStorage.getItem('telefoneLoja')) {
        alert("⚠️ CADASTRO OBRIGATÓRIO!");
        return;
    }

    if (!confirm("📢 AVISO AMMEEP: Entrega até PORTARIA.")) return;

    // --- CAPTURA SEGURA DOS VALORES DA TELA ---
    const extrairValor = (id) => {
        const texto = document.getElementById(id).innerText;
        return parseFloat(texto.replace('R$ ', '').replace(',', '.')) || 0;
    };

    const valorBase = extrairValor('res-base');
    const valorVolta = extrairValor('res-volta');
    const valorTotal = valorBase + valorVolta;

    const cliente = document.getElementById('nomeCliente').value;
    const endEntrega = document.getElementById('enderecoEntrega').value;
    const bairro = document.getElementById('bairroDestino').value;

    // Envio para a Planilha
    fetch(URL_PLANILHA, { 
        method: 'POST', mode: 'no-cors', 
        body: JSON.stringify({ 
            action: "solicitarEntrega",
            ID_LOJA: ID_LOJA_ATUAL, 
            NOME_ESTABELECIMENTO: localStorage.getItem('endereco'),
            WHATSAPP_ESTABELECIMENTO: localStorage.getItem('telefoneLoja'),
            CLIENTE: cliente, 
            ENDERECO_COMPLETO: endEntrega + " (" + bairro + ")",
            TAXA_MOTOBOY: valorTotal
        }) 
    });

    // --- MONTAGEM DA MENSAGEM DINÂMICA ---
    const infoVolta = valorVolta > 0 ? `\n* ADICIONAL VOLTA:* R$ ${valorVolta.toFixed(2).replace('.', ',')}` : "";
    
    const msg = ` *SOLICITAÇÃO DE ENTREGA* \n\n` +
                `*RETIRADA:* \n${localStorage.getItem('endereco')}\n\n` +
                `*CLIENTE:* ${cliente}\n` +
                `*ENDEREÇO:* ${endEntrega}\n` +
                `*BAIRRO:* ${bairro}\n\n` +
                `------------------------------\n` +
                `*ENTREGA:* R$ ${valorBase.toFixed(2).replace('.', ',')}${infoVolta}\n` +
                `* TOTAL A PAGAR: R$ ${valorTotal.toFixed(2).replace('.', ',')}*\n` +
                `------------------------------\n\n` +
                `_Gerado por AMMEEP v3.1_`;

    // --- ABRIR WHATSAPP (MÉTODO MAIS COMPATÍVEL) ---
    const urlWa = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.location.href = urlWa;

    // Reset da interface
    this.reset(); 
    document.getElementById('res-base').innerText = "R$ 0,00";
    document.getElementById('res-volta').innerText = "R$ 0,00";
    document.getElementById('res-total').innerText = "---";
};

function resetarTudoDelivery() {
    if (confirm("Deseja limpar todos os campos deste pedido?")) {
        // 1. Limpa os campos de digitação (input)
        document.getElementById('nomeCliente').value = "";
        document.getElementById('enderecoEntrega').value = "";
        document.getElementById('bairroDestino').value = "";
        document.getElementById('filtroClientes').value = ""; // Limpa a lupa
        
        // 2. Volta o seletor de "Retorno/Volta" para o padrão "Não"
        document.getElementById('volta').value = "Não";

        // 3. Limpa os valores de texto dentro do card de resumo (Taxa Base, Volta e Total)
        // Isso resolve o problema de o valor continuar aparecendo após limpar
        document.getElementById('res-base').innerText = "R$ 0,00";
        document.getElementById('res-volta').innerText = "R$ 0,00";
        document.getElementById('res-total').innerText = "---";

        // 4. Esconde a lista de sugestões da lupa, caso esteja aberta
        const sugestoes = document.getElementById('listaSugestoes');
        if (sugestoes) sugestoes.style.display = "none";

        // 5. Coloca o cursor no nome do cliente para o próximo pedido
        document.getElementById('nomeCliente').focus();
    }
}

/* ========================================== */
/* LUPA DE BUSCA */
/* ========================================== */
document.getElementById('filtroClientes').addEventListener('input', function() {
    const busca = limparTexto(this.value);
    const sugestoes = document.getElementById('listaSugestoes');
    sugestoes.innerHTML = "";
    if (busca.length < 2) return sugestoes.style.display = "none";

    const filtrados = historicoClientes.filter(c => limparTexto(c.cliente).includes(busca));
    if (filtrados.length > 0) {
        sugestoes.style.display = "block";
        filtrados.forEach(f => {
            const item = document.createElement('div');
            item.style.padding = "12px";
            item.style.borderBottom = "1px solid #eee";
            item.innerHTML = `<strong>${f.cliente}</strong><br><small>${f.endereco}</small>`;
            item.onclick = () => {
                document.getElementById('nomeCliente').value = f.cliente;
                document.getElementById('enderecoEntrega').value = f.endereco;
                document.getElementById('bairroDestino').value = f.bairro;
                sugestoes.style.display = "none";
                document.getElementById('filtroClientes').value = "";
                calcular();
            };
            sugestoes.appendChild(item);
        });
    }
});

/* ========================================== */
/* HISTÓRICO / RELATÓRIO */
/* ========================================== */
async function carregarDadosPlanilha() {
    const id = localStorage.getItem('idLojaAmmeep');
    const corpo = document.getElementById('corpoTabela');
    corpo.innerHTML = "<tr><td colspan='4'>Sincronizando...</td></tr>";

    try {
        const res = await fetch(`${URL_PLANILHA}?action=read&id=${id}`);
        const dados = await res.json();
        corpo.innerHTML = ""; let soma = 0;
        dados.reverse().forEach(p => {
            const valorTaxa = parseFloat(p.taxa || 0);
            soma += valorTaxa;
            corpo.innerHTML += `<tr><td>${new Date(p.data).toLocaleDateString()}</td><td>${p.cliente}</td><td>${p.endereco}</td><td>R$ ${valorTaxa.toFixed(2)}</td></tr>`;
        });
        document.getElementById('resumoTotal').innerText = `R$ ${soma.toFixed(2).replace('.', ',')}`;
    } catch (e) { corpo.innerHTML = "<tr><td colspan='4'>Erro.</td></tr>"; }
}

function limparRelatorio() {
    if(confirm("Limpar tela?")) {
        document.getElementById('corpoTabela').innerHTML = '<tr><td colspan="4">Filtre para ver.</td></tr>';
        document.getElementById('resumoTotal').innerText = "R$ 0,00";
    }
}

function prepararImpressao() {
    const nomeEndLoja = localStorage.getItem('endereco') || "AMMEEP DELIVERY";
    document.getElementById('print-loja-nome').innerText = nomeEndLoja.split(',')[0];
    document.getElementById('print-loja-end').innerText = nomeEndLoja;
    document.getElementById('print-data-emissao').innerText = "Emitido em: " + new Date().toLocaleString();
    window.print();
}

/* ========================================== */
/* FINANCEIRO E GRÁFICO */
/* ========================================== */
async function processarFinanceiro() {
    const id = localStorage.getItem('idLojaAmmeep');
    const inicio = document.getElementById('dataInicioF').value;
    const fim = document.getElementById('dataFimF').value;
    const listaRanking = document.getElementById('listaRanking');
    listaRanking.innerHTML = "<tr><td>Processando...</td></tr>";

    try {
        const res = await fetch(`${URL_PLANILHA}?action=read&id=${id}`);
        const dados = await res.json();
        let totalGeral = 0, totalEntregas = 0, bairrosData = {};

        dados.forEach(p => {
            const dataP = p.data.split('T')[0];
            if (dataP >= inicio && dataP <= fim) {
                const valor = parseFloat(p.taxa || 0);
                const bairro = (p.endereco && p.endereco.includes('(')) ? p.endereco.split('(')[1].replace(')', '').trim().toUpperCase() : "DIVERSOS";
                totalGeral += valor; totalEntregas++;
                bairrosData[bairro] = (bairrosData[bairro] || 0) + valor;
            }
        });

        document.getElementById('fin-total-taxas').innerText = `R$ ${totalGeral.toFixed(2).replace('.', ',')}`;
        document.getElementById('fin-total-entregas').innerText = totalEntregas;

        const rankingOrdenado = Object.entries(bairrosData).sort((a, b) => b[1] - a[1]);
        
        // Cores variadas para aguentar muitos bairros
        const coresPizza = [
            '#0f5dc2', '#0cbd15', '#ffc107', '#e91e63', '#9c27b0', 
            '#ff5722', '#00bcd4', '#8bc34a', '#607d8b', '#795548',
            '#ff9800', '#009688', '#3f51b5', '#f44336', '#9e9e9e'
        ];

        listaRanking.innerHTML = ""; // Limpa a tabela

        // Gerar o ranking ILIMITADO
        rankingOrdenado.forEach((item, index) => {
            let icone = "";
            
            // Pega a cor baseada no index (se acabar a lista, ele recomeça as cores)
            const corAtual = coresPizza[index % coresPizza.length];

            if (index === 0) icone = "🥇";
            else if (index === 1) icone = "🥈";
            else if (index === 2) icone = "🥉";
            else {
                // Bolinha com a cor exata que aparecerá na pizza
                icone = `<span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${corAtual}; margin-right:6px;"></span>`;
            }

            listaRanking.innerHTML += `
                <tr style="border-bottom: 1px solid #333;">
                    <td style="color: #ffffff !important; padding: 7px 0; font-weight: normal; font-size: 11px;">
                        ${icone} ${item[0]}
                    </td>
                    <td style="color: #ffffff !important; text-align: right; padding: 7px 0; font-weight: normal; font-size: 11px;">
                        R$ ${item[1].toFixed(2).replace('.', ',')}
                    </td>
                </tr>
            `;
        });

        // Chama a função do gráfico passando TODOS os dados e as cores
        gerarGraficoFinanceiro(rankingOrdenado, coresPizza);

        if (rankingOrdenado.length > 0) {
            document.getElementById("insightFinanceiro").innerText = `🏆 Bairro mais forte: ${rankingOrdenado[0][0]}`;
        }
        
    } catch (e) { console.error(e); }
}

function gerarGraficoFinanceiro(dados, cores) {
    const ctx = document.getElementById('graficoBairros').getContext('2d');
    if (chartFinanceiro) chartFinanceiro.destroy();
    chartFinanceiro = new Chart(ctx, {
        type: 'pie',
        data: {
            // Mostra apenas os top 5 no gráfico para não poluir
            labels: dados.slice(0, 5).map(i => i[0]),
            datasets: [{
                data: dados.slice(0, 5).map(i => i[1]),
                // Usa as mesmas cores definidas no ranking
                backgroundColor: cores.slice(0, 5)
            }]
        },
        options: { plugins: { legend: { display: false } } }
    });
}

/* ========================================== */
/* PERFIL E TRAVAS */
/* ========================================== */
function verificarTravaPerfil() {
    const end = localStorage.getItem('endereco');
    const tel = localStorage.getItem('telefoneLoja');
    if (end && tel) {
        // IDs dos campos no Perfil
        const inpEnd = document.getElementById('perf-endereco');
        const inpTel = document.getElementById('perf-telefone');
        const inpTab = document.getElementById('perf-bairroOrigem'); // Select no Perfil

        if (inpEnd) { inpEnd.value = end; inpEnd.disabled = true; }
        if (inpTel) { inpTel.value = tel; inpTel.disabled = true; }
        if (inpTab) { inpTab.disabled = true; } // Trava o select da tabela

        document.getElementById('btnSalvarPerfil').style.display = 'none';
        document.getElementById('avisoTravaPerfil').style.display = 'block';
    }
}

// --- AJUSTE NA FUNÇÃO DE SALVAR ---
async function salvarCadastroCompleto() {
    const end = document.getElementById('perf-endereco').value.trim();
    const tel = document.getElementById('perf-telefone').value.trim();
    const tab = document.getElementById('perf-bairroOrigem').value; // 'Saudade', 'Ianetama', 'Centro'

    if (!tel || !end || tab === "Selecione") return alert("Campos obrigatórios!");

    const novoID = `${tab.substring(0,3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    
    // Envio para a planilha
    await fetch(URL_PLANILHA, {
        method: 'POST', mode: 'no-cors',
        body: JSON.stringify({ action: "vincularLojista", ID: novoID, TELEFONE: tel, LOJA_NOME_ENDERECO: end, TABELA: tab })
    });

    // Salva no localStorage
    localStorage.setItem('idLojaAmmeep', novoID);
    localStorage.setItem('endereco', end);
    localStorage.setItem('telefoneLoja', tel);
    localStorage.setItem('origem', tab); // Salva 'Ianetama' ou 'Centro'

    // A MÁGICA: Força a atualização visual em todas as abas IMEDIATAMENTE
    recarregarDadosInterface();
    
    // Verifica a trava (cadeado 🔒)
    verificarTravaPerfil();

    alert("✅ Cadastro realizado com sucesso!");
    // location.reload(); // Removido o reload para não quebrar o fluxo visual
}

function vincularIDManual() {
    const id = document.getElementById('inputResgateID').value.trim().toUpperCase();
    if (!/^[A-Z]{3}-\d{4}$/.test(id)) return alert("ID inválido!");
    localStorage.setItem('idLojaAmmeep', id);
    // Para resgate, o reload é necessário para puxar os dados da planilha
    location.reload(); 
}
