"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { addSocialLink, type SocialLinkFormState } from "./actions";

const initialState: SocialLinkFormState = {};

export function AddSocialLinkForm({ vendorId }: { vendorId: string }) {
  const [state, formAction, pending] = useActionState(addSocialLink, initialState);

  return (
    <Card className="flex flex-col gap-3">
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="vendorId" value={vendorId} />
        <Input name="platform" placeholder="Platform (e.g. Instagram, TikTok)" required />
        <Input name="url" type="url" placeholder="https://…" required />
        {state.error && <p className="text-sm font-semibold text-primary">{state.error}</p>}
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Adding…" : "Add link"}
        </Button>
      </form>
    </Card>
  );
}
