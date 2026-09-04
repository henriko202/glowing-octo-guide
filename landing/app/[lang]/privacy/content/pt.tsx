import type { Locale } from '@/i18n/config'

export default function Pt({ lang }: { lang: Locale }) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24 text-cream/70">
      <h1 className="mb-8 font-display text-4xl font-semibold text-cream">Política de Privacidade</h1>
      <div className="space-y-6 text-sm leading-relaxed">
        <p>
          <strong className="text-cream">Última atualização:</strong> Junho 2026
        </p>
        <p>Policy version: 2026-06-15</p>

        {/* 1. Quem somos */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">1. Quem Somos</h2>
        <p>
          O controlador de dados das suas informações pessoais é{' '}
          <strong className="text-cream">NEANDERTECH SERVICOS DE TECNOLOGIA LTDA</strong>, localizado em{' '}
          <strong className="text-cream">
            AV SETE DE SETEMBRO, 2775, REBOUÇAS - 80230-010 - Curitiba, Paraná - Brazil
          </strong>{' '}
          (&ldquo;nós&rdquo;, &ldquo;Link Into The SSI&rdquo;).
        </p>
        <p>
          Consultas sobre privacidade:{' '}
          <a
            href="mailto:contact@linkintothessi.com"
            className="text-gold-text hover:underline"
          >
            contact@linkintothessi.com
          </a>
          .
        </p>
        <p>
          Encarregado de Proteção de Dados / Representante UE&ndash;UK:{' '}
          <strong className="text-cream">Henriko Alberton</strong>.
        </p>

        {/* 2. Dados que coletamos e fontes */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">
          2. Dados que Coletamos &amp; Fontes
        </h2>
        <p>
          <strong className="text-cream">Login com LinkedIn (OIDC).</strong> Quando você conecta sua conta do LinkedIn,
          recebemos seu ID de membro do LinkedIn, nome completo, URL da foto de perfil e endereço de e-mail por meio do
          fluxo OpenID Connect do LinkedIn.
        </p>
        <p>
          <strong className="text-cream">Atributos do perfil que você define.</strong> Você pode opcionalmente informar
          seu setor e país nas configurações do perfil.
        </p>
        <p>
          <strong className="text-cream">Posts que você envia.</strong> Armazenamos os posts que você envia ao feed
          compartilhado pela plataforma.
        </p>
        <p>
          <strong className="text-cream">Atividade de engajamento.</strong> Quando você escolhe reagir ou comentar em um
          post do feed, registramos esse engajamento (o tipo de reação ou o texto do comentário que você usa) para medir
          sua atividade e a contagem de interações. A reação ou o comentário em si você faz por conta própria,
          diretamente no LinkedIn. O Serviço abre o post para que você aja e não reage nem comenta no LinkedIn em seu
          nome.
        </p>
        <p>
          <strong className="text-cream">Cobrança.</strong> Os pagamentos de assinatura são processados pelo Stripe.
          Armazenamos seu ID de cliente Stripe e o status da assinatura; não armazenamos dados de cartão de pagamento.
        </p>
        <p>
          <strong className="text-cream">Dados técnicos e de sessão.</strong> Coletamos logs padrão de servidor
          (endereço IP, tipo de navegador, páginas visitadas, horários) para monitoramento de segurança e desempenho.
        </p>
        <p>
          <strong className="text-cream">Sem raspagem de dados.</strong> Não realizamos raspagem de dados do LinkedIn
          nem de qualquer outro site de terceiros. Todos os dados originam-se de suas interações diretas com nossa
          plataforma ou por meio da API do LinkedIn com seu consentimento autorizado.
        </p>

        {/* 3. Por que usamos e bases legais */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">
          3. Por que Usamos &amp; Bases Legais
        </h2>
        <p>
          <strong className="text-cream">Contrato (Art. 6(1)(b) GDPR).</strong> Fornecimento do serviço principal:
          autenticação, exibição do feed, envio de posts e registro do seu engajamento, e gerenciamento da assinatura.
        </p>
        <p>
          <strong className="text-cream">Interesses legítimos (Art. 6(1)(f) GDPR).</strong> Otimização da qualidade do
          feed, prevenção de abuso, garantia de segurança da plataforma e manutenção de estatísticas agregadas e não
          identificáveis sobre o desempenho do serviço.
        </p>
        <p>
          <strong className="text-cream">Consentimento (Art. 6(1)(a) GDPR).</strong> Comunicações de marketing e
          análises opcionais são processadas somente com seu consentimento explícito. Ambas estão{' '}
          <strong className="text-cream">desativadas por padrão</strong> e podem ser alteradas a qualquer momento em{' '}
          <strong className="text-cream">Configurações &rarr; Privacidade &amp; Dados</strong>.
        </p>
        <p>
          <strong className="text-cream">Obrigação legal (Art. 6(1)(c) GDPR).</strong> Retenção de registros de cobrança
          para conformidade fiscal e financeira, manutenção de registros de consentimento e atendimento a solicitações
          legítimas de autoridades supervisoras ou policiais.
        </p>

        {/* 4. Com quem compartilhamos */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">4. Com Quem Compartilhamos</h2>
        <p>Contratamos os seguintes subprocessadores, que podem tratar dados pessoais em nosso nome:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong className="text-cream">LinkedIn</strong> &mdash; autenticação (login OpenID Connect).
          </li>
          <li>
            <strong className="text-cream">Stripe</strong> &mdash; processamento de pagamentos e gestão de assinaturas.
          </li>
          <li>
            <strong className="text-cream">Convex</strong> &mdash; banco de dados de backend e funções serverless.
          </li>
          <li>
            <strong className="text-cream">Cloudflare</strong> &mdash; hospedagem do site de apresentação e da
            aplicação, além de DNS, CDN e proteção contra DDoS.
          </li>
          <li>
            <strong className="text-cream">Resend</strong> &mdash; entrega de e-mails transacionais.
          </li>
          <li>
            <strong className="text-cream">OpenRouter (inferência de IA)</strong> &mdash; geração de sugestões de reação
            e rascunhos de comentários a partir do conteúdo dos seus posts públicos, incluindo imagens. O OpenRouter
            encaminha apenas para provedores de inferência com retenção zero de dados (os prompts não são armazenados
            nem usados para treinamento).
          </li>
        </ul>
        <p>
          <strong className="text-cream">Não vendemos nem compartilhamos suas informações pessoais</strong> para
          publicidade comportamental contextual cruzada ou qualquer outra finalidade comercial.
        </p>

        {/* 5. Transferencias internacionais */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">5. Transferências Internacionais</h2>
        <p>
          Nossos subprocessadores estão localizados principalmente nos Estados Unidos. Quando dados são transferidos
          para fora do Espaço Econômico Europeu ou do Reino Unido, utilizamos as Cláusulas Contratuais Padrão (SCCs) da
          Comissão Europeia como mecanismo de transferência para cada processador. Uma cópia das salvaguardas de
          transferência aplicáveis está disponível mediante solicitação pelo contato{' '}
          <a
            href="mailto:contact@linkintothessi.com"
            className="text-gold-text hover:underline"
          >
            contact@linkintothessi.com
          </a>
          .
        </p>

        {/* 6. Por quanto tempo mantemos */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">6. Por Quanto Tempo Mantemos</h2>
        <p>
          <strong className="text-cream">Exclusão de conta.</strong> Quando você exclui sua conta (ou solicita
          exclusão), seus dados pessoais são marcados para exclusão imediatamente. Um período de tolerância de 30 dias é
          aplicado para permitir recuperação em caso de exclusão acidental, após o qual os dados são permanentemente
          removidos.
        </p>
        <p>
          <strong className="text-cream">Contas inativas.</strong> Contas sem atividade por 24 meses são automaticamente
          tratadas como solicitações de exclusão; notificaremos você antes de remover os dados.
        </p>
        <p>
          <strong className="text-cream">Registros de cobrança.</strong> Registros de transações e assinaturas são
          mantidos no Stripe pelo tempo exigido pelas regulamentações fiscais e financeiras aplicáveis (geralmente 7
          anos).
        </p>
        <p>
          Aplicamos minimização de dados: coletamos apenas o necessário para prestar o serviço e removemos os dados
          assim que não são mais necessários para a finalidade original.
        </p>

        {/* 7. Seus direitos */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">7. Seus Direitos</h2>
        <p>Dependendo da sua jurisdição, você pode ter o direito de:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong className="text-cream">Acesso</strong> &mdash; obter uma cópia dos dados pessoais que mantemos sobre
            você.
          </li>
          <li>
            <strong className="text-cream">Retificação</strong> &mdash; corrigir dados imprecisos ou incompletos.
          </li>
          <li>
            <strong className="text-cream">Exclusão</strong> &mdash; solicitar a remoção dos seus dados (&ldquo;direito
            ao esquecimento&rdquo;).
          </li>
          <li>
            <strong className="text-cream">Restrição</strong> &mdash; pedir que limitemos como processamos seus dados.
          </li>
          <li>
            <strong className="text-cream">Oposição</strong> &mdash; opor-se ao processamento baseado em interesses
            legítimos.
          </li>
          <li>
            <strong className="text-cream">Portabilidade</strong> &mdash; receber seus dados em formato estruturado e
            legível por máquina.
          </li>
          <li>
            <strong className="text-cream">Retirada de consentimento</strong> &mdash; revogar o consentimento para
            marketing ou análises a qualquer momento, sem afetar o processamento anterior.
          </li>
          <li>
            <strong className="text-cream">Apresentar reclamação</strong> &mdash; junto à sua autoridade supervisora
            local (ex.: autoridade nacional de proteção de dados na UE/UK, ou o procurador-geral do estado relevante nos
            EUA).
          </li>
        </ul>
        <p>
          <strong className="text-cream">Como exercer seus direitos.</strong> A forma mais rápida é por meio de{' '}
          <strong className="text-cream">Configurações &rarr; Privacidade &amp; Dados</strong>, onde você pode exportar
          seus dados, excluir sua conta e gerenciar os consentimentos. Você também pode nos contatar em{' '}
          <a
            href="mailto:contact@linkintothessi.com"
            className="text-gold-text hover:underline"
          >
            contact@linkintothessi.com
          </a>
          . Responderemos em até 30 dias (ou no prazo legal quando menor).
        </p>

        {/* 8. California (CCPA/CPRA) */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">
          8. Residentes da Califórnia (CCPA / CPRA)
        </h2>
        <p>
          <strong className="text-cream">Categorias coletadas.</strong> Identificadores (nome, e-mail, ID do LinkedIn,
          endereço IP); informações profissionais ou relacionadas ao emprego (título, setor); atividade na Internet ou
          em rede (logs de sessão); informações comerciais (status de assinatura via Stripe).
        </p>
        <p>
          <strong className="text-cream">Sem venda ou compartilhamento.</strong> Não vendemos informações pessoais. Não
          compartilhamos informações pessoais para publicidade comportamental contextual cruzada.
        </p>
        <p>
          <strong className="text-cream">Seus direitos CCPA/CPRA.</strong> Residentes da Califórnia podem exercer o
          direito de saber quais informações pessoais coletamos, solicitar a exclusão de informações pessoais, corrigir
          informações pessoais imprecisas e optar por não participar de qualquer venda ou compartilhamento futuro. Não
          discriminaremos você por exercer esses direitos.
        </p>
        <p>
          <strong className="text-cream">Agentes autorizados.</strong> Você pode designar um agente autorizado para
          enviar uma solicitação em seu nome. Podemos exigir verificação de identidade e autorização por escrito para
          tais solicitações.
        </p>
        <p>
          Para enviar uma solicitação de privacidade da Califórnia, use{' '}
          <strong className="text-cream">Configurações &rarr; Privacidade &amp; Dados</strong> ou envie um e-mail para{' '}
          <a
            href="mailto:contact@linkintothessi.com"
            className="text-gold-text hover:underline"
          >
            contact@linkintothessi.com
          </a>
          .
        </p>

        {/* 9. Brasil (LGPD) */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">9. Usuários Brasileiros (LGPD)</h2>
        <p>
          Em conformidade com a Lei Geral de Proteção de Dados (LGPD) do Brasil, você possui os direitos previstos no
          Art. 18 da LGPD, incluindo: confirmação da existência do tratamento; acesso aos seus dados; correção de dados
          incompletos ou imprecisos; anonimização, bloqueio ou eliminação de dados desnecessários ou excessivos;
          portabilidade; eliminação de dados tratados com base no consentimento; informação sobre entidades públicas e
          privadas com as quais compartilhamos dados; informação sobre a possibilidade de negar consentimento e as
          consequências; e revogação do consentimento.
        </p>
        <p>Reclamações podem ser apresentadas à Autoridade Nacional de Proteção de Dados (ANPD).</p>
        <p>
          Nosso encarregado (Data Protection Officer / representante LGPD):{' '}
          <strong className="text-cream">Henriko Alberton</strong>.
        </p>

        {/* 10. Cookies e armazenamento */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">10. Cookies &amp; Armazenamento</h2>
        <p>
          Utilizamos apenas armazenamento de navegador <strong className="text-cream">essencial</strong> (um token de
          sessão para manter você conectado e suas preferências). Não usamos cookies de publicidade, rastreamento entre
          sites ou análises não essenciais. Para detalhes completos, consulte nossa{' '}
          <a
            href={`/${lang}/cookies`}
            className="text-gold-text hover:underline"
          >
            Política de Cookies &amp; Armazenamento
          </a>
          .
        </p>

        {/* 11. Criancas / idade */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">11. Crianças &amp; Idade Mínima</h2>
        <p>
          O serviço é destinado a usuários <strong className="text-cream">com 16 anos ou mais</strong>. Não coletamos
          intencionalmente informações pessoais de menores de 16 anos. Se você acredita que uma criança com menos de 16
          anos nos forneceu informações pessoais, entre em contato em{' '}
          <a
            href="mailto:contact@linkintothessi.com"
            className="text-gold-text hover:underline"
          >
            contact@linkintothessi.com
          </a>{' '}
          e as removeremos imediatamente.
        </p>

        {/* 12. Alterações nesta politica */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">12. Alterações nesta Política</h2>
        <p>
          Podemos atualizar esta política periodicamente. Para{' '}
          <strong className="text-cream">mudanças relevantes</strong> (novas categorias de dados, novas finalidades ou
          novos subprocessadores), notificaremos você por e-mail e/ou aviso no aplicativo, e solicitaremos seu
          reconhecimento antes que as mudanças entrem em vigor. A data de versão da política no topo desta página
          reflete a revisão mais recente.
        </p>
        <p>
          Para qualquer dúvida, entre em contato em{' '}
          <a
            href="mailto:contact@linkintothessi.com"
            className="text-gold-text hover:underline"
          >
            contact@linkintothessi.com
          </a>
          .
        </p>
      </div>
    </main>
  )
}
