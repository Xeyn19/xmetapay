"use client"

import { useState } from "react"
import type { ComponentProps } from "react"
import { Eye, EyeOff } from "lucide-react"

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { cn } from "@/lib/utils"

type PasswordInputProps = Omit<ComponentProps<"input">, "type">

export function PasswordInput({ className, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false)
  const Icon = visible ? EyeOff : Eye

  return (
    <InputGroup className="public-field h-auto min-h-12 focus-within:border-[#ff7043] focus-within:ring-4 focus-within:ring-[#ff7043]/10">
      <InputGroupInput
        {...props}
        type={visible ? "text" : "password"}
        className={cn("min-h-12", className)}
      />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="size-11 text-[var(--public-muted)] hover:bg-[#e64a19]/10 hover:text-[var(--public-text)]"
          size="icon-sm"
          type="button"
          onClick={() => setVisible((current) => !current)}
        >
          <Icon data-icon="inline-start" />
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  )
}
