// Termos de contratação do evento presencial. O texto é um MODELO editável no CRM (Calendário → Formulário): seções começam com
// "## Título" e cada linha não vazia abaixo é um item. Campos entre chaves são preenchidos com os dados do formulário
// (página e PDF). Cada texto salvo vira uma versão nova e imutável (siteConfig/eventForm.terms); o pedido grava a versão aceita.
// Versões que vêm no código: 2 (primeira publicada, nunca alterar) e 3 (padrão atual). Revisão em docs/termos-evento-presencial.md.

export const TERMS_VERSION = '3';

export const PROVIDER = {
  tradeName: 'Herói da Cidade',
  legalName: '52.411.770 IGOR HENRIQUES VIEGAS (MEI)',
  cnpj: '52.411.770/0001-20',
  city: 'Betim/MG',
};

/** Prazo padrão do sinal (dias), editável no CRM. Demais prazos ficam no próprio texto dos termos. */
export const DEPOSIT_DAYS = 3;

/** Campos aceitos no modelo e o que cada um mostra. */
export const TERMS_FIELDS = {
  prestador: 'Herói da Cidade, razão social, CNPJ e cidade',
  contratante: 'nome do responsável', cpf: 'CPF', whatsapp: 'WhatsApp', email: 'e-mail',
  pacote: 'pacote escolhido', duracao: 'duração do pacote', data: 'data do evento', horario: 'horário de início', endereco: 'endereço do evento',
  prazoSinal: 'prazo do sinal (dias)',
};

/**
 * Versão 1: termos do Google Forms ("Termos de contrato.docx"), aceitos nos formulários anteriores ao site (até A214) e usados no
 * PDF que o CRM gera para pedidos importados ou criados à mão. Texto original, inclusive a numeração. Não editar.
 */
