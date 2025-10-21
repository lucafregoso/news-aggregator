import { validate, ValidationError } from 'class-validator';

export async function validateInput<T extends object>(input: T): Promise<ValidationError[]> {
  return await validate(input);
}

export function formatValidationErrors(errors: ValidationError[]): string[] {
  return errors.flatMap((error) =>
    error.constraints ? Object.values(error.constraints) : []
  );
}
