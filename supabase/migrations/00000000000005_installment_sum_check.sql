-- Installment amounts for a plan can never sum to more than the plan's
-- total_amount — a genuine cross-row aggregate check, which a plain CHECK
-- constraint can't express (Postgres CHECK constraints can't reference
-- other rows of the same table). A BEFORE INSERT OR UPDATE trigger is the
-- correct tool here, per docs/gather_web_architecture.md's Business Rules
-- table. This is strictly better than the Salesforce trigger it replaces:
-- synchronous and unconditional, no async rollup-recalculation lag.

create or replace function public.check_installment_sum_within_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  plan_total numeric(12, 2);
  other_installments_sum numeric(12, 2);
begin
  select total_amount into plan_total
  from public.payment_plans
  where id = new.payment_plan_id;

  -- Excludes the row being updated (if any) so re-saving an installment at
  -- its own existing amount doesn't double-count it against itself.
  select coalesce(sum(amount), 0) into other_installments_sum
  from public.payment_installments
  where payment_plan_id = new.payment_plan_id
    and id != new.id;

  if other_installments_sum + new.amount > plan_total then
    raise exception 'Installment total (%) would exceed the payment plan total (%)',
      other_installments_sum + new.amount, plan_total;
  end if;

  return new;
end;
$$;

create trigger payment_installments_check_sum
  before insert or update on public.payment_installments
  for each row execute function public.check_installment_sum_within_plan();
