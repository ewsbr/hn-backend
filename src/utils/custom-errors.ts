import _ from 'lodash';
import { type ErrorCode, errorCode, getErrorMessage } from '~/constants/error-code';

class HttpError extends Error {
  public code: string;
  public cause: any;
  public statusCode: number;
  public details: unknown;

  protected constructor(code: ErrorCode, cause?: unknown, customMessage?: string, details?: unknown) {
    const {
      status,
    } = errorCode[code];

    const replacements: Record<string, string> = _.isObject(details) ? details as Record<string, string> : {};
    super(customMessage ?? getErrorMessage(code, replacements));
    this.code = code;
    this.cause = cause;
    this.statusCode = status;
    this.details = details;
  }

  public static of({
    code,
    cause,
    customMessage,
    details,
  }: {
    code: ErrorCode
    cause?: unknown
    customMessage?: string
    details?: unknown
  }) {
    return new HttpError(code, cause, customMessage, details);
  }

  public static get(code: ErrorCode) {
    return new HttpError(code);
  }
}

const HttpErrors = {
  notFound: (resource: string, alias: string | number) => HttpError.of({
    code: 'not_found',
    details: {
      resource,
      alias,
    },
  }),
  forbidden: (resource: string, alias: string, validRoles?: string[] | undefined) => HttpError.of({
    code: 'forbidden',
    details: {
      resource,
      alias,
      role_required: validRoles,
    },
  }),
} as const;

export {
  HttpError,
  HttpErrors,
};
