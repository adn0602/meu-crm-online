import React, { useState, useEffect, useMemo } from "react";
import './App.css'; 
import { supabase } from './supabase/config'; 

// --- 1. FUNÇÃO DE HOOK PARA LOCALSTORAGE (MANTIDA) ---
function useLocalStorage<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
    const [value, setValue] = useState<T>(() => {
        try {
            const itemStorage = window.localStorage.getItem(key);
            if (itemStorage) {
               return JSON.parse(itemStorage);
            }
            return initialValue;
        } catch (error) {
            console.log(error);
            return initialValue;
        }
    });

    useEffect(() => {
        try {
            window.localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.log(error);
        }
    }, [key, value]);

    return [value, setValue];
}

// --- 2. INTERFACES DE DADOS ---
interface Cliente {
  id: string; 
  nome: string;
  email: string;
  telefone: string;
  imovel_interesse_id: string | null;
}

interface Compromisso { 
  id: string; 
  titulo: string;
  concluido: boolean;
  prioridade: 'Baixa' | 'Média' | 'Alta'; 
  cliente_id: string | null;
  data_compromisso: string;
}

interface Imovel {
  id: string; 
  titulo: string;
  endereco: string;
  valor: number;
  link_externo: string; 
  url_foto: string; 
  tipo: 'Apartamento' | 'Casa' | 'Terreno' | 'Comercial' | 'Outro'; 
}

interface TemplateMensagem {
    id: number; 
    titulo: string;
    texto: string;
}

interface Stats {
    totalClientes: number;
    totalImoveis: number;
    totalCompromissos: number;
    compromissosPendentes: number;
    prioridadeContagem: { [key in Compromisso['prioridade']]: number }; 
    proximosCompromissos: Compromisso[]; 
}

type Secao = 'dashboard' | 'clientes' | 'agenda' | 'imoveis' | 'whatsapp'; 
type ImovelTipo = Imovel['tipo'];

const INITIAL_CLIENTE_STATE: Omit<Cliente, 'id'> = { nome: "", email: "", telefone: "", imovel_interesse_id: null };
const INITIAL_COMPROMISSO_STATE: Omit<Compromisso, 'id'> = { 
    titulo: "", 
    concluido: false, 
    prioridade: 'Média', 
    cliente_id: null,
    data_compromisso: new Date().toISOString().split('T')[0]
}; 
const INITIAL_IMOVEL_STATE: Omit<Imovel, 'id'> = { titulo: "", endereco: "", valor: 0, link_externo: "", url_foto: "", tipo: 'Apartamento' };

// --- FUNÇÃO DELETAR (MANTIDA) ---
const deletarCliente = async (id: string) => {
  try {
    const { error } = await supabase
      .from('clientes')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao deletar cliente:', error);
      alert('Erro ao deletar cliente: ' + error.message);
      return false;
    }

    console.log('Cliente deletado com sucesso');
    return true;

  } catch (error) {
    console.error('Erro ao deletar cliente:', error);
    alert('Erro ao deletar cliente');
    return false;
  }
};

// --- FUNÇÃO DE COPIAR E-MAIL (MANTIDA) ---
const copiarEmailParaAreaTransferencia = async (email: string, nomeCliente: string) => {
    if (!email) {
        alert(`O cliente ${nomeCliente} não tem um email cadastrado.`);
        return;
    }
    try {
        await navigator.clipboard.writeText(email);
        alert(`O email "${email}" foi copiado para a área de transferência!`);
    } catch (e) {
        console.error("Erro ao copiar email:", e);
        // Fallback para navegadores antigos ou permissão negada
        const textArea = document.createElement("textarea");
        textArea.value = email;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            alert(`O email "${email}" foi copiado para a área de transferência!`);
        } catch (err) {
            alert("Não foi possível copiar o email. Por favor, copie-o manualmente: " + email);
        }
        document.body.removeChild(textArea);
    }
};

