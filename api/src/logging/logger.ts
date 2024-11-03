import pino from 'pino';
import env from '~/utils/env';
import { clsProxify } from 'cls-proxify';

const targets: pino.TransportTargetOptions[] = [
  {
    target: 'pino/file',
    level: env.LOG_LEVEL,
    options: {},
  },
  {
    target: 'pino/file',
    level: 'info',
    options: { destination: env.LOG_PATH, mkdir: true },
  },
];

if (env.LOG_ENABLE_AXIOM) {
  targets.push({
    target: '@axiomhq/pino',
    level: 'info',
    options: { dataset: env.LOG_AXIOM_DATASET, token: env.LOG_AXIOM_TOKEN },
  });
}

const transport = pino.transport({ targets });

const unproxiedLogger = pino({
  level: env.LOG_LEVEL,
}, transport);

if (env.LOG_ENABLE_AXIOM) {
  unproxiedLogger.info('Axiom env detected, enabling...');
} else {
  unproxiedLogger.info('Running without Axiom enabled');
}

export default clsProxify(unproxiedLogger);
export {
  unproxiedLogger,
};
