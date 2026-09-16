import * as React from "react";
import { memo, useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface ControlledInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string;
  onValueChange: (value: string) => void;
  uppercase?: boolean;
}

export const ControlledInput = memo(
  ({
    value,
    onValueChange,
    uppercase = false,
    className,
    onBlur,
    onChange,
    ...props
  }: ControlledInputProps) => {
    const [localValue, setLocalValue] = useState(value);

    useEffect(() => {
      setLocalValue(value);
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = uppercase ? e.target.value.toUpperCase() : e.target.value;
      setLocalValue(val);
      if (onChange) onChange(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      if (localValue !== value) {
        onValueChange(localValue);
      }
      if (onBlur) onBlur(e);
    };

    return (
      <input
        {...props}
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        className={cn(
          // text-base (16px) não é estética: abaixo disso o Safari do iPhone dá
          // zoom ao focar o campo, e o médico precisa dar pinch para voltar.
          "w-full min-h-[3rem] bg-secondary/40 border border-border rounded-xl px-4 py-3 text-base font-medium text-foreground placeholder:font-normal placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:bg-card transition-colors",
          uppercase && "uppercase",
          className,
        )}
      />
    );
  },
);

ControlledInput.displayName = "ControlledInput";

interface ControlledTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string;
  onValueChange: (value: string) => void;
  uppercase?: boolean;
}

export const ControlledTextarea = memo(
  ({
    value,
    onValueChange,
    uppercase = false,
    className,
    onBlur,
    onChange,
    ...props
  }: ControlledTextareaProps) => {
    const [localValue, setLocalValue] = useState(value);

    useEffect(() => {
      setLocalValue(value);
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = uppercase ? e.target.value.toUpperCase() : e.target.value;
      setLocalValue(val);
      if (onChange) onChange(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
      if (localValue !== value) {
        onValueChange(localValue);
      }
      if (onBlur) onBlur(e);
    };

    return (
      <textarea
        {...props}
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        className={cn(
          "w-full bg-secondary/40 border border-border rounded-2xl px-4 py-4 text-base font-medium text-foreground placeholder:font-normal placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:bg-card leading-relaxed transition-colors",
          uppercase && "uppercase",
          className,
        )}
      />
    );
  },
);

ControlledTextarea.displayName = "ControlledTextarea";