const TERMS_V1 = `## 1. Descrição dos Serviços
O Prestador de Serviços fornecerá a participação do personagem Homem-Aranha que fará uma animação temática durante o evento de acordo com as condições e especificações acordadas. O trabalho prestado não se trata de Recreação infantil e sim de uma Presença Teatral Animada em que o ator interpretará nas devidas condições, o personagem contratado.

## 2. Pagamento
O contratante concorda em efetuar o pagamento no valor total conforme detalhes de pagamento acertados.

## 3. Cancelamento
O contratante compreende que em caso de cancelamento por parte dele, o valor pago até o momento não será reembolsado, a menos que especificado de outra forma no presente termo.

## 5. Responsabilidades do Contratante
O contratante se compromete a fornecer as condições necessárias para a realização dos serviços, incluindo espaço adequado, energia elétrica e quaisquer outros recursos especificamente solicitados pelo Prestador de Serviços e reconhece que é responsabilidade do mesmo supervisionar todas as crianças durante a execução do serviço.

## 6. Condições de Execução
O contratante compreende e concorda que:
6.1 Segurança do Ator: O ator que interpretará o serviço não será obrigado a realizar movimentos ou ações nas quais possam comprometer sua segurança e/ou bem-estar. Caso o ator e/ou Agente considere que uma ação específica é arriscada ou insegura para ele e/ou demais convidados, ele terá o direito de não realizá-la.
6.2 Pausas e Hidratação: O ator terá o direito de solicitar pausas caso necessário para descanso e hidratação. O contratante entende que a saúde do ator são prioridades, e que as condições de respiração do uniforme é limitada, por isso, essas pausas serão concedidas de forma a garantir o seu bem-estar durante a execução do serviço contratado.
6.3 Ajustes de Performance: O ator pode fazer ajustes na performance com o objetivo de garantir a segurança das crianças e a sua própria segurança. Esses ajustes podem incluir modificações nas atividades ou ações planejadas, sempre visando a segurança e o conforto de todos os envolvidos.

## 7. Responsabilidade do Prestador de Serviço
O Prestador de Serviço deve prestar o serviço conforme o pacote oferecido ao Contratante, cumprindo o horário e programações previamente estabelecidas. Deve entregar uma performance teatral temática, um ator em condições para a execução do serviço contratado e demais itens inclusos no pacote de serviços.

## 8. Mudanças de Programação
O contratante compreende que mudanças de horário ou de detalhes do evento podem afetar a execução do serviço de animação infantil. Caso haja necessidade de alterações, se compromete a informar ao Prestador de Serviços com a devida antecedência para que possam ajustar os planos.

## 9. Participantes com Necessidades Especiais
O contratante informará ao Prestador de Serviços com antecedência sobre a presença de participantes com necessidades especiais ou restrições médicas. Isso garantirá que as atividades planejadas possam ser adaptadas para acomodar esses participantes da melhor forma possível.

## 10. Interrupção ou Comportamento Inadequado
O contratante compreende que o Prestador de Serviços se reserva o direito de interromper ou encerrar a execução do serviço caso haja comportamento inadequado, agressivo ou disruptivo por parte dos participantes. Nesse caso, o pagamento não será reembolsado.

## 11. Comunicação
O contratante se compromete a manter uma comunicação clara e eficaz com o Prestador de Serviços, fornecendo informações precisas e atualizadas sobre o evento, como localização, horários e quaisquer requisitos especiais.

## 12. Renúncia de Responsabilidade
O contratante isenta o Prestador de Serviços de qualquer responsabilidade por lesões, danos ou perdas ocorridas durante a execução do serviço de animação infantil, exceto em casos de negligência grosseira.

## 13. Força Maior
O contratante compreende que o Prestador de Serviços não será responsável por atrasos ou incapacidade de cumprir as obrigações em casos de circunstâncias imprevistas, como condições climáticas extremas ou eventos de força maior.
Da mesma forma, o Contratado deverá oferecer alternativas para o reagendamento do evento em caso de força maior por parte do Contratante, caso não haja essa possibilidade o valor já pago pode ser devolvido integralmente.

## 12. Aceitação das Condições
Ao assinalar a caixa no formulário, o contratante confirma que leu e compreendeu todas as condições acima e concorda em cumpri-las integralmente.`;

