import type { Locale } from '../../../../i18n/config'

export default function Pt({ lang }: { lang: Locale }) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24 text-cream/70">
      <h1 className="mb-8 font-display text-4xl font-semibold text-cream">Política de Privacidade</h1>
      <div className="space-y-6 text-sm leading-relaxed">
        <p>
          <strong className="text-cream">Ultima atualizacao:</strong> Junho 2026
        </p>
        <p>Policy version: 2026-06-15</p>

        {/* 1. Quem somos */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">1. Quem Somos</h2>
        <p>
          O controlador de dados das suas informações pessoais e{' '}
          <strong className="text-cream">[LEGAL_ENTITY_NAME]</strong>, localizado em{' '}
          <strong className="text-cream">[BUSINESS_ADDRESS]</strong> (&ldquo;nos&rdquo;, &ldquo;Link Into The
          SSI&rdquo;).
        </p>
        <p>
          Consultas sobre privacidade:{' '}
          <a
            href="mailto:[PRIVACY_CONTACT_EMAIL]"
            className="text-gold-text hover:underline"
          >
            [PRIVACY_CONTACT_EMAIL]
          </a>
          .
        </p>
        <p>
          Encarregado de Proteção de Dados / Representante UE&ndash;UK:{' '}
          <strong className="text-cream">[DPO_OR_REP_CONTACT]</strong>.
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
          seu setor e pais nas configurações do perfil.
        </p>
        <p>
          <strong className="text-cream">Posts que você envia.</strong> Armazenamos as publicações do LinkedIn que você
          cria ou agenda pela plataforma.
        </p>
        <p>
          <strong className="text-cream">Ações de engajamento.</strong> Registramos comentarios e reações feitas por
          meio do seu token de acesso do LinkedIn em seu nome, como parte do recurso principal de engajamento no feed da
          plataforma.
        </p>
        <p>
          <strong className="text-cream">Cobrança.</strong> Os pagamentos de assinatura são processados pelo Stripe.
          Armazenamos seu ID de cliente Stripe e o status da assinatura; não armazenamos dados de cartao de pagamento.
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
          autenticacao, exibicao do feed, publicacao de posts e ações de engajamento, e gerenciamento da assinatura.
        </p>
        <p>
          <strong className="text-cream">Interesses legitimos (Art. 6(1)(f) GDPR).</strong> Otimizacao da qualidade do
          feed, prevencao de abuso, garantia de segurança da plataforma e manutencao de estatisticas agregadas e não
          identificaveis sobre o desempenho do serviço.
        </p>
        <p>
          <strong className="text-cream">Consentimento (Art. 6(1)(a) GDPR).</strong> Comunicações de marketing e
          analises opcionais são processadas somente com seu consentimento explicito. Ambas estao{' '}
          <strong className="text-cream">desativadas por padrão</strong> e podem ser alteradas a qualquer momento em{' '}
          <strong className="text-cream">Configurações &rarr; Privacidade &amp; Dados</strong>.
        </p>
        <p>
          <strong className="text-cream">Obrigacao legal (Art. 6(1)(c) GDPR).</strong> Retencao de registros de cobrança
          para conformidade fiscal e financeira, manutencao de registros de consentimento e atendimento a solicitações
          legitimas de autoridades supervisoras ou policiais.
        </p>

        {/* 4. Com quem compartilhamos */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">4. Com Quem Compartilhamos</h2>
        <p>Contratamos os seguintes subprocessadores, que podem tratar dados pessoais em nosso nome:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong className="text-cream">LinkedIn</strong> &mdash; autenticacao (OIDC) e API de engajamento.
          </li>
          <li>
            <strong className="text-cream">Stripe</strong> &mdash; processamento de pagamentos e gestao de assinaturas.
          </li>
          <li>
            <strong className="text-cream">Convex</strong> &mdash; banco de dados de backend e funções serverless.
          </li>
          <li>
            <strong className="text-cream">Vercel</strong> &mdash; hospedagem do site de apresentacao e entrega edge.
          </li>
          <li>
            <strong className="text-cream">Railway</strong> &mdash; hospedagem do servidor de aplicacao.
          </li>
          <li>
            <strong className="text-cream">Cloudflare</strong> &mdash; DNS, CDN e protecao contra DDoS.
          </li>
          <li>
            <strong className="text-cream">Resend</strong> &mdash; entrega de e-mails transacionais.
          </li>
          <li>
            <strong className="text-cream">OpenRouter (inferencia de IA)</strong> &mdash; geracao de sugestoes de reacao
            e rascunhos de comentarios a partir do conteudo dos seus posts publicos, incluindo imagens. O OpenRouter
            encaminha apenas para provedores de inferencia com retencao zero de dados (os prompts não são armazenados
            nem usados para treinamento).
          </li>
        </ul>
        <p>
          <strong className="text-cream">NAO vendemos nem compartilhamos suas informações pessoais</strong> para
          publicidade comportamental contextual cruzada ou qualquer outra finalidade comercial.
        </p>

        {/* 5. Transferencias internacionais */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">5. Transferencias Internacionais</h2>
        <p>
          Nossos subprocessadores estao localizados principalmente nos Estados Unidos. Quando dados são transferidos
          para fora do Espaco Economico Europeu ou do Reino Unido, utilizamos as Clausulas Contratuais Padrao (SCCs) da
          Comissão Europeia como mecanismo de transferencia para cada processador. Uma copia das salvaguardas de
          transferencia aplicaveis esta disponivel mediante solicitacao pelo contato{' '}
          <a
            href="mailto:[PRIVACY_CONTACT_EMAIL]"
            className="text-gold-text hover:underline"
          >
            [PRIVACY_CONTACT_EMAIL]
          </a>
          .
        </p>

        {/* 6. Por quanto tempo mantemos */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">6. Por Quanto Tempo Mantemos</h2>
        <p>
          <strong className="text-cream">Exclusão de conta.</strong> Quando você exclui sua conta (ou solicita
          exclusão), seus dados pessoais são marcados para exclusão imediatamente. Um periodo de tolerancia de 30 dias e
          aplicado para permitir recuperacao em caso de exclusão acidental, apos o qual os dados são permanentemente
          removidos.
        </p>
        <p>
          <strong className="text-cream">Contas inativas.</strong> Contas sem atividade por 24 meses são automaticamente
          tratadas como solicitações de exclusão; notificaremos você antes de remover os dados.
        </p>
        <p>
          <strong className="text-cream">Registros de cobrança.</strong> Registros de transações e assinaturas são
          mantidos no Stripe pelo tempo exigido pelas regulamentações fiscais e financeiras aplicaveis (geralmente 7
          anos).
        </p>
        <p>
          Aplicamos minimizacao de dados: coletamos apenas o necessário para prestar o serviço e removemos os dados
          assim que não são mais necessários para a finalidade original.
        </p>

        {/* 7. Seus direitos */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">7. Seus Direitos</h2>
        <p>Dependendo da sua jurisdicao, você pode ter o direito de:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong className="text-cream">Acesso</strong> &mdash; obter uma copia dos dados pessoais que mantemos sobre
            você.
          </li>
          <li>
            <strong className="text-cream">Retificacao</strong> &mdash; corrigir dados imprecisos ou incompletos.
          </li>
          <li>
            <strong className="text-cream">Exclusão</strong> &mdash; solicitar a remocao dos seus dados (&ldquo;direito
            ao esquecimento&rdquo;).
          </li>
          <li>
            <strong className="text-cream">Restricao</strong> &mdash; pedir que limitemos como processamos seus dados.
          </li>
          <li>
            <strong className="text-cream">Oposicao</strong> &mdash; opor-se ao processamento baseado em interesses
            legitimos.
          </li>
          <li>
            <strong className="text-cream">Portabilidade</strong> &mdash; receber seus dados em formato estruturado e
            legivel por maquina.
          </li>
          <li>
            <strong className="text-cream">Retirada de consentimento</strong> &mdash; revogar o consentimento para
            marketing ou analises a qualquer momento, sem afetar o processamento anterior.
          </li>
          <li>
            <strong className="text-cream">Apresentar reclamacao</strong> &mdash; junto a sua autoridade supervisora
            local (ex.: autoridade nacional de protecao de dados na UE/UK, ou o procurador-geral do estado relevante nos
            EUA).
          </li>
        </ul>
        <p>
          <strong className="text-cream">Como exercer seus direitos.</strong> A forma mais rapida e por meio de{' '}
          <strong className="text-cream">Configurações &rarr; Privacidade &amp; Dados</strong>, onde você pode exportar
          seus dados, excluir sua conta e gerenciar os consentimentos. Você tambem pode nos contatar em{' '}
          <a
            href="mailto:[PRIVACY_CONTACT_EMAIL]"
            className="text-gold-text hover:underline"
          >
            [PRIVACY_CONTACT_EMAIL]
          </a>
          . Responderemos em ate 30 dias (ou no prazo legal quando menor).
        </p>

        {/* 8. California (CCPA/CPRA) */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">
          8. Residentes da California (CCPA / CPRA)
        </h2>
        <p>
          <strong className="text-cream">Categorias coletadas.</strong> Identificadores (nome, e-mail, ID do LinkedIn,
          endereço IP); informações profissionais ou relacionadas ao emprego (titulo, setor); atividade na Internet ou
          em rede (logs de sessão); informações comerciais (status de assinatura via Stripe).
        </p>
        <p>
          <strong className="text-cream">Sem venda ou compartilhamento.</strong> Não vendemos informações pessoais. Não
          compartilhamos informações pessoais para publicidade comportamental contextual cruzada.
        </p>
        <p>
          <strong className="text-cream">Seus direitos CCPA/CPRA.</strong> Residentes da California podem exercer o
          direito de saber quais informações pessoais coletamos, solicitar a exclusão de informações pessoais, corrigir
          informações pessoais imprecisas e optar por não participar de qualquer venda ou compartilhamento futuro. Não
          discriminaremos você por exercer esses direitos.
        </p>
        <p>
          <strong className="text-cream">Agentes autorizados.</strong> Você pode designar um agente autorizado para
          enviar uma solicitacao em seu nome. Podemos exigir verificacao de identidade e autorizacao por escrito para
          tais solicitações.
        </p>
        <p>
          Para enviar uma solicitacao de privacidade da California, use{' '}
          <strong className="text-cream">Configurações &rarr; Privacidade &amp; Dados</strong> ou envie um e-mail para{' '}
          <a
            href="mailto:[PRIVACY_CONTACT_EMAIL]"
            className="text-gold-text hover:underline"
          >
            [PRIVACY_CONTACT_EMAIL]
          </a>
          .
        </p>

        {/* 9. Brasil (LGPD) */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">9. Usuarios Brasileiros (LGPD)</h2>
        <p>
          Em conformidade com a Lei Geral de Proteção de Dados (LGPD) do Brasil, você possui os direitos previstos no
          Art. 18 da LGPD, incluindo: confirmacao da existencia do tratamento; acesso aos seus dados; correcao de dados
          incompletos ou imprecisos; anonimizacao, bloqueio ou eliminacao de dados desnecessários ou excessivos;
          portabilidade; eliminacao de dados tratados com base no consentimento; informacao sobre entidades publicas e
          privadas com as quais compartilhamos dados; informacao sobre a possibilidade de negar consentimento e as
          consequencias; e revogacao do consentimento.
        </p>
        <p>Reclamações podem ser apresentadas a Autoridade Nacional de Proteção de Dados (ANPD).</p>
        <p>
          Nosso encarregado (Data Protection Officer / representante LGPD):{' '}
          <strong className="text-cream">[DPO_OR_REP_CONTACT]</strong>.
        </p>

        {/* 10. Cookies e armazenamento */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">10. Cookies &amp; Armazenamento</h2>
        <p>
          Utilizamos apenas armazenamento de navegador <strong className="text-cream">essencial</strong> (um token de
          sessão para manter você conectado e suas preferências). Não usamos cookies de publicidade, rastreamento entre
          sites ou analises não essenciais. Para detalhes completos, consulte nossa{' '}
          <a
            href={`/${lang}/cookies`}
            className="text-gold-text hover:underline"
          >
            Política de Cookies &amp; Armazenamento
          </a>
          .
        </p>

        {/* 11. Criancas / idade */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">11. Criancas &amp; Idade Minima</h2>
        <p>
          O serviço e destinado a usuarios <strong className="text-cream">com 16 anos ou mais</strong>. Não coletamos
          intencionalmente informações pessoais de menores de 16 anos. Se você acredita que uma crianca com menos de 16
          anos nos forneceu informações pessoais, entre em contato em{' '}
          <a
            href="mailto:[PRIVACY_CONTACT_EMAIL]"
            className="text-gold-text hover:underline"
          >
            [PRIVACY_CONTACT_EMAIL]
          </a>{' '}
          e as removeremos imediatamente.
        </p>

        {/* 12. Alterações nesta politica */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">12. Alterações nesta Política</h2>
        <p>
          Podemos atualizar esta politica periodicamente. Para{' '}
          <strong className="text-cream">mudancas relevantes</strong> (novas categorias de dados, novas finalidades ou
          novos subprocessadores), notificaremos você por e-mail e/ou aviso no aplicativo, e solicitaremos seu
          reconhecimento antes que as mudancas entrem em vigor. A data de versão da politica no topo desta pagina
          reflete a revisão mais recente.
        </p>
        <p>
          Duvidas ou preocupações? Entre em contato em{' '}
          <a
            href="mailto:hello@linkintothessi.com"
            className="text-gold-text hover:underline"
          >
            hello@linkintothessi.com
          </a>
          .
        </p>
      </div>
    </main>
  )
}
