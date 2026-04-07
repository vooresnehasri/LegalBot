import React from "react";

export function Input(props) {
  const { className = "", ...rest } = props;
  return <input {...rest} className={`border rounded px-3 py-2 ${className}`} />;
}

export default Input;