/** Versão 2: texto aceito pelos primeiros formulários. Não editar (o histórico precisa continuar igual). */
const TERMS_V2 = `## 1. Partes
Prestador: {prestador}.
Contratante: {contratante}, CPF {cpf}, WhatsApp {whatsapp}, e-mail {email}.

## 2. Objeto
Participação de um ator caracterizado como personagem inspirado no Homem-Aranha, em presença teatral animada, no pacote {pacote} ({duracao}), em {data} às {horario}, no endereço {endereco}.
O serviço não é recreação infantil: o ator interpreta o personagem; brincadeiras, fotos e interações fazem parte da apresentação, dentro das condições deste termo.
O Herói da Cidade não tem vínculo com a Marvel, a Disney ou os titulares do personagem.
Os adicionais escolhidos no formulário (teia extra, vídeos) fazem parte deste contrato, com os prazos descritos em cada um.

## 3. Valor e pagamento
O valor total é o do orçamento enviado pelo WhatsApp para a data e o endereço informados, somado aos adicionais escolhidos.
Sinal de 50% do valor total, pago em até {prazoSinal} dias após o envio deste formulário, para reservar a data. A data só fica garantida após a confirmação do sinal; sem ele, o pré-agendamento pode ser cancelado e a data liberada.
O restante (50%) deve ser pago até o início do evento. Sem o pagamento do restante, o prestador pode não iniciar a apresentação.
Mudança de data ou de endereço pode alterar o valor (deslocamento); o novo valor é informado antes de ser confirmado.

## 4. Arrependimento, cancelamento e reagendamento
Arrependimento: o contratante pode desistir em até 7 dias após o envio deste formulário, com devolução integral do que foi pago, desde que o evento não aconteça dentro desse prazo.
Reagendamento pelo contratante: pedido com pelo menos 7 dias de antecedência pode ser feito uma vez, sem custo, para data disponível em até 6 meses, com o valor pago virando crédito. Diferença de valor por data ou deslocamento é ajustada.
Cancelamento pelo contratante fora do prazo de arrependimento: o sinal fica retido como arras, para cobrir a data reservada e recusada a outros clientes. Valores pagos além do sinal são devolvidos.
Cancelamento pelo prestador (exceto força maior): devolução integral do que foi pago ou, se o contratante preferir, reagendamento sem custo.

## 5. Horário, duração e atrasos
O ator chega ao local com antecedência para se preparar e inicia no horário combinado.
Se a festa não estiver pronta no horário, o ator aguarda até 15 minutos; depois disso, a apresentação começa ou o tempo de espera é descontado da duração.
Tempo além do contratado depende da agenda do ator e é cobrado à parte, combinado na hora.
Atraso do prestador por motivo dele: a duração contratada é cumprida a partir da chegada; se não for possível, o tempo não prestado é devolvido proporcionalmente.

## 6. Responsabilidades do contratante
Supervisionar as crianças durante toda a apresentação; o ator não é responsável pela guarda delas.
Oferecer espaço adequado e seguro para a apresentação e um local reservado para o ator se trocar (banheiro ou cômodo).
Em local aberto, prever área coberta em caso de chuva.
Informar com antecedência o acesso ao local (portaria, estacionamento, escadas) e mudanças de horário ou de detalhes do evento.
Informar participantes com necessidades especiais ou restrições médicas, para que a apresentação seja adaptada.

## 7. Segurança e bem-estar do ator
O ator não é obrigado a fazer movimentos ou ações que coloquem em risco a sua segurança ou a dos convidados.
O ator pode fazer pausas curtas para hidratação e respiração, pois a respiração dentro do uniforme é limitada.
O ator pode ajustar a apresentação para garantir a segurança das crianças e a sua.
Em caso de comportamento agressivo ou inadequado de participantes, o ator avisa o responsável; se continuar, pode encerrar a apresentação, sem devolução do valor.

## 8. Responsabilidades do prestador
Prestar o serviço conforme o pacote, no horário e no endereço combinados, com ator em condições e com os itens do pacote.
Responder por danos causados pelo ator ou pelo prestador, nos termos da lei. Não responde por danos causados pelos convidados, pela estrutura do local ou pela falta de supervisão das crianças.

## 9. Força maior
Nenhuma das partes responde por atraso ou impossibilidade causados por força maior (ex.: tempestade, interdição de vias, doença súbita do ator sem substituto, emergências).
Nesses casos, o evento é reagendado sem custo para data disponível; se não houver data possível para o contratante, o valor pago é devolvido integralmente.

## 10. Uso de imagem
Com a autorização marcada no formulário, o responsável legal autoriza o uso gratuito de fotos e vídeos da apresentação nas redes sociais e no site do Herói da Cidade, para divulgação do trabalho.
As imagens não são vendidas nem cedidas a terceiros.
A autorização pode ser revogada a qualquer momento pelo WhatsApp; publicações já feitas são removidas em até 7 dias.
Sem autorização, nenhuma imagem dos participantes é publicada.

## 11. Dados pessoais
Os dados deste formulário são usados para executar o serviço (agendamento, contato, pagamento e emissão deste termo) e guardados enquanto forem necessários para isso e para obrigações legais. Detalhes e direitos do titular: heroidacidade.com/privacidade.

## 12. Aceite
Ao marcar a caixa de aceite e concluir o formulário, o contratante declara que leu e concorda com estes termos. O aceite é registrado com o número do formulário, a versão dos termos e a data e hora do envio, e uma cópia em PDF fica disponível para download.

## 13. Foro
Fica eleito o foro do domicílio do contratante.`;

