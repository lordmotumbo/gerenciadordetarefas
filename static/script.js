document.addEventListener("DOMContentLoaded", () => {
    const apiBaseUrl = "/api";
    const socket = io(); 

    // Elementos Globais
    const botaoAlternarTema = document.getElementById("botaoAlternarTema");
    const themeIcon = botaoAlternarTema.querySelector("i");

    // Seção Gerenciar Pessoas
    const listaPessoasUl = document.getElementById("listaPessoasUl");
    const inputNomeNovaPessoa = document.getElementById("inputNomeNovaPessoa");
    const botaoAdicionarNovaPessoa = document.getElementById("botaoAdicionarNovaPessoa");

    // Seção Adicionar Tarefa (na barra lateral)
    const secaoAdicionarTarefa = document.getElementById("secaoAdicionarTarefa");
    const tituloAdicionarTarefaPara = document.getElementById("tituloAdicionarTarefaPara");
    const inputTituloNovaTarefa = document.getElementById("inputTituloNovaTarefa");
    const selectPrioridadeNovaTarefa = document.getElementById("selectPrioridadeNovaTarefa");
    const inputHorarioNovaTarefa = document.getElementById("inputHorarioNovaTarefa");
    const botaoSalvarNovaTarefa = document.getElementById("botaoSalvarNovaTarefa");

    // Seção Detalhes Tarefas (conteúdo principal)
    const tituloTarefasDePessoa = document.getElementById("tituloTarefasDePessoa");
    const listaTarefasUl = document.getElementById("listaTarefasUl");
    const placeholderTarefas = listaTarefasUl.querySelector(".placeholder-tarefas");

    // Modal Editar Tarefa
    const modalEditarTarefa = document.getElementById("modalEditarTarefa");
    const fecharModalEditarTarefa = document.getElementById("fecharModalEditarTarefa");
    const inputEditarTarefaId = document.getElementById("inputEditarTarefaId");
    const inputEditarDescricaoTarefa = document.getElementById("inputEditarDescricaoTarefa");
    const selectEditarPrioridadeTarefa = document.getElementById("selectEditarPrioridadeTarefa");
    const inputEditarHorarioInicioTarefa = document.getElementById("inputEditarHorarioInicioTarefa");
    const botaoSalvarEdicaoTarefa = document.getElementById("botaoSalvarEdicaoTarefa");

    // Modal Editar Pessoa
    const modalEditarPessoa = document.getElementById("modalEditarPessoa");
    const fecharModalEditarPessoa = document.getElementById("fecharModalEditarPessoa");
    const inputEditarPessoaId = document.getElementById("inputEditarPessoaId");
    const inputEditarNomePessoa = document.getElementById("inputEditarNomePessoa");
    const botaoSalvarEdicaoPessoa = document.getElementById("botaoSalvarEdicaoPessoa");

    let pessoasCache = [];
    let tarefasCache = {}; // { pessoaId: [tarefas] }
    let pessoaSelecionadaId = null;
    let tarefaArrastadaElement = null;

    // --- Funções Auxiliares --- 
    async function fetchWrapper(url, options = {}) {
        const response = await fetch(url, options);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ erro: "Erro de comunicação com o servidor." }));
            console.error("Erro na API:", response.status, errorData);
            alert(`Erro: ${errorData.erro || response.statusText}`);
            throw new Error(errorData.erro || response.statusText);
        }
        if (response.status === 204 || response.headers.get("content-length") === "0") return null;
        return response.json();
    }

    function showPlaceholderSeNecessario() {
        if (!listaTarefasUl) return; 
        const temTarefasVisiveis = Array.from(listaTarefasUl.children).some(child => child !== placeholderTarefas && !child.classList.contains("hidden"));

        if (placeholderTarefas) {
            if (temTarefasVisiveis) {
                placeholderTarefas.classList.add("hidden");
            } else {
                if (!listaTarefasUl.contains(placeholderTarefas)) {
                    listaTarefasUl.appendChild(placeholderTarefas);
                }
                placeholderTarefas.classList.remove("hidden");
            }
        }
    }

    // --- Tema ---
    if (botaoAlternarTema) {
        botaoAlternarTema.addEventListener("click", () => {
            document.body.classList.toggle("tema-claro");
            document.body.classList.toggle("tema-escuro");
            const isDark = document.body.classList.contains("tema-escuro");
            if (themeIcon) {
                themeIcon.classList.remove(isDark ? "fa-moon" : "fa-sun");
                themeIcon.classList.add(isDark ? "fa-sun" : "fa-moon");
            }
        });
    }

    // --- Socket.IO Event Listeners ---
    socket.on("connect", () => console.log("Conectado ao servidor WebSocket!"));
    socket.on("pessoas_atualizadas", async () => {
        console.log("Evento: pessoas_atualizadas recebido");
        await carregarPessoas(); 
    });
    socket.on("tarefas_atualizadas", async (data) => {
        console.log("Evento: tarefas_atualizadas recebido para pessoa_id:", data.pessoa_id);
        if (data && data.pessoa_id) {
            await carregarTarefasDaPessoa(data.pessoa_id);
            if (parseInt(data.pessoa_id) === parseInt(pessoaSelecionadaId)) {
                renderizarTarefasParaPessoaSelecionada();
            }
        }
    });

    // --- Gerenciamento de Pessoas ---
    async function carregarPessoas() {
        try {
            pessoasCache = await fetchWrapper(`${apiBaseUrl}/pessoas`);
            renderizarListaPessoas();
            if (pessoaSelecionadaId && !pessoasCache.find(p => p.id === pessoaSelecionadaId)) {
                limparSelecaoPessoa();
            } else if (pessoaSelecionadaId) {
                await carregarTarefasDaPessoa(pessoaSelecionadaId);
                renderizarTarefasParaPessoaSelecionada();
            } else if (pessoasCache.length === 0) {
                limparSelecaoPessoa();
            }
        } catch (error) {
            console.error("Falha ao carregar pessoas:", error);
        }
    }

    function renderizarListaPessoas() {
        if (!listaPessoasUl) return;
        listaPessoasUl.innerHTML = ""; 
        pessoasCache.forEach(pessoa => {
            const li = document.createElement("li");
            li.dataset.pessoaId = pessoa.id;
            if (pessoa.id === pessoaSelecionadaId) {
                li.classList.add("selecionada");
            }

            const nomeSpan = document.createElement("span");
            nomeSpan.classList.add("nome-entidade");
            nomeSpan.textContent = pessoa.nome;
            nomeSpan.addEventListener("click", () => selecionarPessoa(pessoa.id, pessoa.nome));

            const acoesDiv = document.createElement("div");
            acoesDiv.classList.add("acoes-entidade");

            const btnEditar = document.createElement("button");
            btnEditar.innerHTML = "<i class=\"fas fa-pencil-alt\"></i>";
            btnEditar.title = "Editar Pessoa";
            btnEditar.classList.add("editar-pessoa-btn");
            btnEditar.addEventListener("click", () => abrirModalEditarPessoa(pessoa));

            const btnExcluir = document.createElement("button");
            btnExcluir.innerHTML = "<i class=\"fas fa-trash-alt\"></i>";
            btnExcluir.title = "Excluir Pessoa";
            btnExcluir.classList.add("excluir-pessoa-btn");
            btnExcluir.addEventListener("click", () => excluirPessoa(pessoa.id, pessoa.nome)); 

            acoesDiv.appendChild(btnEditar);
            acoesDiv.appendChild(btnExcluir);
            
            li.appendChild(nomeSpan);
            li.appendChild(acoesDiv);
            listaPessoasUl.appendChild(li);
        });
    }

    if (botaoAdicionarNovaPessoa) {
        botaoAdicionarNovaPessoa.addEventListener("click", async () => {
            if (!inputNomeNovaPessoa) return;
            const nome = inputNomeNovaPessoa.value.trim();
            if (!nome) {
                alert("Por favor, insira o nome da pessoa.");
                return;
            }
            try {
                await fetchWrapper(`${apiBaseUrl}/pessoas`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ nome })
                });
                inputNomeNovaPessoa.value = "";
            } catch (error) {
                console.error("Falha ao adicionar pessoa:", error);
            }
        });
    }

    async function excluirPessoa(id, nome) {
        if (!confirm(`Tem certeza que deseja excluir ${nome} e todas as suas tarefas? Esta ação não pode ser desfeita.`)) return;
        try {
            await fetchWrapper(`${apiBaseUrl}/pessoas/${id}`, { method: "DELETE" });
            if (pessoaSelecionadaId === id) {
                limparSelecaoPessoa();
            }
        } catch (error) {
            console.error("Falha ao excluir pessoa:", error);
        }
    }

    function selecionarPessoa(id, nome) {
        pessoaSelecionadaId = id;
        document.querySelectorAll("#listaPessoasUl li").forEach(item => item.classList.remove("selecionada"));
        const pessoaLi = document.querySelector(`#listaPessoasUl li[data-pessoa-id=\'${id}\'`);
        if (pessoaLi) pessoaLi.classList.add("selecionada");

        if (tituloAdicionarTarefaPara) tituloAdicionarTarefaPara.textContent = `Adicionar Tarefa para ${nome}`;
        if (secaoAdicionarTarefa) secaoAdicionarTarefa.classList.remove("hidden");
        
        if (tituloTarefasDePessoa) tituloTarefasDePessoa.textContent = `Tarefas de ${nome}`;
        carregarTarefasDaPessoa(id).then(renderizarTarefasParaPessoaSelecionada);
    }

    function limparSelecaoPessoa() {
        pessoaSelecionadaId = null;
        document.querySelectorAll("#listaPessoasUl li").forEach(item => item.classList.remove("selecionada"));
        if (secaoAdicionarTarefa) secaoAdicionarTarefa.classList.add("hidden");
        if (tituloTarefasDePessoa) tituloTarefasDePessoa.textContent = "Tarefas de...";
        if (listaTarefasUl) listaTarefasUl.innerHTML = ""; 
        if(listaTarefasUl && placeholderTarefas) listaTarefasUl.appendChild(placeholderTarefas);
        showPlaceholderSeNecessario();
    }

    // --- Gerenciamento de Tarefas ---
    async function carregarTarefasDaPessoa(pessoaId) {
        try {
            tarefasCache[pessoaId] = await fetchWrapper(`${apiBaseUrl}/tarefas/pessoa/${pessoaId}`);
        } catch (error) {
            console.error(`Falha ao carregar tarefas para pessoa ${pessoaId}:`, error);
            tarefasCache[pessoaId] = [];
        }
    }

    function renderizarTarefasParaPessoaSelecionada() {
        if (!listaTarefasUl) return;
        listaTarefasUl.innerHTML = ""; 
        if (!pessoaSelecionadaId || !tarefasCache[pessoaSelecionadaId] || tarefasCache[pessoaSelecionadaId].length === 0) {
            if(placeholderTarefas) listaTarefasUl.appendChild(placeholderTarefas);
            showPlaceholderSeNecessario();
            return;
        }

        const tarefas = tarefasCache[pessoaSelecionadaId];

        tarefas.forEach(tarefa => {
            const li = document.createElement("li");
            li.classList.add("tarefa-item", `prioridade-${tarefa.prioridade}`);
            if (tarefa.concluida) li.classList.add("concluida");
            li.dataset.tarefaId = tarefa.id;
            li.draggable = true;

            li.addEventListener("dragstart", (e) => {
                tarefaArrastadaElement = e.target.closest(".tarefa-item"); 
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", tarefa.id.toString());
                setTimeout(() => { if(tarefaArrastadaElement) tarefaArrastadaElement.classList.add("arrastando")}, 0);
            });
            li.addEventListener("dragend", (e) => {
                if(tarefaArrastadaElement) tarefaArrastadaElement.classList.remove("arrastando");
                tarefaArrastadaElement = null;
            });

            const dragHandle = document.createElement("span");
            dragHandle.classList.add("drag-handle");
            dragHandle.innerHTML = "<i class=\"fas fa-grip-vertical\"></i>";

            const conteudoDiv = document.createElement("div");
            conteudoDiv.classList.add("tarefa-conteudo");
            
            const tituloP = document.createElement("p");
            tituloP.classList.add("titulo-tarefa");
            tituloP.textContent = tarefa.descricao;
            conteudoDiv.appendChild(tituloP);

            const detalhesDiv = document.createElement("div");
            detalhesDiv.classList.add("detalhes-tarefa");
            if (tarefa.horario_inicio) {
                const horarioP = document.createElement("p");
                horarioP.textContent = `Horário: ${tarefa.horario_inicio}`;
                detalhesDiv.appendChild(horarioP);
            }
            const prioridadeP = document.createElement("p");
            prioridadeP.textContent = `Prioridade: ${tarefa.prioridade}`;
            detalhesDiv.appendChild(prioridadeP);
            conteudoDiv.appendChild(detalhesDiv);

            const acoesItemDiv = document.createElement("div");
            acoesItemDiv.classList.add("tarefa-acoes-item");

            const btnCompletar = document.createElement("button");
            btnCompletar.innerHTML = `<i class="fas ${tarefa.concluida ? 'fa-undo' : 'fa-check'}"></i> ${tarefa.concluida ? "Reabrir" : "Completar"}`;
            btnCompletar.classList.add("completar-tarefa-btn");
            btnCompletar.addEventListener("click", () => toggleConcluirTarefa(tarefa.id));

            const btnEditar = document.createElement("button");
            btnEditar.innerHTML = "<i class=\"fas fa-pencil-alt\"></i> Editar";
            btnEditar.classList.add("editar-tarefa-btn");
            btnEditar.addEventListener("click", () => abrirModalEditarTarefa(tarefa));

            const btnExcluir = document.createElement("button");
            btnExcluir.innerHTML = "<i class=\"fas fa-trash-alt\"></i> Excluir";
            btnExcluir.classList.add("excluir-tarefa-btn");
            btnExcluir.addEventListener("click", () => excluirTarefa(tarefa.id));

            acoesItemDiv.appendChild(btnCompletar);
            acoesItemDiv.appendChild(btnEditar);
            acoesItemDiv.appendChild(btnExcluir);

            li.appendChild(dragHandle);
            li.appendChild(conteudoDiv);
            li.appendChild(acoesItemDiv);
            listaTarefasUl.appendChild(li);
        });
        showPlaceholderSeNecessario();
    }

    if (listaTarefasUl) {
        listaTarefasUl.addEventListener("dragover", e => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
        });

        listaTarefasUl.addEventListener("drop", async e => {
            e.preventDefault();
            if (!tarefaArrastadaElement || !pessoaSelecionadaId) return;
            
            const idTarefaMovida = parseInt(tarefaArrastadaElement.dataset.tarefaId);
            const itemAlvo = e.target.closest(".tarefa-item");

            let idsOrdenados = Array.from(listaTarefasUl.querySelectorAll(".tarefa-item"))
                                    .map(t => parseInt(t.dataset.tarefaId));
            
            const indiceOrigem = idsOrdenados.indexOf(idTarefaMovida);
            if (indiceOrigem > -1) idsOrdenados.splice(indiceOrigem, 1);

            let indiceAlvo = -1;
            if (itemAlvo && itemAlvo !== tarefaArrastadaElement) {
                const idAlvo = parseInt(itemAlvo.dataset.tarefaId);
                indiceAlvo = idsOrdenados.indexOf(idAlvo);
                idsOrdenados.splice(indiceAlvo, 0, idTarefaMovida);
            } else {
                const boundingBox = listaTarefasUl.getBoundingClientRect();
                const offsetY = e.clientY - boundingBox.top;
                let inserido = false;
                for(let i=0; i < listaTarefasUl.children.length; i++) {
                    const child = listaTarefasUl.children[i];
                    if (child.classList.contains("tarefa-item") && child !== tarefaArrastadaElement) {
                        const childBox = child.getBoundingClientRect();
                        if (offsetY < childBox.top + childBox.height / 2) {
                            idsOrdenados.splice(i, 0, idTarefaMovida);
                            inserido = true;
                            break;
                        }
                    }
                }
                if (!inserido) {
                    idsOrdenados.push(idTarefaMovida);
                }
            }
            
            if(tarefaArrastadaElement) tarefaArrastadaElement.classList.remove("arrastando");
            tarefaArrastadaElement = null;

            try {
                await fetchWrapper(`${apiBaseUrl}/tarefas/reordenar`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ pessoa_id: pessoaSelecionadaId, ids_tarefas_ordenadas: idsOrdenados })
                });
            } catch (error) {
                console.error("Falha ao reordenar tarefa:", error);
                await carregarTarefasDaPessoa(pessoaSelecionadaId).then(renderizarTarefasParaPessoaSelecionada); 
            }
        });
    }

    if (inputHorarioNovaTarefa) inputHorarioNovaTarefa.addEventListener("input", formatarHorario);
    if (botaoSalvarNovaTarefa) {
        botaoSalvarNovaTarefa.addEventListener("click", async () => {
            if (!pessoaSelecionadaId) {
                alert("Selecione uma pessoa para adicionar a tarefa.");
                return;
            }
            const descricao = inputTituloNovaTarefa.value.trim();
            const prioridade = selectPrioridadeNovaTarefa.value;
            const horario_inicio = inputHorarioNovaTarefa.value.trim() || null;

            if (!descricao) {
                alert("O título da tarefa é obrigatório.");
                return;
            }
            if (horario_inicio && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(horario_inicio)){
                alert("Formato de horário inválido. Use HH:MM."); return;
            }

            const dadosTarefa = { descricao, prioridade, horario_inicio, pessoa_id: pessoaSelecionadaId };
            try {
                await fetchWrapper(`${apiBaseUrl}/tarefas`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(dadosTarefa)
                });
                inputTituloNovaTarefa.value = "";
                selectPrioridadeNovaTarefa.value = "Media";
                inputHorarioNovaTarefa.value = "";
            } catch (error) {
                console.error("Falha ao salvar nova tarefa:", error);
            }
        });
    }

    if (inputEditarHorarioInicioTarefa) inputEditarHorarioInicioTarefa.addEventListener("input", formatarHorario);
    function abrirModalEditarTarefa(tarefa) {
        if (!modalEditarTarefa) return;
        inputEditarTarefaId.value = tarefa.id;
        inputEditarDescricaoTarefa.value = tarefa.descricao;
        selectEditarPrioridadeTarefa.value = tarefa.prioridade;
        inputEditarHorarioInicioTarefa.value = tarefa.horario_inicio || "";
        modalEditarTarefa.style.display = "block";
    }
    if (fecharModalEditarTarefa) fecharModalEditarTarefa.addEventListener("click", () => { if(modalEditarTarefa) modalEditarTarefa.style.display = "none"});
    if (botaoSalvarEdicaoTarefa) {
        botaoSalvarEdicaoTarefa.addEventListener("click", async () => {
            const id = inputEditarTarefaId.value;
            const descricao = inputEditarDescricaoTarefa.value.trim();
            const prioridade = selectEditarPrioridadeTarefa.value;
            const horario_inicio = inputEditarHorarioInicioTarefa.value.trim() || null;

            if (!descricao) { alert("A descrição é obrigatória."); return; }
            if (horario_inicio && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(horario_inicio)){
                alert("Formato de horário inválido. Use HH:MM."); return;
            }
            const dadosTarefa = { descricao, prioridade, horario_inicio }; 
            try {
                await fetchWrapper(`${apiBaseUrl}/tarefas/${id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(dadosTarefa)
                });
                if(modalEditarTarefa) modalEditarTarefa.style.display = "none";
            } catch (error) {
                console.error("Falha ao editar tarefa:", error);
            }
        });
    }

    function abrirModalEditarPessoa(pessoa) {
        if (!modalEditarPessoa) return;
        inputEditarPessoaId.value = pessoa.id;
        inputEditarNomePessoa.value = pessoa.nome;
        modalEditarPessoa.style.display = "block";
    }
    if (fecharModalEditarPessoa) fecharModalEditarPessoa.addEventListener("click", () => {if(modalEditarPessoa) modalEditarPessoa.style.display = "none"});
    if (botaoSalvarEdicaoPessoa) {
        botaoSalvarEdicaoPessoa.addEventListener("click", async () => {
            const id = inputEditarPessoaId.value;
            const nome = inputEditarNomePessoa.value.trim();
            if (!nome) { alert("O nome da pessoa é obrigatório."); return; }
            try {
                await fetchWrapper(`${apiBaseUrl}/pessoas/${id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ nome })
                });
                if(modalEditarPessoa) modalEditarPessoa.style.display = "none";
            } catch (error) {
                console.error("Falha ao editar pessoa:", error);
            }
        });
    }

    async function toggleConcluirTarefa(tarefaId) {
        try {
            await fetchWrapper(`${apiBaseUrl}/tarefas/${tarefaId}/concluir`, { method: "PATCH" });
        } catch (error) {
            console.error("Falha ao concluir/reabrir tarefa:", error);
        }
    }
    async function excluirTarefa(tarefaId) {
        if (!confirm("Tem certeza que deseja excluir esta tarefa?")) return;
        try {
            await fetchWrapper(`${apiBaseUrl}/tarefas/${tarefaId}`, { method: "DELETE" });
        } catch (error) {
            console.error("Falha ao excluir tarefa:", error);
        }
    }

    window.addEventListener("click", (event) => {
        if (modalEditarTarefa && event.target == modalEditarTarefa) modalEditarTarefa.style.display = "none";
        if (modalEditarPessoa && event.target == modalEditarPessoa) modalEditarPessoa.style.display = "none";
    });

    function formatarHorario(e) {
        let value = e.target.value.replace(/[^0-9]/g, "");
        if (value.length > 2 && value.indexOf(":") === -1) {
            value = value.substring(0, 2) + ":" + value.substring(2, 4);
        }
        e.target.value = value.substring(0, 5);
    }

    async function init() {
        await carregarPessoas();
        showPlaceholderSeNecessario();
        if (document.body.classList.contains("tema-escuro") && themeIcon) {
            themeIcon.classList.remove("fa-moon");
            themeIcon.classList.add("fa-sun");
        }
    }

    init();
});

