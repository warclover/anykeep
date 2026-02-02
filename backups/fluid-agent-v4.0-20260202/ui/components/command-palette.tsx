'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { commandMatcher, presetCommands } from '@/lib/fluid-agent';
import type { PresetCommand } from '@/lib/fluid-agent';

interface CommandPaletteProps {
  onCommandSelect?: (command: PresetCommand) => void;
}

export function CommandPalette({ onCommandSelect }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [commands, setCommands] = useState<PresetCommand[]>(presetCommands);

  // 监听快捷键
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(open => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // 搜索命令
  useEffect(() => {
    if (search) {
      const results = commandMatcher.getSuggestions(search, 10);
      setCommands(results);
    } else {
      setCommands(presetCommands);
    }
  }, [search]);

  const handleSelect = useCallback((command: PresetCommand) => {
    setOpen(false);
    setSearch('');
    onCommandSelect?.(command);
  }, [onCommandSelect]);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setSearch('');
    }
  };

  return (
    <CommandDialog open={open} onOpenChange={handleOpenChange}>
      <CommandInput
        placeholder="输入命令..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>未找到匹配的命令</CommandEmpty>
        <CommandGroup heading="快捷命令">
          {commands.map(command => (
            <CommandItem
              key={command.id}
              value={command.id}
              onSelect={() => handleSelect(command)}
            >
              <span className="mr-3 text-xl">{command.icon}</span>
              <div className="flex flex-col">
                <span>{command.name}</span>
                <span className="text-xs text-muted-foreground">
                  {command.description}
                </span>
              </div>
              {command.requiresSelection && (
                <span className="ml-auto text-xs text-muted-foreground">
                  需选中
                </span>
              )}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
