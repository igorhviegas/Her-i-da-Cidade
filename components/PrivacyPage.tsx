import React from 'react';
import { Link } from '../lib/router';
import { useSiteConfig } from '../services/siteConfigService';
import { PRIVACY_CONTROLLER, PRIVACY_UPDATED } from '../services/privacy.js';

const INSTAGRAM_URL = 'https://www.instagram.com/oheroidacidade/';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="mt-8">
    <h2 className="text-lg font-extrabold text-white">{title}</h2>
    <div className="mt-2 space-y-3 text-sm leading-relaxed text-white/75">{children}</div>
  </section>
);

const Item: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <li className="rounded-xl border border-white/10 bg-white/[0.04] p-3.5">
    <p className="font-bold text-white">{title}</p>
    <p className="mt-1">{children}</p>
  </li>
);

/**
 * Política de Privacidade pública (/privacidade): texto curto, em linguagem simples. Os formulários só trazem uma linha e o link para cá.
 * Descreve o que o código e a operação realmente fazem; dados do responsável que faltam (CNPJ, e-mail) estão em services/privacy.js.
 */
export const PrivacyPage: React.FC = () => {
  const { whatsappUrl } = useSiteConfig();
  const { tradeName, legalName, cnpj, email } = PRIVACY_CONTROLLER;
  const link = 'font-semibold text-blue-300 underline hover:text-blue-200';

  return (
    <main className="min-h-screen bg-gradient-to-b from-black to-[#0B1929] px-4 pb-12 pt-5 text-white">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6 flex justify-center">
          <Link href="/" aria-label="Herói da Cidade: ir para o site" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#0072d2] shadow-lg shadow-blue-600/30">
              <img src="/images/logo-128.webp" alt="" className="h-full w-full scale-125 object-cover" />
            </span>
            <span className="text-base font-bold tracking-tight">Herói da Cidade</span>
          </Link>
        </header>

        <h1 className="text-2xl font-extrabold leading-tight sm:text-3xl">Política de Privacidade</h1>
        <p className="mt-2 text-sm text-white/55">Atualizada em {PRIVACY_UPDATED}. Em resumo: pedimos só o que precisamos para atender você, e fotos ou vídeos da criança só são divulgados com a sua autorização.</p>

        <Section title="Quem cuida dos seus dados">
          <p>
            <strong className="text-white">{tradeName}</strong>
            {legalName ? ` (${legalName})` : ''}
            {cnpj ? `, CNPJ ${cnpj}` : ''} decide como os dados são usados (na LGPD, é o “controlador”).
          </p>
          <p>
            Para qualquer assunto sobre seus dados, fale conosco pelo{' '}
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className={link}>WhatsApp oficial</a>
            {' '}ou pelo <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className={link}>Instagram @oheroidacidade</a>
            {email ? <>, ou escreva para <a href={`mailto:${email}`} className={link}>{email}</a></> : null}.
          </p>
        </Section>

        <Section title="O que coletamos e para quê">
          <ul className="space-y-2.5">
            <Item title="Agendar vídeo chamada (site)">
              Nome do responsável, e-mail, WhatsApp (e o número da chamada, se for outro), nome e idade da criança, tema e detalhes, e o fuso horário do seu navegador.
              Usamos para reservar o horário, criar o compromisso na agenda, enviar o convite, falar com você pelo WhatsApp e confirmar o pagamento.
              Reservas sem pagamento no prazo são excluídas automaticamente.
            </Item>
            <Item title="Pedido de áudio (página dos clientes)">
              Data da festa, nome da criança e a mensagem. O site não guarda nada: ele só abre o seu WhatsApp com a mensagem pronta. O pedido só chega até nós se você tocar em enviar.
            </Item>
            <Item title="Contratação e atendimento (WhatsApp)">
              Nome, número de WhatsApp e o que você nos conta (nome da criança, tema, detalhes do vídeo) para atender, receber o pagamento, produzir e entregar.
            </Item>
            <Item title="Festas e eventos presenciais">
              Pelo formulário da festa: nome do responsável, nome e data de nascimento da criança, data, horário e endereço do evento e se a criança tem alguma necessidade especial (para o Herói poder adaptar a atuação).
              Usamos para organizar e realizar o evento. A sua escolha sobre uso de imagem é registrada à parte (veja “Fotos, vídeos e voz”).
            </Item>
            <Item title="Campeonato Viegas Kart">
              A página mostra o nome, os resultados e os vídeos dos pilotos inscritos, a partir dos relatórios de cronometragem das corridas.
            </Item>
          </ul>
          <p>Usamos esses dados para prestar o serviço que você pediu (execução do contrato) e para cumprir obrigações legais, como as fiscais. Não usamos para outras finalidades sem avisar você.</p>
        </Section>

        <Section title="Crianças">
          <p>
            Os dados da criança são informados pelo pai, mãe ou responsável, e só para personalizar o serviço (chamada, vídeo, áudio) e organizar a festa.
            Pedimos o mínimo: o primeiro nome basta na maioria dos casos. A informação sobre necessidade especial serve apenas para adaptar a atuação.
          </p>
        </Section>

        <Section title="Fotos, vídeos e voz">
          <p>
            Contratar um serviço <strong className="text-white">não</strong> autoriza, por si só, a divulgação de imagens. Durante a festa, fotos e vídeos podem ser feitos como parte do serviço,
            mas só são divulgados se o responsável autorizar de forma específica, em pergunta própria, separada dos termos de contratação.
          </p>
          <p>
            Hoje a autorização pedida no formulário da festa vale para a divulgação nas redes sociais do Herói da Cidade. Qualquer outro uso exige uma nova autorização.
            Você pode mudar de ideia quando quiser, pelos canais acima: paramos de usar e retiramos dos nossos canais o que já foi publicado
            (não conseguimos recolher cópias que outras pessoas já tenham salvo ou compartilhado).
          </p>
        </Section>

        <Section title="Com quem compartilhamos">
          <p>Só com quem precisa para o serviço funcionar, e apenas o necessário:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li><strong className="text-white">WhatsApp (Meta) e ManyChat:</strong> conversas de atendimento e confirmação do pagamento.</li>
            <li><strong className="text-white">Google:</strong> Agenda (compromissos das chamadas e das festas), Formulários (cadastro da festa), Maps (cálculo do deslocamento até o local do evento) e YouTube (vídeos).</li>
            <li><strong className="text-white">Google Firebase e Vercel:</strong> banco de dados do atendimento e hospedagem do site e dos arquivos.</li>
            <li><strong className="text-white">Equipe que acompanha a festa:</strong> nome do responsável e da criança, horário, endereço e as informações necessárias para o evento.</li>
          </ul>
          <p>Alguns desses provedores podem guardar dados em servidores fora do Brasil. O site não envia seus dados para anunciantes nem usa ferramentas de publicidade.</p>
        </Section>

        <Section title="Por quanto tempo guardamos">
          <p>
            Pelo tempo necessário para prestar o serviço, atender você depois (dúvidas, reentrega) e cumprir obrigações legais, como as fiscais e contábeis.
            Quando deixam de ser necessários, os dados são eliminados ou anonimizados, e você pode pedir isso quando quiser (ressalvado o que a lei nos obriga a manter).
          </p>
        </Section>

        <Section title="Seus direitos">
          <p>
            Você pode pedir, pelos canais acima: confirmação de que tratamos seus dados e acesso a eles; correção; anonimização, bloqueio ou eliminação do que for desnecessário;
            informação sobre com quem compartilhamos; revogação de autorizações; e oposição a algum uso. Respondemos em até 15 dias, como a LGPD determina.
            Para sua segurança, podemos pedir que confirme que é você, ou o responsável pela criança, antes de atender.
          </p>
          <p>
            Se sentir que algo não foi resolvido, você também pode procurar a Autoridade Nacional de Proteção de Dados (ANPD).
          </p>
        </Section>

        <Section title="Navegando no site">
          <p>
            Não usamos cookies de publicidade nem ferramentas de análise de visitantes. Ao abrir o site, seu navegador carrega fontes e estilos de servidores de terceiros (Google Fonts e Tailwind),
            que recebem o endereço IP do seu aparelho, e os vídeos incorporados são carregados do YouTube quando você toca para assistir.
          </p>
        </Section>

        <p className="mt-10 border-t border-white/10 pt-5 text-center text-[11px] text-white/35">
          © {tradeName} · <Link href="/" className="underline hover:text-white/60">heroidacidade.com</Link>
        </p>
      </div>
    </main>
  );
};
