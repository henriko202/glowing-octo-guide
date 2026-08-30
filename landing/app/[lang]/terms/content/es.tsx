import type { Locale } from '@/i18n/config'

export default function Es({ lang }: { lang: Locale }) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24 text-cream/70">
      <h1 className="mb-8 font-display text-4xl font-semibold text-cream">Terminos de Servicio</h1>
      <div className="space-y-6 text-sm leading-relaxed">
        <p>
          <strong className="text-cream">Ultima actualizacion:</strong> Junio 2026
        </p>

        {/* 1. Aceptacion */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">1. Aceptacion</h2>
        <p>
          Al acceder o utilizar Link Into The SSI (&ldquo;el Servicio&rdquo;, &ldquo;nosotros&rdquo;) usted acepta
          quedar vinculado por estos Terminos de Servicio. Si no esta de acuerdo, no utilice el Servicio.
        </p>
        <p>
          <strong className="text-cream">Requisito de edad.</strong> Al usar el Servicio usted confirma que tiene{' '}
          <strong className="text-cream">16 anos de edad o mas</strong>. Si tiene menos de 16 anos no puede crear una
          cuenta ni utilizar el Servicio.
        </p>

        {/* 2. El servicio */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">2. El Servicio</h2>
        <p>
          Link Into The SSI es una plataforma SaaS conectada a LinkedIn que ofrece un feed compartido de publicaciones
          de miembros y le ayuda a interactuar con ellas. Las reacciones y los comentarios los realiza usted,
          directamente en LinkedIn: el Servicio muestra publicaciones relevantes, puede sugerir una reaccion y un
          borrador de comentario, y luego abre la publicacion en LinkedIn para que usted decida actuar. El Servicio no
          publica, comenta ni reacciona en LinkedIn en su nombre. Su proposito es ayudar a los profesionales a aumentar
          su Indice de Ventas Sociales (SSI) de LinkedIn mediante una interaccion autentica y mutua dentro de la
          comunidad.
        </p>

        {/* 3. Su cuenta LinkedIn y autorizacion */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">
          3. Su Cuenta LinkedIn &amp; Autorizacion
        </h2>
        <p>
          Para usar el Servicio debe iniciar sesion con su cuenta de LinkedIn a traves de LinkedIn OpenID Connect. Esto
          confirma su identidad y proporciona su informacion basica de perfil &mdash; su ID de miembro de LinkedIn,
          nombre, foto de perfil y direccion de correo electronico. El Servicio no solicita permiso para publicar,
          comentar ni reaccionar en LinkedIn, y no realiza ninguna escritura en su cuenta de LinkedIn.
        </p>
        <p>
          Usted sigue siendo plenamente responsable de toda la actividad que ocurra en su cuenta de LinkedIn, incluidos
          los comentarios o reacciones que realice en LinkedIn despues de abrir una publicacion a traves del Servicio.
          Puede revocar esta autorizacion en cualquier momento desde la configuracion de su cuenta de LinkedIn o
          eliminando su cuenta.
        </p>

        {/* 4. Uso aceptable */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">4. Uso Aceptable</h2>
        <p>Usted acepta no utilizar el Servicio para:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>enviar spam o mensajes no solicitados;</li>
          <li>acosar, abusar o perjudicar a otros miembros;</li>
          <li>
            ejecutar actividades automatizadas o de bot mas alla de las funciones expresamente ofrecidas por el Servicio
            (p. ej., interaccion programada fuera de la plataforma);
          </li>
          <li>violar cualquier ley o regulacion local, nacional o internacional aplicable; o</li>
          <li>eludir o intentar eludir cualquier medida tecnica o control de seguridad del Servicio o de LinkedIn.</li>
        </ul>
        <p>
          Tambien debe cumplir en todo momento con el{' '}
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

        {/* 5. Suscripciones y facturacion */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">5. Suscripciones &amp; Facturacion</h2>
        <p>
          El acceso al Servicio requiere una suscripcion de pago activa. Las suscripciones se facturan de forma{' '}
          <strong className="text-cream">mensual</strong> a traves de Stripe. Al suscribirse autoriza a Stripe a cargar
          el metodo de pago proporcionado de forma recurrente mensual hasta que cancele.
        </p>
        <p>
          <strong className="text-cream">Cancelacion.</strong> Puede cancelar su suscripcion en cualquier momento desde
          la configuracion de su cuenta. La cancelacion surte efecto al{' '}
          <strong className="text-cream">final del periodo de facturacion actual</strong>; mantiene acceso al Servicio
          hasta esa fecha y no se emiten reembolsos parciales por el tiempo no utilizado.
        </p>
        <p>
          <strong className="text-cream">Eliminacion de cuenta.</strong> Solicitar la eliminacion de la cuenta cancela
          automaticamente cualquier suscripcion activa. Los registros de facturacion se conservan segun lo exigido por
          la ley (consulte la{' '}
          <a
            href={`/${lang}/privacy`}
            className="text-gold-text hover:underline"
          >
            Politica de Privacidad
          </a>
          ).
        </p>

        {/* 6. Suspension, ban y eliminacion de cuenta */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">
          6. Suspension, Ban &amp; Eliminacion de Cuenta
        </h2>
        <p>
          Podemos suspender o banear permanentemente cuentas que violen estos Terminos, incurran en uso indebido o
          perjudiquen a la comunidad o al Servicio, sin previo aviso cuando sea necesario para proteger a los miembros o
          la plataforma.
        </p>
        <p>
          <strong className="text-cream">Autoelminacion.</strong> Puede eliminar su cuenta en cualquier momento desde la
          configuracion de su cuenta. Se aplica un <strong className="text-cream">periodo de gracia de 30 dias</strong>,
          durante el cual su cuenta puede recuperarse. Tras 30 dias sus datos personales se eliminan permanentemente,
          excepto los registros de facturacion que deben conservarse por razones de cumplimiento fiscal o financiero
          (consulte nuestra{' '}
          <a
            href={`/${lang}/privacy`}
            className="text-gold-text hover:underline"
          >
            Politica de Privacidad
          </a>
          ).
        </p>

        {/* 7. Exenciones de garantia y limitacion de responsabilidad */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">
          7. Exenciones de Garantia &amp; Limitacion de Responsabilidad
        </h2>
        <p>
          Esta seccion, incluidas las exenciones de garantia, las disposiciones de indemnizacion y los limites de
          responsabilidad, sera redactada e insertada por asesores juridicos calificados antes del lanzamiento publico
          del Servicio. Hasta que estos terminos sean finalizados, no se aplica ninguna limitacion vinculante de
          responsabilidad en ninguna direccion.
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
          y todas las politicas de LinkedIn. Link Into The SSI es un producto independiente y{' '}
          <strong className="text-cream">no esta afiliado, respaldado ni patrocinado por LinkedIn Corporation</strong>{' '}
          ni ninguna de sus filiales.
        </p>

        {/* 9. Ley aplicable */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">9. Ley Aplicable</h2>
        <p>
          Estos Terminos se rigen e interpretan de conformidad con las leyes de{' '}
          <strong className="text-cream">Brazil</strong>. Cualquier disputa derivada de o relacionada con estos Terminos
          estara sujeta a la jurisdiccion exclusiva de los tribunales de <strong className="text-cream">Brazil</strong>.
        </p>

        {/* 10. Cambios y contacto */}
        <h2 className="mt-10 mb-3 font-display text-xl font-semibold text-cream">10. Cambios &amp; Contacto</h2>
        <p>
          Podemos actualizar estos Terminos periodicamente. Los cambios relevantes se comunicaran por correo electronico
          o aviso en la aplicacion antes de que entren en vigor. El uso continuado del Servicio despues de la fecha de
          vigencia de un cambio constituye la aceptacion de los Terminos revisados.
        </p>
        <p>
          Preguntas sobre estos Terminos? Contactenos en{' '}
          <a
            href="mailto:contact@linkintothessi.com"
            className="text-gold-text hover:underline"
          >
            contact@linkintothessi.com
          </a>
          .
        </p>
        <p>
          Para informacion sobre como tratamos sus datos personales, lea nuestra{' '}
          <a
            href={`/${lang}/privacy`}
            className="text-gold-text hover:underline"
          >
            Politica de Privacidad
          </a>
          .
        </p>
      </div>
    </main>
  )
}
