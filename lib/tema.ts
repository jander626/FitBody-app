/**
 * El tema de la app: automático, claro u oscuro.
 *
 * "Automático" es el que viene puesto y sigue al teléfono. Es lo correcto por
 * omisión —quien puso el celular en oscuro a las nueve de la noche ya dijo lo
 * que quería— pero no alcanza: hay quien deja el sistema en automático y
 * prefiere esta app siempre oscura, o al revés.
 *
 * Este módulo es compartido entre el script que corre antes del primer pintado
 * y el selector de la pantalla de Perfil. Tienen que coincidir en la clave de
 * almacenamiento y en el atributo, y con una sola fuente no se pueden
 * desincronizar.
 */

export const TEMAS = ["auto", "claro", "oscuro"] as const;
export type Tema = (typeof TEMAS)[number];

export const CLAVE_TEMA = "fitfood-tema";

/** El color de la barra de estado, por tema. Debe seguir a --ground. */
export const COLOR_BARRA = {
  claro: "#f5f5f3",
  oscuro: "#131417",
} as const;

export function esTema(valor: string | null): valor is Tema {
  return valor !== null && (TEMAS as readonly string[]).includes(valor);
}

/**
 * El guion que corre antes de pintar nada.
 *
 * Va como texto en un `<script>` del layout, en el head y sin `defer`: si
 * corriera después del primer pintado, abrir la app de noche daría un
 * destello blanco en toda la pantalla. Ese destello es la razón por la que
 * este código es una cadena y no un módulo normal.
 *
 * Si el almacenamiento falla —ventana privada, datos bloqueados— no se hace
 * nada y la app queda en automático, que es el comportamiento de siempre.
 */
export const GUION_TEMA = `(function(){try{
var t=localStorage.getItem(${JSON.stringify(CLAVE_TEMA)});
if(t==="claro"||t==="oscuro"){
document.documentElement.setAttribute("data-theme",t==="claro"?"light":"dark");
}
}catch(e){}})();`;

/** Aplica un tema al documento y deja la barra de estado a juego. */
export function aplicarTema(tema: Tema): void {
  const raiz = document.documentElement;

  if (tema === "auto") raiz.removeAttribute("data-theme");
  else raiz.setAttribute("data-theme", tema === "claro" ? "light" : "dark");

  // La barra de estado del sistema no lee las variables CSS: hay que
  // decírselo. Sin esto, en la app instalada la franja de arriba se queda del
  // color del tema anterior y se ve una costura.
  const oscuro =
    tema === "oscuro" ||
    (tema === "auto" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  for (const etiqueta of document.querySelectorAll<HTMLMetaElement>(
    'meta[name="theme-color"]',
  )) {
    etiqueta.content = oscuro ? COLOR_BARRA.oscuro : COLOR_BARRA.claro;
  }
}

/** Lo guardado, o "auto" si no hay nada o el almacenamiento no responde. */
export function temaGuardado(): Tema {
  try {
    const valor = localStorage.getItem(CLAVE_TEMA);
    return esTema(valor) ? valor : "auto";
  } catch {
    return "auto";
  }
}

export function guardarTema(tema: Tema): void {
  try {
    if (tema === "auto") localStorage.removeItem(CLAVE_TEMA);
    else localStorage.setItem(CLAVE_TEMA, tema);
  } catch {
    // Sin almacenamiento el tema dura lo que dure la pestaña. Aplicarlo igual
    // es mejor que no hacer nada cuando alguien acaba de tocar el botón.
  }
}
