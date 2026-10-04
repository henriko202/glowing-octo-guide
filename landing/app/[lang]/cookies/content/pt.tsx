import type { Locale } from '@/i18n/config'

export default function Pt({ lang }: { lang: Locale }) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24 text-cream/70">
      <h1 className="mb-8 font-display text-4xl font-semibold text-cream">Política de Cookies &amp; Armazenamento</h1>
      <div className="space-y-6 text-sm leading-relaxed">
        <p>
          <strong className="text-cream">Última atualização:</strong> outubro de 2026
        </p>
        <p>
          Esta página lista cada cookie e item de armazenamento do navegador que o Link Into The SSI usa em
          linkintothessi.com e app.linkintothessi.com, e para que serve cada um. Não usamos cookies de publicidade nem
          de rastreamento entre sites. Os itens do armazenamento local ficam até você apagá-los; os itens do
          armazenamento de sessão são apagados quando você fecha a aba.
        </p>

        {/* 1. Necessarios para o site e o aplicativo */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">
          1. Necessários para o Site e o Aplicativo
        </h2>
        <p>
          Estes itens mantêm você conectado e lembram as escolhas que você faz. Não contêm análises e, como o serviço
          não funciona sem eles, não precisam do seu consentimento.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong className="text-cream">lang</strong> e <strong className="text-cream">theme</strong> (cookies, 1
            ano, compartilhados pelo site e pelo aplicativo) &mdash; o seu idioma e o seu tema claro ou escuro. O site
            guarda uma cópia do seu tema no armazenamento local (<strong className="text-cream">theme</strong>), e o
            aplicativo guarda cópias dos dois (<strong className="text-cream">theme</strong> e{' '}
            <strong className="text-cream">i18nextLng</strong>).
          </li>
          <li>
            <strong className="text-cream">sessionToken</strong> (aplicativo, armazenamento de sessão) &mdash; mantém
            você conectado.
          </li>
          <li>
            <strong className="text-cream">oauthVerifier</strong> e <strong className="text-cream">oauthCode</strong>{' '}
            (aplicativo, armazenamento de sessão) &mdash; usados só enquanto você entra com o LinkedIn.
          </li>
          <li>
            <strong className="text-cream">oauth_nonce_&hellip;</strong> (cookie definido pelo nosso servidor de login,
            10 minutos) &mdash; vincula o login com o LinkedIn ao navegador que o iniciou, para que ninguém mais possa
            concluí-lo.
          </li>
          <li>
            <strong className="text-cream">signedOut</strong> (aplicativo, armazenamento local) &mdash; depois que você
            sai, impede que o LinkedIn conecte você de novo automaticamente.
          </li>
          <li>
            <strong className="text-cream">chosenPlan</strong> e <strong className="text-cream">chosenInterval</strong>{' '}
            (aplicativo, armazenamento de sessão) &mdash; o plano e o período de cobrança que você escolheu na nossa
            página de preços, levados até o pagamento.
          </li>
          <li>
            <strong className="text-cream">motdDismissed</strong> (aplicativo, armazenamento de sessão) &mdash; lembra
            que você fechou um aviso.
          </li>
          <li>
            <strong className="text-cream">ref</strong> (site, armazenamento de sessão) &mdash; o código de convite do
            link que você seguiu, repassado ao aplicativo quando você se cadastra.
          </li>
          <li>
            <strong className="text-cream">cookieNoticeDismissed</strong> (site, armazenamento local) &mdash; lembra que
            você fechou o aviso de armazenamento.
          </li>
          <li>
            <strong className="text-cream">__ph_opt_in_out_&hellip;</strong> (aplicativo, armazenamento local) &mdash; o
            registro do PostHog da sua escolha sobre as análises (sim ou não). Não contém nenhum identificador.
          </li>
        </ul>

        {/* 2. Monitoramento de erros */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">2. Monitoramento de Erros</h2>
        <p>
          O aplicativo usa o Sentry para encontrar e corrigir erros. O Sentry guarda um item no armazenamento de sessão,{' '}
          <strong className="text-cream">sentryReplaySession</strong>, que identifica a gravação de tela atual. O Sentry
          grava a tela em 10% das sessões do aplicativo e em toda sessão com erro. As gravações ocultam todo o texto e
          bloqueiam as imagens, então mostram o layout da página e os seus cliques, não o que você lê ou digita. Veja a
          seção 2 da nossa{' '}
          <a
            href={`/${lang}/privacy`}
            className="text-gold-text hover:underline"
          >
            Política de Privacidade
          </a>
          .
        </p>

        {/* 3. Estatisticas do site sem cookies */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">
          3. Estatísticas do Site sem Cookies
        </h2>
        <p>Estes itens contam as visitas ao nosso site. Nenhum deles define cookies.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong className="text-cream">DataFast</strong> &mdash; conta as páginas vistas no site. Guarda{' '}
            <strong className="text-cream">datafast_visitor_id</strong>,{' '}
            <strong className="text-cream">datafast_session_id</strong> e{' '}
            <strong className="text-cream">datafast_session_start</strong> no armazenamento de sessão, e{' '}
            <strong className="text-cream">datafast_event_queue</strong> (visitas aguardando envio, vazio depois do
            envio) no armazenamento local. O código de visitante é derivado do seu endereço IP e do seu navegador e muda
            todos os dias, então as suas visitas não podem ser relacionadas entre dias diferentes. Os códigos de convite
            são removidos do endereço da página antes do envio.
          </li>
          <li>
            <strong className="text-cream">Cloudflare Web Analytics</strong> &mdash; mede o carregamento das páginas no
            site e no aplicativo. Não guarda nada no seu navegador.
          </li>
          <li>
            <strong className="text-cream">Nosso contador de cadastros</strong> &mdash; conta, nos nossos próprios
            servidores, quantos visitantes veem os nossos preços e clicam nos nossos botões de cadastro. Não guarda nada
            no seu navegador. Para contar cada visitante uma vez por dia, mantém um código derivado do seu endereço IP e
            do seu navegador que muda todos os dias e é excluído em até dois dias.
          </li>
        </ul>
        <p>
          A base legal é o nosso interesse legítimo em entender como o nosso site é usado (veja a seção 3 da nossa
          Política de Privacidade).
        </p>

        {/* 4. Analises do aplicativo, so com consentimento */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">
          4. Análises do Aplicativo, Só com o Seu Consentimento
        </h2>
        <p>
          As análises do aplicativo ficam desativadas por padrão. Só começam se você as ativar em{' '}
          <strong className="text-cream">Configurações &rarr; Privacidade e dados</strong>.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong className="text-cream">DataFast</strong> &mdash; registra as páginas que você visita no aplicativo,
            vinculadas ao seu ID interno de membro. Define cinco cookies em linkintothessi.com:{' '}
            <strong className="text-cream">datafast_visitor_id</strong>,{' '}
            <strong className="text-cream">datafast_visitor_first_seen_at</strong> e{' '}
            <strong className="text-cream">datafast_visitor_session_count</strong> (1 ano), e{' '}
            <strong className="text-cream">datafast_session_id</strong> e{' '}
            <strong className="text-cream">datafast_session_start</strong> (30 minutos). Também usa{' '}
            <strong className="text-cream">datafast_event_queue</strong> no armazenamento local.
          </li>
          <li>
            <strong className="text-cream">PostHog</strong> &mdash; registra as páginas que você visita e os recursos
            que você usa no aplicativo, vinculados ao seu ID interno de membro. O texto dos elementos em que você clica
            é ocultado. Define o cookie <strong className="text-cream">ph_&hellip;_posthog</strong> (1 ano) e guarda
            itens correspondentes no armazenamento local e de sessão.
          </li>
        </ul>
        <p>
          Ao desativar as análises, ou ao sair da conta, os dois param, e excluímos os cookies do DataFast e o cookie e
          o armazenamento do PostHog. Nunca enviamos a eles o seu nome, e-mail, publicações nem dados de pagamento.
        </p>

        {/* 5. Suas escolhas */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">5. Suas Escolhas</h2>
        <p>
          Você pode ativar ou desativar as análises do aplicativo a qualquer momento em{' '}
          <strong className="text-cream">Configurações &rarr; Privacidade e dados</strong>. Também pode apagar os
          cookies e os dados do site nas configurações do navegador; apagar os itens da seção 1 desconecta você e
          redefine o seu idioma e o seu tema.
        </p>
        <p>
          Dúvidas:{' '}
          <a
            href="mailto:contact@linkintothessi.com"
            className="text-gold-text hover:underline"
          >
            contact@linkintothessi.com
          </a>
        </p>
      </div>
    </main>
  )
}
