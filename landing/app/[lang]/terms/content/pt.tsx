import type { Locale } from '@/i18n/config'

export default function Pt({ lang }: { lang: Locale }) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24 text-cream/70">
      <h1 className="mb-8 font-display text-4xl font-semibold text-cream">Termos de Serviço</h1>
      <div className="space-y-6 text-sm leading-relaxed">
        <p>
          <strong className="text-cream">Última atualização:</strong> outubro de 2026
        </p>

        {/* 1. Aceitação */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">1. Aceitação</h2>
        <p>
          Ao acessar ou usar Link Into The SSI (&ldquo;o Serviço&rdquo;, &ldquo;nós&rdquo;) você concorda em se vincular
          a estes Termos de Serviço. Se você não concordar, não use o Serviço.
        </p>
        <p>
          <strong className="text-cream">Requisito de idade.</strong> Ao usar o Serviço você confirma que possui{' '}
          <strong className="text-cream">16 anos de idade ou mais</strong>. Se você tiver menos de 16 anos, não pode
          criar uma conta ou usar o Serviço.
        </p>

        {/* 2. O serviço */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">2. O Serviço</h2>
        <p>
          Link Into The SSI é uma plataforma SaaS conectada ao LinkedIn que oferece um feed compartilhado de publicações
          de membros e ajuda você a engajar com elas. Reações e comentários são feitos por você, diretamente no
          LinkedIn: o Serviço mostra publicações relevantes, pode sugerir uma reação e um rascunho de comentário, e
          então abre a publicação no LinkedIn para que você decida agir. O Serviço não publica, comenta nem reage no
          LinkedIn em seu nome. Seu objetivo é ajudar profissionais a aumentar seu Índice de Vendas Sociais (SSI) do
          LinkedIn por meio de engajamento autêntico e mútuo dentro da comunidade.
        </p>
        <p>
          <strong className="text-cream">O que você compra.</strong> Você compra acesso a este software. Sua assinatura
          cobre o feed compartilhado, as sugestões de reação e comentário, e os recursos de conta listados no seu plano.
          Não vendemos reações, comentários, conexões nem seguidores, e não entregamos engajamento à sua conta do
          LinkedIn nem a nenhuma outra conta. Seu SSI depende do que você faz no LinkedIn, então não prometemos
          pontuação, posição nem resultado.
        </p>

        {/* 3. Sua conta LinkedIn e autorização */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">
          3. Sua Conta LinkedIn &amp; Autorização
        </h2>
        <p>
          Para usar o Serviço você entra com sua conta do LinkedIn via LinkedIn OpenID Connect. Isso confirma sua
          identidade e fornece suas informações básicas de perfil: seu ID de membro do LinkedIn, nome, foto de perfil e
          endereço de e-mail. O Serviço não solicita permissão para publicar, comentar ou reagir no LinkedIn e não faz
          nenhuma escrita na sua conta do LinkedIn.
        </p>
        <p>
          Você permanece totalmente responsável por toda a atividade que ocorra em sua conta do LinkedIn, incluindo
          quaisquer comentários ou reações que você faça no LinkedIn após abrir uma publicação por meio do Serviço. Você
          pode revogar esta autorização a qualquer momento pelas configurações da sua conta do LinkedIn ou excluindo sua
          conta.
        </p>

        {/* 4. Uso aceitável */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">4. Uso Aceitável</h2>
        <p>Você concorda em não usar o Serviço para:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>enviar spam ou mensagens não solicitadas;</li>
          <li>assediar, abusar ou prejudicar outros membros;</li>
          <li>
            executar atividades automatizadas ou de bot além dos recursos expressamente fornecidos pelo Serviço (ex.:
            engajamento scriptado fora da plataforma);
          </li>
          <li>violar qualquer lei ou regulamentação local, nacional ou internacional aplicável; ou</li>
          <li>
            contornar ou tentar contornar quaisquer medidas técnicas ou controles de segurança do Serviço ou do
            LinkedIn.
          </li>
        </ul>
        <p>
          Você também deve cumprir o{' '}
          <a
            href="https://www.linkedin.com/legal/user-agreement"
            className="text-gold-text hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Contrato do Usuário do LinkedIn
          </a>{' '}
          em todos os momentos.
        </p>

        {/* 5. Assinaturas e cobrança */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">5. Assinaturas &amp; Cobrança</h2>
        <p>
          O acesso ao Serviço requer uma assinatura paga ativa. As assinaturas são cobradas{' '}
          <strong className="text-cream">mensalmente ou anualmente</strong>, conforme o plano e o intervalo que você
          escolher, via Stripe. Ao assinar você autoriza o Stripe a cobrar o método de pagamento informado de forma
          recorrente até que você cancele.
        </p>
        <p>
          <strong className="text-cream">Planos e entrega.</strong> Oferecemos quatro planos: Starter, Growth, Pro e um
          plano Enterprise personalizado, combinado por contato. Você vê o preço atual de cada plano e intervalo na
          nossa página inicial, e de novo no checkout, antes de pagar. O Serviço funciona como uma aplicação web
          hospedada, liberamos seu acesso assim que a assinatura começa, e não enviamos produtos físicos.
        </p>
        <p>
          <strong className="text-cream">Compras avulsas.</strong> Alguns recursos são vendidos separadamente da
          assinatura. Destacar uma publicação sua custa <strong className="text-cream">U$5</strong>, cobrados uma única
          vez pelo Stripe quando você confirma a compra. A compra vale para a{' '}
          <strong className="text-cream">publicação que você escolher</strong>, não é renovada e não é reembolsável
          depois que essa publicação for destacada.
        </p>
        <p>
          <strong className="text-cream">Teste grátis.</strong> O plano <strong className="text-cream">Pro</strong>{' '}
          começa com um <strong className="text-cream">teste grátis de 7 dias</strong> (14 dias quando você entra pelo
          link de convite de um membro) e é necessário informar um método de pagamento para iniciá-lo. Os planos Starter
          e Growth não têm teste grátis: a cobrança começa quando você assina. O teste termina — e a cobrança começa —
          assim que você atingir <strong className="text-cream">50 interações</strong> (feitas e recebidas) ou quando o
          período de teste terminar, o que vier primeiro. Avisamos você por e-mail antes da primeira cobrança. Você pode
          cancelar a qualquer momento antes do fim do teste, na página Assinatura da sua conta, e nada será cobrado. Há
          um teste grátis por conta; se você assinar novamente após cancelar, a cobrança começa imediatamente e isso é
          informado no checkout.
        </p>
        <p>
          <strong className="text-cream">Códigos promocionais.</strong> Um código promocional informado no checkout pode
          deixar grátis o primeiro mês de um plano mensal. Ainda é necessário um método de pagamento e, depois desse
          mês, você é cobrado pelo preço mensal do plano, a menos que cancele antes. Códigos promocionais não valem no
          plano anual.
        </p>
        <p>
          <strong className="text-cream">Cancelamento.</strong> Você pode cancelar sua assinatura a qualquer momento
          pelas configurações da conta. O cancelamento entra em vigor no{' '}
          <strong className="text-cream">fim do período de cobrança atual</strong>; você mantém acesso ao Serviço até
          essa data e nenhum reembolso parcial é emitido pelo tempo não utilizado.
        </p>
        <p>
          <strong className="text-cream">Exclusão de conta.</strong> A solicitação de exclusão de conta cancela
          automaticamente qualquer assinatura ativa. Os registros de cobrança são mantidos conforme exigido por lei
          (consulte a{' '}
          <a
            href={`/${lang}/privacy`}
            className="text-gold-text hover:underline"
          >
            Política de Privacidade
          </a>
          ).
        </p>

        {/* 6. Suspensão, banimento e exclusão de conta */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">
          6. Suspensão, Banimento &amp; Exclusão de Conta
        </h2>
        <p>
          Podemos suspender ou banir permanentemente contas que violem estes Termos, pratiquem uso indevido ou
          prejudiquem a comunidade ou o Serviço, sem aviso prévio quando necessário para proteger membros ou a
          plataforma.
        </p>
        <p>
          <strong className="text-cream">Autoexclusão.</strong> Você pode excluir sua conta a qualquer momento pelas
          configurações da conta. Um <strong className="text-cream">período de tolerância de 30 dias</strong> se aplica,
          durante o qual sua conta pode ser recuperada. Após 30 dias seus dados pessoais são permanentemente removidos,
          exceto registros de cobrança que devem ser mantidos para fins de conformidade fiscal ou financeira (consulte
          nossa{' '}
          <a
            href={`/${lang}/privacy`}
            className="text-gold-text hover:underline"
          >
            Política de Privacidade
          </a>
          ).
        </p>

        {/* 7. Isenções de responsabilidade e limitação de responsabilidade */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">
          7. Isenções de Responsabilidade &amp; Limitação de Responsabilidade
        </h2>
        <p>
          Esta seção, incluindo quaisquer isenções de garantia, disposições de indenização e limites de
          responsabilidade, será redigida e inserida por advogados qualificados antes do lançamento público do Serviço.
          Até que esses termos sejam finalizados, nenhuma limitação vinculante de responsabilidade se aplica em nenhuma
          direção.
        </p>

        {/* 8. Contrato do Usuário do LinkedIn */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">8. Contrato do Usuário do LinkedIn</h2>
        <p>
          Você deve cumprir independentemente o{' '}
          <a
            href="https://www.linkedin.com/legal/user-agreement"
            className="text-gold-text hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Contrato do Usuário do LinkedIn
          </a>{' '}
          e todas as políticas do LinkedIn. Link Into The SSI é um produto independente e{' '}
          <strong className="text-cream">não é afiliado, endossado ou patrocinado pela LinkedIn Corporation</strong> ou
          qualquer de suas afiliadas.
        </p>

        {/* 9. Lei aplicável */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">9. Lei Aplicável</h2>
        <p>
          Estes Termos são regidos e interpretados de acordo com as leis do{' '}
          <strong className="text-cream">Brasil</strong>. Quaisquer disputas decorrentes ou relacionadas a estes Termos
          estarão sujeitas à jurisdição exclusiva dos tribunais do <strong className="text-cream">Brasil</strong>.
        </p>

        {/* 10. Alterações e contato */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">10. Alterações &amp; Contato</h2>
        <p>
          Podemos atualizar estes Termos periodicamente. Mudanças relevantes serão comunicadas por e-mail ou aviso no
          aplicativo antes de entrarem em vigor. O uso continuado do Serviço após a data de vigência de uma mudança
          constitui aceitação dos Termos revisados.
        </p>
        <p>
          Para dúvidas sobre estes Termos, entre em contato em{' '}
          <a
            href="mailto:contact@linkintothessi.com"
            className="text-gold-text hover:underline"
          >
            contact@linkintothessi.com
          </a>
          .
        </p>
        <p>
          Para informações sobre como tratamos seus dados pessoais, leia nossa{' '}
          <a
            href={`/${lang}/privacy`}
            className="text-gold-text hover:underline"
          >
            Política de Privacidade
          </a>
          .
        </p>
      </div>
    </main>
  )
}
