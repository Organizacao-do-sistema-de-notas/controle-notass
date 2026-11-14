import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { AbaCadastro } from "./Cadastros";

export function MenuCadastros({ aoAbrir, refBotao }: {
  aoAbrir: (aba: AbaCadastro) => void;
  refBotao: RefObject<HTMLButtonElement | null>;
}) {
  const [aberto, setAberto] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    container.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    function aoClicarFora(evento: PointerEvent) {
      if (evento.target instanceof Node && !container.current?.contains(evento.target)) setAberto(false);
    }
    document.addEventListener("pointerdown", aoClicarFora);
    return () => document.removeEventListener("pointerdown", aoClicarFora);
  }, [aberto]);

  function fechar() {
    setAberto(false);
    refBotao.current?.focus();
  }

  return (
    <div className="cadastros-menu" ref={container} onBlur={(evento) => {
      if (!evento.currentTarget.contains(evento.relatedTarget)) setAberto(false);
    }} onKeyDown={(evento) => {
      if (evento.key === "Escape") { evento.preventDefault(); fechar(); }
      if (!aberto && ["ArrowDown", "ArrowUp"].includes(evento.key)) {
        evento.preventDefault(); setAberto(true); return;
      }
      const itens = Array.from(container.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
      const indice = itens.indexOf(document.activeElement as HTMLButtonElement);
      if (aberto && ["ArrowDown", "ArrowUp", "Home", "End"].includes(evento.key)) {
        evento.preventDefault();
        const proximo = evento.key === "Home" ? 0 : evento.key === "End" ? itens.length - 1
          : (indice + (evento.key === "ArrowUp" ? -1 : 1) + itens.length) % itens.length;
        itens[proximo]?.focus();
      }
    }}>
      <button ref={refBotao} type="button" className="cadastros-menu-botao"
        aria-label="Mais opções" title="Cadastros" aria-haspopup="menu"
        aria-expanded={aberto} aria-controls={aberto ? "menu-cadastros" : undefined}
        onClick={() => setAberto(!aberto)}>
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      {aberto && (
        <div id="menu-cadastros" role="menu" aria-label="Cadastros" className="cadastros-menu-opcoes">
          <p>Cadastros</p>
          {([['clientes', 'Clientes'], ['contabilidades', 'Contabilidades']] as const).map(([aba, nome]) => (
            <button type="button" role="menuitem" key={aba} onClick={() => { fechar(); aoAbrir(aba); }}>{nome}</button>
          ))}
        </div>
      )}
    </div>
  );
}
