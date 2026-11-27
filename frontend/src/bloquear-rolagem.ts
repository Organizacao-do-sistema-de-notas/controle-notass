let bloqueios = 0;
let anterior = "";
export function bloquearRolagem() {
  if (bloqueios++ === 0) { anterior = document.body.style.overflow; document.body.style.overflow = "hidden"; }
  let liberado = false;
  return () => {
    if (liberado) return;
    liberado = true;
    if (--bloqueios === 0) document.body.style.overflow = anterior;
  };
}
