import { KanbanBoard } from "./KanbanBoard";

export function CardapioContent() {
  return (
    <div className="z-0 basis-0 box-border content-stretch flex flex-col gap-[25px] grow items-center justify-start min-h-screen w-full px-0 py-[50px]">
      <div className="font-['PrimaryFont:Demo',_sans-serif] leading-[0] not-italic relative shrink-0 text-textColorPrimary text-[64px] text-nowrap tracking-[-1.28px]">
        <p className="leading-[1.5] whitespace-pre font-[PrimaryFont]">Cardapio</p>
      </div>
      <div className="flex-grow w-full bg-[#f0eee9]">
        <KanbanBoard />
      </div>
    </div>
  );
}