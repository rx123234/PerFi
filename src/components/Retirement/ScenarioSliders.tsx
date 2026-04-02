import { Slider } from "@/components/ui/slider";
import type { RetirementProfile } from "@/lib/types";

interface ScenarioSlidersProps {
  profile: RetirementProfile;
  onUpdate: (overrides: Partial<RetirementProfile>) => void;
}

function formatDollars(value: number): string {
  return `$${value.toLocaleString("en-US")}/mo`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatAge(value: number): string {
  return `Age ${value}`;
}

function formatRetirementAge(value: number): string {
  return `${value} yrs`;
}

export default function ScenarioSliders({ profile, onUpdate }: ScenarioSlidersProps) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
          What-If Scenarios
        </p>
        <div className="space-y-5">
          <Slider
            min={50}
            max={80}
            step={1}
            value={profile.retirement_age}
            onChange={(v) => onUpdate({ retirement_age: v })}
            label="Retirement Age"
            formatValue={formatRetirementAge}
          />

          <Slider
            min={10}
            max={95}
            step={5}
            value={Math.round((1 - profile.retirement_spending_rate) * 100)}
            onChange={(v) => {
              // Savings rate = 1 - spending rate
              onUpdate({ retirement_spending_rate: (100 - v) / 100 });
            }}
            label="Savings Rate"
            formatValue={(v) => `${v}%`}
          />

          <Slider
            min={1}
            max={12}
            step={0.5}
            value={profile.pre_retirement_return * 100}
            onChange={(v) => onUpdate({ pre_retirement_return: v / 100 })}
            label="Expected Return"
            formatValue={formatPercent}
          />

          <Slider
            min={1}
            max={6}
            step={0.5}
            value={profile.inflation_rate * 100}
            onChange={(v) => onUpdate({ inflation_rate: v / 100 })}
            label="Inflation Rate"
            formatValue={formatPercent}
          />

          <Slider
            min={62}
            max={70}
            step={1}
            value={profile.ss_claiming_age}
            onChange={(v) => onUpdate({ ss_claiming_age: v })}
            label="SS Claiming Age"
            formatValue={formatAge}
          />

          <Slider
            min={0}
            max={5000}
            step={100}
            value={
              profile.ss_monthly_benefit_cents != null
                ? Math.round(profile.ss_monthly_benefit_cents / 100)
                : 0
            }
            onChange={(v) => onUpdate({ ss_monthly_benefit_cents: v * 100 })}
            label="SS Monthly Benefit"
            formatValue={formatDollars}
          />
        </div>
      </div>

      {/* Contextual note */}
      <p className="text-xs text-muted-foreground leading-relaxed">
        Adjusting these parameters reruns the Monte Carlo projection in real-time. Results reflect median outcomes across 1,000 simulated futures.
      </p>
    </div>
  );
}
