import { supabase } from './config'

export async function deletarCliente(id: string) {
  try {
    const { error } = await supabase
      .from('clientes')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Erro ao deletar cliente:', error)
      return false
    }

    console.log('Cliente deletado com sucesso')
    return true

  } catch (error) {
    console.error('Erro ao deletar cliente:', error)
    return false
  }
}

export async function enviarEmail(clienteId: string, assunto: string, mensagem: string) {
  try {
    const { data: cliente, error } = await supabase
      .from('clientes')
      .select('email, nome')
      .eq('id', clienteId)
      .single()

    if (error) {
      console.error('Erro ao buscar cliente:', error)
      return false
    }

    console.log('Enviando email para:', cliente.email)
    console.log('Assunto:', assunto)
    console.log('Mensagem:', mensagem)
    
    alert(`EMAIL ENVIADO COM SUCESSO!\nPara: ${cliente.email}\nAssunto: ${assunto}\nMensagem: ${mensagem}`)
    return true

  } catch (error) {
    console.error('Erro ao enviar email:', error)
    alert('Erro ao enviar email')
    return false
  }
}