/** Versão 3 (padrão): ajustes do dono em 16/10/2026 (5.1, 5.2, 6.2, 7.4). */
export const TERMS_TEMPLATE = `## 1. Partes
Prestador: {prestador}.
Contratante: {contratante}, CPF {cpf}, WhatsApp {whatsapp}, e-mail {email}.

## 2. Objeto
Participação de um ator caracterizado como personagem inspirado no Homem-Aranha, em presença teatral animada, no pacote {pacote} ({duracao}), em {data} às {horario}, no endereço {endereco}.
O serviço não é recreação infantil: o ator interpreta o personagem; brincadeiras, fotos e interações fazem parte da apresentação, dentro das condições deste termo.
O Herói da Cidade não tem vínculo com a Marvel, a Disney ou os titulares do personagem.
Os adicionais escolhidos no formulário (teia extra, vídeos) fazem parte deste contrato, com os prazos descritos em cada um.

## 3. Valor e pagamento
O valor total é o do orçamento enviado pelo WhatsApp para a data e o endereço informados, somado aos adicionais escolhidos.
Sinal de 50% do valor total, pago em até {prazoSinal} dias após o envio deste formulário, para reservar a data. A data só fica garantida após a confirmação do sinal; sem ele, o pré-agendamento pode ser cancelado e a data liberada.
O restante (50%) deve ser pago até o início do evento. Sem o pagamento do restante, o prestador pode não iniciar a apresentação.
Mudança de data ou de endereço pode alterar o valor (deslocamento); o novo valor é informado antes de ser confirmado.

## 4. Arrependimento, cancelamento e reagendamento
Arrependimento: o contratante pode desistir em até 7 dias após o envio deste formulário, com devolução integral do que foi pago, desde que o evento não aconteça dentro desse prazo.
Reagendamento pelo contratante: pedido com pelo menos 7 dias de antecedência pode ser feito uma vez, sem custo, para data disponível em até 6 meses, com o valor pago virando crédito. Diferença de valor por data ou deslocamento é ajustada.
Cancelamento pelo contratante fora do prazo de arrependimento: o sinal fica retido como arras, para cobrir a data reservada e recusada a outros clientes. Valores pagos além do sinal são devolvidos.
Cancelamento pelo prestador (exceto força maior): devolução integral do que foi pago ou, se o contratante preferir, reagendamento sem custo.

## 5. Horário, duração e atrasos
O ator chega ao local com antecedência e inicia no horário combinado.
Se for necessário adiar o início da participação, o tempo de espera é descontado da duração, exceto em caso de força maior, quando há tolerância de 10 minutos.
Tempo além do contratado depende da agenda do ator e é cobrado à parte, combinado na hora.
Atraso do prestador por motivo dele: a duração contratada é cumprida a partir da chegada; se não for possível, o tempo não prestado é devolvido proporcionalmente.

## 6. Responsabilidades do contratante
Supervisionar as crianças durante toda a apresentação; o ator não é responsável pela guarda delas.
Oferecer espaço adequado e seguro para a apresentação.
Em local aberto, prever área coberta em caso de chuva.
Informar com antecedência o acesso ao local (portaria, estacionamento, escadas) e mudanças de horário ou de detalhes do evento.
Informar participantes com necessidades especiais ou restrições médicas, para que a apresentação seja adaptada.

## 7. Segurança e bem-estar do ator
O ator não é obrigado a fazer movimentos ou ações que coloquem em risco a sua segurança ou a dos convidados.
O ator pode fazer pausas curtas para hidratação e respiração, pois a respiração dentro do uniforme é limitada.
O ator pode ajustar a apresentação para garantir a segurança das crianças e a sua.
Em caso de comportamento agressivo ou inadequado de participantes, o ator ou o agente avisa o responsável; se continuar, pode encerrar a apresentação, sem devolução do valor.

## 8. Responsabilidades do prestador
Prestar o serviço conforme o pacote, no horário e no endereço combinados, com ator em condições e com os itens do pacote.
Responder por danos causados pelo ator ou pelo prestador, nos termos da lei. Não responde por danos causados pelos convidados, pela estrutura do local ou pela falta de supervisão das crianças.

## 9. Força maior
Nenhuma das partes responde por atraso ou impossibilidade causados por força maior (ex.: tempestade, interdição de vias, doença súbita do ator sem substituto, emergências).
Nesses casos, o evento é reagendado sem custo para data disponível; se não houver data possível para o contratante, o valor pago é devolvido integralmente.

## 10. Uso de imagem
Com a autorização marcada no formulário, o responsável legal autoriza o uso gratuito de fotos e vídeos da apresentação nas redes sociais e no site do Herói da Cidade, para divulgação do trabalho.
As imagens não são vendidas nem cedidas a terceiros.
A autorização pode ser revogada a qualquer momento pelo WhatsApp; publicações já feitas são removidas em até 7 dias.
Sem autorização, nenhuma imagem dos participantes é publicada.

## 11. Dados pessoais
Os dados deste formulário são usados para executar o serviço (agendamento, contato, pagamento e emissão deste termo) e guardados enquanto forem necessários para isso e para obrigações legais. Detalhes e direitos do titular: heroidacidade.com/privacidade.

## 12. Aceite
Ao marcar a caixa de aceite e concluir o formulário, o contratante declara que leu e concorda com estes termos. O aceite é registrado com o número do formulário, a versão dos termos e a data e hora do envio, e uma cópia em PDF fica disponível para download.

## 13. Foro
Fica eleito o foro do domicílio do contratante.`;

