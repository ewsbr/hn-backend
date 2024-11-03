import { Static } from '@fastify/type-provider-typebox';
import { TSchema } from '@sinclair/typebox';
import Ajv, { ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import _ from 'lodash';

// Why don't ajv and typebox have this?
const ajv = new Ajv({
  allErrors: true,
  removeAdditional: true,
  useDefaults: true,
  coerceTypes: true,
  allowUnionTypes: true,
  addUsedSchema: false,
});
addFormats(ajv);

type ValidationResult<T> = {
  success: false;
  error: CustomValidationError;
} | {
  success: true;
  data: T;
}

class CustomValidationError extends Error {
  constructor(public errors?: ErrorObject[] | null, cause: any = null) {
    super('Validation error');
    this.name = 'CustomValidationError';
    this.cause = cause;
  }
}

function parse<S extends TSchema>(schema: S, object: any): Static<S> {
  const validate = ajv.compile(schema);
  const data = _.cloneDeep(object);
  if (!validate(data)) {
    throw new CustomValidationError(validate.errors);
  }
  return data;
}

function safeParse<S extends TSchema>(schema: S, object: any): ValidationResult<Static<S>> {
  const validate = ajv.compile(schema);
  const data = _.cloneDeep(object);
  if (!validate(data)) {
    return {
      success: false,
      error: new CustomValidationError(validate.errors),
    };
  }
  return {
    success: true,
    data: data,
  };
}

export {
  ajv,
  parse,
  safeParse,
  CustomValidationError,
};