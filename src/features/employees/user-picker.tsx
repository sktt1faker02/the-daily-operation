/**
 * Searchable "Entra User" picker for the employee form. Lists active environment
 * users; selecting one links the employee to that login (and, in the form,
 * prefills their name/email). Presentation only — the list and selection are
 * driven by props.
 */
import { useMemo, useState } from "react"
import { Check, ChevronsUpDown, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { EnvironmentUser } from "./user-service"

export function UserPicker({
  users,
  value,
  onSelect,
  isLoading,
}: {
  users: EnvironmentUser[]
  /** Selected systemuser id, or "" when unlinked. */
  value: string
  /** Called with the chosen user, or null when cleared. */
  onSelect: (user: EnvironmentUser | null) => void
  isLoading?: boolean
}) {
  const [open, setOpen] = useState(false)
  const selected = useMemo(
    () => users.find((u) => u.systemuserid === value) ?? null,
    [users, value],
  )

  const label = selected
    ? (selected.fullname ?? selected.internalemailaddress ?? "Selected user")
    : "Link an environment user…"

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="flex-1 min-w-0 justify-between font-normal"
          >
            <span className={`truncate ${selected ? "" : "text-muted-foreground"}`}>{label}</span>
            {isLoading ? (
              <Loader2 className="size-4 shrink-0 animate-spin opacity-50" aria-hidden />
            ) : (
              <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command
            filter={(itemValue, search) =>
              itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
            }
          >
            <CommandInput placeholder="Search by name or email…" />
            <CommandList>
              <CommandEmpty>No matching users.</CommandEmpty>
              <CommandGroup>
                {users.map((user) => {
                  const name = user.fullname ?? user.internalemailaddress ?? user.systemuserid
                  const email = user.internalemailaddress ?? user.domainname ?? ""
                  return (
                    <CommandItem
                      key={user.systemuserid}
                      value={`${name} ${email}`}
                      onSelect={() => {
                        onSelect(user)
                        setOpen(false)
                      }}
                    >
                      <Check
                        className={`size-4 ${user.systemuserid === value ? "opacity-100" : "opacity-0"}`}
                        aria-hidden
                      />
                      <div className="flex flex-col">
                        <span>{name}</span>
                        {email && <span className="text-xs text-muted-foreground">{email}</span>}
                      </div>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selected && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => onSelect(null)}
          aria-label="Unlink user"
        >
          <X className="size-4" aria-hidden />
        </Button>
      )}
    </div>
  )
}
