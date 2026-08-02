// components/modals/ImportarCobranzasModalSuccess.tsx
import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

interface Props {
  open: boolean;
  title?: string;
  message: string;
  onClose: () => void;
}

export function ImportarCobranzasModalSuccess({
  open,
  title = "Operación exitosa",
  message,
  onClose,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <DialogTitle>{title}</DialogTitle>
          </div>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={onClose}>Aceptar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
