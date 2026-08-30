import type { Locale } from '@/i18n/config'

export default function Pt({ lang }: { lang: Locale }) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24 text-cream/70">
      <h1 className="mb-8 font-display text-4xl font-semibold text-cream">Termos de Serviço</h1>
      <div className="space-y-6 text-sm leading-relaxed">
        <p>
          <strong className="text-cream">Ultima atualizacao:</strong> Junho 2026
        </p>

        {/* 1. Aceitação */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">1. Aceitação</h2>
        <p>
          Ao acessar ou usar Link Into The SSI (&ldquo;o Serviço&rdquo;, &ldquo;nos&rdquo;) você concorda em se vincular
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
          Link Into The SSI e uma plataforma SaaS conectada ao LinkedIn que oferece um feed compartilhado de posts de
          membros e permite engajamento real no LinkedIn &mdash; comentarios e reações &mdash; em seu nome. Seu objetivo
          e ajudar profissionais a aumentar seu Indice de Vendas Sociais (SSI) do LinkedIn por meio de engajamento
          autentico e mutuo dentro da comunidade.
        </p>

        {/* 3. Sua conta LinkedIn e autorização */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">
          3. Sua Conta LinkedIn &amp; Autorização
        </h2>
        <p>
          Para usar o Serviço você deve conectar sua conta do LinkedIn via LinkedIn OAuth. Ao fazer isso, você concede
          ao Link Into The SSI permissão para:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>ler as publicações do LinkedIn associadas a sua conta; e</li>
          <li>publicar comentarios e reações no LinkedIn em seu nome.</li>
        </ul>
        <p>
          Você permanece totalmente responsavel por toda a atividade que ocorra em sua conta do LinkedIn, incluindo
          quaisquer comentarios ou reações publicados por meio do Serviço. Você pode revogar esta autorizacao a qualquer
          momento pelas configurações da sua conta do LinkedIn ou excluindo sua conta.
        </p>

        {/* 4. Uso aceitável */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">4. Uso Aceitável</h2>
        <p>Você concorda em não usar o Serviço para:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>enviar spam ou mensagens não solicitadas;</li>
          <li>assediar, abusar ou prejudicar outros membros;</li>
          <li>
            executar atividades automatizadas ou de bot alem dos recursos expressamente fornecidos pelo Serviço (ex.:
            engajamento scriptado fora da plataforma);
          </li>
          <li>violar qualquer lei ou regulamentacao local, nacional ou internacional aplicavel; ou</li>
          <li>
            contornar ou tentar contornar quaisquer medidas tecnicas ou controles de segurança do Serviço ou do
            LinkedIn.
          </li>
        </ul>
        <p>
          Você tambem deve cumprir o{' '}
          <a
            href="https://www.linkedin.com/legal/user-agreement"
            className="text-gold-text hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Contrato do Usuario do LinkedIn
          </a>{' '}
          em todos os momentos.
        </p>

        {/* 5. Assinaturas e cobrança */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">5. Assinaturas &amp; Cobrança</h2>
        <p>
          O acesso ao Serviço requer uma assinatura paga ativa. As assinaturas são cobradas{' '}
          <strong className="text-cream">mensalmente</strong> via Stripe. Ao assinar você autoriza o Stripe a cobrar o
          metodo de pagamento informado de forma recorrente mensalmente ate que você cancele.
        </p>
        <p>
          <strong className="text-cream">Cancelamento.</strong> Você pode cancelar sua assinatura a qualquer momento
          pelas configurações da conta. O cancelamento entra em vigor no{' '}
          <strong className="text-cream">fim do periodo de cobrança atual</strong>; você mantem acesso ao Serviço ate
          essa data e nenhum reembolso parcial e emitido pelo tempo não utilizado.
        </p>
        <p>
          <strong className="text-cream">Exclusão de conta.</strong> A solicitacao de exclusão de conta cancela
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
          prejudiquem a comunidade ou o Serviço, sem aviso previo quando necessário para proteger membros ou a
          plataforma.
        </p>
        <p>
          <strong className="text-cream">Autoexclusão.</strong> Você pode excluir sua conta a qualquer momento pelas
          configurações da conta. Um <strong className="text-cream">periodo de tolerancia de 30 dias</strong> se aplica,
          durante o qual sua conta pode ser recuperada. Apos 30 dias seus dados pessoais são permanentemente removidos,
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
          7. Isenções de Responsabilidade &amp; Limitacao de Responsabilidade
        </h2>
        <p>
          Esta secao, incluindo quaisquer isenções de garantia, disposições de indenizacao e limites de
          responsabilidade, sera redigida e inserida por advogados qualificados antes do lancamento publico do Serviço.
          Ate que esses termos sejam finalizados, nenhuma limitacao vinculante de responsabilidade se aplica em nenhuma
          direcao.
        </p>

        {/* 8. Contrato do Usuario do LinkedIn */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">8. Contrato do Usuario do LinkedIn</h2>
        <p>
          Você deve cumprir independentemente o{' '}
          <a
            href="https://www.linkedin.com/legal/user-agreement"
            className="text-gold-text hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Contrato do Usuario do LinkedIn
          </a>{' '}
          e todas as politicas do LinkedIn. Link Into The SSI e um produto independente e{' '}
          <strong className="text-cream">não e afiliado, endossado ou patrocinado pela LinkedIn Corporation</strong> ou
          qualquer de suas afiliadas.
        </p>

        {/* 9. Lei aplicável */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">9. Lei Aplicável</h2>
        <p>
          Estes Termos são regidos e interpretados de acordo com as leis do{' '}
          <strong className="text-cream">Brasil</strong>. Quaisquer disputas decorrentes ou relacionadas a estes Termos
          estarão sujeitas a jurisdicao exclusiva dos tribunais do <strong className="text-cream">Brasil</strong>.
        </p>

        {/* 10. Alterações e contato */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">10. Alterações &amp; Contato</h2>
        <p>
          Podemos atualizar estes Termos periodicamente. Mudancas relevantes serão comunicadas por e-mail ou aviso no
          aplicativo antes de entrarem em vigor. O uso continuado do Serviço apos a data de vigencia de uma mudanca
          constitui aceitacao dos Termos revisados.
        </p>
        <p>
          Duvidas sobre estes Termos? Entre em contato em{' '}
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