function App() {
  // --- 3. ESTADOS DO COMPONENTE ---
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [compromissos, setCompromissos] = useState<Compromisso[]>([]); 
  const [imoveis, setImoveis] = useState<Imovel[]>([]);
  const [loading, setLoading] = useState(true); 

  const [templates, setTemplates] = useLocalStorage<TemplateMensagem[]>('crm-templates-whatsapp', [
      { id: 1, titulo: "Primeira Abordagem", texto: "Olá! Sou corretor de imóveis e gostaria de saber se você tem interesse em comprar, vender ou alugar um imóvel. Posso te ajudar?" },
      { id: 2, titulo: "Follow-up Lead", texto: "Oi! Como vai? Gostaria de saber se ainda tem interesse no imóvel que conversamos. Tenho algumas opções similares que podem..." },
      { id: 3, titulo: "Agendamento Visita", texto: "Olá! Gostaria de agendar uma visita ao imóvel? Tenho disponibilidade hoje e amanhã. Qual horário é melhor para você?" },
      { id: 4, titulo: "Proposta Aceita", texto: "Parabéns! Sua proposta foi aceita! Por favor, me confirme seu melhor horário para enviarmos o contrato digital." }
  ]);
  
  const [isDarkMode, setIsDarkMode] = useLocalStorage<boolean>('crm-dark-mode', false); 

  const [novoCliente, setNovoCliente] = useState<Omit<Cliente, 'id'>>(INITIAL_CLIENTE_STATE);
  const [novoCompromisso, setNovoCompromisso] = useState<Omit<Compromisso, 'id'>>(INITIAL_COMPROMISSO_STATE); 
  const [novoImovel, setNovoImovel] = useState<Omit<Imovel, 'id'>>(INITIAL_IMOVEL_STATE);

  const [secaoAtiva, setSecaoAtiva] = useState<Secao>('dashboard'); 
  
  const [whatsappNumero, setWhatsappNumero] = useState('');
  const [whatsappMensagem, setWhatsappMensagem] = useState('');
  
  const [buscaCliente, setBuscaCliente] = useState('');
  const [buscaImovel, setBuscaImovel] = useState('');
  
  const [templateEditandoId, setTemplateEditandoId] = useState<number | null>(null);

  const [filtroTipo, setFiltroTipo] = useState<ImovelTipo | 'Todos'>('Todos');
  const [filtroPreco, setFiltroPreco] = useState<'Todos' | '100k' | '300k' | '500k' | '1m' | '1m+'>('Todos');
  
  const [dataSelecionada, setDataSelecionada] = useState<string>(new Date().toISOString().split('T')[0]);

  // --- 4. CARREGAR DADOS ---
  const carregarDados = async () => {
      setLoading(true);
      
      const { data: clientesData, error: clientesError } = await supabase
          .from('clientes')
          .select('*')
          .order('nome');

      if (clientesError) console.error("Erro ao carregar clientes:", clientesError);
      else setClientes(clientesData as Cliente[]);

      const { data: imoveisData, error: imoveisError } = await supabase
          .from('imoveis')
          .select('*')
          .order('titulo');

      if (imoveisError) console.error("Erro ao carregar imóveis:", imoveisError);
      else setImoveis(imoveisData as Imovel[]);

      const { data: compromissosData, error: compromissosError } = await supabase
          .from('compromissos')
          .select('*')
          .order('data_compromisso', { ascending: true })
          .order('prioridade', { ascending: false }); 

      if (compromissosError) console.error("Erro ao carregar compromissos:", compromissosError);
      else setCompromissos(compromissosData as Compromisso[]);

      setLoading(false);
  };

  useEffect(() => {
    carregarDados();

    const clientesListener = supabase
        .channel('public:clientes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes' }, () => {
            carregarDados();
        })
        .subscribe();
        
    const imoveisListener = supabase
        .channel('public:imoveis')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'imoveis' }, () => {
            carregarDados();
        })
        .subscribe();
        
    const compromissosListener = supabase
        .channel('public:compromissos')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'compromissos' }, () => {
            carregarDados();
        })
        .subscribe();

    return () => {
        supabase.removeChannel(clientesListener);
        supabase.removeChannel(imoveisListener);
        supabase.removeChannel(compromissosListener);
    };
  }, []); 

  // --- 5. FUNÇÕES DE LÓGICA ---
  const getClienteNome = (clienteId: string | null): string => {
    if (clienteId === null || clienteId === "") return "Sem cliente";
    const cliente = clientes.find(c => c.id === clienteId);
    return cliente ? cliente.nome : "Cliente não encontrado";
  };
  
  const getImovelTitulo = (imovelId: string | null): string => {
      if (imovelId === null || imovelId === "" ) return "Nenhum imóvel associado";
      const imovel = imoveis.find(i => i.id === imovelId);
      return imovel ? imovel.titulo : "Imóvel (ID) não encontrado";
  };
  
  const stats = useMemo<Stats>(() => {
    const totalCompromissos = compromissos.length;
    const compromissosPendentes = compromissos.filter(c => !c.concluido).length; 

    const prioridadeContagem = compromissos.reduce((acc, c) => {
        if (!c.concluido) {
            acc[c.prioridade] = (acc[c.prioridade] || 0) + 1;
        }
        return acc;
    }, { 'Alta': 0, 'Média': 0, 'Baixa': 0 } as { [key in Compromisso['prioridade']]: number });
    
    const proximosCompromissos = compromissos
        .filter(c => !c.concluido)
        .sort((a, b) => {
            if (a.data_compromisso < b.data_compromisso) return -1;
            if (a.data_compromisso > b.data_compromisso) return 1;
            
            const priorityOrder = { 'Alta': 3, 'Média': 2, 'Baixa': 1 };
            return priorityOrder[b.prioridade] - priorityOrder[a.prioridade];
        })
        .slice(0, 3);
    
    return {
        totalClientes: clientes.length,
        totalImoveis: imoveis.length,
        totalCompromissos: totalCompromissos,
        compromissosPendentes: compromissosPendentes,
        prioridadeContagem: prioridadeContagem,
        proximosCompromissos: proximosCompromissos
    };
  }, [clientes.length, imoveis.length, compromissos]);

  
  const compromissosDoDia = useMemo(() => {
      return compromissos
          .filter(c => c.data_compromisso === dataSelecionada)
          .sort((a, b) => {
              const priorityOrder = { 'Alta': 3, 'Média': 2, 'Baixa': 1 };
              const prioDiff = priorityOrder[b.prioridade] - priorityOrder[a.prioridade];
              if (prioDiff !== 0) return prioDiff;
              return a.titulo.localeCompare(b.titulo);
          });
  }, [compromissos, dataSelecionada]);
  
  const clientesFiltrados = useMemo(() => {
    if (!buscaCliente) return clientes;
    const termo = buscaCliente.toLowerCase();
    
    return clientes.filter(c => 
        c.nome.toLowerCase().includes(termo) ||
        c.email.toLowerCase().includes(termo) ||
        c.telefone.includes(termo)
    );
  }, [clientes, buscaCliente]);
  
  const imoveisFiltrados = useMemo(() => {
    let listaFiltrada = imoveis;
    const termo = buscaImovel.toLowerCase();
    const termoBuscaNumero = termo.replace(/[^0-9]/g, '');

    if (buscaImovel) {
        listaFiltrada = listaFiltrada.filter(i => 
            i.titulo.toLowerCase().includes(termo) ||
            i.endereco.toLowerCase().includes(termo) ||
            i.valor.toString().includes(termoBuscaNumero) 
        );
    }

    if (filtroTipo !== 'Todos') {
        listaFiltrada = listaFiltrada.filter(i => i.tipo === filtroTipo);
    }

    if (filtroPreco !== 'Todos') {
        const valor = (v: number) => v; 
        
        listaFiltrada = listaFiltrada.filter(i => {
            switch(filtroPreco) {
                case '100k': return valor(i.valor) <= 100000;
                case '300k': return valor(i.valor) > 100000 && valor(i.valor) <= 300000;
                case '500k': return valor(i.valor) > 300000 && valor(i.valor) <= 500000;
                case '1m': return valor(i.valor) > 500000 && valor(i.valor) <= 1000000;
                case '1m+': return valor(i.valor) > 1000000;
                default: return true;
            }
        });
    }

    return listaFiltrada;
  }, [imoveis, buscaImovel, filtroTipo, filtroPreco]);


  // --- 6. FUNÇÕES DE CRUD DO SUPABASE ---
  
  // Clientes
  const adicionarCliente = async () => {
    if (novoCliente.nome.trim() === "") return; 
    
    try {
        const { error } = await supabase
            .from('clientes')
            .insert({
                nome: novoCliente.nome,
                email: novoCliente.email,
                telefone: novoCliente.telefone,
                imovel_interesse_id: novoCliente.imovel_interesse_id === "0" ? null : novoCliente.imovel_interesse_id
            });
        
        if (error) throw error;
        setNovoCliente(INITIAL_CLIENTE_STATE);
    } catch (e) {
        console.error("Erro ao adicionar cliente: ", e);
        alert("Erro ao adicionar cliente. Verifique o console.");
    }
  };

  const removerCliente = async (id: string) => {
    try {
        const { error } = await supabase
            .from('clientes')
            .delete()
            .match({ id }); 
            
        if (error) throw error;
    } catch (e) {
        console.error("Erro ao remover cliente: ", e);
        alert("Erro ao remover cliente. Verifique o console.");
    }
  };

  // Compromissos
  const adicionarCompromisso = async () => {
    if (novoCompromisso.titulo.trim() === "" || novoCompromisso.data_compromisso.trim() === "") return;
    
    try {
        const { error } = await supabase
            .from('compromissos')
            .insert({
                titulo: novoCompromisso.titulo,
                concluido: novoCompromisso.concluido,
                prioridade: novoCompromisso.prioridade,
                data_compromisso: novoCompromisso.data_compromisso,
                cliente_id: novoCompromisso.cliente_id === "0" ? null : novoCompromisso.cliente_id
            });
        
        if (error) throw error;
        setNovoCompromisso({ ...INITIAL_COMPROMISSO_STATE, data_compromisso: dataSelecionada });
    } catch (e) {
        console.error("Erro ao adicionar compromisso: ", e);
        alert("Erro ao adicionar compromisso. Verifique o console.");
    }
  };
  
  const concluirCompromisso = async (compromisso: Compromisso) => {
      try {
          const { error } = await supabase
              .from('compromissos')
              .update({ concluido: !compromisso.concluido })
              .match({ id: compromisso.id });

          if (error) throw error;
      } catch (e) {
          console.error("Erro ao atualizar compromisso: ", e);
          alert("Erro ao atualizar compromisso. Verifique o console.");
      }
  };
  
  // Imóveis
  const adicionarImovel = async () => {
    if (novoImovel.titulo.trim() === "" || novoImovel.endereco.trim() === "") return;
    
    try {
        const { error } = await supabase
            .from('imoveis')
            .insert({
                titulo: novoImovel.titulo,
                endereco: novoImovel.endereco,
                valor: Number(novoImovel.valor),
                link_externo: novoImovel.link_externo,
                url_foto: novoImovel.url_foto,
                tipo: novoImovel.tipo
            });
            
        if (error) throw error;
        setNovoImovel(INITIAL_IMOVEL_STATE);
    } catch (e) {
        console.error("Erro ao adicionar imóvel: ", e);
        alert("Erro ao adicionar imóvel. Verifique o console.");
    }
  };
  
  const removerImovel = async (id: string) => {
    try {
        const { error } = await supabase
            .from('imoveis')
            .delete()
            .match({ id });
            
        if (error) throw error;
    } catch (e) {
        console.error("Erro ao remover imóvel: ", e);
        alert("Erro ao remover imóvel. Verifique o console.");
    }
  };

  // Funções Locais (Whatsapp e Exportar) - Mantidas
  const atualizarTemplate = (id: number, novoTexto: string) => {
    if (novoTexto.trim() === "") {
        alert("O texto do template não pode ser vazio.");
        return;
    }
    setTemplates(prevTemplates => prevTemplates.map(t => (
        t.id === id ? { ...t, texto: novoTexto } : t
    )));
    setTemplateEditandoId(null); 
  };
  
  const enviarWhatsapp = (numero: string, mensagem: string = "") => {
    const numLimpo = numero.replace(/[^0-9]/g, '');
    const mensagemCodificada = encodeURIComponent(mensagem);
    
    if (numLimpo.length < 8) {
        alert("Por favor, digite um número de telefone válido (com DDD).");
        return;
    }
    
    window.open(`https://wa.me/55${numLimpo}?text=${mensagemCodificada}`, "_blank");
  };

  const ligarParaCliente = (telefone: string) => {
    window.location.href = `tel:${telefone}`;
  };

  const exportarClientesParaCSV = () => {
      if (clientes.length === 0) {
          alert("Não há clientes para exportar.");
          return;
      }

      const cabecalho = ["ID", "Nome", "Email", "Telefone", "Imovel_Interesse_ID"].join(",");
      
      const linhas = clientes.map(cliente => {
          const escape = (str: string | number | null) => {
            const s = String(str || '');
            return `"${s.replace(/"/g, '""')}"`;
          }
          
          return [
              cliente.id,
              escape(cliente.nome),
              escape(cliente.email),
              escape(cliente.telefone),
              escape(cliente.imovel_interesse_id)
          ].join(",");
      }).join("\n");
      
      const csv = cabecalho + "\n" + linhas;

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      
      link.setAttribute("href", url);
      link.setAttribute("download", `clientes_crm_${Date.now()}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      alert("Clientes exportados com sucesso!");
  };


  // --- 7. FUNÇÕES DE FORMATAÇÃO DE DATA E AVATAR ---
  
  const formatarData = (dataIso: string) => {
      if (!dataIso) return "Sem data";
      const [ano, mes, dia] = dataIso.split('-');
      return `${dia}/${mes}/${ano}`;
  };

  const getAvatarInicial = (nome: string) => {
      if (!nome) return "?";
      const partes = nome.trim().split(/\s+/);
      if (partes.length >= 2) {
          // CORREÇÃO: Removido o espaço em "partes[par tes.length"
          return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
      }
      return partes[0][0].toUpperCase();
  };


  // --- 8. RENDERIZAÇÃO DO COMPONENTE ---
  return (
    <div className={`app ${isDarkMode ? 'dark-mode' : ''}`}> 
      
      <header className="header">
        <h1>CRM Alexandre Nascimento</h1>
      </header>

      <nav className="menu">
        <button className={`botao-menu ${secaoAtiva === 'dashboard' ? 'ativo' : ''}`} onClick={() => setSecaoAtiva('dashboard')}>Dashboard</button>
        <button className={`botao-menu ${secaoAtiva === 'clientes' ? 'ativo' : ''}`} onClick={() => setSecaoAtiva('clientes')}>Clientes</button>
        <button className={`botao-menu ${secaoAtiva === 'agenda' ? 'ativo' : ''}`} onClick={() => setSecaoAtiva('agenda')}>Agenda</button> 
        <button className={`botao-menu ${secaoAtiva === 'imoveis' ? 'ativo' : ''}`} onClick={() => setSecaoAtiva('imoveis')}>Imóveis</button>
        <button className={`botao-menu ${secaoAtiva === 'whatsapp' ? 'ativo' : ''}`} onClick={() => setSecaoAtiva('whatsapp')}>WhatsApp</button>
        
        <button 
            className="botao-menu toggle-mode" 
            onClick={() => setIsDarkMode(!isDarkMode)}
            title={isDarkMode ? "Modo Claro" : "Modo Escuro"}
        >
            {isDarkMode ? "☀️ Light Mode" : "🌙 Dark Mode"}
        </button>
      </nav>

      <div className="conteudo">
        
        {loading && <div className="loading-overlay">Carregando dados da nuvem...</div>}
        
        {/* --- SEÇÃO: DASHBOARD --- */}
        {secaoAtiva === 'dashboard' && (
            <div className="dashboard-grid">
                
                <div className="cartao dashboard-card card-clientes">
                    <h3>Total de Clientes</h3>
                    <p className="big-number">{stats.totalClientes}</p>
                    <span className="sub-text">Contatos cadastrados</span>
                </div>

                <div className="cartao dashboard-card card-tarefas">
                    <h3>Compromissos Pendentes</h3> 
                    <p className="big-number">{stats.compromissosPendentes}</p>
                    <span className="sub-text">de {stats.totalCompromissos} compromissos totais</span>
                </div>

                <div className="cartao dashboard-card card-imoveis">
                    <h3>Imóveis no Catálogo</h3>
                    <p className="big-number">{stats.totalImoveis}</p>
                    <span className="sub-text">Imóveis ativos para venda/aluguel</span>
                </div>
                
                <div className="cartao dashboard-card card-prioridade-resumo">
                    <h3>Compromissos Pendentes por Tipo</h3>
                    <div className="prioridade-resumo-lista">
                        <div className="prioridade-item-resumo">
                            <span className="prioridade-resumo-tag prioridade-alta">Alta</span>
                            <span className="prioridade-resumo-count">{stats.prioridadeContagem.Alta}</span>
                        </div>
                        <div className="prioridade-item-resumo">
                            <span className="prioridade-resumo-tag prioridade-media">Média</span>
                            <span className="prioridade-resumo-count">{stats.prioridadeContagem.Média}</span>
                        </div>
                        <div className="prioridade-item-resumo">
                            <span className="prioridade-resumo-tag prioridade-baixa">Baixa</span>
                            <span className="prioridade-resumo-count">{stats.prioridadeContagem.Baixa}</span>
                        </div>
                    </div>
                    <span className="sub-text" style={{marginTop: '10px'}}>Compromissos a fazer (não concluídos)</span>
                </div>

                <div className="cartao dashboard-card card-proximos-compromissos full-width-card">
                    <h3>Próximos 3 Compromissos Pendentes</h3>
                    <div className="lista-dados">
                        {stats.proximosCompromissos.length > 0 ? (
                            stats.proximosCompromissos.map(c => (
                                <div className="item-lista dashboard-compromisso" key={c.id}>
                                   <span className={`prioridade prioridade-${c.prioridade.toLowerCase()}`}>
                                        {c.prioridade}
                                   </span>
                                   <div className="info-compromisso">
                                        <strong>{c.titulo}</strong>
                                        <span className="cliente-associado">
                                            Dia: {formatarData(c.data_compromisso)} | Cliente: {getClienteNome(c.cliente_id)}
                                        </span>
                                   </div>
                                </div>
                            ))
                        ) : (
                            <p>Nenhum compromisso pendente agendado.</p>
                        )}
                    </div>
                </div>
                
                <div className="cartao dashboard-card card-insights">
                    <h3>Dica do Sistema</h3>
                    <p style={{marginTop: '10px'}}>Use a seção Agenda para manter seu pipeline organizado e não perca nenhum follow-up.</p>
                    <p style={{marginTop: '10px'}}>Lembre-se de sempre associar um cliente ao agendar uma visita ou proposta.</p>
                </div>
            </div>
        )}

        {/* --- SEÇÃO DE CLIENTES --- */}
        {secaoAtiva === 'clientes' && (
          <>
            <div className="cartao formulario">
              <h2>Adicionar Cliente</h2>
              <div className="campo-duplo">
                <div className="campo"><input type="text" placeholder="Nome" value={novoCliente.nome} onChange={(e) => setNovoCliente({ ...novoCliente, nome: e.target.value })}/></div>
                <div className="campo"><input type="email" placeholder="Email" value={novoCliente.email} onChange={(e) => setNovoCliente({ ...novoCliente, email: e.target.value })}/></div>
              </div>
              
              <div className="campo-duplo"> 
                <div className="campo">
                    <label htmlFor="imovelInteresse">Principal Interesse:</label>
                    <select 
                        id="imovelInteresse"
                        value={novoCliente.imovel_interesse_id === null ? "0" : novoCliente.imovel_interesse_id} 
                        onChange={(e) => setNovoCliente({ ...novoCliente, imovel_interesse_id: e.target.value === "0" ? null : e.target.value })}
                    >
                        <option value="0">-- Selecionar Imóvel (Opcional) --</option>
                        {imoveis.map(i => (
                            <option key={i.id} value={i.id}>{i.titulo}</option>
                        ))}
                    </select>
                </div>
                
                <div className="campo">
                    <label htmlFor="telefoneCliente">Telefone (com DDD)</label>
                    <input type="text" id="telefoneCliente" placeholder="Ex: (21) 99888-7766" value={novoCliente.telefone} onChange={(e) => setNovoCliente({ ...novoCliente, telefone: e.target.value })} style={{marginBottom: '0'}}/>
                </div>
              </div>
              <button className="botao-primario" onClick={adicionarCliente} style={{width: '100%', marginTop: '10px'}}>Adicionar Cliente</button>
            </div>

            <div className="cartao">
              <h2>Clientes ({clientesFiltrados.length} de {clientes.length})</h2>
              
              <input 
                type="text" 
                placeholder="Buscar por nome, email ou telefone..." 
                value={buscaCliente}
                onChange={(e) => setBuscaCliente(e.target.value)}
                className="input-busca"
              />
              <div className="campo-exportar-csv">
                  <button 
                      className="botao-secundario botao-exportar" 
                      onClick={exportarClientesParaCSV}
                  >
                      ⬇️ Exportar Clientes (CSV)
                  </button>
              </div>

              <div className="lista-dados lista-clientes-visual">
                {clientesFiltrados.map((cliente) => (
                  <div className="cliente-card" key={cliente.id}>
                    
                    <div className="cliente-avatar">
                        {getAvatarInicial(cliente.nome)}
                    </div>

                    <div className="cliente-info">
                        <strong>{cliente.nome}</strong>
                        <p className="cliente-contato">📞 {cliente.telefone || "Sem telefone"}</p>
                        <p className="cliente-contato">📧 {cliente.email || "Sem email"}</p>
                        
                        <div style={{display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '5px'}}>
                            {cliente.imovel_interesse_id ? (
                                <span className="cliente-tag tag-interesse">
                                    Interesse: {getImovelTitulo(cliente.imovel_interesse_id)}
                                </span>
                            ) : (
                                <span className="cliente-tag tag-novo-lead">
                                    Novo Lead
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="cliente-acoes-rapidas">
                        <button 
                            className="botao-acao botao-zap-card" 
                            title="Enviar WhatsApp"
                            disabled={!cliente.telefone}
                            onClick={() => cliente.telefone && enviarWhatsapp(cliente.telefone)}
                        >
                            <i className="icone-zap">💬</i>
                        </button>
                        
                        <button 
                            className="botao-acao botao-ligacao" 
                            title="Ligar"
                            disabled={!cliente.telefone}
                            onClick={() => cliente.telefone && ligarParaCliente(cliente.telefone)}
                        >
                            <i className="icone-ligacao">📞</i>
                        </button>
                        
                        {/* BOTÃO E-MAIL (com mailto) */}
                        <a 
                            className="botao-acao botao-email" 
                            title={`Abrir Cliente de E-mail para ${cliente.email || 'Sem Email'}`}
                            href={cliente.email 
                                ? `mailto:${cliente.email}?subject=Proposta Imóvel CRM Alexandre&body=Prezado(a) ${cliente.nome},%0A%0AMeu nome é Alexandre, e sou seu corretor de imóveis. Gostaria de dar seguimento ao seu interesse no mercado imobiliário.%0A%0AAguardamos seu contato.` 
                                : '#'}
                            onClick={(e) => {
                                if (!cliente.email) {
                                    e.preventDefault();
                                    alert(`Atenção: O cliente ${cliente.nome} não tem um email cadastrado.`);
                                }
                            }}
                            style={{ opacity: cliente.email ? 1 : 0.5, cursor: cliente.email ? 'pointer' : 'not-allowed' }}
                        >
                            <i className="icone-email">📧</i>
                        </a>
                        
                        {/* BOTÃO Copiar Email para Área de Transferência */}
                        <button 
                            className="botao-acao botao-copiar" 
                            title={`Copiar E-mail: ${cliente.email || 'Sem Email'}`}
                            onClick={() => copiarEmailParaAreaTransferencia(cliente.email, cliente.nome)}
                            style={{ opacity: cliente.email ? 1 : 0.5, cursor: cliente.email ? 'pointer' : 'not-allowed' }}
                        >
                            <i className="icone-copiar">📋</i>
                        </button>
                        

                       <button 
                            className="botao-acao botao-perigo" 
                            title="Remover Cliente"
                            onClick={async () => {
                                if (confirm(`Tem certeza que deseja deletar ${cliente.nome}?`)) {
                                    const sucesso = await deletarCliente(cliente.id);
                                    if (sucesso) {
                                        alert('Cliente deletado com sucesso!');
                                        carregarDados();
                                    }
                                }
                            }}
                          >
                            <i className="icone-remover">🗑️</i>
                          </button>
                    </div>
                  </div>
                ))}
                {clientesFiltrados.length === 0 && <p>Nenhum cliente encontrado.</p>}
              </div>
            </div>
          </>
        )}

        {/* --- SEÇÃO: AGENDA --- */}
        {secaoAtiva === 'agenda' && (
            <div className="agenda-grid">
                <div className="cartao formulario">
                    <h2>Agendar Novo Compromisso</h2>
                    <div className="campo">
                        <input 
                            type="text" 
                            placeholder="Título do Compromisso (Ex: Visita ao Imóvel X)" 
                            value={novoCompromisso.titulo} 
                            onChange={(e) => setNovoCompromisso({ ...novoCompromisso, titulo: e.target.value })}
                        />
                    </div>
                    <div className="campo-duplo">
                        <div className="campo">
                            <label htmlFor="dataCompromisso">Data:</label>
                            <input 
                                type="date" 
                                id="dataCompromisso"
                                value={novoCompromisso.data_compromisso}
                                onChange={(e) => setNovoCompromisso({ ...novoCompromisso, data_compromisso: e.target.value, concluido: false })}
                            />
                        </div>
                        <div className="campo">
                            <label htmlFor="prioridadeCompromisso">Prioridade:</label>
                            <select 
                                id="prioridadeCompromisso"
                                value={novoCompromisso.prioridade}
                                onChange={(e) => setNovoCompromisso({ ...novoCompromisso, prioridade: e.target.value as Compromisso['prioridade'] })}
                            >
                                <option value="Baixa">Baixa</option>
                                <option value="Média">Média</option>
                                <option value="Alta">Alta</option>
                            </select>
                        </div>
                    </div>
                    <div className="campo">
                        <label htmlFor="clienteAssociado">Cliente Associado:</label>
                        <select 
                            id="clienteAssociado"
                            value={novoCompromisso.cliente_id === null ? "0" : novoCompromisso.cliente_id}
                            onChange={(e) => setNovoCompromisso({ ...novoCompromisso, cliente_id: e.target.value === "0" ? null : e.target.value })}
                        >
                            <option value="0">-- Nenhum Cliente --</option>
                            {clientes.map(c => (
                                <option key={c.id} value={c.id}>{c.nome}</option>
                            ))}
                        </select>
                    </div>
                    <button className="botao-primario" onClick={adicionarCompromisso} style={{width: '100%', marginTop: '10px'}}>Adicionar Compromisso</button>
                </div>

                <div className="cartao">
                    <h2>Compromissos para o Dia</h2>
                    <div className="campo" style={{marginBottom: '15px'}}>
                        <label htmlFor="dataSelecionada">Selecione o Dia:</label>
                        <input 
                            type="date" 
                            id="dataSelecionada"
                            value={dataSelecionada}
                            onChange={(e) => setDataSelecionada(e.target.value)}
                        />
                    </div>
                    
                    <p style={{marginBottom: '10px', fontWeight: 'bold'}}>
                        {formatarData(dataSelecionada)} ({compromissosDoDia.length} compromisso(s))
                    </p>

                    <div className="lista-dados lista-compromissos">
                        {compromissosDoDia.length > 0 ? (
                            compromissosDoDia.map(c => (
                                <div 
                                    className={`item-lista compromisso-item ${c.concluido ? 'concluido' : ''}`} 
                                    key={c.id}
                                >
                                    <input 
                                        type="checkbox" 
                                        checked={c.concluido}
                                        onChange={() => concluirCompromisso(c)}
                                        title={c.concluido ? 'Marcar como Pendente' : 'Marcar como Concluído'}
                                    />
                                    <div className="info-compromisso">
                                        <div className="titulo-prioridade">
                                            <strong>{c.titulo}</strong>
                                            <span className={`prioridade prioridade-${c.prioridade.toLowerCase()}`}>{c.prioridade}</span>
                                        </div>
                                        <span className="cliente-associado">
                                            Cliente: {getClienteNome(c.cliente_id)}
                                        </span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p>Nenhum compromisso agendado para esta data.</p>
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* --- SEÇÃO: IMÓVEIS --- */}
        {secaoAtiva === 'imoveis' && (
            <div className="imoveis-grid">
                <div className="cartao formulario">
                    <h2>Cadastrar Novo Imóvel</h2>
                    <div className="campo"><input type="text" placeholder="Título (Ex: Lindo Apartamento Vista Mar)" value={novoImovel.titulo} onChange={(e) => setNovoImovel({ ...novoImovel, titulo: e.target.value })}/></div>
                    <div className="campo-duplo">
                        <div className="campo"><input type="text" placeholder="Endereço Principal" value={novoImovel.endereco} onChange={(e) => setNovoImovel({ ...novoImovel, endereco: e.target.value })}/></div>
                        <div className="campo">
                            <label htmlFor="tipoImovel">Tipo:</label>
                            <select 
                                id="tipoImovel"
                                value={novoImovel.tipo} 
                                onChange={(e) => setNovoImovel({ ...novoImovel, tipo: e.target.value as ImovelTipo })}
                            >
                                <option value="Apartamento">Apartamento</option>
                                <option value="Casa">Casa</option>
                                <option value="Terreno">Terreno</option>
                                <option value="Comercial">Comercial</option>
                                <option value="Outro">Outro</option>
                            </select>
                        </div>
                    </div>
                    <div className="campo-duplo">
                        <div className="campo">
                            <label htmlFor="valorImovel">Valor (R$):</label>
                            <input type="number" id="valorImovel" placeholder="Ex: 350000" value={novoImovel.valor} onChange={(e) => setNovoImovel({ ...novoImovel, valor: Number(e.target.value) })}/>
                        </div>
                        <div className="campo">
                            <label htmlFor="linkImovel">Link Externo (Site):</label>
                            <input type="url" id="linkImovel" placeholder="Ex: https://seu-site.com/imovel" value={novoImovel.link_externo} onChange={(e) => setNovoImovel({ ...novoImovel, link_externo: e.target.value })}/>
                        </div>
                    </div>
                    <div className="campo">
                        <label htmlFor="urlFotoImovel">URL da Foto Principal:</label>
                        <input type="url" id="urlFotoImovel" placeholder="Ex: https://caminho.para/foto.jpg" value={novoImovel.url_foto} onChange={(e) => setNovoImovel({ ...novoImovel, url_foto: e.target.value })}/>
                    </div>
                    <button className="botao-primario" onClick={adicionarImovel} style={{width: '100%', marginTop: '10px'}}>Cadastrar Imóvel</button>
                </div>

                <div className="cartao">
                    <h2>Catálogo de Imóveis ({imoveisFiltrados.length} de {imoveis.length})</h2>
                    <div className="filtros-imoveis">
                        <input 
                            type="text" 
                            placeholder="Buscar por título ou endereço..." 
                            value={buscaImovel}
                            onChange={(e) => setBuscaImovel(e.target.value)}
                            className="input-busca"
                        />
                        <select 
                            value={filtroTipo} 
                            onChange={(e) => setFiltroTipo(e.target.value as ImovelTipo | 'Todos')}
                        >
                            <option value="Todos">Todos os Tipos</option>
                            <option value="Apartamento">Apartamento</option>
                            <option value="Casa">Casa</option>
                            <option value="Terreno">Terreno</option>
                            <option value="Comercial">Comercial</option>
                            <option value="Outro">Outro</option>
                        </select>
                        <select 
                            value={filtroPreco} 
                            onChange={(e) => setFiltroPreco(e.target.value as typeof filtroPreco)}
                        >
                            <option value="Todos">Todos os Preços</option>
                            <option value="100k">Até R$100 mil</option>
                            <option value="300k">R$100 mil a R$300 mil</option>
                            <option value="500k">R$300 mil a R$500 mil</option>
                            <option value="1m">R$500 mil a R$1 milhão</option>
                            <option value="1m+">Acima de R$1 milhão</option>
                        </select>
                    </div>

                    <div className="lista-dados lista-imoveis-visual">
                        {imoveisFiltrados.map((imovel) => (
                            <div className="imovel-card" key={imovel.id}>
                                <div 
                                    className="imovel-foto" 
                                    style={{ backgroundImage: `url(${imovel.url_foto})` }}
                                >
                                    <span className={`imovel-tag tag-tipo`}>{imovel.tipo}</span>
                                </div>
                                <div className="imovel-info">
                                    <strong>{imovel.titulo}</strong>
                                    <p className="imovel-endereco">📍 {imovel.endereco}</p>
                                    <p className="imovel-valor">
                                        💰 **R$ {imovel.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}**
                                    </p>
                                </div>
                                <div className="imovel-acoes-rapidas">
                                    {imovel.link_externo && (
                                        <a 
                                            href={imovel.link_externo} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="botao-acao botao-link"
                                            title="Ver Imóvel Externo"
                                        >
                                            🌐
                                        </a>
                                    )}
                                    <button 
                                        className="botao-acao botao-perigo" 
                                        title="Remover Imóvel"
                                        onClick={async () => {
                                            if (confirm(`Tem certeza que deseja deletar o imóvel "${imovel.titulo}"?`)) {
                                                await removerImovel(imovel.id);
                                            }
                                        }}
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        ))}
                        {imoveisFiltrados.length === 0 && <p>Nenhum imóvel encontrado com os filtros aplicados.</p>}
                    </div>
                </div>
            </div>
        )}

        {/* --- SEÇÃO: WHATSAPP/TEMPLATES --- */}
        {secaoAtiva === 'whatsapp' && (
            <div className="whatsapp-grid">
                <div className="cartao formulario">
                    <h2>Envio Rápido de WhatsApp</h2>
                    <div className="campo">
                        <label htmlFor="whatsNumero">Telefone (DDD + Número):</label>
                        <input 
                            type="tel" 
                            id="whatsNumero"
                            placeholder="Ex: 21998887766 (sem espaços ou traços)" 
                            value={whatsappNumero} 
                            onChange={(e) => setWhatsappNumero(e.target.value)}
                        />
                    </div>
                    <div className="campo">
                        <label htmlFor="whatsMensagem">Mensagem:</label>
                        <textarea 
                            id="whatsMensagem"
                            placeholder="Digite ou selecione um template abaixo..." 
                            value={whatsappMensagem} 
                            onChange={(e) => setWhatsappMensagem(e.target.value)}
                            rows={4}
                        />
                    </div>
                    <button 
                        className="botao-primario" 
                        onClick={() => enviarWhatsapp(whatsappNumero, whatsappMensagem)} 
                        disabled={!whatsappNumero.replace(/[^0-9]/g, '')}
                        style={{width: '100%', marginTop: '10px'}}
                    >
                        Abrir WhatsApp
                    </button>
                </div>

                <div className="cartao">
                    <h2>Templates de Mensagens Salvas</h2>
                    <div className="lista-dados lista-templates">
                        {templates.map((template) => (
                            <div className="template-item" key={template.id}>
                                {templateEditandoId === template.id ? (
                                    <div className="template-edicao">
                                        <input 
                                            type="text" 
                                            value={template.titulo} 
                                            readOnly 
                                            style={{fontWeight: 'bold', marginBottom: '5px', opacity: 0.7}}
                                        />
                                        <textarea
                                            value={template.texto}
                                            onChange={(e) => setTemplates(prev => prev.map(t => t.id === template.id ? {...t, texto: e.target.value} : t))}
                                            rows={3}
                                            style={{marginBottom: '5px'}}
                                        />
                                        <button 
                                            className="botao-primario" 
                                            onClick={() => atualizarTemplate(template.id, template.texto)}
                                            style={{marginRight: '5px'}}
                                        >
                                            Salvar
                                        </button>
                                        <button 
                                            className="botao-secundario" 
                                            onClick={() => setTemplateEditandoId(null)}
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="template-info">
                                            <strong>{template.titulo}</strong>
                                            <p className="template-texto">{template.texto}</p>
                                        </div>
                                        <div className="template-acoes">
                                            <button 
                                                className="botao-acao botao-copiar"
                                                title="Copiar Texto"
                                                onClick={() => {
                                                    setWhatsappMensagem(template.texto);
                                                    alert(`Template "${template.titulo}" carregado no campo de mensagem acima.`);
                                                }}
                                            >
                                                📋
                                            </button>
                                            <button 
                                                className="botao-acao botao-editar"
                                                title="Editar Template"
                                                onClick={() => setTemplateEditandoId(template.id)}
                                            >
                                                ✏️
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

      </div>
    </div> 
  );
}

export default App;