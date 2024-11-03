export interface ErrorBody {
  status: number
}

function makeErrorCodes<T extends Record<string, ErrorBody>>(map: T): T {
  return map;
}

export const errorCode = makeErrorCodes({
  internal_server_error: {
    status: 500,
    message: 'An internal error occurred. The server cannot complete this request at this moment.',
  },

  unauthorized: {
    status: 401,
    message: 'You are not authorized to access this resource.',
  },
  forbidden: {
    status: 403,
    message: 'You are not authorized to access this resource.',
  },
  forbidden_creator_only: {
    status: 403,
    message: 'Only owners and administrators can modify resources created by other users.',
  },
  invalid_token: {
    status: 401,
    message: 'The OIDC token provided is invalid.',
  },
  invalid_credentials: {
    status: 401,
    message: 'The user credentials provided are invalid.',
  },
  federated_user_password: {
    status: 401,
    message: 'The user is federated and cannot be authenticated with a password.',
  },

  not_found: {
    status: 404,
    message: 'The requested resource was not found.',
  },
  route_not_found: {
    status: 404,
    message: 'The requested route does not exist.',
  },

  validation_error: {
    status: 400,
    message: 'The body or parameters of this request are invalid.',
  },
  invalid_body: {
    status: 400,
    message: 'The body of this request is invalid.',
  },

  user_exists: {
    status: 409,
    message: 'A user with this email or username already exists.',
  },
  user_has_encryption_keys: {
    status: 409,
    message: 'This user already has encryption keys.',
  },
  resource_exists: {
    status: 409,
    message: 'The requested resource already exists.',
  },
});

export type ErrorCode = keyof typeof errorCode;

export interface ErrorObject {
  code: ErrorCode
  message: string

  [key: string]: unknown
}

function getErrorObject(code: ErrorCode, replacements: Record<string, string> = {}): ErrorObject {
  return {
    code,
    message: getErrorMessage(code, replacements),
  };
}

function getErrorMessage(code: ErrorCode, replacements: Record<string, string> = {}) {
  return errorCode[code].message.replaceAll(
    /{{(\w+)}}/g,
    (_, key) => replacements[key] ?? 'unknown',
  );
}

export {
  getErrorObject,
  getErrorMessage,
};
