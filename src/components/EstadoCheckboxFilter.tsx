import React from "react";

export interface EstadoOption {
  key: string;
  label: string;
}

interface EstadoCheckboxFilterProps {
  estados: EstadoOption[];
  value: string[];
  onChange: (value: string[]) => void;
}

const EstadoCheckboxFilter: React.FC<EstadoCheckboxFilterProps> = ({
  estados,
  value,
  onChange,
}) => (
  <div className="flex gap-4">
    {estados.map((e) => (
      <label key={e.key} className="flex items-center gap-1 cursor-pointer">
        <input
          type="checkbox"
          checked={value.includes(e.key)}
          onChange={(ev) => {
            const checked = ev.target.checked;
            if (checked) onChange([...value, e.key]);
            else onChange(value.filter((v) => v !== e.key));
          }}
        />
        <span className="text-sm">{e.label}</span>
      </label>
    ))}
  </div>
);

export default EstadoCheckboxFilter;
