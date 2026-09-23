import type { Locale } from '@/i18n/config'

export default function Es({ lang }: { lang: Locale }) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24 text-cream/70">
      <h1 className="mb-8 font-display text-4xl font-semibold text-cream">Política de Cookies &amp; Almacenamiento</h1>
      <div className="space-y-6 text-sm leading-relaxed">
        <p>
          <strong className="text-cream">Última actualización:</strong> Septiembre 2026
        </p>
        <p>
          Esta página enumera cada cookie y elemento de almacenamiento del navegador que Link Into The SSI usa en
          linkintothessi.com y app.linkintothessi.com, y para qué sirve cada uno. No utilizamos cookies de publicidad ni
          de rastreo entre sitios. Los elementos del almacenamiento local permanecen hasta que usted los borra; los del
          almacenamiento de sesión se eliminan cuando cierra la pestaña.
        </p>

        {/* 1. Necesarios para el sitio y la aplicacion */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">
          1. Necesarios para el Sitio y la Aplicación
        </h2>
        <p>
          Estos elementos mantienen su sesión iniciada y recuerdan las elecciones que usted hace. No contienen análisis
          y, como el servicio no funciona sin ellos, no necesitan su consentimiento.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong className="text-cream">lang</strong> y <strong className="text-cream">theme</strong> (cookies, 1
            año, compartidas por el sitio web y la aplicación) &mdash; su idioma y su tema claro u oscuro. El sitio web
            guarda una copia de su tema en el almacenamiento local (<strong className="text-cream">theme</strong>), y la
            aplicación guarda copias de ambos (<strong className="text-cream">theme</strong> e{' '}
            <strong className="text-cream">i18nextLng</strong>).
          </li>
          <li>
            <strong className="text-cream">sessionToken</strong> (aplicación, almacenamiento de sesión) &mdash; mantiene
            su sesión iniciada.
          </li>
          <li>
            <strong className="text-cream">oauthVerifier</strong> y <strong className="text-cream">oauthCode</strong>{' '}
            (aplicación, almacenamiento de sesión) &mdash; se usan solo mientras inicia sesión con LinkedIn.
          </li>
          <li>
            <strong className="text-cream">oauth_nonce_&hellip;</strong> (cookie de nuestro servidor de inicio de
            sesión, 10 minutos) &mdash; vincula el inicio de sesión con LinkedIn al navegador que lo comenzó, para que
            nadie más pueda completarlo.
          </li>
          <li>
            <strong className="text-cream">signedOut</strong> (aplicación, almacenamiento local) &mdash; después de que
            cierra sesión, evita que LinkedIn la vuelva a iniciar automáticamente.
          </li>
          <li>
            <strong className="text-cream">chosenPlan</strong> y <strong className="text-cream">chosenInterval</strong>{' '}
            (aplicación, almacenamiento de sesión) &mdash; el plan y el período de facturación que eligió en nuestra
            página de precios, llevados hasta el pago.
          </li>
          <li>
            <strong className="text-cream">motdDismissed</strong> (aplicación, almacenamiento de sesión) &mdash;
            recuerda que cerró un anuncio.
          </li>
          <li>
            <strong className="text-cream">ref</strong> (sitio web, almacenamiento de sesión) &mdash; el código de
            invitación del enlace que siguió, que se pasa a la aplicación cuando se registra.
          </li>
          <li>
            <strong className="text-cream">trialStarted</strong> (sitio web, almacenamiento local) &mdash; después de
            que inicia una prueba, nuestros botones le ofrecen iniciar sesión.
          </li>
          <li>
            <strong className="text-cream">cookieNoticeDismissed</strong> (sitio web, almacenamiento local) &mdash;
            recuerda que cerró el aviso de almacenamiento.
          </li>
          <li>
            <strong className="text-cream">__ph_opt_in_out_&hellip;</strong> (aplicación, almacenamiento local) &mdash;
            el registro de PostHog de su elección sobre los análisis (sí o no). No contiene ningún identificador.
          </li>
        </ul>

        {/* 2. Monitoreo de errores */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">2. Monitoreo de Errores</h2>
        <p>
          La aplicación usa Sentry para encontrar y corregir errores. Sentry guarda un elemento en el almacenamiento de
          sesión, <strong className="text-cream">sentryReplaySession</strong>, que identifica la grabación de pantalla
          actual. Sentry graba la pantalla en el 10% de las sesiones de la aplicación y en toda sesión con un error. Las
          grabaciones ocultan todo el texto y bloquean las imágenes, así que muestran el diseño de la página y sus
          clics, no lo que usted lee o escribe. Consulte la sección 2 de nuestra{' '}
          <a
            href={`/${lang}/privacy`}
            className="text-gold-text hover:underline"
          >
            Política de Privacidad
          </a>
          .
        </p>

        {/* 3. Estadisticas del sitio web sin cookies */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">
          3. Estadísticas del Sitio Web sin Cookies
        </h2>
        <p>Estos elementos cuentan las visitas a nuestro sitio web. Ninguno establece cookies.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong className="text-cream">DataFast</strong> &mdash; cuenta las páginas vistas en el sitio web. Guarda{' '}
            <strong className="text-cream">datafast_visitor_id</strong>,{' '}
            <strong className="text-cream">datafast_session_id</strong> y{' '}
            <strong className="text-cream">datafast_session_start</strong> en el almacenamiento de sesión, y{' '}
            <strong className="text-cream">datafast_event_queue</strong> (visitas pendientes de envío, vacío una vez
            enviadas) en el almacenamiento local. El código de visitante se deriva de su dirección IP y su navegador y
            cambia cada día, por lo que sus visitas no se pueden relacionar entre días distintos. Los códigos de
            invitación se eliminan de la dirección de la página antes de enviarla.
          </li>
          <li>
            <strong className="text-cream">Cloudflare Web Analytics</strong> &mdash; mide la carga de las páginas en el
            sitio web y en la aplicación. No guarda nada en su navegador.
          </li>
          <li>
            <strong className="text-cream">Nuestro contador de registros</strong> &mdash; cuenta, en nuestros propios
            servidores, cuántos visitantes ven nuestros precios y hacen clic en nuestros botones de registro. No guarda
            nada en su navegador. Para contar a cada visitante una vez al día, conserva un código derivado de su
            dirección IP y su navegador que cambia cada día y se elimina en un plazo de dos días.
          </li>
        </ul>
        <p>
          La base legal es nuestro interés legítimo en entender cómo se usa nuestro sitio web (consulte la sección 3 de
          nuestra Política de Privacidad).
        </p>

        {/* 4. Analisis de la aplicacion, solo con consentimiento */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">
          4. Análisis de la Aplicación, Solo con su Consentimiento
        </h2>
        <p>
          Los análisis de la aplicación están desactivados por defecto. Solo empiezan si usted los activa en{' '}
          <strong className="text-cream">Configuración &rarr; Privacidad y datos</strong>.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong className="text-cream">DataFast</strong> &mdash; registra las páginas que visita en la aplicación,
            vinculadas a su ID interno de miembro. Establece cinco cookies en linkintothessi.com:{' '}
            <strong className="text-cream">datafast_visitor_id</strong>,{' '}
            <strong className="text-cream">datafast_visitor_first_seen_at</strong> y{' '}
            <strong className="text-cream">datafast_visitor_session_count</strong> (1 año), y{' '}
            <strong className="text-cream">datafast_session_id</strong> y{' '}
            <strong className="text-cream">datafast_session_start</strong> (30 minutos). También usa{' '}
            <strong className="text-cream">datafast_event_queue</strong> en el almacenamiento local.
          </li>
          <li>
            <strong className="text-cream">PostHog</strong> &mdash; registra las páginas que visita y las funciones que
            usa en la aplicación, vinculadas a su ID interno de miembro. El texto de los elementos en los que hace clic
            se oculta. Establece la cookie <strong className="text-cream">ph_&hellip;_posthog</strong> (1 año) y guarda
            elementos equivalentes en el almacenamiento local y de sesión.
          </li>
        </ul>
        <p>
          Si desactiva los análisis, o cierra sesión, ambos se detienen, y eliminamos las cookies de DataFast y la
          cookie y el almacenamiento de PostHog. Nunca les enviamos su nombre, correo electrónico, publicaciones ni
          datos de pago.
        </p>

        {/* 5. Sus opciones */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">5. Sus Opciones</h2>
        <p>
          Puede activar o desactivar los análisis de la aplicación en cualquier momento en{' '}
          <strong className="text-cream">Configuración &rarr; Privacidad y datos</strong>. También puede borrar las
          cookies y los datos del sitio en la configuración de su navegador; borrar los elementos de la sección 1 cierra
          su sesión y restablece su idioma y su tema.
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
