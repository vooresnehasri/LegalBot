import React from "react";

export function Select({ value, onValueChange, children, className = "", ...rest }) {
  const handleChange = (e) => {
    onValueChange?.(e.target.value);
  };

  return (
    <select value={value} onChange={handleChange} className={className} {...rest}>
      {children}
    </select>
  );
}

export function SelectContent({ children, className = "", ...rest }) {
  return (
    <div className={className} {...rest}>
      {children}
    </div>
  );
}

export function SelectItem({ value, children, ...rest }) {
  return (
    <option value={value} {...rest}>
      {children}
    </option>
  );
}

export function SelectTrigger({ children }) {
  return <div>{children}</div>;
}

export function SelectValue() {
  return null;
}

export default Select;
