import logger from '~/logging/logger.js';
import { errorHandler, notFoundHandler, validatorCompiler } from '~/utils/handlers.js';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import closeWithGrace from 'close-with-grace';
import Fastify, { FastifyListenOptions } from 'fastify';
import app from '~/app.js';
import env from '~/utils/env.js';

const fastify = Fastify({
  logger: {
    enabled: false,
  },
  ajv: {
    customOptions: {
      coerceTypes: false,
    },
  },
}).withTypeProvider<TypeBoxTypeProvider>();

fastify.register(app);

fastify.setErrorHandler(errorHandler);
fastify.setNotFoundHandler(notFoundHandler);
fastify.setValidatorCompiler(validatorCompiler);

const closeListeners = closeWithGrace(
  { delay: 500 },
  async function ({ signal, err, manual }) {
    if (err) {
      logger.error(err, 'Server is shutting down with errors');
    }
    await fastify.close();
  }
);

fastify.addHook('onClose', (instance, done) => {
  closeListeners.uninstall();
  done();
});

const opts: FastifyListenOptions = {
  port: env.PORT,
};
fastify.listen(opts, async (err) => {
  if (err) {
    logger.error(err, 'Server is shutting down with errors');
    process.exit(1);
  }
  logger.info(`Server listening on ${env.PORT}`);
});