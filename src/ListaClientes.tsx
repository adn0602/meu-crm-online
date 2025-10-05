import { useState, useEffect } from 'react'
import { supabase } from './config'
import { deletarCliente, enviarEmail } from './supabase/deletarCliente'

export function ListaClientes() {
  const [clientes, setClientes] = useState([])
  const [carregando, setCarregando] = useState(true)

  // Buscar clientes do Supabase
  async function buscarClientes() {
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('nome')

      if (error) throw error
      setClientes(data || [])
    } catch (error) {
      console.error('Erro ao buscar clientes:', error)
    } finally {
      setCarregando(false)
    }
  }

  // Carregar clientes quando abrir a tela
  useEffect(() => {
    buscarClientes()
  }, [])

  if (carregando) return <div>Carregando clientes...</div>

  return (
    <div style={{ padding: '20px' }}>
      <h2>📋 Lista de Clientes</h2>
      
      {clientes.length === 0 ? (
        <p>Nenhum cliente cadastrado</p>
      ) : (
        clientes.map(cliente => (
          <div key={cliente.id} style={{
            border: '1px solid #ddd',
            padding: '15px',
            margin: '10px 0',
            borderRadius: '8px',
            backgroundColor: '#f9f9f9'
          }}>
            <h3>👤 {cliente.nome}</h3>
            <p>📧 {cliente.email}</p>
            <p>📞 {cliente.telefone}</p>
            {cliente.imovel_interesse && (
              <p>🏠 Interesse: {cliente.imovel_interesse}</p>
            )}

            <div style={{ marginTop: '10px' }}>
              <button onClick={async () => {
                const assunto = prompt('Digite o assunto do email:')
                if (!assunto) return
                
                const mensagem = prompt('Digite a mensagem do email:')
                if (!mensagem) return
                
                await enviarEmail(cliente.id, assunto, mensagem)
              }} style={{
                marginRight: '10px',
                padding: '8px 15px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}>
                📧 Enviar Email
              </button>

              <button onClick={async () => {
                if (confirm(`Tem certeza que deseja deletar ${cliente.nome}?`)) {
                  const sucesso = await deletarCliente(cliente.id)
                  if (sucesso) {
                    alert('Cliente deletado com sucesso!')
                    buscarClientes() // Atualiza a lista
                  }
                }
              }} style={{
                padding: '8px 15px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}>
                🗑️ Deletar
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

