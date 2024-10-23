import {describe, it, expect, afterEach, beforeEach} from 'vitest'
import fs from "node:fs";
import {
  createPhp,
  runPhpCode,
  assertOutput,
  rootPath,
  setupFixturePaths,
  cleanupFixturePaths,
  writeFlavorTxt,
  copyArtifactFixture,
  createCgiPhp,
  doRequest,
  writeInstallParams,
  copyExistingBuildFixture, assertSitesDefaultDirectoryPermissions
} from './utils'

async function testInstall(php, stdOut, stdErr,persistFixturePath, configFixturePath, siteName) {
  expect(fs.existsSync(`${persistFixturePath}/drupal`)).toBe(true)

  await runPhpCode(php, rootPath + '/public/assets/install-site.phpcode')
  const lastMessage = stdOut.pop().trim();
  expect(lastMessage).toEqual('{"message":"Performing install task (14 \\/ 14)","type":"install"}')
  assertOutput(stdErr, '')
  stdOut.length = 0;

  await runPhpCode(php, rootPath + '/public/assets/login-admin.phpcode')
  const loginOutput = JSON.parse(stdOut.join('').trim());
  expect(loginOutput).toHaveProperty('type')
  expect(loginOutput.type).toStrictEqual('set_cookie')
  expect(loginOutput).toHaveProperty('params')
  expect(loginOutput.params).toHaveProperty('name')
  expect(loginOutput.params).toHaveProperty('id')
  assertOutput(stdErr, '')
  stdOut.length = 0;

  assertSitesDefaultDirectoryPermissions(persistFixturePath)

  const [cgiOut, cgiErr, phpCgi] = createCgiPhp({ configFixturePath, persistFixturePath });
  phpCgi.cookies.set(loginOutput.params.name, loginOutput.params.id)

  const [, text] = await doRequest(phpCgi, '/cgi/drupal')
  assertOutput(cgiOut, 'GET /cgi/drupal 200')
  assertOutput(cgiErr, '')

  // Verify custom site title.
  expect(text).toContain(`<title>Home | ${siteName}</title>`)
  // Verify CSS/JS aggregation turned off
  expect(text).toContain('cgi/drupal/core/themes/olivero/css')
  expect(text).toContain('cgi/drupal/core/themes/olivero/js')
  // Verify default content on homepage
  expect(text).toContain('Starshot: a journey beyond the horizon')
  // Verify user is logged in.
  expect(text).toContain('/cgi/drupal/user/logout')

  // Test OutgoingHttpInterceptor doesn't crash when fetching PSAs.
  const [, configText] = await doRequest(phpCgi, '/cgi/drupal/admin/config');
  expect(configText).not.toContain('Request URI not mocked: https://updates.drupal.org/psa.json')
}

describe('install-site.phpcode', {timeout: 270000}, () => {
  beforeEach(setupFixturePaths)
  afterEach(cleanupFixturePaths)

  it('installs the site from the artifact', async ({ configFixturePath, persistFixturePath }) => {
    writeFlavorTxt(configFixturePath, 'drupal')
    writeInstallParams(configFixturePath, {
      langcode: 'en',
      installType: 'automated',
      siteName: 'DXPR CMS Test',
      host: globalThis.location.host,
    })
    copyArtifactFixture(persistFixturePath, 'trial.zip')

    const [stdOut, stdErr, php] = await createPhp({ configFixturePath, persistFixturePath })

    await runPhpCode(php, rootPath + '/public/assets/init.phpcode')
    expect(stdOut.pop().trim()).toStrictEqual('{"message":"Unpacking files 100%","type":"unarchive"}')
    assertOutput(stdErr, '')
    stdOut.length = 0;

    await testInstall(php, stdOut, stdErr, persistFixturePath, configFixturePath, 'DXPR CMS Test')
  })
  it.skipIf(!fs.existsSync(`${rootPath}/build`))('install-site from source [debug job]', async ({ configFixturePath, persistFixturePath }) => {
    writeFlavorTxt(configFixturePath, 'drupal')
    writeInstallParams(configFixturePath, {
      langcode: 'en',
      installType: 'automated',
      siteName: 'test install',
      host: globalThis.location.host,
    })
    copyExistingBuildFixture(persistFixturePath)

    const [stdOut, stdErr, php] = await createPhp({ configFixturePath, persistFixturePath })
    await testInstall(php, stdOut, stdErr, persistFixturePath, configFixturePath, 'test install')
  })
})
