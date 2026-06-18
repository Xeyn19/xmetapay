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

type PasswordInputProps = Omit<ComponentProps<"input">, "type">

export function PasswordInput({ className, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false)
  const Icon = visible ? EyeOff : Eye

  return (
    <InputGroup className="h-auto min-h-12 border-zinc-200 bg-white focus-within:border-[#e64a19] focus-within:ring-4 focus-within:ring-[#e64a19]/10">
      <InputGroupInput
        {...props}
        type={visible ? "text" : "password"}
        className={className}
      />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
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
