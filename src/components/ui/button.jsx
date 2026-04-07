import React from "react";

export function Button({ children, className = "", ...props }) {
  return (
    <button {...props} className={`${className} px-3 py-1.5 rounded`}> 
      {children}
    </button>
  );
}

export default Button;
