// Termos de contratação do evento presencial: fonte única do texto mostrado no formulário do site e no PDF.
// Mudou o texto? Suba TERMS_VERSION: cada pedido grava a versão aceita (eventFormSite.termsVersion).
// Rascunho revisado em docs/termos-evento-presencial.md; valores marcados lá como "a confirmar" ainda dependem do dono.

export const TERMS_VERSION = '2';

export const PROVIDER = {
  tradeName: 'Herói da Cidade',
  legalName: '52.411.770 IGOR HENRIQUES VIEGAS (MEI)',
  cnpj: '52.411.770/0001-20',
  city: 'Betim/MG',
};

/** Prazos dos termos (os mesmos que o sistema aplica). */
export const DEPOSIT_DAYS = 3;
export const RESCHEDULE_NOTICE_DAYS = 7;
export const CREDIT_MONTHS = 6;
export const WAIT_MINUTES = 15;

const blank = (value, fallback = '______') => (value ? String(value) : fallback);

/**
 * Seções dos termos. Sem `data` sai a versão genérica (lida no formulário); com os dados do envio sai preenchida (PDF).
 * `data`: { number, packageTitle, duration, date, time, location, name, cpf, whatsapp, email }
 */
export function termsSections(data = {}) {
  const partyLine = data.name
    ? `Contratante: ${data.name}, CPF ${blank(data.cpf)}, WhatsApp ${blank(data.whatsapp)}, e-mail ${blank(data.email)}.`
    : 'Contratante: o responsável identificado neste formulário (nome, CPF, WhatsApp e e-mail).';
  const objectLine = data.packageTitle
    ? `Participação de um ator caracterizado como personagem inspirado no Homem-Aranha, em presença teatral animada, no pacote ${data.packageTitle} (${blank(data.duration)}), em ${blank(data.date)} às ${blank(data.time)}, no endereço ${blank(data.location)}.`
    : 'Participação de um ator caracterizado como personagem inspirado no Homem-Aranha, em presença teatral animada, no pacote, data, horário e endereço informados neste formulário, com a duração do pacote escolhido.';
  return [
    { title: '1. Partes', items: [
      `Prestador: ${PROVIDER.tradeName}, ${PROVIDER.legalName}, CNPJ ${PROVIDER.cnpj}, ${PROVIDER.city}.`,
      partyLine,
    ] },
    { title: '2. Objeto', items: [
      objectLine,
      'O serviço não é recreação infantil: o ator interpreta o personagem; brincadeiras, fotos e interações fazem parte da apresentação, dentro das condições deste termo.',
      'O Herói da Cidade não tem vínculo com a Marvel, a Disney ou os titulares do personagem.',
      'Os adicionais escolhidos no formulário (teia extra, vídeos) fazem parte deste contrato, com os prazos descritos em cada um.',
    ] },
    { title: '3. Valor e pagamento', items: [
      'O valor total é o do orçamento enviado pelo WhatsApp para a data e o endereço informados, somado aos adicionais escolhidos.',
      `Sinal de 50% do valor total, pago em até ${DEPOSIT_DAYS} dias após o envio deste formulário, para reservar a data. A data só fica garantida após a confirmação do sinal; sem ele, o pré-agendamento pode ser cancelado e a data liberada.`,
      'O restante (50%) deve ser pago até o início do evento. Sem o pagamento do restante, o prestador pode não iniciar a apresentação.',
      'Mudança de data ou de endereço pode alterar o valor (deslocamento); o novo valor é informado antes de ser confirmado.',
    ] },
    { title: '4. Arrependimento, cancelamento e reagendamento', items: [
      'Arrependimento: o contratante pode desistir em até 7 dias após o envio deste formulário, com devolução integral do que foi pago, desde que o evento não aconteça dentro desse prazo.',
      `Reagendamento pelo contratante: pedido com pelo menos ${RESCHEDULE_NOTICE_DAYS} dias de antecedência pode ser feito uma vez, sem custo, para data disponível em até ${CREDIT_MONTHS} meses, com o valor pago virando crédito. Diferença de valor por data ou deslocamento é ajustada.`,
      'Cancelamento pelo contratante fora do prazo de arrependimento: o sinal fica retido como arras, para cobrir a data reservada e recusada a outros clientes. Valores pagos além do sinal são devolvidos.',
      'Cancelamento pelo prestador (exceto força maior): devolução integral do que foi pago ou, se o contratante preferir, reagendamento sem custo.',
    ] },
    { title: '5. Horário, duração e atrasos', items: [
      'O ator chega ao local com antecedência para se preparar e inicia no horário combinado.',
      `Se a festa não estiver pronta no horário, o ator aguarda até ${WAIT_MINUTES} minutos; depois disso, a apresentação começa ou o tempo de espera é descontado da duração.`,
      'Tempo além do contratado depende da agenda do ator e é cobrado à parte, combinado na hora.',
      'Atraso do prestador por motivo dele: a duração contratada é cumprida a partir da chegada; se não for possível, o tempo não prestado é devolvido proporcionalmente.',
    ] },
    { title: '6. Responsabilidades do contratante', items: [
      'Supervisionar as crianças durante toda a apresentação; o ator não é responsável pela guarda delas.',
      'Oferecer espaço adequado e seguro para a apresentação e um local reservado para o ator se trocar (banheiro ou cômodo).',
      'Em local aberto, prever área coberta em caso de chuva.',
      'Informar com antecedência o acesso ao local (portaria, estacionamento, escadas) e mudanças de horário ou de detalhes do evento.',
      'Informar participantes com necessidades especiais ou restrições médicas, para que a apresentação seja adaptada.',
    ] },
    { title: '7. Segurança e bem-estar do ator', items: [
      'O ator não é obrigado a fazer movimentos ou ações que coloquem em risco a sua segurança ou a dos convidados.',
      'O ator pode fazer pausas curtas para hidratação e respiração, pois a respiração dentro do uniforme é limitada.',
      'O ator pode ajustar a apresentação para garantir a segurança das crianças e a sua.',
      'Em caso de comportamento agressivo ou inadequado de participantes, o ator avisa o responsável; se continuar, pode encerrar a apresentação, sem devolução do valor.',
    ] },
    { title: '8. Responsabilidades do prestador', items: [
      'Prestar o serviço conforme o pacote, no horário e no endereço combinados, com ator em condições e com os itens do pacote.',
      'Responder por danos causados pelo ator ou pelo prestador, nos termos da lei. Não responde por danos causados pelos convidados, pela estrutura do local ou pela falta de supervisão das crianças.',
    ] },
    { title: '9. Força maior', items: [
      'Nenhuma das partes responde por atraso ou impossibilidade causados por força maior (ex.: tempestade, interdição de vias, doença súbita do ator sem substituto, emergências).',
      'Nesses casos, o evento é reagendado sem custo para data disponível; se não houver data possível para o contratante, o valor pago é devolvido integralmente.',
    ] },
    { title: '10. Uso de imagem', items: [
      'Com a autorização marcada no formulário, o responsável legal autoriza o uso gratuito de fotos e vídeos da apresentação nas redes sociais e no site do Herói da Cidade, para divulgação do trabalho.',
      'As imagens não são vendidas nem cedidas a terceiros.',
      'A autorização pode ser revogada a qualquer momento pelo WhatsApp; publicações já feitas são removidas em até 7 dias.',
      'Sem autorização, nenhuma imagem dos participantes é publicada.',
    ] },
    { title: '11. Dados pessoais', items: [
      'Os dados deste formulário são usados para executar o serviço (agendamento, contato, pagamento e emissão deste termo) e guardados enquanto forem necessários para isso e para obrigações legais. Detalhes e direitos do titular: heroidacidade.com/privacidade.',
    ] },
    { title: '12. Aceite', items: [
      'Ao marcar a caixa de aceite e concluir o formulário, o contratante declara que leu e concorda com estes termos. O aceite é registrado com o número do formulário, a versão dos termos e a data e hora do envio, e uma cópia em PDF fica disponível para download.',
    ] },
    { title: '13. Foro', items: ['Fica eleito o foro do domicílio do contratante.'] },
  ];
}
