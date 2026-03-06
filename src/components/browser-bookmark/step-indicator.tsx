"use client";

import { IMPORT_DIALOG_STEPS, IMPORT_STEP_NAMES } from "@/lib/browser-bookmark";
import type { ImportDialogStep } from "@/lib/browser-bookmark";

interface StepIndicatorProps {
  currentStep: ImportDialogStep;
}

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  const steps = [
    IMPORT_DIALOG_STEPS.UPLOAD,
    IMPORT_DIALOG_STEPS.PREVIEW,
    IMPORT_DIALOG_STEPS.OPTIONS,
    IMPORT_DIALOG_STEPS.IMPORT,
  ];

  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {steps.map((step, index) => (
        <div key={step} className="flex items-center">
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${
              step === currentStep
                ? "bg-primary text-primary-foreground"
                : step < currentStep
                  ? "bg-primary/20 text-primary"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {step}
          </div>
          <span
            className={`ml-2 text-sm hidden sm:inline ${
              step === currentStep ? "font-medium" : "text-muted-foreground"
            }`}
          >
            {IMPORT_STEP_NAMES[step]}
          </span>
          {index < steps.length - 1 && (
            <div className="w-8 h-px bg-muted mx-2" />
          )}
        </div>
      ))}
    </div>
  );
}
