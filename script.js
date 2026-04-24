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
/* FUNÇÃO DE AVISO PERSONALIZADO (TOAST) */
/* ========================================== */
function mostrarAviso(mensagem) {
    const antigo = document.querySelector('.toast-ammeep');
    if (antigo) antigo.remove();

    const toast = document.createElement('div');
    toast.className = 'toast-ammeep';
    toast.innerHTML = `<span>✅</span> ${mensagem}`;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 100);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

/* ========================================== */
/* INICIALIZAÇÃO DO APP */
/* ========================================== */
window.addEventListener('load', () => {
    fetch('tabelas.json').then(res => res.json()).then(data => { 
        dadosTabelas = data;
        
        const hoje = new Date().toISOString().split('T')[0];
        ['dataInicio', 'dataFim', 'dataInicioF', 'dataFimF'].forEach(id => {
            const input = document.getElementById(id);
            if (input) input.value = hoje;
        });
        
        recarregarDadosInterface();
        verificarStatusCadastro(); // Trava os campos se já houver ID
        carregarHistoricoParaFiltro();

        const tabAtiva = localStorage.getItem('origem');
        if(tabAtiva) {
            setTimeout(() => mostrarAviso(`Tabela ${tabAtiva} Ativada`), 800);
        }
    })
    .catch(err => console.error("Erro ao carregar tabelas.json:", err));
});

/* ========================================== */
/* LÓGICA DE CONTROLE DE PERFIL (TRAVA/EDITAR) */
/* ========================================== */
function verificarStatusCadastro() {
    const idExistente = localStorage.getItem('idLojaAmmeep');
    const aviso = document.getElementById('avisoTravaPerfil');
    const btnEditar = document.getElementById('btnEditarPerfil');
    const btnSalvar = document.getElementById('btnSalvarPerfil');
    
    const campos = [
        document.getElementById('perf-endereco'),
        document.getElementById('perf-telefone'),
        document.getElementById('perf-bairroOrigem')
    ];

    if (idExistente) {
        // Exibe o status de cadastrado e trava campos
        aviso.style.display = 'block';
        aviso.style.background = '#e3f2fd'; 
        aviso.style.color = '#0d47a1';
        aviso.style.border = '1px solid #bbdefb';
        aviso.innerHTML = `<i class="fa-solid fa-circle-check"></i> Estabelecimento Cadastrado (ID: ${idExistente})`;
        
        btnEditar.style.display = 'block';
        btnSalvar.style.display = 'none';

        campos.forEach(campo => { if(campo) campo.disabled = true; });
    } else {
        // Se não tem ID, deixa liberado para o primeiro cadastro
        aviso.style.display = 'none';
        btnEditar.style.display = 'none';
        btnSalvar.style.display = 'block';
        campos.forEach(campo => { if(campo) campo.disabled = false; });
    }
}

