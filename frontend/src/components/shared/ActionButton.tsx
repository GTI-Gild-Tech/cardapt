import { useState } from "react";

interface ActionButtonProps {
  children?: React.ReactNode;
  variant?: "outline" | "filled";
  onClick?: () => void;
  isToggle?: boolean;
  initialText?: string;
  toggledText?: string;
}

export function ActionButton({
  children,
  variant = "outline",
  onClick,
  isToggle = false,
  initialText = "Aberto",
  toggledText = "Fechado",
}: ActionButtonProps) {
  const [isToggled, setIsToggled] = useState(false);
  const isOutline = variant === "outline";

  const handleClick = () => {
    if (isToggle) {
      setIsToggled(prev => !prev);
    }
    onClick?.();
  };

  const displayText = isToggle 
    ? (isToggled ? toggledText : initialText)
    : children;

  return (
    <div
      className={`content-stretch flex gap-[52px] h-[23px] items-center justify-center relative rounded-[43px] shrink-0 w-[125px] cursor-pointer transition-colors ${
        isToggle && isToggled
          ? "bg-secondary hover:bg-secondaryHover"
          : isOutline
          ? "hover:bg-primaryHover hover:text-white"
          : "bg-primary hover:bg-primaryHover"
      }`}
      onClick={handleClick}
    >
      {isOutline && (
        <div
          aria-hidden="true"
          className="absolute border border-primary border-solid inset-0 pointer-events-none rounded-[43px]"
        />
      )}
      <div className="content-stretch flex gap-[9px] h-0 items-center justify-center relative shrink-0">
        <div
          className={`font-['Rethink_Sans:Medium',_sans-serif] font-medium leading-[0] relative shrink-0 text-[14px] text-center text-nowrap ${
            isToggle && isToggled
              ? "text-[#ffffff]"
              : isOutline 
              ? "text-textColorPrimary" 
              : "text-[#ffffff]"
          }`}
        >
          <p className="leading-[0px] whitespace-pre">
            {displayText}
          </p>
        </div>
      </div>
    </div>
  );
}