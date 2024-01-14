import * as core from '@actions/core';

import os from 'os';

import * as auth from './authutil';
import * as path from 'path';
import {restoreCache} from './cache-restore';
import {isCacheFeatureAvailable} from './cache-utils';
import {getNodejsDistribution} from './distributions/installer-factory';
import {getNodeVersionFromFile, printEnvDetailsAndSetOutput} from './util';
import {State} from './constants';

export async function run() {
  try {
    core.info('15');
    //
    // Version is optional.  If supplied, install / use from the tool cache
    // If not supplied then task is still used to setup proxy, auth, etc...
    //
    const version = resolveVersionInput();

    core.info('22');
    let arch = core.getInput('architecture');
    core.info('24');

    const cache = core.getInput('cache');
    core.info('27');

    // if architecture supplied but node-version is not
    // if we don't throw a warning, the already installed x64 node will be used which is not probably what user meant.
    if (arch && !version) {
      core.warning(
        '`architecture` is provided but `node-version` is missing. In this configuration, the version/architecture of Node will not be changed. To fix this, provide `architecture` in combination with `node-version`'
      );
    }
    core.info('36');

    if (!arch) {
      arch = os.arch();
    }
    core.info('42');

    if (version) {
      const token = core.getInput('token');
      const auth = !token ? undefined : `token ${token}`;
      const stable =
        (core.getInput('stable') || 'true').toUpperCase() === 'TRUE';
      const checkLatest =
        (core.getInput('check-latest') || 'false').toUpperCase() === 'TRUE';
      const nodejsInfo = {
        versionSpec: version,
        checkLatest,
        auth,
        stable,
        arch
      };
      const nodeDistribution = getNodejsDistribution(nodejsInfo);
      await nodeDistribution.setupNodeJs();
    }
    core.info('61');

    await printEnvDetailsAndSetOutput();
    core.info('64');

    const registryUrl: string = core.getInput('registry-url');
    const alwaysAuth: string = core.getInput('always-auth');
    if (registryUrl) {
      auth.configAuthentication(registryUrl, alwaysAuth);
    }
    core.info('71');

    if (cache && isCacheFeatureAvailable()) {
      core.saveState(State.CachePackageManager, cache);
      core.info('75');

      const cacheDependencyPath = core.getInput('cache-dependency-path');
      core.info('78');

      await restoreCache(cache, cacheDependencyPath);
    }
    core.info('82');

    const matchersPath = path.join(__dirname, '../..', '.github');
    core.info(`##[add-matcher]${path.join(matchersPath, 'tsc.json')}`);
    core.info(
      `##[add-matcher]${path.join(matchersPath, 'eslint-stylish.json')}`
    );
    core.info(
      `##[add-matcher]${path.join(matchersPath, 'eslint-compact.json')}`
    );

    core.info('92');
    core.info('process about to exist');
    process.exit(0);
  } catch (err) {
    core.setFailed((err as Error).message);
  }
}

function resolveVersionInput(): string {
  let version = core.getInput('node-version');
  const versionFileInput = core.getInput('node-version-file');

  if (version && versionFileInput) {
    core.warning(
      'Both node-version and node-version-file inputs are specified, only node-version will be used'
    );
  }

  if (version) {
    return version;
  }

  if (versionFileInput) {
    const versionFilePath = path.join(
      process.env.GITHUB_WORKSPACE!,
      versionFileInput
    );

    const parsedVersion = getNodeVersionFromFile(versionFilePath);

    if (parsedVersion) {
      version = parsedVersion;
    } else {
      core.warning(
        `Could not determine node version from ${versionFilePath}. Falling back`
      );
    }

    core.info(`Resolved ${versionFileInput} as ${version}`);
  }

  return version;
}
