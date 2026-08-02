import React from "react";

interface Props {
  label: string;
  active: boolean;
  onToggle: () => void;
  colorClass?: string;
}

export const FiltroPill: React.FC<Props> = ({
  label,
  active,
  onToggle,
  colorClass,
}) => {
  const base =
    "px-2 py-[3px] rounded-full border text-xs cursor-pointer select-none flex items-center gap-1 transition-all leading-none";

  // check tamaño más pequeño
  const checkClass = "w-3 h-3";

  const activeStyle = colorClass
    ? `${colorClass} border-2`
    : "bg-blue-600 text-white border-blue-700";

  const inactiveStyle =
    "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200";

  return (
    <div
      onClick={onToggle}
      className={`${base} ${active ? activeStyle : inactiveStyle}`}
      style={{
        transform: "scale(0.92)", // 20% más finos visualmente
      }}
    >
      <input type="checkbox" checked={active} readOnly className={checkClass} />
      {label}
    </div>
  );
};