function liberarEdicao() {
    if (confirm("Deseja alterar os dados da sua loja?")) {
        const btnEditar = document.getElementById('btnEditarPerfil');
        const btnSalvar = document.getElementById('btnSalvarPerfil');
        const aviso = document.getElementById('avisoTravaPerfil');
        
        const campos = [
            document.getElementById('perf-endereco'),
            document.getElementById('perf-telefone'),
            document.getElementById('perf-bairroOrigem')
        ];

        // Habilita os campos e alterna botões
        campos.forEach(campo => { if(campo) campo.disabled = false; });
        btnEditar.style.display = 'none';
        btnSalvar.style.display = 'block';
        
        aviso.innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Editando informações...`;
        aviso.style.background = '#fff3e0'; 
        aviso.style.color = '#e65100';
        aviso.style.border = '1px solid #ffe0b2';
    }
}

async function salvarCadastroCompleto() {
    const end = document.getElementById('perf-endereco').value.trim();
    const tel = document.getElementById('perf-telefone').value.trim();
    const tab = document.getElementById('perf-bairroOrigem').value;

    if (!tel || !end || tab === "Selecione") return alert("Campos obrigatórios!");

    // CONFIRMAÇÃO DE CONSCIÊNCIA
    if (!confirm("Tem certeza que deseja salvar/atualizar estes dados?")) return;

    const idExistente = localStorage.getItem('idLojaAmmeep');
    const novoID = idExistente || `${tab.substring(0,3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    
    mostrarAviso("Atualizando ...");

    try {
        await fetch(URL_PLANILHA, {
            method: 'POST', mode: 'no-cors',
            body: JSON.stringify({ action: "vincularLojista", ID: novoID, TELEFONE: tel, LOJA_NOME_ENDERECO: end, TABELA: tab })
        });

        localStorage.setItem('idLojaAmmeep', novoID);
        localStorage.setItem('endereco', end);
        localStorage.setItem('telefoneLoja', tel);
        localStorage.setItem('origem', tab);

        recarregarDadosInterface();
        verificarStatusCadastro(); // Trava novamente após salvar
        
        mostrarAviso(`Tabela ${tab} Ativada com Sucesso!`);
    } catch (e) {
        alert("Erro ao salvar. Verifique sua conexão.");
    }
}

/* ========================================== */
/* DEMAIS FUNÇÕES DO SISTEMA (HISTÓRICO, DELIVERY, ETC) */
/* ========================================== */

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

function trocarAba(idAba, botaoMenu) {
    document.querySelectorAll('.aba-content').forEach(aba => aba.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    const aba = document.getElementById(idAba);
    if (aba) aba.classList.add('active');
    botaoMenu.classList.add('active');
}

function limparTexto(t) { return t ? t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim() : ""; }

function recarregarDadosInterface() {
    const endSalv = localStorage.getItem('endereco') || '';
    const telSalv = localStorage.getItem('telefoneLoja') || '';
    const tabSalv = localStorage.getItem('origem') || ''; 

    const inputEndPerf = document.getElementById('perf-endereco');
    const inputTelPerf = document.getElementById('perf-telefone');
    const selectTabPerf = document.getElementById('perf-bairroOrigem'); 

    if (inputEndPerf) inputEndPerf.value = endSalv;
    if (inputTelPerf) inputTelPerf.value = telSalv;
    if (selectTabPerf) selectTabPerf.value = tabSalv;

    const inputTabPed = document.getElementById('perf-bairroOrigem-pedido'); 
    if (inputTabPed) inputTabPed.value = tabSalv;
}

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
        alert("⚠️ CADASTRO OBRIGATÓRIO NO PERFIL!");
        return;
    }

    if (!confirm("📢 AVISO AMMEEP: Entrega até PORTARIA.")) return;

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

    fetch(URL_PLANILHA, { 
        method: 'POST', mode: 'no-cors', 
        body: JSON.stringify({ 
            action: "solicitarEntrega",
            ID_LOJA: localStorage.getItem('idLojaAmmeep'), 
            NOME_ESTABELECIMENTO: localStorage.getItem('endereco'),
            WHATSAPP_ESTABELECIMENTO: localStorage.getItem('telefoneLoja'),
            CLIENTE: cliente, 
            ENDERECO_COMPLETO: endEntrega + " (" + bairro + ")",
            TAXA_MOTOBOY: valorTotal
        }) 
    });

    const infoVolta = valorVolta > 0 ? `\n* ADICIONAL VOLTA:* R$ ${valorVolta.toFixed(2).replace('.', ',')}` : "";
    
    const msg = ` *SOLICITAÇÃO DE ENTREGA* \n\n` +
                `*RETIRADA:* \n${localStorage.getItem('endereco')}\n\n` +
                `*CLIENTE:* ${cliente}\n` +
                `*ENDEREÇO:* ${endEntrega}\n` +
                `*BAIRRO:* ${bairro}\n\n` +
                `------------------------------\n` +
                `*ENTREGA:* R$ ${valorBase.toFixed(2).replace('.', ',')}${infoVolta}\n` +
                `*TOTAL A PAGAR: R$ ${valorTotal.toFixed(2).replace('.', ',')}*\n` +
                `------------------------------\n\n` +
                `_AMMEEP v3.1.4_`;

    window.location.href = `https://wa.me/?text=${encodeURIComponent(msg)}`;

    this.reset(); 
    document.getElementById('res-base').innerText = "R$ 0,00";
    document.getElementById('res-volta').innerText = "R$ 0,00";
    document.getElementById('res-total').innerText = "---";
};

function resetarTudoDelivery() {
    if (confirm("Deseja limpar todos os campos deste pedido?")) {
        document.getElementById('nomeCliente').value = "";
        document.getElementById('enderecoEntrega').value = "";
        document.getElementById('bairroDestino').value = "";
        document.getElementById('filtroClientes').value = ""; 
        document.getElementById('volta').value = "Não";
        document.getElementById('res-base').innerText = "R$ 0,00";
        document.getElementById('res-volta').innerText = "R$ 0,00";
        document.getElementById('res-total').innerText = "---";
        const sugestoes = document.getElementById('listaSugestoes');
        if (sugestoes) sugestoes.style.display = "none";
        document.getElementById('nomeCliente').focus();
    }
}

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
        document.getElementById('corpoTabela').innerHTML = '<tr><td colspan="4">Filtre para ver os dados.</td></tr>';
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

async function processarFinanceiro() {
    const id = localStorage.getItem('idLojaAmmeep');
    const inicio = document.getElementById('dataInicioF').value;
    const fim = document.getElementById('dataFimF').value;
    const listaRanking = document.getElementById('listaRanking');
    listaRanking.innerHTML = "<tr><td>Processando...</td></tr>";

    try {
        const res = await fetch(`${URL_PLANILHA}?action=read&id=${id}`);
        const dados = await res.json();
        let totalGeral = 0, totalEntregas = 0;
        let bairrosData = {}; // Armazenará { valor: X, qtd: Y }

        dados.forEach(p => {
            const dataP = p.data.split('T')[0];
            if (dataP >= inicio && dataP <= fim) {
                const valor = parseFloat(p.taxa || 0);
                const bairro = (p.endereco && p.endereco.includes('(')) 
                    ? p.endereco.split('(')[1].replace(')', '').trim().toUpperCase() 
                    : "DIVERSOS";

                totalGeral += valor;
                totalEntregas++;

                if (!bairrosData[bairro]) {
                    bairrosData[bairro] = { valor: 0, qtd: 0 };
                }
                bairrosData[bairro].valor += valor;
                bairrosData[bairro].qtd += 1;
            }
        });

        document.getElementById('fin-total-taxas').innerText = `R$ ${totalGeral.toFixed(2).replace('.', ',')}`;
        document.getElementById('fin-total-entregas').innerText = totalEntregas;

        // Ordena pelo valor total (item[1].valor)
        const rankingOrdenado = Object.entries(bairrosData).sort((a, b) => b[1].valor - a[1].valor);
        const cores = ['#0f5dc2', '#0cbd15', '#ffc107', '#e91e63', '#9c27b0', '#ff5722', '#00bcd4', '#8bc34a', '#607d8b', '#795548'];

        listaRanking.innerHTML = ""; 
        rankingOrdenado.forEach((item, index) => {
            let icone = "";
            const corAtual = cores[index % cores.length];
            if (index === 0) icone = "🥇";
            else if (index === 1) icone = "🥈";
            else if (index === 2) icone = "🥉";
            else icone = `<span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${corAtual}; margin-right:6px;"></span>`;

            listaRanking.innerHTML += `
                <tr style="border-bottom: 1px solid #333;">
                    <td style="color: #ffffff !important; padding: 7px 0; font-weight: normal; font-size: 11px;">
                        ${icone} ${item[0]} <span style="color: #888;">(${item[1].qtd} peds)</span>
                    </td>
                    <td style="color: #ffffff !important; text-align: right; padding: 7px 0; font-weight: normal; font-size: 11px;">
                        R$ ${item[1].valor.toFixed(2).replace('.', ',')}
                    </td>
                </tr>`;
        });

        gerarGraficoFinanceiro(rankingOrdenado.slice(0, 5), cores);
        
        if (rankingOrdenado.length > 0) {
            document.getElementById("insightFinanceiro").innerText = `🏆 Bairro mais forte: ${rankingOrdenado[0][0]}`;
        }
    } catch (e) { console.error(e); }
}

function gerarGraficoFinanceiro(dados, cores) {
    const ctx = document.getElementById('graficoBairros').getContext('2d');
    if (chartFinanceiro) chartFinanceiro.destroy();

    chartFinanceiro = new Chart(ctx, {
        type: 'bar', // Mudança para Colunas
        data: {
            labels: dados.map(i => i[0]),
            datasets: [
                {
                    label: 'Valor (R$)',
                    data: dados.map(i => i[1].valor),
                    backgroundColor: cores.slice(0, 5),
                    borderRadius: 5,
                    yAxisID: 'y'
                },
                {
                    label: 'Qtd Pedidos',
                    data: dados.map(i => i[1].qtd),
                    type: 'line', // Estilo misto para destacar a quantidade
                    borderColor: '#ffffff',
                    borderWidth: 2,
                    pointBackgroundColor: '#ffc107',
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    position: 'left',
                    grid: { color: '#333' },
                    ticks: { color: '#aaa', font: { size: 10 } }
                },
                y1: {
                    beginAtZero: true,
                    position: 'right',
                    grid: { display: false },
                    ticks: { color: '#ffc107', font: { size: 10 } }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#aaa', font: { size: 9 } }
                }
            }
        }
    });
}

/* ========================================== */
/* FUNÇÃO DE RESGATE COM SENHA MASTER (SUPORTE) */
/* ========================================== */
function vincularIDManual() {
    const campoID = document.getElementById('inputResgateID');
    const valorDigitado = campoID.value.trim();
    
    // DEFINA SUA SENHA MASTER AQUI (Exemplo: AMMEEP2026)
    const SENHA_MASTER = "GLAY1440"; 

    // 1. Verifica se o que foi digitado é a Senha Master
    if (valorDigitado === SENHA_MASTER) {
        const novoID = prompt("🔑 MODO SUPORTE ATIVADO\nDigite o ID da Loja para vincular:");
        
        if (novoID && /^[A-Z]{3}-\d{4}$/.test(novoID.toUpperCase())) {
            localStorage.setItem('idLojaAmmeep', novoID.toUpperCase());
            alert("✅ Sucesso! ID vinculado pelo suporte. O app será reiniciado.");
            location.reload();
        } else {
            alert("❌ ID inválido. Operação cancelada.");
        }
        return; // Encerra aqui para não mostrar o alerta de erro abaixo
    }

    // 2. Se não for a senha, mostra o aviso padrão para o lojista
    alert("🔒 SEGURANÇA AMMEEP:\n\nO resgate automático de dados está desativado.\n\nPara recuperar seu acesso, entre em contato com o suporte para validação de identidade.");
    
    // Limpa o campo
    campoID.value = "";
}
