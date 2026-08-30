import type { Locale } from '@/i18n/config'

export default function Pt({ lang: _lang }: { lang: Locale }) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24 text-cream/70">
      <h1 className="mb-8 font-display text-4xl font-semibold text-cream">Política de Cookies &amp; Armazenamento</h1>
      <div className="space-y-6 text-sm leading-relaxed">
        <p>
          <strong className="text-cream">Ultima atualizacao:</strong> Junho 2026
        </p>
        <p>
          Link Into The SSI usa apenas armazenamento de navegador{' '}
          <strong className="text-cream">estritamente necessário</strong>. O aplicativo armazena um token de sessão
          (para manter você conectado) e sua preferência de idioma. Não usamos cookies de publicidade ou rastreamento
          entre sites.
        </p>
        <p>
          Como esse armazenamento é essencial para prestar o serviço solicitado, não requer consentimento sob as regras
          de ePrivacidade. Analises opcionais, caso venham a ser introduzidas, estarão desativadas por padrão e poderão
          ser controladas em <strong className="text-cream">Configurações &rarr; Privacidade &amp; Dados</strong>.
        </p>
        <p>
          Duvidas:{' '}
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
