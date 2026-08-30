import type { Locale } from '@/i18n/config'

export default function Es({ lang: _lang }: { lang: Locale }) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24 text-cream/70">
      <h1 className="mb-8 font-display text-4xl font-semibold text-cream">Política de Cookies &amp; Almacenamiento</h1>
      <div className="space-y-6 text-sm leading-relaxed">
        <p>
          <strong className="text-cream">Última actualización:</strong> Junio 2026
        </p>
        <p>
          Link Into The SSI utiliza únicamente almacenamiento de navegador{' '}
          <strong className="text-cream">estrictamente necesario</strong>. La aplicación almacena un token de sesión
          (para mantenerle conectado) y su preferencia de idioma. No utilizamos cookies de publicidad ni de rastreo
          entre sitios.
        </p>
        <p>
          Dado que este almacenamiento es esencial para prestar el servicio solicitado, no requiere consentimiento bajo
          las normas de ePrivacidad. Los análisis opcionales, si se llegaran a introducir, estarán desactivados por
          defecto y podrán controlarse desde{' '}
          <strong className="text-cream">Configuración &rarr; Privacidad &amp; Datos</strong>.
        </p>
        <p>
          Preguntas:{' '}
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