/** Versões que vêm no código (as do CRM ficam em siteConfig/eventForm.terms). */
export const BUILTIN_TERMS = { 1: TERMS_V1, 2: TERMS_V2, 3: TERMS_TEMPLATE };
/** Versão do Google Forms: a dos pedidos que não vieram do formulário do site. */
export const LEGACY_TERMS_VERSION = '1';

/** Modelo → seções [{ title, items }]. Linhas antes do primeiro "## " são ignoradas. */
export function parseTerms(text) {
  const sections = [];
  for (const raw of String(text ?? '').split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith('## ')) sections.push({ title: line.slice(3).trim(), items: [] });
    else if (line && sections.length) sections[sections.length - 1].items.push(line);
  }
  return sections.filter((s) => s.title && s.items.length);
}

/** Campos desconhecidos no modelo (provável erro de digitação). */
export const unknownTermsFields = (text) => [...new Set([...String(text ?? '').matchAll(/\{(\w+)\}/g)].map((m) => m[1]).filter((key) => !(key in TERMS_FIELDS)))];

/**
 * Seções com os campos preenchidos. `data`: { packageTitle, duration, date, time, location, name, cpf, whatsapp, email };
 * campo ainda vazio aparece como [campo]. `text` = modelo da versão (padrão: versão 2).
 */
export function termsSections(data = {}, { text = TERMS_TEMPLATE, depositDays = DEPOSIT_DAYS } = {}) {
  const values = {
    prestador: `${PROVIDER.tradeName}, ${PROVIDER.legalName}, CNPJ ${PROVIDER.cnpj}, ${PROVIDER.city}`,
    contratante: data.name, cpf: data.cpf, whatsapp: data.whatsapp, email: data.email, pacote: data.packageTitle, duracao: data.duration,
    data: data.date, horario: data.time, endereco: data.location, prazoSinal: String(depositDays),
  };
  const fill = (line) => line.replace(/\{(\w+)\}/g, (match, key) => (key in values ? values[key] || `[${TERMS_FIELDS[key]}]` : match));
  return parseTerms(text).map((s) => ({ title: fill(s.title), items: s.items.map(fill) }));
}
