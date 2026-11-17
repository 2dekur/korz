import * as RadixSwitch from "@radix-ui/react-switch";

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id?: string;
}

export function Switch({ checked, onCheckedChange, id }: SwitchProps) {
  return (
    <RadixSwitch.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      className="relative h-[22px] w-[38px] shrink-0 cursor-pointer rounded-full bg-white/[0.12] transition-colors duration-200 data-[state=checked]:bg-accent"
    >
      <RadixSwitch.Thumb className="block size-[18px] translate-x-[2px] rounded-full bg-fg shadow-[0_1px_3px_rgb(0_0_0/0.4)] transition-transform duration-200 will-change-transform data-[state=checked]:translate-x-[18px] data-[state=checked]:bg-bg" />
    </RadixSwitch.Root>
  );
}
