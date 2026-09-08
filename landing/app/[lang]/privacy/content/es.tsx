import type { Locale } from '@/i18n/config'

export default function Es({ lang }: { lang: Locale }) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24 text-cream/70">
      <h1 className="mb-8 font-display text-4xl font-semibold text-cream">Política de Privacidad</h1>
      <div className="space-y-6 text-sm leading-relaxed">
        <p>
          <strong className="text-cream">Última actualización:</strong> Junio 2026
        </p>
        <p>Policy version: 2026-06-15</p>

        {/* 1. Quienes somos */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">1. Quiénes Somos</h2>
        <p>
          El responsable del tratamiento de sus datos personales es{' '}
          <strong className="text-cream">NEANDERTECH SERVICOS DE TECNOLOGIA LTDA</strong>, ubicado en{' '}
          <strong className="text-cream">
            AV SETE DE SETEMBRO, 2775, REBOUÇAS - 80230-010 - Curitiba, Paraná - Brazil
          </strong>{' '}
          (&ldquo;nosotros&rdquo;, &ldquo;Link Into The SSI&rdquo;).
        </p>
        <p>
          Consultas sobre privacidad:{' '}
          <a
            href="mailto:contact@linkintothessi.com"
            className="text-gold-text hover:underline"
          >
            contact@linkintothessi.com
          </a>
          .
        </p>
        <p>
          Delegado de Protección de Datos / Representante UE&ndash;UK:{' '}
          <strong className="text-cream">Henriko Alberton</strong>.
        </p>

        {/* 2. Datos que recopilamos y fuentes */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">
          2. Datos que Recopilamos &amp; Fuentes
        </h2>
        <p>
          <strong className="text-cream">Inicio de sesión con LinkedIn (OIDC).</strong> Cuando conecta su cuenta de
          LinkedIn, recibimos su ID de miembro de LinkedIn, nombre completo, URL de foto de perfil y dirección de correo
          electrónico a través del flujo OpenID Connect de LinkedIn.
        </p>
        <p>
          <strong className="text-cream">Atributos de perfil que usted define.</strong> Puede proporcionar
          voluntariamente su sector y país en la configuración de su perfil.
        </p>
        <p>
          <strong className="text-cream">Publicaciones que usted envía.</strong> Almacenamos las publicaciones que envía
          al feed compartido a través de la plataforma.
        </p>
        <p>
          <strong className="text-cream">Actividad de interacción.</strong> Cuando decide reaccionar o comentar en una
          publicación del feed, registramos esa interacción (el tipo de reacción o el texto del comentario que utiliza)
          para medir su actividad y el conteo de interacciones. La reacción o el comentario en sí lo realiza usted,
          directamente en LinkedIn. El Servicio abre la publicación para que usted actúe y no reacciona ni comenta en
          LinkedIn en su nombre.
        </p>
        <p>
          <strong className="text-cream">Facturación.</strong> Los pagos de suscripción son procesados por Stripe.
          Almacenamos su ID de cliente de Stripe y el estado de suscripción; no almacenamos datos de tarjeta de pago.
          Las compras únicas (una publicación destacada) se cobran a través de Stripe de la misma forma y aparecen en su
          recibo de Stripe; guardamos el registro de la compra (ID de sesión, monto y fecha) en la publicación
          destacada.
        </p>
        <p>
          <strong className="text-cream">Datos técnicos y de sesión.</strong> Recopilamos registros de servidor estándar
          (dirección IP, tipo de navegador, páginas visitadas, marcas de tiempo) para monitoreo de seguridad y
          rendimiento.
        </p>
        <p>
          <strong className="text-cream">Sin raspado de datos.</strong> No realizamos raspado de datos de LinkedIn ni de
          ningún otro sitio web de terceros. Todos los datos provienen de sus interacciones directas con nuestra
          plataforma o a través de la API de LinkedIn con su consentimiento autorizado.
        </p>

        {/* 3. Por que lo usamos y bases legales */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">
          3. Por qué lo Usamos &amp; Bases Legales
        </h2>
        <p>
          <strong className="text-cream">Contrato (Art. 6(1)(b) GDPR).</strong> Prestación del servicio principal:
          autenticación, visualización de su feed, envío de posts y registro de su interacción, y gestión de su
          suscripción.
        </p>
        <p>
          <strong className="text-cream">Intereses legítimos (Art. 6(1)(f) GDPR).</strong> Optimización de la calidad
          del feed, prevención de abuso, garantía de seguridad de la plataforma y mantenimiento de estadísticas
          agregadas y no identificables sobre el rendimiento del servicio.
        </p>
        <p>
          <strong className="text-cream">Consentimiento (Art. 6(1)(a) GDPR).</strong> Las comunicaciones de marketing y
          los análisis opcionales se procesan únicamente con su consentimiento explícito. Ambos están{' '}
          <strong className="text-cream">desactivados por defecto</strong> y pueden modificarse en cualquier momento en{' '}
          <strong className="text-cream">Configuración &rarr; Privacidad &amp; Datos</strong>.
        </p>
        <p>
          <strong className="text-cream">Obligación legal (Art. 6(1)(c) GDPR).</strong> Conservación de registros de
          facturación para cumplimiento fiscal y financiero, mantenimiento de registros de consentimiento y respuesta a
          solicitudes legítimas de autoridades supervisoras o policiales.
        </p>

        {/* 4. Con quien lo compartimos */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">4. Con Quién lo Compartimos</h2>
        <p>Contratamos los siguientes subencargados que pueden tratar datos personales en nuestro nombre:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong className="text-cream">LinkedIn</strong> &mdash; autenticación (inicio de sesión OpenID Connect).
          </li>
          <li>
            <strong className="text-cream">Stripe</strong> &mdash; procesamiento de pagos y gestión de suscripciones.
          </li>
          <li>
            <strong className="text-cream">Convex</strong> &mdash; base de datos backend y funciones serverless.
          </li>
          <li>
            <strong className="text-cream">Cloudflare</strong> &mdash; alojamiento del sitio de presentación y de la
            aplicación, además de DNS, CDN y protección contra DDoS.
          </li>
          <li>
            <strong className="text-cream">Resend</strong> &mdash; entrega de correos electrónicos transaccionales.
          </li>
          <li>
            <strong className="text-cream">OpenRouter (inferencia de IA)</strong> &mdash; generación de sugerencias de
            reacción y borradores de comentarios a partir del contenido de sus publicaciones públicas, incluidas las
            imágenes. OpenRouter enruta únicamente a proveedores de inferencia con retención cero de datos (los prompts
            no se almacenan ni se utilizan para entrenamiento).
          </li>
        </ul>
        <p>
          <strong className="text-cream">No vendemos ni compartimos su información personal</strong> para publicidad
          conductual contextual cruzada ni para ninguna otra finalidad comercial.
        </p>

        {/* 5. Transferencias internacionales */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">5. Transferencias Internacionales</h2>
        <p>
          Nuestros subencargados están ubicados principalmente en los Estados Unidos. Cuando los datos se transfieren
          fuera del Espacio Económico Europeo o del Reino Unido, utilizamos las Cláusulas Contractuales Estándar (SCCs)
          de la Comisión Europea como mecanismo de transferencia para cada procesador. Una copia de las salvaguardas de
          transferencia aplicables está disponible previa solicitud contactando{' '}
          <a
            href="mailto:contact@linkintothessi.com"
            className="text-gold-text hover:underline"
          >
            contact@linkintothessi.com
          </a>
          .
        </p>

        {/* 6. Durante cuanto tiempo lo conservamos */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">
          6. Durante Cuánto Tiempo lo Conservamos
        </h2>
        <p>
          <strong className="text-cream">Eliminación de cuenta.</strong> Cuando elimina su cuenta (o solicita la
          supresión), sus datos personales se marcan para eliminación de inmediato. Se aplica un período de gracia de 30
          días para permitir la recuperación en caso de eliminación accidental, tras el cual los datos se eliminan
          permanentemente.
        </p>
        <p>
          <strong className="text-cream">Cuentas inactivas.</strong> Las cuentas sin actividad durante 24 meses se
          tratan automáticamente como solicitudes de eliminación; le notificaremos antes de proceder a la eliminación.
        </p>
        <p>
          <strong className="text-cream">Registros de facturación.</strong> Los registros de transacciones y
          suscripciones se conservan en Stripe durante el tiempo exigido por la normativa fiscal y financiera aplicable
          (generalmente 7 años).
        </p>
        <p>
          Aplicamos minimización de datos: recopilamos solo lo necesario para prestar el servicio y eliminamos los datos
          en cuanto dejan de ser necesarios para su finalidad original.
        </p>

        {/* 7. Sus derechos */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">7. Sus Derechos</h2>
        <p>Según su jurisdicción, puede tener derecho a:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong className="text-cream">Acceso</strong> &mdash; obtener una copia de los datos personales que
            conservamos sobre usted.
          </li>
          <li>
            <strong className="text-cream">Rectificación</strong> &mdash; corregir datos inexactos o incompletos.
          </li>
          <li>
            <strong className="text-cream">Supresión</strong> &mdash; solicitar la eliminación de sus datos
            (&ldquo;derecho al olvido&rdquo;).
          </li>
          <li>
            <strong className="text-cream">Limitación</strong> &mdash; pedirnos que limitemos el tratamiento de sus
            datos.
          </li>
          <li>
            <strong className="text-cream">Oposición</strong> &mdash; oponerse al tratamiento basado en intereses
            legítimos.
          </li>
          <li>
            <strong className="text-cream">Portabilidad</strong> &mdash; recibir sus datos en un formato estructurado y
            legible por máquina.
          </li>
          <li>
            <strong className="text-cream">Retirar el consentimiento</strong> &mdash; revocar el consentimiento para
            marketing o análisis en cualquier momento sin afectar el tratamiento previo.
          </li>
          <li>
            <strong className="text-cream">Presentar una reclamación</strong> &mdash; ante su autoridad supervisora
            local (p. ej., la autoridad nacional de protección de datos en la UE/UK, o el fiscal general estatal
            correspondiente en los EE. UU.).
          </li>
        </ul>
        <p>
          <strong className="text-cream">Cómo ejercer sus derechos.</strong> La forma más rápida es a través de{' '}
          <strong className="text-cream">Configuración &rarr; Privacidad &amp; Datos</strong>, donde puede exportar sus
          datos, eliminar su cuenta y gestionar los consentimientos. También puede contactarnos en{' '}
          <a
            href="mailto:contact@linkintothessi.com"
            className="text-gold-text hover:underline"
          >
            contact@linkintothessi.com
          </a>
          . Responderemos en un plazo de 30 días (o el plazo legal cuando sea menor).
        </p>

        {/* 8. California (CCPA/CPRA) */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">
          8. Residentes de California (CCPA / CPRA)
        </h2>
        <p>
          <strong className="text-cream">Categorías recopiladas.</strong> Identificadores (nombre, correo electrónico,
          ID de LinkedIn, dirección IP); información profesional o relacionada con el empleo (título, sector); actividad
          en Internet o en red (registros de sesión); información comercial (estado de suscripción vía Stripe).
        </p>
        <p>
          <strong className="text-cream">Sin venta ni compartición.</strong> No vendemos información personal. No
          compartimos información personal para publicidad conductual contextual cruzada.
        </p>
        <p>
          <strong className="text-cream">Sus derechos CCPA/CPRA.</strong> Los residentes de California pueden ejercer el
          derecho a saber qué información personal recopilamos, solicitar la eliminación de información personal,
          corregir información personal inexacta y optar por no participar en cualquier venta o compartición futura. No
          discriminaremos por ejercer estos derechos.
        </p>
        <p>
          <strong className="text-cream">Agentes autorizados.</strong> Puede designar un agente autorizado para enviar
          una solicitud en su nombre. Podemos requerir verificación de identidad y autorización por escrito para dichas
          solicitudes.
        </p>
        <p>
          Para enviar una solicitud de privacidad de California, use{' '}
          <strong className="text-cream">Configuración &rarr; Privacidad &amp; Datos</strong> o envíe un correo
          electrónico a{' '}
          <a
            href="mailto:contact@linkintothessi.com"
            className="text-gold-text hover:underline"
          >
            contact@linkintothessi.com
          </a>
          .
        </p>

        {/* 9. Brasil (LGPD) */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">9. Usuarios de Brasil (LGPD)</h2>
        <p>
          De conformidad con la Lei Geral de Prote&ccedil;&atilde;o de Dados (LGPD) de Brasil, usted tiene los derechos
          establecidos en el Art. 18 de la LGPD, que incluyen: confirmación de la existencia del tratamiento; acceso a
          sus datos; corrección de datos incompletos o inexactos; anonimización, bloqueo o eliminación de datos
          innecesarios o excesivos; portabilidad; eliminación de datos tratados con base en el consentimiento;
          información sobre las entidades públicas y privadas con las que compartimos datos; información sobre la
          posibilidad de negar el consentimiento y las consecuencias; y revocación del consentimiento.
        </p>
        <p>
          Las reclamaciones pueden presentarse ante la Autoridade Nacional de Prote&ccedil;&atilde;o de Dados (ANPD).
        </p>
        <p>
          Nuestro encarregado (Delegado de Protección de Datos / representante LGPD):{' '}
          <strong className="text-cream">Henriko Alberton</strong>.
        </p>

        {/* 10. Cookies y almacenamiento */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">10. Cookies &amp; Almacenamiento</h2>
        <p>
          Utilizamos únicamente almacenamiento de navegador <strong className="text-cream">esencial</strong> (un token
          de sesión para mantenerle conectado y sus preferencias). No utilizamos cookies de publicidad, rastreo entre
          sitios ni análisis no esenciales. Para más detalles consulte nuestra{' '}
          <a
            href={`/${lang}/cookies`}
            className="text-gold-text hover:underline"
          >
            Política de Cookies &amp; Almacenamiento
          </a>
          .
        </p>

        {/* 11. Menores / edad */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">11. Menores &amp; Edad Mínima</h2>
        <p>
          El servicio está destinado a usuarios <strong className="text-cream">de 16 años de edad o mayores</strong>. No
          recopilamos conscientemente información personal de menores de 16 años. Si cree que un menor de 16 años nos ha
          proporcionado información personal, contáctenos en{' '}
          <a
            href="mailto:contact@linkintothessi.com"
            className="text-gold-text hover:underline"
          >
            contact@linkintothessi.com
          </a>{' '}
          y la eliminaremos de inmediato.
        </p>

        {/* 12. Cambios en esta politica */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">12. Cambios en esta Política</h2>
        <p>
          Podemos actualizar esta política periódicamente. Para{' '}
          <strong className="text-cream">cambios relevantes</strong> (nuevas categorías de datos, nuevas finalidades o
          nuevos subencargados), le notificaremos por correo electrónico y/o aviso en la aplicación, y le solicitaremos
          confirmación antes de que los cambios entren en vigor. La fecha de versión de la política en la parte superior
          de esta página refleja la revisión más reciente.
        </p>
        <p>
          Contáctenos con cualquier pregunta en{' '}
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
