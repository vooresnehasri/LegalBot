import React from "react";

export function Textarea(props) {
  const { className = "", ...rest } = props;
  return <textarea {...rest} className={`border rounded px-3 py-2 ${className}`} />;
}

export default Textarea;
