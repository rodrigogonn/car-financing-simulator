import { z } from 'zod';

export const zSimulationInput = z.object({
  customerCpf: z.string().min(11),
  customerPhone: z.string().min(8),
  customerBirthDate: z.string().min(8), // dd/mm/yyyy
  licensingState: z.string().min(2).max(2),
  plate: z.string().min(5),
  vehiclePrice: z.number().positive(),
  desiredDownPayment: z.number().nonnegative(),
});
export type SimulationInput = z.infer<typeof zSimulationInput>;

export const zFinancingPlan = z.object({
  label: z.string(),
});
export type FinancingPlan = z.infer<typeof zFinancingPlan>;

export enum ScenarioType {
  REQUESTED = 'requested',
  SUGGESTED = 'suggested',
  MINIMUM = 'minimum',
  MAXIMUM = 'maximum',
}

export const zSimpleSimulation = z.object({
  vehiclePrice: z.number(),
  downPayment: z.number(),
  downPaymentIndicator: z.nativeEnum(ScenarioType),
  plans: z.array(zFinancingPlan),
});
export type SimpleSimulation = z.infer<typeof zSimpleSimulation>;

export const zScenario = z.object({
  type: z.nativeEnum(ScenarioType),
  data: zSimpleSimulation,
});
export type Scenario = z.infer<typeof zScenario>;

export const zSimulationResult = z.object({
  approved: z.boolean(),
  scenarios: z.array(zScenario),
  reason: z.string().optional(),
  elapsedMs: z.number().int().nonnegative(),
});
export type SimulationResult = z.infer<typeof zSimulationResult>;

export const zCreateSimulationRequest = z.object({
  input: zSimulationInput,
  callbackUrl: z.string().url(),
});
export type CreateSimulationRequest = z.infer<typeof zCreateSimulationRequest>;

export const zCreateSimulationAccepted = z.object({
  id: z.string(),
  status: z.literal('queued'),
});
export type CreateSimulationAccepted = z.infer<
  typeof zCreateSimulationAccepted
>;

export const zCallbackPayload = z.object({
  id: z.string(),
  status: z.enum(['succeeded', 'failed']),
  result: zSimulationResult.optional(),
  error: z
    .object({
      message: z.string(),
    })
    .optional(),
});
export type CallbackPayload = z.infer<typeof zCallbackPayload>;
