import type { Locale } from '@/i18n/config'

export default function Es({ lang }: { lang: Locale }) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24 text-cream/70">
      <h1 className="mb-8 font-display text-4xl font-semibold text-cream">Términos de Servicio</h1>
      <div className="space-y-6 text-sm leading-relaxed">
        <p>
          <strong className="text-cream">Última actualización:</strong> Septiembre 2026
        </p>

        {/* 1. Aceptación */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">1. Aceptación</h2>
        <p>
          Al acceder o utilizar Link Into The SSI (&ldquo;el Servicio&rdquo;, &ldquo;nosotros&rdquo;) usted acepta
          quedar vinculado por estos Términos de Servicio. Si no está de acuerdo, no utilice el Servicio.
        </p>
        <p>
          <strong className="text-cream">Requisito de edad.</strong> Al usar el Servicio usted confirma que tiene{' '}
          <strong className="text-cream">16 años de edad o más</strong>. Si tiene menos de 16 años no puede crear una
          cuenta ni utilizar el Servicio.
        </p>

        {/* 2. El servicio */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">2. El Servicio</h2>
        <p>
          Link Into The SSI es una plataforma SaaS conectada a LinkedIn que ofrece un feed compartido de publicaciones
          de miembros y le ayuda a interactuar con ellas. Las reacciones y los comentarios los realiza usted,
          directamente en LinkedIn: el Servicio muestra publicaciones relevantes, puede sugerir una reacción y un
          borrador de comentario, y luego abre la publicación en LinkedIn para que usted decida actuar. El Servicio no
          publica, comenta ni reacciona en LinkedIn en su nombre. Su propósito es ayudar a los profesionales a aumentar
          su Índice de Ventas Sociales (SSI) de LinkedIn mediante una interacción auténtica y mutua dentro de la
          comunidad.
        </p>
        <p>
          <strong className="text-cream">Qué compra usted.</strong> Usted compra acceso a este software. Su suscripción
          cubre el feed compartido, las sugerencias de reacción y comentario, y las funciones de cuenta incluidas en su
          plan. No vendemos reacciones, comentarios, conexiones ni seguidores, y no entregamos interacciones a su cuenta
          de LinkedIn ni a ninguna otra cuenta. Su SSI depende de lo que usted haga en LinkedIn, así que no prometemos
          puntaje, posición ni resultado.
        </p>

        {/* 3. Su cuenta LinkedIn y autorización */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">
          3. Su Cuenta LinkedIn &amp; Autorización
        </h2>
        <p>
          Para usar el Servicio debe iniciar sesión con su cuenta de LinkedIn a través de LinkedIn OpenID Connect. Esto
          confirma su identidad y proporciona su información básica de perfil: su ID de miembro de LinkedIn, nombre,
          foto de perfil y dirección de correo electrónico. El Servicio no solicita permiso para publicar, comentar ni
          reaccionar en LinkedIn, y no realiza ninguna escritura en su cuenta de LinkedIn.
        </p>
        <p>
          Usted sigue siendo plenamente responsable de toda la actividad que ocurra en su cuenta de LinkedIn, incluidos
          los comentarios o reacciones que realice en LinkedIn después de abrir una publicación a través del Servicio.
          Puede revocar esta autorización en cualquier momento desde la configuración de su cuenta de LinkedIn o
          eliminando su cuenta.
        </p>

        {/* 4. Uso aceptable */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">4. Uso Aceptable</h2>
        <p>Usted acepta no utilizar el Servicio para:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>enviar spam o mensajes no solicitados;</li>
          <li>acosar, abusar o perjudicar a otros miembros;</li>
          <li>
            ejecutar actividades automatizadas o de bot más allá de las funciones expresamente ofrecidas por el Servicio
            (p. ej., interacción programada fuera de la plataforma);
          </li>
          <li>violar cualquier ley o regulación local, nacional o internacional aplicable; o</li>
          <li>eludir o intentar eludir cualquier medida técnica o control de seguridad del Servicio o de LinkedIn.</li>
        </ul>
        <p>
          También debe cumplir en todo momento con el{' '}
          <a
            href="https://www.linkedin.com/legal/user-agreement"
            className="text-gold-text hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Acuerdo de Usuario de LinkedIn
          </a>
          .
        </p>

        {/* 5. Suscripciones y facturación */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">5. Suscripciones &amp; Facturación</h2>
        <p>
          El acceso al Servicio requiere una suscripción de pago activa. Las suscripciones se facturan de forma{' '}
          <strong className="text-cream">mensual o anual</strong>, según el plan y el intervalo que elija, a través de
          Stripe. Al suscribirse autoriza a Stripe a cargar el método de pago proporcionado de forma recurrente hasta
          que cancele.
        </p>
        <p>
          <strong className="text-cream">Planes y entrega.</strong> Ofrecemos cuatro planes: Starter, Growth, Pro y un
          plan Enterprise personalizado, acordado por contacto. Usted ve el precio actual de cada plan e intervalo en
          nuestra página de inicio, y de nuevo en el checkout, antes de pagar. El Servicio funciona como una aplicación
          web alojada, habilitamos su acceso apenas comienza la suscripción, y no enviamos productos físicos.
        </p>
        <p>
          <strong className="text-cream">Compras únicas.</strong> Algunas funciones se venden por separado de la
          suscripción. Destacar una de sus publicaciones cuesta <strong className="text-cream">U$5</strong>, cobrados
          una sola vez por Stripe cuando confirma la compra. Se aplica a la{' '}
          <strong className="text-cream">publicación que elija</strong>, no se renueva y no es reembolsable una vez que
          esa publicación ha sido destacada.
        </p>
        <p>
          <strong className="text-cream">Prueba gratuita.</strong> Las cuentas nuevas comienzan con una{' '}
          <strong className="text-cream">prueba gratuita de 7 días</strong> (14 días cuando se une mediante el enlace de
          invitación de un miembro) y se requiere un método de pago para iniciarla. La prueba termina —y la facturación
          comienza— en cuanto alcanza <strong className="text-cream">50 interacciones</strong> (hechas y recibidas) o
          cuando termina el período de prueba, lo que ocurra primero. Le avisamos por correo antes del primer cobro.
          Puede cancelar en cualquier momento antes de que termine la prueba desde la página Suscripción de su cuenta, y
          no se le cobrará. Hay una prueba gratuita por cuenta; si se suscribe de nuevo tras cancelar, el cobro comienza
          de inmediato y se indica en el checkout.
        </p>
        <p>
          <strong className="text-cream">Cancelación.</strong> Puede cancelar su suscripción en cualquier momento desde
          la configuración de su cuenta. La cancelación surte efecto al{' '}
          <strong className="text-cream">final del período de facturación actual</strong>; mantiene acceso al Servicio
          hasta esa fecha y no se emiten reembolsos parciales por el tiempo no utilizado.
        </p>
        <p>
          <strong className="text-cream">Eliminación de cuenta.</strong> Solicitar la eliminación de la cuenta cancela
          automáticamente cualquier suscripción activa. Los registros de facturación se conservan según lo exigido por
          la ley (consulte la{' '}
          <a
            href={`/${lang}/privacy`}
            className="text-gold-text hover:underline"
          >
            Política de Privacidad
          </a>
          ).
        </p>

        {/* 6. Suspensión, ban y eliminación de cuenta */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">
          6. Suspensión, Ban &amp; Eliminación de Cuenta
        </h2>
        <p>
          Podemos suspender o banear permanentemente cuentas que violen estos Términos, incurran en uso indebido o
          perjudiquen a la comunidad o al Servicio, sin previo aviso cuando sea necesario para proteger a los miembros o
          la plataforma.
        </p>
        <p>
          <strong className="text-cream">Autoeliminación.</strong> Puede eliminar su cuenta en cualquier momento desde
          la configuración de su cuenta. Se aplica un{' '}
          <strong className="text-cream">período de gracia de 30 días</strong>, durante el cual su cuenta puede
          recuperarse. Tras 30 días sus datos personales se eliminan permanentemente, excepto los registros de
          facturación que deben conservarse por razones de cumplimiento fiscal o financiero (consulte nuestra{' '}
          <a
            href={`/${lang}/privacy`}
            className="text-gold-text hover:underline"
          >
            Política de Privacidad
          </a>
          ).
        </p>

        {/* 7. Exenciones de garantía y limitación de responsabilidad */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">
          7. Exenciones de Garantía &amp; Limitación de Responsabilidad
        </h2>
        <p>
          Esta sección, incluidas las exenciones de garantía, las disposiciones de indemnización y los límites de
          responsabilidad, será redactada e insertada por asesores jurídicos calificados antes del lanzamiento público
          del Servicio. Hasta que estos términos sean finalizados, no se aplica ninguna limitación vinculante de
          responsabilidad en ninguna dirección.
        </p>

        {/* 8. Acuerdo de Usuario de LinkedIn */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">8. Acuerdo de Usuario de LinkedIn</h2>
        <p>
          Debe cumplir de forma independiente con el{' '}
          <a
            href="https://www.linkedin.com/legal/user-agreement"
            className="text-gold-text hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Acuerdo de Usuario de LinkedIn
          </a>{' '}
          y todas las políticas de LinkedIn. Link Into The SSI es un producto independiente y{' '}
          <strong className="text-cream">no está afiliado, respaldado ni patrocinado por LinkedIn Corporation</strong>{' '}
          ni ninguna de sus filiales.
        </p>

        {/* 9. Ley aplicable */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">9. Ley Aplicable</h2>
        <p>
          Estos Términos se rigen e interpretan de conformidad con las leyes de{' '}
          <strong className="text-cream">Brasil</strong>. Cualquier disputa derivada de o relacionada con estos Términos
          estará sujeta a la jurisdicción exclusiva de los tribunales de <strong className="text-cream">Brasil</strong>.
        </p>

        {/* 10. Cambios y contacto */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">10. Cambios &amp; Contacto</h2>
        <p>
          Podemos actualizar estos Términos periódicamente. Los cambios relevantes se comunicarán por correo electrónico
          o aviso en la aplicación antes de que entren en vigor. El uso continuado del Servicio después de la fecha de
          vigencia de un cambio constituye la aceptación de los Términos revisados.
        </p>
        <p>
          Para preguntas sobre estos Términos, contáctenos en{' '}
          <a
            href="mailto:contact@linkintothessi.com"
            className="text-gold-text hover:underline"
          >
            contact@linkintothessi.com
          </a>
          .
        </p>
        <p>
          Para información sobre cómo tratamos sus datos personales, lea nuestra{' '}
          <a
            href={`/${lang}/privacy`}
            className="text-gold-text hover:underline"
          >
            Política de Privacidad
          </a>
          .
        </p>
      </div>
    </main>
  )
}
