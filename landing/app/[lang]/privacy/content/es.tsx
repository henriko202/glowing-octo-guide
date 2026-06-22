import type { Locale } from '../../../../i18n/config'

export default function Es({ lang }: { lang: Locale }) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24 text-cream/70">
      <h1 className="mb-8 font-display text-4xl font-semibold text-cream">Politica de Privacidad</h1>
      <div className="space-y-6 text-sm leading-relaxed">
        <p>
          <strong className="text-cream">Ultima actualizacion:</strong> Junio 2026
        </p>
        <p>Policy version: 2026-06-15</p>

        {/* 1. Quienes somos */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">1. Quienes Somos</h2>
        <p>
          El responsable del tratamiento de sus datos personales es{' '}
          <strong className="text-cream">[LEGAL_ENTITY_NAME]</strong>, ubicado en{' '}
          <strong className="text-cream">[BUSINESS_ADDRESS]</strong> (&ldquo;nosotros&rdquo;, &ldquo;Link Into The
          SSI&rdquo;).
        </p>
        <p>
          Consultas sobre privacidad:{' '}
          <a
            href="mailto:[PRIVACY_CONTACT_EMAIL]"
            className="text-gold-text hover:underline"
          >
            [PRIVACY_CONTACT_EMAIL]
          </a>
          .
        </p>
        <p>
          Delegado de Proteccion de Datos / Representante UE&ndash;UK:{' '}
          <strong className="text-cream">[DPO_OR_REP_CONTACT]</strong>.
        </p>

        {/* 2. Datos que recopilamos y fuentes */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">
          2. Datos que Recopilamos &amp; Fuentes
        </h2>
        <p>
          <strong className="text-cream">Inicio de sesion con LinkedIn (OIDC).</strong> Cuando conecta su cuenta de
          LinkedIn, recibimos su ID de miembro de LinkedIn, nombre completo, URL de foto de perfil y direccion de correo
          electronico a traves del flujo OpenID Connect de LinkedIn.
        </p>
        <p>
          <strong className="text-cream">Atributos de perfil que usted define.</strong> Puede proporcionar
          voluntariamente su sector e industria y pais en la configuracion de su perfil.
        </p>
        <p>
          <strong className="text-cream">Publicaciones que envias.</strong> Almacenamos las publicaciones de LinkedIn
          que crea o programa a traves de la plataforma.
        </p>
        <p>
          <strong className="text-cream">Acciones de interaccion.</strong> Registramos comentarios y reacciones
          realizados a traves de su token de acceso de LinkedIn en su nombre como parte de la funcion principal de
          interaccion con el feed de la plataforma.
        </p>
        <p>
          <strong className="text-cream">Facturacion.</strong> Los pagos de suscripcion son procesados por Stripe.
          Almacenamos su ID de cliente de Stripe y el estado de suscripcion; no almacenamos datos de tarjeta de pago.
        </p>
        <p>
          <strong className="text-cream">Datos tecnicos y de sesion.</strong> Recopilamos registros de servidor estandar
          (direccion IP, tipo de navegador, paginas visitadas, marcas de tiempo) para monitoreo de seguridad y
          rendimiento.
        </p>
        <p>
          <strong className="text-cream">Sin raspado de datos.</strong> No realizamos raspado de datos de LinkedIn ni de
          ningun otro sitio web de terceros. Todos los datos provienen de sus interacciones directas con nuestra
          plataforma o a traves de la API de LinkedIn con su consentimiento autorizado.
        </p>

        {/* 3. Por que lo usamos y bases legales */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">
          3. Por que lo Usamos &amp; Bases Legales
        </h2>
        <p>
          <strong className="text-cream">Contrato (Art. 6(1)(b) GDPR).</strong> Prestacion del servicio principal:
          autenticacion, visualizacion de su feed, publicacion de posts y acciones de interaccion, y gestion de su
          suscripcion.
        </p>
        <p>
          <strong className="text-cream">Intereses legitimos (Art. 6(1)(f) GDPR).</strong> Optimizacion de la calidad
          del feed, prevencion de abuso, garantia de seguridad de la plataforma y mantenimiento de estadisticas
          agregadas y no identificables sobre el rendimiento del servicio.
        </p>
        <p>
          <strong className="text-cream">Consentimiento (Art. 6(1)(a) GDPR).</strong> Las comunicaciones de marketing y
          los analisis opcionales se procesan unicamente con su consentimiento explicito. Ambos estan{' '}
          <strong className="text-cream">desactivados por defecto</strong> y pueden modificarse en cualquier momento en{' '}
          <strong className="text-cream">Configuracion &rarr; Privacidad &amp; Datos</strong>.
        </p>
        <p>
          <strong className="text-cream">Obligacion legal (Art. 6(1)(c) GDPR).</strong> Conservacion de registros de
          facturacion para cumplimiento fiscal y financiero, mantenimiento de registros de consentimiento y respuesta a
          solicitudes legitimas de autoridades supervisoras o policiales.
        </p>

        {/* 4. Con quien lo compartimos */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">4. Con Quien lo Compartimos</h2>
        <p>Contratamos los siguientes subencargados que pueden tratar datos personales en nuestro nombre:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong className="text-cream">LinkedIn</strong> &mdash; autenticacion (OIDC) y API de interaccion.
          </li>
          <li>
            <strong className="text-cream">Stripe</strong> &mdash; procesamiento de pagos y gestion de suscripciones.
          </li>
          <li>
            <strong className="text-cream">Convex</strong> &mdash; base de datos backend y funciones serverless.
          </li>
          <li>
            <strong className="text-cream">Vercel</strong> &mdash; alojamiento del sitio de presentacion y entrega edge.
          </li>
          <li>
            <strong className="text-cream">Railway</strong> &mdash; alojamiento del servidor de aplicacion.
          </li>
          <li>
            <strong className="text-cream">Cloudflare</strong> &mdash; DNS, CDN y proteccion contra DDoS.
          </li>
          <li>
            <strong className="text-cream">Resend</strong> &mdash; entrega de correos electronicos transaccionales.
          </li>
          <li>
            <strong className="text-cream">OpenRouter (inferencia de IA)</strong> &mdash; generacion de sugerencias de
            reaccion y borradores de comentarios a partir del contenido de sus publicaciones publicas, incluidas las
            imagenes. OpenRouter enruta unicamente a proveedores de inferencia con retencion cero de datos (los prompts
            no se almacenan ni se utilizan para entrenamiento).
          </li>
        </ul>
        <p>
          <strong className="text-cream">NO vendemos ni compartimos su informacion personal</strong> para publicidad
          conductual contextual cruzada ni para ninguna otra finalidad comercial.
        </p>

        {/* 5. Transferencias internacionales */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">5. Transferencias Internacionales</h2>
        <p>
          Nuestros subencargados estan ubicados principalmente en los Estados Unidos. Cuando los datos se transfieren
          fuera del Espacio Economico Europeo o del Reino Unido, utilizamos las Clausulas Contractuales Estandar (SCCs)
          de la Comision Europea como mecanismo de transferencia para cada procesador. Una copia de las salvaguardas de
          transferencia aplicables esta disponible previa solicitud contactando{' '}
          <a
            href="mailto:[PRIVACY_CONTACT_EMAIL]"
            className="text-gold-text hover:underline"
          >
            [PRIVACY_CONTACT_EMAIL]
          </a>
          .
        </p>

        {/* 6. Durante cuanto tiempo lo conservamos */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">
          6. Durante Cuanto Tiempo lo Conservamos
        </h2>
        <p>
          <strong className="text-cream">Eliminacion de cuenta.</strong> Cuando elimina su cuenta (o solicita la
          supresion), sus datos personales se marcan para eliminacion de inmediato. Se aplica un periodo de gracia de 30
          dias para permitir la recuperacion en caso de eliminacion accidental, tras el cual los datos se eliminan
          permanentemente.
        </p>
        <p>
          <strong className="text-cream">Cuentas inactivas.</strong> Las cuentas sin actividad durante 24 meses se
          tratan automaticamente como solicitudes de eliminacion; le notificaremos antes de proceder a la eliminacion.
        </p>
        <p>
          <strong className="text-cream">Registros de facturacion.</strong> Los registros de transacciones y
          suscripciones se conservan en Stripe durante el tiempo exigido por la normativa fiscal y financiera aplicable
          (generalmente 7 anos).
        </p>
        <p>
          Aplicamos minimizacion de datos: recopilamos solo lo necesario para prestar el servicio y eliminamos los datos
          en cuanto dejan de ser necesarios para su finalidad original.
        </p>

        {/* 7. Sus derechos */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">7. Sus Derechos</h2>
        <p>Segun su jurisdiccion, puede tener derecho a:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong className="text-cream">Acceso</strong> &mdash; obtener una copia de los datos personales que
            conservamos sobre usted.
          </li>
          <li>
            <strong className="text-cream">Rectificacion</strong> &mdash; corregir datos inexactos o incompletos.
          </li>
          <li>
            <strong className="text-cream">Supresion</strong> &mdash; solicitar la eliminacion de sus datos
            (&ldquo;derecho al olvido&rdquo;).
          </li>
          <li>
            <strong className="text-cream">Limitacion</strong> &mdash; pedirnos que limitemos el tratamiento de sus
            datos.
          </li>
          <li>
            <strong className="text-cream">Oposicion</strong> &mdash; oponerse al tratamiento basado en intereses
            legitimos.
          </li>
          <li>
            <strong className="text-cream">Portabilidad</strong> &mdash; recibir sus datos en un formato estructurado y
            legible por maquina.
          </li>
          <li>
            <strong className="text-cream">Retirar el consentimiento</strong> &mdash; revocar el consentimiento para
            marketing o analisis en cualquier momento sin afectar el tratamiento previo.
          </li>
          <li>
            <strong className="text-cream">Presentar una reclamacion</strong> &mdash; ante su autoridad supervisora
            local (p. ej., la autoridad nacional de proteccion de datos en la UE/UK, o el fiscal general estatal
            correspondiente en los EE. UU.).
          </li>
        </ul>
        <p>
          <strong className="text-cream">Como ejercer sus derechos.</strong> La forma mas rapida es a traves de{' '}
          <strong className="text-cream">Configuracion &rarr; Privacidad &amp; Datos</strong>, donde puede exportar sus
          datos, eliminar su cuenta y gestionar los consentimientos. Tambien puede contactarnos en{' '}
          <a
            href="mailto:[PRIVACY_CONTACT_EMAIL]"
            className="text-gold-text hover:underline"
          >
            [PRIVACY_CONTACT_EMAIL]
          </a>
          . Responderemos en un plazo de 30 dias (o el plazo legal cuando sea menor).
        </p>

        {/* 8. California (CCPA/CPRA) */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">
          8. Residentes de California (CCPA / CPRA)
        </h2>
        <p>
          <strong className="text-cream">Categorias recopiladas.</strong> Identificadores (nombre, correo electronico,
          ID de LinkedIn, direccion IP); informacion profesional o relacionada con el empleo (titulo, sector); actividad
          en Internet o en red (registros de sesion); informacion comercial (estado de suscripcion via Stripe).
        </p>
        <p>
          <strong className="text-cream">Sin venta ni comparticion.</strong> No vendemos informacion personal. No
          compartimos informacion personal para publicidad conductual contextual cruzada.
        </p>
        <p>
          <strong className="text-cream">Sus derechos CCPA/CPRA.</strong> Los residentes de California pueden ejercer el
          derecho a saber que informacion personal recopilamos, solicitar la eliminacion de informacion personal,
          corregir informacion personal inexacta y optar por no participar en cualquier venta o comparticion futura. No
          discriminaremos por ejercer estos derechos.
        </p>
        <p>
          <strong className="text-cream">Agentes autorizados.</strong> Puede designar un agente autorizado para enviar
          una solicitud en su nombre. Podemos requerir verificacion de identidad y autorizacion por escrito para dichas
          solicitudes.
        </p>
        <p>
          Para enviar una solicitud de privacidad de California, use{' '}
          <strong className="text-cream">Configuracion &rarr; Privacidad &amp; Datos</strong> o envie un correo
          electronico a{' '}
          <a
            href="mailto:[PRIVACY_CONTACT_EMAIL]"
            className="text-gold-text hover:underline"
          >
            [PRIVACY_CONTACT_EMAIL]
          </a>
          .
        </p>

        {/* 9. Brasil (LGPD) */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">9. Usuarios de Brasil (LGPD)</h2>
        <p>
          De conformidad con la Lei Geral de Prote&ccedil;&atilde;o de Dados (LGPD) de Brasil, usted tiene los derechos
          establecidos en el Art. 18 de la LGPD, que incluyen: confirmacion de la existencia del tratamiento; acceso a
          sus datos; correccion de datos incompletos o inexactos; anonimizacion, bloqueo o eliminacion de datos
          innecesarios o excesivos; portabilidad; eliminacion de datos tratados con base en el consentimiento;
          informacion sobre las entidades publicas y privadas con las que compartimos datos; informacion sobre la
          posibilidad de negar el consentimiento y las consecuencias; y revocacion del consentimiento.
        </p>
        <p>
          Las reclamaciones pueden presentarse ante la Autoridade Nacional de Prote&ccedil;&atilde;o de Dados (ANPD).
        </p>
        <p>
          Nuestro encarregado (Delegado de Proteccion de Datos / representante LGPD):{' '}
          <strong className="text-cream">[DPO_OR_REP_CONTACT]</strong>.
        </p>

        {/* 10. Cookies y almacenamiento */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">10. Cookies &amp; Almacenamiento</h2>
        <p>
          Utilizamos unicamente almacenamiento de navegador <strong className="text-cream">esencial</strong> (un token
          de sesion para mantenerle conectado y sus preferencias). No utilizamos cookies de publicidad, rastreo entre
          sitios ni analisis no esenciales. Para mas detalles consulte nuestra{' '}
          <a
            href={`/${lang}/cookies`}
            className="text-gold-text hover:underline"
          >
            Politica de Cookies &amp; Almacenamiento
          </a>
          .
        </p>

        {/* 11. Menores / edad */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">11. Menores &amp; Edad Minima</h2>
        <p>
          El servicio esta destinado a usuarios <strong className="text-cream">de 16 anos de edad o mayores</strong>. No
          recopilamos conscientemente informacion personal de menores de 16 anos. Si cree que un menor de 16 anos nos ha
          proporcionado informacion personal, contactenos en{' '}
          <a
            href="mailto:[PRIVACY_CONTACT_EMAIL]"
            className="text-gold-text hover:underline"
          >
            [PRIVACY_CONTACT_EMAIL]
          </a>{' '}
          y la eliminaremos de inmediato.
        </p>

        {/* 12. Cambios en esta politica */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">12. Cambios en esta Politica</h2>
        <p>
          Podemos actualizar esta politica periodicamente. Para{' '}
          <strong className="text-cream">cambios relevantes</strong> (nuevas categorias de datos, nuevas finalidades o
          nuevos subencargados), le notificaremos por correo electronico y/o aviso en la aplicacion, y le solicitaremos
          confirmacion antes de que los cambios entren en vigor. La fecha de version de la politica en la parte superior
          de esta pagina refleja la revision mas reciente.
        </p>
        <p>
          Preguntas o inquietudes? Contactenos en{' '}
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
