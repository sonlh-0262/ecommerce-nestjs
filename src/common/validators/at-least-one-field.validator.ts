import { isObject, ValidateBy, ValidationOptions } from 'class-validator';

export const AT_LEAST_ONE_FIELD = 'atLeastOneField';

export function hasDefinedField(value: object): boolean {
  return Object.values(value).some((field) => field !== undefined);
}

export const AtLeastOneField = (validationOptions?: ValidationOptions) =>
  ValidateBy(
    {
      name: AT_LEAST_ONE_FIELD,
      validator: {
        validate: (value: unknown) =>
          !isObject(value) || hasDefinedField(value),
      },
    },
    validationOptions,
  );
