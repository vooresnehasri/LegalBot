import React from "react";

export function Card({ children, className = "", ...props }) {
  return (
    <div {...props} className={`rounded-lg bg-white shadow ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = "", ...props }) {
  return (
    <div {...props} className={`px-4 py-3 border-b ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className = "", ...props }) {
  return (
    <h3 {...props} className={`text-lg font-semibold ${className}`}>
      {children}
    </h3>
  );
}

export function CardContent({ children, className = "", ...props }) {
  return (
    <div {...props} className={`p-4 ${className}`}>
      {children}
    </div>
  );
}

export default Card;
