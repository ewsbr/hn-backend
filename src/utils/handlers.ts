import { FastifyRouteSchemaDef, FastifySchema } from 'fastify/types/schema';
import { ErrorCode, getErrorMessage, getErrorObject } from '~/constants/error-code';
import logger from '~/logging/logger';
import { HttpError } from '~/utils/custom-errors';
import env from '~/utils/env';
import { CustomValidationError } from '~/utils/validation';
import Ajv, { ValidationError } from 'ajv';
import { FastifyReply, FastifyRequest } from 'fastify';

const DISPLAY_CAUSE_ENVIRONMENTS = ['test', 'development'];

function errorHandler(error: any, req: FastifyRequest, reply: FastifyReply) {
  if (error.code === 'FST_ERR_CTP_INVALID_JSON_BODY') {
    return reply.status(400).send({
      error: {
        ...getErrorObject('invalid_body'),
        details: {
          message: error.message,
        },
      },
    });
  }

  const shouldDisplayCause = DISPLAY_CAUSE_ENVIRONMENTS.includes(env.NODE_ENV);
  if (error instanceof HttpError) {
    const {
      code,
      statusCode,
      message,
      details,
      cause,
    } = error;

    if (statusCode >= 500) {
      logger.error(cause, `An unexpected error occurred in request ${req.meta.requestId}`);
    }

    return reply.status(statusCode).send({
      error: {
        code,
        message: message ?? 'No message provided',
        details,
        ...shouldDisplayCause && { cause },
      },
    });
  }

  if (error instanceof ValidationError || error.code === 'FST_ERR_VALIDATION') {
    return reply.status(400).send({
      error: {
        ...getErrorObject('validation_error'),
        validation: error.validation ?? {},
      },
    });
  }

  if (error instanceof CustomValidationError) {
    return reply.status(400).send({
      error: {
        ...getErrorObject('validation_error'),
        validation: error.errors,
      },
    });
  }

  if (error.name === 'FastifyError') {
    return reply.status(error.statusCode).send({
      error: {
        code: error.code,
        message: error.message,
      },
    });
  }

  logger.error(error, `An uncaught error was thrown in request ${req.meta.requestId}`);
  return reply.status(500).send({
    error: {
      code: 'internal_server_error' satisfies ErrorCode,
      message: shouldDisplayCause ? error.message : getErrorMessage('internal_server_error'),
      ...shouldDisplayCause && { cause: error },
    },
  });
}

function notFoundHandler(req: FastifyRequest, reply: FastifyReply) {
  reply.status(404).send({
    error: {
      ...getErrorObject('not_found'),
      details: {
        resource: 'route',
        alias: req.url,
      },
    },
  });
}

const coercingAjv = new Ajv({
  removeAdditional: false,
  coerceTypes: true,
  allErrors: true
});

const nonCoercingAjv = new Ajv({
  removeAdditional: false,
  coerceTypes: false,
  allErrors: true
});

const schemaCompilers = {
  body: nonCoercingAjv,
  params: coercingAjv,
  querystring: coercingAjv,
  headers: coercingAjv,
} as const;

function validatorCompiler(routeSchema: FastifyRouteSchemaDef<FastifySchema>) {
  if (!routeSchema.httpPart) {
    throw new Error('Missing httpPart')
  }
  const compiler = schemaCompilers[routeSchema.httpPart as keyof typeof schemaCompilers]
  if (!compiler) {
    throw new Error(`Missing compiler for ${routeSchema.httpPart}`)
  }
  return compiler.compile(routeSchema.schema)
}

export { errorHandler, notFoundHandler, validatorCompiler };